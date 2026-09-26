"""The reasoning step: asking a model what a good social-media manager would do.

Three rules shape this module.

**The model advises, it does not command.** Everything that comes back is
parsed strictly and checked against the deterministic rules again before it can
act. A model that returns `publish_image_post` when the daily limit is spent
gets refused, not executed. See policies.validate.

**The model is never asked for facts it could invent.** It is given measured
performance numbers and asked to interpret them; it is never asked what the
engagement was. It is told what has recently been posted; it is not asked to
remember. Anything it cannot know, it is instructed to say it cannot know.

**Honest, not deceptive.** The Page is educational, so the content rules here
are strict: no invented scientific names, population figures, conservation
statuses or locations. And because the images are generated, the agent must
never imply a generated image is a photograph someone took.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from ..logging_config import get_logger
from ..services import ai as ai_service
from .policies import Decision
from .state import AgentState

log = get_logger(__name__)


class DecisionParseError(ValueError):
    """The model did not return something usable."""


@dataclass(slots=True)
class ModelDecision:
    decision: Decision
    reason: str
    confidence: float = 0.5
    priority: str = "normal"
    topic: str | None = None
    animal: str | None = None
    caption: str | None = None
    visual_prompt: str | None = None
    wait_minutes: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CommentJudgement:
    comment_id: str
    classification: str
    action: str           # reply | ignore | flag
    confidence: float
    reply: str | None = None
    reason: str = ""


VALID_CLASSIFICATIONS = {
    "positive", "compliment", "question", "information_request", "negative",
    "criticism", "spam", "abuse", "hate", "sensitive", "unclear",
}

#: Classifications the agent must never answer on its own. A wrong reply about
#: politics or medicine under a wildlife post is a public liability, and an
#: argument with an abusive commenter is one the Page cannot win.
NEVER_AUTO_REPLY = {"sensitive", "abuse", "hate", "negative", "unclear"}

#: Classifications that are simply dropped. Replying to spam rewards it.
ALWAYS_IGNORE = {"spam"}


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
_MANAGER_SYSTEM = """\
You are the social media manager for a Facebook Page about wildlife and nature.
You decide what the Page should do next, like an experienced human manager.

Your goal is healthy, steady growth of a Page people trust — NOT maximum
posting. Doing nothing is very often the right answer, and choosing it when
nothing is needed is a sign you are doing the job well, not badly.

Reply with ONE JSON object and nothing else. No markdown, no commentary.

Rules you must not break:
- Choose only from the decisions you are offered. Never invent one.
- Never claim a fact you are not sure of. No invented scientific names,
  population numbers, conservation statuses, locations or statistics.
- Prefer a subject you are confident about over an impressive-sounding one.
- Do not repeat a topic or animal that appears in the recent lists.
- Never write as if you personally saw, photographed or experienced anything.
- Images on this Page are AI-generated. Never describe one as a photograph,
  and never state where or when it was taken.

About formats: short narrated reels are how this Page reaches new people —
Facebook recommends reels to non-followers, and photo posts mostly reach
existing followers. When publish_reel is allowed and nothing more urgent is
waiting, it is usually the right choice. Image posts are quizzes, good for
getting existing followers to comment.
"""

_DECISION_SCHEMA = """\
{
  "decision": "<one of the allowed decisions>",
  "reason": "<one sentence, concrete, referencing the actual situation>",
  "confidence": <0.0-1.0>,
  "priority": "low" | "normal" | "high",
  "topic": "<short topic, only for a publishing decision>",
  "animal": "<the single main subject, or null>",
  "wait_minutes": <integer, only for the wait decision>
}"""


def build_decision_prompt(state: AgentState, allowed: frozenset[Decision]) -> str:
    """Everything the model needs, and nothing it does not.

    The observation comes from state.for_model(), which is an allowlist — so a
    field added to the state later cannot silently start being sent to a
    third-party provider.
    """
    observation = state.for_model()
    options = sorted(d.value for d in allowed)

    # Only when a reel is actually on offer: describing an option the rules
    # have ruled out invites the model to pick it and be refused.
    reel_step = (
        "5. If you choose publish_reel, pick a topic that works as a short "
        "narrated video: one surprising fact, a two-animal comparison, or the "
        "next entry in a numbered series already in the recent topics.\n"
        if Decision.PUBLISH_REEL in allowed else ""
    )

    return (
        f"Current situation:\n{json.dumps(observation, indent=2)}\n\n"
        f"Allowed decisions: {options}\n\n"
        "Consider, in this order:\n"
        "1. Is anyone waiting for a reply? People already engaged matter more "
        "than new content.\n"
        "2. Has the Page posted recently, and is that post still doing well? "
        "If so, posting again buries it.\n"
        "3. Would another post today be useful, or just noise?\n"
        "4. If you publish, what has NOT been covered recently?\n"
        f"{reel_step}\n"
        f"Respond with exactly this JSON shape:\n{_DECISION_SCHEMA}"
    )


_CONTENT_SYSTEM = """\
You write posts for a Facebook Page about wildlife and nature.

