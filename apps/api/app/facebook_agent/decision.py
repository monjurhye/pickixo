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

    return (
        f"Current situation:\n{json.dumps(observation, indent=2)}\n\n"
        f"Allowed decisions: {options}\n\n"
        "Consider, in this order:\n"
        "1. Is anyone waiting for a reply? People already engaged matter more "
        "than new content.\n"
        "2. Has the Page posted recently, and is that post still doing well? "
        "If so, posting again buries it.\n"
        "3. Would another post today be useful, or just noise?\n"
        "4. If you publish, what has NOT been covered recently?\n\n"
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


def build_content_prompt(
    state: AgentState, *, topic: str | None, animal: str | None, want_image: bool
) -> str:
    recent = {
        "topics": state.recent_topics[:25],
        "animals": state.recent_animals[:25],
    }
    shape = {
        "topic": "<the specific topic covered>",
        "animal": "<main subject, or null>",
        "caption": "<the post text, 40-90 words>",
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
        f"{steer}{performance}"
        f"Do NOT repeat anything from these recent posts:\n"
        f"{json.dumps(recent, indent=2)}\n\n"
        f"Respond with exactly this JSON shape:\n{json.dumps(shape, indent=2)}"
    )


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
    state: AgentState, *, topic: str | None, animal: str | None, want_image: bool
) -> dict[str, Any]:
    """Write the post. Returns caption, topic, animal and optional visual prompt."""
    text = await ai_service.generate_for_system(
        prompt=build_content_prompt(
            state, topic=topic, animal=animal, want_image=want_image
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
