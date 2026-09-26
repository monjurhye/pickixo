"""The loop.

    wake -> observe -> evaluate -> think -> decide -> act -> verify
         -> remember -> learn -> wait -> wake again

The scheduler's only job is the first word. It does not decide what gets
published, when, or whether anything does — it wakes this function, and this
function decides. That distinction is the difference between an agent and a
cron job with a prompt attached.

Every wake writes a run record, including the wakes where the answer was "do
nothing". Those rows are the only way to answer "why did it not post this
afternoon?", and an agent nobody can interrogate is an agent nobody will trust
to run unattended.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..config import Settings
from ..errors import AppError
from ..logging_config import get_logger
from ..services.facebook.errors import GraphFailure
from . import (actions, decision as reasoning, evaluator, observer,
               repository as repo)
from .policies import Decision, assess, validate
from .state import AgentState

log = get_logger(__name__)


class RunOutcome:
    """What one wake did. Returned for the dashboard and for tests."""

    def __init__(self) -> None:
        self.run_id: str | None = None
        self.decision: str = "do_nothing"
        self.reason: str = ""
        self.actions_taken: int = 0
        self.used_ai: bool = False
        self.error: str | None = None
        self.details: list[str] = []

    def note(self, message: str) -> None:
        self.details.append(message)

    def as_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "decision": self.decision,
            "reason": self.reason,
            "actions_taken": self.actions_taken,
            "used_ai": self.used_ai,
            "error": self.error,
            "details": self.details,
        }


async def run_once(
    *, page_uuid: str, settings: Settings, trigger: str = "scheduled",
    force_sync: bool = False,
) -> RunOutcome:
    """One complete cycle for one Page."""
    outcome = RunOutcome()
    state: AgentState | None = None

    page_row = await repo.get_page(page_uuid)
    if page_row is None:
        outcome.error = "page not found"
        return outcome

    settings_row = await repo.ensure_settings(page_uuid)
    run_id = await repo.start_run(page_uuid, trigger=trigger)
    outcome.run_id = run_id

    try:
        # --- observe ------------------------------------------------------
        await repo.set_run_state(run_id, "observing")
        state = await observer.observe(
            page_row=page_row,
            settings_row=settings_row,
            token_key=settings.facebook_token_key,
            graph_base_url=settings.graph_base_url,
            app_id=settings.meta_app_id,
            app_secret=settings.meta_app_secret,
            force_sync=force_sync,
        )
        outcome.note(
            f"observed: {len(state.recent_posts)} recent posts, "
            f"{len(state.unanswered_comments)} unanswered comment(s)"
        )

        # --- the cheap pass ------------------------------------------------
        await repo.set_run_state(run_id, "analyzing")
        verdict = assess(state)

        if not verdict.needs_reasoning:
            # Settled without spending anything. The common case.
            assert verdict.decision is not None
            outcome.decision = verdict.decision.value
            outcome.reason = verdict.reason
            await repo.record_decision(
                run_id=run_id, page_uuid=page_uuid,
                decision=verdict.decision.value, reason=verdict.reason,
                source="rules",
            )
            if verdict.decision is Decision.FLAG_FOR_REVIEW:
                log.warning("agent.flagged", page=page_uuid, reason=verdict.reason)
            await _finish(run_id, outcome, state, status="completed", state_name="idle")
            return outcome

        # --- think ----------------------------------------------------------
        await repo.set_run_state(run_id, "deciding")
        outcome.used_ai = True
        try:
            choice = await reasoning.decide(state, verdict.allowed)
        except (reasoning.DecisionParseError, AppError) as exc:
            # Two different problems, one correct response: do nothing this
            # cycle and say why.
            #
            #   * DecisionParseError — the model returned junk. Guessing at
            #     what it meant is how a half-parsed decision publishes.
            #   * AppError — usually no text provider is configured at all.
            #     An agent that cannot think must record that plainly rather
            #     than crash the run; a failed run looks like a broken agent,
            #     when the truth is a missing setting.
            outcome.decision = "do_nothing"
            if isinstance(exc, AppError):
                outcome.reason = (
                    "the agent could not think: no AI text provider is enabled "
                    "and configured"
                )
            else:
                outcome.reason = f"the reasoning step produced nothing usable ({exc})"
            log.warning("agent.decision_unusable", error=str(exc)[:200])
            await repo.record_decision(
                run_id=run_id, page_uuid=page_uuid, decision="do_nothing",
                reason=outcome.reason, source="model",
            )
            await _finish(run_id, outcome, state, status="completed", state_name="idle")
            return outcome

        outcome.decision = choice.decision.value
        outcome.reason = choice.reason

        # --- the rules get the last word -----------------------------------
        refusal = validate(choice.decision, state, verdict.allowed)
        if refusal:
            log.warning("agent.decision_refused", decision=choice.decision.value,
                        refusal=refusal)
            outcome.decision = "do_nothing"
            outcome.reason = f"the chosen action was refused: {refusal}"
            await repo.record_decision(
                run_id=run_id, page_uuid=page_uuid, decision="do_nothing",
                reason=outcome.reason, source="rules",
            )
            await _finish(run_id, outcome, state, status="completed", state_name="idle")
            return outcome

        await repo.record_decision(
            run_id=run_id, page_uuid=page_uuid, decision=choice.decision.value,
            reason=choice.reason, priority=choice.priority,
            confidence=choice.confidence, topic=choice.topic,
            payload={"animal": choice.animal, "wait_minutes": choice.wait_minutes},
            source="model",
        )

        # --- act -------------------------------------------------------------
        await _execute(
            choice=choice, state=state, page_row=page_row,
            settings_row=settings_row, settings=settings,
            page_uuid=page_uuid, run_id=run_id, outcome=outcome,
        )
        await _learn(page_uuid=page_uuid, page_row=page_row, settings=settings,
                     run_id=run_id, outcome=outcome)
        await _finish(run_id, outcome, state, status="completed", state_name="idle")
        return outcome

    except Exception as exc:  # noqa: BLE001
        log.exception("agent.run_failed", page=page_uuid)
        outcome.error = f"{type(exc).__name__}: {exc}"[:500]
        await _finish(run_id, outcome, state, status="failed", state_name="error")
        return outcome


async def _learn(
    *, page_uuid: str, page_row: dict, settings: Settings, run_id: str,
    outcome: RunOutcome,
) -> None:
    """Measure what happened, and adjust strategy if the evidence warrants.

    Wrapped so that a failure here can never lose the work the run already
    did — the post is published, and losing the record of it to a metrics
    error would be a far worse outcome than skipping one evaluation.
    """
    try:
        if not await evaluator.due_for_evaluation(page_uuid):
            return

        await repo.set_run_state(run_id, "learning")
        ref = observer.page_ref(page_row, token_key=settings.facebook_token_key)

        # The claim doubles as the "when did we last evaluate" marker, so two
        # workers cannot both spend Graph calls on the same snapshot round.
        claim = await repo.claim_action(
            page_uuid=page_uuid, action_type="fetch_insights",
            idempotency_key=(
                f"fetch_insights:{datetime.now(timezone.utc):%Y%m%d%H}"
                f":{page_uuid}"
            ),
            run_id=run_id,
        )
        if not claim.get("claimed"):
            return

        measured = await evaluator.collect_metrics(
            page_uuid=page_uuid, ref=ref, settings=settings
        )
        result = await evaluator.evaluate(page_uuid)

        await repo.finish_action(
            str(claim["action_id"]), status="succeeded",
            external_id=f"metrics-{measured}", result=result.as_dict(),
        )
        if result.changed:
            outcome.note(f"learning: {result.note}")
        elif measured:
            outcome.note(f"measured {measured} post(s); {result.note}")
    except Exception:  # noqa: BLE001
        log.exception("agent.learning_failed", page=page_uuid)


async def _finish(
    run_id: str, outcome: RunOutcome, state: AgentState | None, *,
    status: str, state_name: str,
) -> None:
    await repo.finish_run(
        run_id, status=status, state=state_name,
        decision=outcome.decision, reason=outcome.reason[:2000],
        actions_taken=outcome.actions_taken, used_ai=outcome.used_ai,
        observation=state.to_dict() if state else None,
        error=outcome.error,
    )


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------
async def _execute(
    *, choice: reasoning.ModelDecision, state: AgentState, page_row: dict,
    settings_row: dict, settings: Settings, page_uuid: str, run_id: str,
    outcome: RunOutcome,
) -> None:
    decision = choice.decision

    if decision in (Decision.DO_NOTHING, Decision.WAIT):
        return

    if decision is Decision.FLAG_FOR_REVIEW:
        log.warning("agent.flagged", page=page_uuid, reason=choice.reason)
        return

    try:
        ref = observer.page_ref(page_row, token_key=settings.facebook_token_key)
    except observer.ConnectionUnusable as exc:
        # Cannot act without a usable credential. Record it plainly; the
        # dashboard shows the reason and the fix.
        outcome.decision = "do_nothing"
        outcome.reason = str(exc)
        return

    if decision is Decision.REPLY_TO_COMMENTS:
        await _handle_comments(
            state=state, ref=ref, settings=settings, settings_row=settings_row,
            page_uuid=page_uuid, run_id=run_id, outcome=outcome,
        )
        return

    # --- a publishing decision -------------------------------------------
    await repo.set_run_state(run_id, "generating")

    if decision is Decision.PUBLISH_REEL:
        await _execute_reel(
            choice=choice, state=state, ref=ref, settings_row=settings_row,
            settings=settings, page_uuid=page_uuid, run_id=run_id, outcome=outcome,
        )
        return

    want_image = decision in (Decision.PUBLISH_IMAGE_POST, Decision.PUBLISH_STORY)

    try:
        draft = await reasoning.draft_content(
            state, topic=choice.topic, animal=choice.animal, want_image=want_image,
            # Photo posts are quizzes: they reach existing followers, and a
            # question is what gets them to comment.
            quiz=decision is Decision.PUBLISH_IMAGE_POST,
        )
    except (reasoning.DecisionParseError, AppError) as exc:
        outcome.decision = "do_nothing"
        outcome.reason = (
            "no AI text provider is available to write the post"
            if isinstance(exc, AppError)
            else f"content generation produced nothing usable ({exc})"
        )
        return

    caption = draft["caption"]
    topic = draft["topic"]
    animal = draft["animal"]
    visual_prompt = draft["visual_prompt"]

    # Duplicate rejection happens here — after writing (which is cheap) and
    # before image generation (which is not).
    try:
        await actions.check_freshness(
            page_uuid=page_uuid, topic=topic, animal=animal, caption=caption,
            recent_captions=state.recent_captions,
        )
    except actions.ActionSkipped as skip:
        outcome.decision = "do_nothing"
        outcome.reason = str(skip)
        outcome.note("rejected as a duplicate before generating an image")
        return

    # A plan row exists whatever the mode, so the calendar shows what was
    # intended as distinct from what happened.
    plan_id = await repo.create_plan(
        page_uuid=page_uuid, run_id=run_id,
        content_type={"publish_text_post": "text_post",
                      "publish_image_post": "image_post",
                      "publish_story": "story"}[decision.value],
        topic=topic, animal=animal, caption=caption,
        visual_prompt=visual_prompt, status="ready",
    )

    # In APPROVAL_REQUIRED the agent stops here: it has decided and written the
    # content, and a person releases it.
    if str(settings_row.get("mode")) == "APPROVAL_REQUIRED":
        await repo.set_plan_status(plan_id, "needs_review",
                                   detail="waiting for approval")
        outcome.reason = (
            f"{choice.reason} — prepared and waiting for approval "
            "(APPROVAL_REQUIRED mode)"
        )
        outcome.note("content drafted; not published because approval is required")
        return

    await repo.set_run_state(run_id, "publishing")
    try:
        if decision is Decision.PUBLISH_TEXT_POST:
            result = await actions.publish_text_post(
                page_uuid=page_uuid, ref=ref, settings=settings, run_id=run_id,
                caption=caption, topic=topic, animal=animal,
            )
        elif decision is Decision.PUBLISH_IMAGE_POST:
            if not visual_prompt:
                raise actions.ActionSkipped("no visual prompt was produced")
            result = await actions.publish_image_post(
                page_uuid=page_uuid, ref=ref, settings=settings, run_id=run_id,
                caption=caption, visual_prompt=visual_prompt,
                topic=topic, animal=animal,
            )
        else:  # publish_story
            if not visual_prompt:
                raise actions.ActionSkipped("no visual prompt was produced")
            result = await actions.publish_story(
                page_uuid=page_uuid, ref=ref, settings=settings, run_id=run_id,
                visual_prompt=visual_prompt, topic=topic, animal=animal,
            )
    except actions.ActionSkipped as skip:
        await repo.set_plan_status(plan_id, "cancelled", detail=str(skip)[:500])
        outcome.decision = "do_nothing"
        outcome.reason = str(skip)
        return
    except GraphFailure as failure:
        await repo.set_plan_status(plan_id, "failed", detail=failure.message[:500])
        outcome.error = f"{failure.kind.value}: {failure.message}"
        outcome.note(f"publishing failed ({failure.kind.value})")
        return

    await repo.set_run_state(run_id, "verifying")
    await repo.set_plan_status(
        plan_id, "published", published_post_id=result.get("post_id")
    )
    outcome.actions_taken += 1
    outcome.note(f"published {decision.value} ({result.get('fb_post_id') or result.get('story_id')})")


async def _execute_reel(
    *, choice: reasoning.ModelDecision, state: AgentState, ref, settings_row: dict,
    settings: Settings, page_uuid: str, run_id: str, outcome: RunOutcome,
) -> None:
    """Write, check, render and publish one reel.

    Same order as a photo post, for the same reason: the cheap steps (writing
    and the duplicate check) come before the expensive one. For a reel the
    expensive step is minutes of rendering and possibly a paid hook clip.
    """
    try:
        script = await reasoning.draft_reel(state, topic=choice.topic,
                                            animal=choice.animal)
    except (reasoning.DecisionParseError, AppError) as exc:
        outcome.decision = "do_nothing"
        outcome.reason = (
            "no AI text provider is available to write the reel"
            if isinstance(exc, AppError)
            else f"the reel script was unusable ({exc})"
        )
        return

    try:
        await actions.check_freshness(
            page_uuid=page_uuid, topic=script.topic, animal=script.animal,
            caption=script.caption, recent_captions=state.recent_captions,
        )
    except actions.ActionSkipped as skip:
        outcome.decision = "do_nothing"
        outcome.reason = str(skip)
        outcome.note("reel rejected as a duplicate before rendering")
        return

    plan_id = await repo.create_plan(
        page_uuid=page_uuid, run_id=run_id, content_type="reel",
        topic=script.topic, animal=script.animal,
        caption=actions.reel_caption(script), visual_prompt=script.hook_visual,
        status="ready",
    )

    if str(settings_row.get("mode")) == "APPROVAL_REQUIRED":
        await repo.set_plan_status(plan_id, "needs_review",
                                   detail="waiting for approval")
        outcome.reason = (f"{choice.reason} — reel scripted and waiting for "
                          "approval (APPROVAL_REQUIRED mode)")
        outcome.note("reel scripted; not rendered because approval is required")
        return

    await repo.set_run_state(run_id, "publishing")
    try:
        result = await actions.publish_reel(
            page_uuid=page_uuid, ref=ref, settings=settings, run_id=run_id,
            script=script,
        )
    except actions.ActionSkipped as skip:
        await repo.set_plan_status(plan_id, "cancelled", detail=str(skip)[:500])
        outcome.decision = "do_nothing"
        outcome.reason = str(skip)
        return
    except GraphFailure as failure:
        await repo.set_plan_status(plan_id, "failed", detail=failure.message[:500])
        outcome.error = f"{failure.kind.value}: {failure.message}"
        outcome.note(f"reel publishing failed ({failure.kind.value})")
        return

    await repo.set_run_state(run_id, "verifying")
    await repo.set_plan_status(plan_id, "published",
                               published_post_id=result.get("post_id"))
    outcome.actions_taken += 1
    outcome.note(
        f"published a {script.format} reel ({result['fb_post_id']}, "
        f"{result['seconds']:.0f}s; {result['hook_note']})"
    )


async def _handle_comments(
    *, state: AgentState, ref, settings: Settings, settings_row: dict,
    page_uuid: str, run_id: str, outcome: RunOutcome,
) -> None:
    """Triage the pending comments, then reply only where it is warranted."""
    pending = [
        c for c in state.unanswered_comments
        if not c.already_replied and c.action != "ignore"
    ]
    if not pending:
        outcome.reason = "no comments were actually pending"
        return

    payload = [
        {
            "comment_id": c.comment_id,
            "comment": c.message[:500],
            "author": c.author_name,
            # Context is what makes a correct answer possible. Without the post
            # it sits under, "what animal is this?" cannot be answered — and
            # the model is instructed to say so rather than guess.
            "post_context": (c.post_context or "")[:400],
            "minutes_old": c.age_minutes,
        }
        for c in pending[:15]
    ]

    threshold = float(settings_row.get("comment_reply_confidence") or 0.75)
    try:
        judgements = await reasoning.triage_comments(payload, min_confidence=threshold)
    except (reasoning.DecisionParseError, AppError) as exc:
        outcome.reason = (
            "no AI text provider is available to read the comments"
            if isinstance(exc, AppError)
            else f"comment triage produced nothing usable ({exc})"
        )
        return

    replied = 0
    ignored = 0
    flagged = 0
    hourly_cap = state.today.max_replies_per_hour
    used_this_hour = state.today.replies_last_hour

    for judgement in judgements:
        await repo.save_comment_judgement(
            page_uuid=page_uuid, comment_id=judgement.comment_id,
            classification=judgement.classification, action=judgement.action,
            confidence=judgement.confidence, reply_text=judgement.reply,
            reason=judgement.reason,
        )

        if judgement.action == "flag":
            flagged += 1
            continue
        if judgement.action != "reply" or not judgement.reply:
            ignored += 1
            continue

        # The hourly ceiling is re-checked per reply, not once for the batch:
        # a batch of twelve must not be able to step over a limit of ten.
        if used_this_hour >= hourly_cap:
            outcome.note("stopped replying: hourly limit reached mid-batch")
            break

        try:
            await actions.reply_to_comment(
                page_uuid=page_uuid, ref=ref, settings=settings, run_id=run_id,
                comment_id=judgement.comment_id, reply=judgement.reply,
            )
            replied += 1
            used_this_hour += 1
            outcome.actions_taken += 1
        except actions.ActionSkipped as skip:
            log.info("agent.reply_skipped", reason=str(skip)[:200])
        except GraphFailure as failure:
            log.warning("agent.reply_failed", kind=failure.kind.value)
            outcome.note(f"a reply failed ({failure.kind.value})")
            if failure.kind.value == "rate_limited":
                break

    parts = []
    if replied:
        parts.append(f"replied to {replied}")
    if ignored:
        parts.append(f"ignored {ignored}")
    if flagged:
        parts.append(f"flagged {flagged} for review")
    outcome.reason = ", ".join(parts) or "no comment needed a reply"
    outcome.note(outcome.reason)