Voice: warm, curious, plain. Write for someone scrolling, not for a textbook.
No hashtag spam — at most two, and only if they genuinely fit.

Accuracy is not negotiable. This Page is educational, and a confident wrong
fact does real damage to it:
- State only things that are well established and that you are confident about.
- No invented numbers, scientific names, conservation statuses or locations.
- If a striking claim might be folklore rather than fact, do not use it.
- Prefer a simple true thing over an impressive uncertain one.

Never write in the first person as an observer. You did not see this animal,
did not take a photograph, and were not there.

Reply with ONE JSON object and nothing else.
"""


_QUIZ_BRIEF = """\
This post is a QUIZ. The image shows the animal; the caption asks one
question about it that has a single, well-established answer.

Caption layout, exactly:
  line 1: the question (one short sentence)
  lines 2-4: three options, "A) ...", "B) ...", "C) ..."
  line 5: "Comment your answer 👇"
  then a line containing only "."  repeated on five separate lines
  then: "✅ Answer: <letter>) <answer> — <one sentence explaining why>"

The dots push the answer below Facebook's "See more" fold, so people guess
before they see it. The question must be answerable from general knowledge,
and the explanation must be something you are sure of.

"""


def build_content_prompt(
    state: AgentState, *, topic: str | None, animal: str | None, want_image: bool,
    quiz: bool = False,
) -> str:
    recent = {
        "topics": state.recent_topics[:25],
        "animals": state.recent_animals[:25],
    }
    shape = {
        "topic": "<the specific topic covered>",
        "animal": "<main subject, or null>",
        "caption": ("<the quiz caption, laid out as described>" if quiz
                    else "<the post text, 40-90 words>"),
    }
    if want_image:
        shape["visual_prompt"] = (
            "<a description for an image generator: the animal, its posture, "
            "the habitat, lighting and framing. No text, no watermark, no "
            "human figures, no logos.>"
        )

    steer = ""
    if topic:
        steer = f"Write about: {topic}"
        if animal:
            steer += f" (subject: {animal})"
        steer += "\n\n"
    else:
        steer = (
            "Choose a wildlife subject that is NOT in the recent lists below.\n\n"
        )

    performance = ""
    if state.performance.is_meaningful and state.performance.top_topics:
        performance = (
            "These topics have measurably performed well on this Page "
            f"(real numbers, not estimates): "
            f"{json.dumps(state.performance.top_topics[:4])}\n"
            "Lean towards this kind of subject where it fits naturally.\n\n"
        )

    return (
        f"{_QUIZ_BRIEF if quiz else ''}{steer}{performance}"
        f"Do NOT repeat anything from these recent posts:\n"
        f"{json.dumps(recent, indent=2)}\n\n"
        f"Respond with exactly this JSON shape:\n{json.dumps(shape, indent=2)}"
    )


_REEL_SYSTEM = """\
You write scripts for short narrated vertical videos (Facebook Reels) on a
wildlife Page called The World Frame. English, for adults scrolling on a phone.

A reel is: a hook line over the opening shot, three to five beats (one
narrated line and one picture each), and a closing question. Spoken, it runs
20 to 40 seconds.

Choose one format:
- "facts": one surprising thing about one animal, unpacked beat by beat.
- "versus": two animals compared on ONE measurable thing (speed, bite, size,
  lifespan). Fair, factual, and say who comes out ahead and why.
- "series": the next entry in a numbered series, e.g. "Deadliest Animals #4"
  or "Animals You Didn't Know Existed #2". If the recent topics contain a
  series, continue it with the next number; otherwise start one at #1.

The hook is everything. It is the first thing heard, over the first picture,
and decides whether anyone stays. It must be a surprising claim that is TRUE,
in 12 words or fewer. Never a question like "Did you know...?".

Accuracy is not negotiable — this Page is educational:
- Only well-established facts you are confident about. If a striking claim
  might be folklore, drop it.
- No invented numbers. A figure is allowed only if it is widely documented,
  and then as a rounded, hedged value ("around 80 km/h", "up to 3 metres").
- Do not stretch a comparison. "As fast as a bullet" and "accelerates like a
  bullet" are different claims; use only the one that is true.
- No scientific names, conservation statuses or locations unless certain.

Choose animals an image generator draws recognisably: well-known, visually
distinctive species (tiger, octopus, bald eagle, chameleon, elephant,
peacock). Avoid obscure, microscopic or look-alike species — a viewer who
cannot tell the picture is the animal being described stops trusting the reel.

Each beat's `visual` describes ONE photorealistic still for an image
generator: name the animal and spell out its most distinctive visible
features (colours, markings, body shape), then what it is doing, the habitat,
the light, the framing. No text, no people, no logos. For "versus", each beat
shows the animal that line is about.

`hook_motion` describes five seconds of movement for a video model, starting
from the hook picture: what the animal does and how the camera moves. Keep it
natural and physically plausible — slow and real beats fast and strange.

Never write as if you filmed or saw anything. The visuals are AI-generated.

Reply with ONE JSON object and nothing else.
"""

_REEL_SHAPE = """\
{
  "format": "facts" | "versus" | "series",
  "topic": "<short topic; for a series, include its name and number>",
  "animal": "<main animal, or the two joined with ' vs '>",
  "hook_line": "<spoken first line, a true surprising claim, max 12 words>",
  "hook_visual": "<the opening still>",
  "hook_motion": "<five seconds of motion from that still>",
  "beats": [
    {"line": "<one narrated sentence, max 22 words>", "visual": "<its still>"}
  ],
  "question": "<closing question inviting a comment, max 14 words>",
  "caption": "<post text, 25-60 words: restate the hook, add one line, end with the question. No hashtags here.>",
  "hashtags": ["#animalfacts", "<3 to 5 specific tags in total>"]
}"""

#: Hard caps in words. Past these a line is not a caption-length line any
#: more, and the script is refused rather than cut mid-sentence.
_HOOK_MAX_WORDS = 18
_BEAT_MAX_WORDS = 32
_QUESTION_MAX_WORDS = 20
_REEL_FORMATS = {"facts", "versus", "series"}
_HASHTAG = re.compile(r"^#[A-Za-z][A-Za-z0-9_]{1,40}$")


def build_reel_prompt(state: AgentState, *, topic: str | None,
                      animal: str | None) -> str:
    recent = {
        "topics": state.recent_topics[:25],
        "animals": state.recent_animals[:25],
    }
    if topic:
        steer = f"Write a reel about: {topic}"
        if animal:
            steer += f" (subject: {animal})"
        steer += "\n\n"
    else:
        steer = "Choose a subject that is NOT in the recent lists below.\n\n"

    performance = ""
    if state.performance.is_meaningful and state.performance.top_topics:
        performance = (
            "These topics have measurably performed well on this Page "
            f"(real numbers): {json.dumps(state.performance.top_topics[:4])}\n\n"
        )

    return (
        f"{steer}{performance}"
        f"Do NOT repeat anything from these recent posts:\n"
        f"{json.dumps(recent, indent=2)}\n\n"
        f"Respond with exactly this JSON shape (3 to 5 beats):\n{_REEL_SHAPE}"
    )


def _words(text: str) -> int:
    return len(text.split())


def parse_reel_script(payload: dict[str, Any]):
    """Turn the model's object into a ReelScript, or refuse it.

    Strict about structure, because every field becomes something on screen or
    in someone's ear: a missing visual is a black scene, an overlong line is a
    caption nobody can read. Nothing is repaired — a script that fails here is
    a failed generation, and the agent does nothing this cycle.
    """
    from ..services.video.reel import Beat, ReelScript

    def text(key: str, limit: int = 1000) -> str:
        value = " ".join(str(payload.get(key) or "").split())
        if not value:
            raise DecisionParseError(f"reel script has no {key}")
        return value[:limit]

    fmt = str(payload.get("format") or "").strip().lower()
    if fmt not in _REEL_FORMATS:
        raise DecisionParseError(f"unknown reel format {fmt!r}")

    hook_line = text("hook_line", 300)
    if _words(hook_line) > _HOOK_MAX_WORDS:
        raise DecisionParseError("hook line is too long to work as a hook")

    raw_beats = payload.get("beats")
    if not isinstance(raw_beats, list) or not 3 <= len(raw_beats) <= 5:
        raise DecisionParseError("a reel needs 3 to 5 beats")
    beats = []
    for index, entry in enumerate(raw_beats):
        if not isinstance(entry, dict):
            raise DecisionParseError(f"beat {index} is not an object")
        line = " ".join(str(entry.get("line") or "").split())
        visual = " ".join(str(entry.get("visual") or "").split())
        if not line or not visual:
            raise DecisionParseError(f"beat {index} lacks a line or a visual")
        if _words(line) > _BEAT_MAX_WORDS:
            raise DecisionParseError(f"beat {index} is too long to narrate")
        beats.append(Beat(line=line[:400], visual=visual[:800]))

    question = text("question", 300)
    if _words(question) > _QUESTION_MAX_WORDS:
        raise DecisionParseError("closing question is too long")

    tags: list[str] = []
    for tag in payload.get("hashtags") or []:
        tag = str(tag).strip()
        if not tag.startswith("#"):
            tag = f"#{tag}"
        if _HASHTAG.match(tag) and tag.lower() not in {t.lower() for t in tags}:
            tags.append(tag)
    tags = tags[:5] or ["#animalfacts", "#wildlife"]

    animal = str(payload.get("animal") or "").strip()[:100] or None
    return ReelScript(
        format=fmt,
        topic=text("topic", 200),
        animal=animal,
        hook_line=hook_line,
        hook_visual=text("hook_visual", 800),
        hook_motion=text("hook_motion", 800),
        beats=beats,
        question=question,
        caption=text("caption", 1500),
        hashtags=tags,
    )


_FACT_SYSTEM = """\
You are a strict fact-checker for an educational wildlife Page. A script for a
short narrated video is about to be published to ten thousand people. Your
job is to stop anything false or exaggerated from reaching them.

Check every factual claim in the hook, each line, the question and the caption:
- Is it true, and well established — not folklore, not a popular myth?
- Is every number right and appropriately hedged ("around", "up to")?
- Is every comparison literally true? Watch for speed vs. acceleration,
  strength vs. strength-for-its-size, "the only" vs. "one of the few",
  and superlatives ("fastest", "deadliest", "largest") that are not settled.
- Does the caption say the same true things as the narration?

Then answer with one verdict:
- "ok": every claim holds as written.
- "fixed": something was wrong or overstated, and a true version keeps the
  reel working. Rewrite ONLY the lines that need it, keep the same number of
  beats, keep each line as short as the original, and keep the hook a
  surprising statement (not a question).
- "reject": the reel's central claim is false and no true version of it
  would still be interesting. Say why.

Reply with ONE JSON object and nothing else.
"""

_FACT_SHAPE = """\
{
  "verdict": "ok" | "fixed" | "reject",
  "issues": ["<each problem found, one short sentence each; empty if ok>"],
  "hook_line": "<the hook, corrected if needed>",
  "beats": ["<line 1>", "<line 2>", "..."],
  "question": "<the closing question>",
  "caption": "<the caption, corrected if needed>"
}"""


def build_fact_check_prompt(script) -> str:
    payload = {
        "topic": script.topic,
        "animal": script.animal,
        "hook_line": script.hook_line,
        "beats": [b.line for b in script.beats],
        "question": script.question,
        "caption": script.caption,
    }
    return (
        f"Script to check:\n{json.dumps(payload, indent=2, ensure_ascii=False)}\n\n"
        f"Respond with exactly this JSON shape:\n{_FACT_SHAPE}"
    )


def apply_fact_check(script, payload: dict[str, Any]):
    """Apply the fact-checker's verdict to a script, or refuse it.

    Only the words change; the pictures do not, because a corrected line is
    still about the same animal doing the same thing. The corrected script
    goes back through parse_reel_script, so a "fix" that breaks the length or
    shape rules is refused exactly as a bad first draft would be.
    """
    verdict = str(payload.get("verdict") or "").strip().lower()
    issues = [str(i).strip()[:300] for i in (payload.get("issues") or []) if str(i).strip()]

    if verdict == "ok":
        script.fact_check = "checked: no issues"
        return script
    if verdict == "reject":
        reason = "; ".join(issues) or "no reason given"
        raise DecisionParseError(f"fact-check rejected the reel: {reason}"[:500])
    if verdict != "fixed":
        raise DecisionParseError(f"fact-check returned no usable verdict ({verdict!r})")

    lines = payload.get("beats")
    if not isinstance(lines, list) or len(lines) != len(script.beats):
        raise DecisionParseError("fact-check changed the number of beats")

    corrected = parse_reel_script({
        "format": script.format,
        "topic": script.topic,
        "animal": script.animal,
        "hook_line": payload.get("hook_line") or script.hook_line,
        "hook_visual": script.hook_visual,
        "hook_motion": script.hook_motion,
        "beats": [{"line": str(line), "visual": beat.visual}
                  for line, beat in zip(lines, script.beats)],
        "question": payload.get("question") or script.question,
        "caption": payload.get("caption") or script.caption,
        "hashtags": script.hashtags,
    })
    corrected.fact_check = "corrected: " + ("; ".join(issues) or "unspecified")
    return corrected


_COMMENT_SYSTEM = """\
You triage comments on a wildlife Facebook Page and decide which deserve a
reply from the Page.

The Page must not look automated. Replying to everything with "Thank you!" is
worse than replying to nothing: it is obvious, it is noise, and people notice.

Reply only where a reply genuinely adds something:
- a real question you can answer from the post itself
- a request for information you actually have
- a substantial comment worth a real response

Ignore: simple praise with nothing to answer, emoji-only comments, spam,
and anything already answered.

Flag for a human, and NEVER answer yourself: politics, religion, medical or
legal questions, threats, serious allegations, and anything sensitive or
ambiguous in a way that could go wrong.

Critical: answer only from the post context you are given. If a comment asks
where or when something was photographed, and you were not told, say plainly
that you do not have a confirmed location. Never invent one. The images on
this Page are AI-generated, so there often is no location to give.

Keep replies short — one or two sentences, in the commenter's language where
you can tell.

Reply with ONE JSON object and nothing else.
"""


def build_comment_prompt(comments: list[dict[str, Any]]) -> str:
    return (
        "Comments to triage:\n"
        f"{json.dumps(comments, indent=2, ensure_ascii=False)}\n\n"
        "Respond with exactly this shape:\n"
        '{\n'
        '  "judgements": [\n'
        '    {\n'
        '      "comment_id": "<id exactly as given>",\n'
        '      "classification": "positive|compliment|question|'
        'information_request|negative|criticism|spam|abuse|hate|sensitive|unclear",\n'
        '      "action": "reply|ignore|flag",\n'
        '      "confidence": <0.0-1.0>,\n'
        '      "reply": "<the reply text, or null if not replying>",\n'
        '      "reason": "<why, in a few words>"\n'
        '    }\n'
        '  ]\n'
        '}'
    )


# ---------------------------------------------------------------------------
# Strict parsing
# ---------------------------------------------------------------------------
def extract_json(text: str) -> dict[str, Any]:
    """Pull one JSON object out of a model response.

    Models wrap JSON in prose and fences however often they are asked not to,
    so this is tolerant about the wrapper and strict about the content. It does
    not repair malformed JSON: a response that cannot be parsed is a failed
    generation, and guessing at what it meant is how a half-parsed decision
    ends up publishing something.
    """
    if not text:
        raise DecisionParseError("empty response")

    candidate = text.strip()

    fence = re.search(r"```(?:json)?\s*(.+?)```", candidate, re.S)
    if fence:
        candidate = fence.group(1).strip()

    if not candidate.startswith("{"):
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise DecisionParseError("no JSON object in response")
        candidate = candidate[start:end + 1]

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise DecisionParseError(f"invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise DecisionParseError("response was not a JSON object")
    return parsed


def _clamp_confidence(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        # An unparseable confidence must not read as certainty.
        return 0.0


def parse_decision(payload: dict[str, Any], allowed: frozenset[Decision]) -> ModelDecision:
    """Turn the model's object into a decision, or refuse it."""
    raw_decision = str(payload.get("decision", "")).strip().lower()
    try:
        decision = Decision(raw_decision)
    except ValueError as exc:
        raise DecisionParseError(f"unknown decision {raw_decision!r}") from exc

    if decision not in allowed:
        raise DecisionParseError(
            f"{decision.value} was not offered; allowed were "
            f"{sorted(d.value for d in allowed)}"
        )

    reason = str(payload.get("reason") or "").strip()
    if not reason:
        reason = "no reason given"

    wait_minutes = payload.get("wait_minutes")
    try:
        wait_minutes = int(wait_minutes) if wait_minutes is not None else None
    except (TypeError, ValueError):
        wait_minutes = None
    if wait_minutes is not None:
        wait_minutes = max(1, min(720, wait_minutes))

    priority = str(payload.get("priority") or "normal").lower()
    if priority not in {"low", "normal", "high"}:
        priority = "normal"

    return ModelDecision(
        decision=decision,
        reason=reason[:500],
        confidence=_clamp_confidence(payload.get("confidence", 0.5)),
        priority=priority,
        topic=(str(payload["topic"]).strip()[:200]
               if payload.get("topic") else None),
        animal=(str(payload["animal"]).strip()[:100]
                if payload.get("animal") else None),
        wait_minutes=wait_minutes,
        raw=payload,
    )


def parse_comment_judgements(
    payload: dict[str, Any], *, known_ids: set[str], min_confidence: float
) -> list[CommentJudgement]:
    """Parse triage results, refusing anything unsafe.

    Enforced here rather than trusted from the model:
      * a judgement for a comment we did not ask about is dropped — that is
        either a hallucination or a prompt injection from comment text;
      * sensitive/abusive/unclear categories are forced to flag or ignore no
        matter what action the model chose;
      * spam is always ignored;
      * a reply below the confidence threshold is downgraded to no reply.
    """
    raw = payload.get("judgements")
    if not isinstance(raw, list):
        raise DecisionParseError("judgements was not a list")

    out: list[CommentJudgement] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        comment_id = str(entry.get("comment_id") or "").strip()
        if comment_id not in known_ids:
            log.warning("agent.comment_judgement_unknown_id", comment_id=comment_id[:40])
            continue

        classification = str(entry.get("classification") or "unclear").lower()
        if classification not in VALID_CLASSIFICATIONS:
            classification = "unclear"

        action = str(entry.get("action") or "ignore").lower()
        if action not in {"reply", "ignore", "flag"}:
            action = "ignore"

        confidence = _clamp_confidence(entry.get("confidence", 0))
        reply = entry.get("reply")
        reply = str(reply).strip() if reply else None

        # --- safety overrides, applied regardless of what the model said ---
        if classification in ALWAYS_IGNORE:
            action, reply = "ignore", None
        elif classification in NEVER_AUTO_REPLY:
            # Abuse and hate are dropped; genuinely sensitive things go to a
            # person. Either way the agent does not answer.
            action = "ignore" if classification in {"abuse", "hate"} else "flag"
            reply = None
        elif action == "reply":
            if not reply:
                action = "ignore"
            elif confidence < min_confidence:
                action = "ignore"
                reply = None

        out.append(CommentJudgement(
            comment_id=comment_id,
            classification=classification,
            action=action,
            confidence=confidence,
            reply=reply[:800] if reply else None,
            reason=str(entry.get("reason") or "")[:300],
        ))
    return out


# ---------------------------------------------------------------------------
# Calls
# ---------------------------------------------------------------------------
async def decide(state: AgentState, allowed: frozenset[Decision]) -> ModelDecision:
    """Ask the model what to do. Raises DecisionParseError on junk."""
    text = await ai_service.generate_for_system(
        prompt=build_decision_prompt(state, allowed),
        system=_MANAGER_SYSTEM,
        max_tokens=500,
        capability="agent_decision",
    )
    return parse_decision(extract_json(text), allowed)


async def draft_content(
    state: AgentState, *, topic: str | None, animal: str | None, want_image: bool,
    quiz: bool = False,
) -> dict[str, Any]:
    """Write the post. Returns caption, topic, animal and optional visual prompt."""
    text = await ai_service.generate_for_system(
        prompt=build_content_prompt(
            state, topic=topic, animal=animal, want_image=want_image, quiz=quiz,
        ),
        system=_CONTENT_SYSTEM,
        max_tokens=800,
        capability="agent_content",
    )
    payload = extract_json(text)

    caption = str(payload.get("caption") or "").strip()
    if not caption:
        raise DecisionParseError("no caption was produced")

    return {
        "topic": (str(payload.get("topic")).strip()[:200]
                  if payload.get("topic") else topic),
        "animal": (str(payload.get("animal")).strip()[:100]
                   if payload.get("animal") else animal),
        "caption": caption[:2000],
        "visual_prompt": (str(payload.get("visual_prompt")).strip()[:1000]
                          if payload.get("visual_prompt") else None),
    }


async def draft_reel(state: AgentState, *, topic: str | None, animal: str | None):
    """Write a reel script, then have it fact-checked.

    Two calls, deliberately. Told not to state false things, a writer still
    reached for "faster than a bullet" about the mantis shrimp — its strike
    accelerates like one, and is nowhere near as fast. A second pass whose
    only job is to doubt catches that class of error, and costs a fraction of
    a cent against a false claim in front of the whole Page.

    Raises DecisionParseError on anything unusable, including a rejection.
    """
    text = await ai_service.generate_for_system(
        prompt=build_reel_prompt(state, topic=topic, animal=animal),
        system=_REEL_SYSTEM,
        max_tokens=1500,
        capability="agent_content",
    )
    script = parse_reel_script(extract_json(text))

    verdict = await ai_service.generate_for_system(
        prompt=build_fact_check_prompt(script),
        system=_FACT_SYSTEM,
        max_tokens=1200,
        capability="agent_fact_check",
    )
    checked = apply_fact_check(script, extract_json(verdict))
    log.info("agent.reel_fact_check", topic=script.topic[:80],
             result=checked.fact_check[:300])
    return checked


async def triage_comments(
    comments: list[dict[str, Any]], *, min_confidence: float
) -> list[CommentJudgement]:
    """Classify comments and draft replies for the ones that deserve one."""
    if not comments:
        return []
    known = {str(c["comment_id"]) for c in comments}
    text = await ai_service.generate_for_system(
        prompt=build_comment_prompt(comments),
        system=_COMMENT_SYSTEM,
        max_tokens=1200,
        capability="agent_comments",
    )
    return parse_comment_judgements(
        extract_json(text), known_ids=known, min_confidence=min_confidence
    )
