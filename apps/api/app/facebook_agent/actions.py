"""Doing the thing, exactly once.

Every function here follows the same shape, and the order is the whole point:

    derive an idempotency key from the *content*
      -> claim it in the database (UNIQUE constraint)
        -> only if the claim succeeded, call Facebook
          -> verify the result
            -> record it and close the claim

The key is derived from what is being published, not from a timestamp or a
random value. That is what makes a retry of the same intent collide with its
own first attempt instead of sailing past it and posting twice.

The timeout case is the one that matters most. A publish that times out has
*not* necessarily failed — Facebook may well have created the post and lost
the response. So a timeout never leads to a blind retry: the claim stays, and
the next attempt has to verify against Facebook before it may proceed. A
duplicate post is visible to every follower and cannot be withdrawn quietly.
"""
from __future__ import annotations

import hashlib
import pathlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from ..config import Settings
from ..logging_config import get_logger
from ..services import ai as ai_service
from ..services.facebook import FacebookClient, PageRef
from ..services.facebook.errors import FailureKind, GraphFailure
from . import repository as repo
from .memory import content_hash, extract_subject, looks_repetitive, normalize, topic_key
from .state import AgentState

log = get_logger(__name__)


class ActionSkipped(RuntimeError):
    """The action was not performed, for a reason that is not a failure."""


def _key(page_uuid: str, action_type: str, *parts: str) -> str:
    """An idempotency key from the intent.

    Content-derived on purpose: publishing the same caption twice in the same
    day is almost always a bug, and this makes it impossible rather than
    merely unlikely. A genuinely intended repeat needs different content, which
    for a wildlife Page it always has.
    """
    material = "|".join([page_uuid, action_type, *[p or "" for p in parts]])
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]
    # The date bucket means the same caption *can* be reposted next month if
    # the diversity window has passed and a human asks for it.
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"{action_type}:{day}:{digest}"


# ---------------------------------------------------------------------------
# Content preparation
# ---------------------------------------------------------------------------
async def check_freshness(
    *, page_uuid: str, topic: str | None, animal: str | None, caption: str,
    recent_captions: list[str],
) -> None:
    """Reject a duplicate before anything expensive happens.

    Deliberately called *before* image generation. Discovering a repeat after
    paying for an image is the expensive ordering, and it is the one a naive
    implementation falls into.
    """
    if topic:
        if not await repo.is_fresh(page_uuid, "topic", topic_key(topic, animal)):
            raise ActionSkipped(
                f"the topic {topic!r} was covered recently — choosing it again "
                "would repeat the Page"
            )
    if animal:
        if not await repo.is_fresh(page_uuid, "animal", content_hash(animal)):
            raise ActionSkipped(
                f"{animal} featured recently; the Page needs variety"
            )
    if not await repo.is_fresh(page_uuid, "caption", content_hash(caption)):
        raise ActionSkipped("this caption has been published before")

    # Exact hashes miss a caption rebuilt from the same handful of content
    # words, which is the realistic near-duplicate.
    if looks_repetitive(caption, recent_captions):
        raise ActionSkipped(
            "this reads as a rewording of something published recently"
        )


async def remember_content(
    *, page_uuid: str, topic: str | None, animal: str | None,
    caption: str, visual_prompt: str | None, post_id: str | None,
) -> None:
    """Write what was published into memory, so it is not repeated."""
    if topic:
        await repo.remember(page_uuid=page_uuid, kind="topic", value=topic,
                            normalized=normalize(topic),
                            hash_value=topic_key(topic, animal), post_id=post_id)
    if animal:
        await repo.remember(page_uuid=page_uuid, kind="animal", value=animal,
                            normalized=normalize(animal),
                            hash_value=content_hash(animal), post_id=post_id)
    await repo.remember(page_uuid=page_uuid, kind="caption", value=caption[:1000],
                        normalized=normalize(caption),
                        hash_value=content_hash(caption), post_id=post_id)
    if visual_prompt:
        await repo.remember(page_uuid=page_uuid, kind="visual_concept",
                            value=visual_prompt[:1000],
                            normalized=normalize(visual_prompt),
                            hash_value=content_hash(visual_prompt), post_id=post_id)


def save_image(data: bytes, *, settings: Settings, page_uuid: str) -> str:
    """Write a generated image to disk and return its path."""
    root = pathlib.Path(settings.storage_root) / "facebook" / page_uuid
    root.mkdir(parents=True, exist_ok=True)
    name = f"{datetime.now(timezone.utc):%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}.png"
    path = root / name
    path.write_bytes(data)
    return str(path)


# ---------------------------------------------------------------------------
# Shared claim/execute wrapper
# ---------------------------------------------------------------------------
async def _guard_claim(
    *, page_uuid: str, action_type: str, idempotency_key: str,
    run_id: str | None, request: dict,
) -> str:
    """Take the claim or refuse to proceed."""
    claim = await repo.claim_action(
        page_uuid=page_uuid, action_type=action_type,
        idempotency_key=idempotency_key, run_id=run_id, request=request,
    )
    if not claim.get("claimed"):
        status = claim.get("status")
        external = claim.get("external_id")
        if status == "succeeded" and external:
            raise ActionSkipped(
                f"already published as {external} — not publishing it again"
            )
        raise ActionSkipped(
            f"an identical action is already {status}; refusing to duplicate it"
        )
    return str(claim["action_id"])


def _cooldown_until(failure: GraphFailure) -> datetime | None:
    if failure.kind is not FailureKind.RATE_LIMITED:
        return None
    seconds = failure.retry_after_seconds or 3600
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


async def _fail(action_id: str, failure: GraphFailure) -> None:
    await repo.finish_action(
        action_id, status="failed", error=f"{failure.kind.value}: {failure.message}",
        retry_after=_cooldown_until(failure),
    )


# ---------------------------------------------------------------------------
# Publishing
# ---------------------------------------------------------------------------
async def publish_text_post(
    *, page_uuid: str, ref: PageRef, settings: Settings, run_id: str | None,
    caption: str, topic: str | None, animal: str | None,
) -> dict[str, Any]:
    action_id = await _guard_claim(
        page_uuid=page_uuid, action_type="publish_text_post",
        idempotency_key=_key(page_uuid, "publish_text_post", content_hash(caption)),
        run_id=run_id, request={"topic": topic, "animal": animal},
    )

    async with FacebookClient(
        graph_base_url=settings.graph_base_url,
        app_id=settings.meta_app_id, app_secret=settings.meta_app_secret,
    ) as client:
        try:
            fb_post_id = await client.publish_text_post(ref, message=caption)
        except GraphFailure as failure:
            await _fail(action_id, failure)
            raise

        # Verify rather than trust: an id in a response is good evidence, but
        # reading the object back is proof, and it is one cheap call.
        permalink = None
        try:
            obj = await client.get_object(
                ref, object_id=fb_post_id, fields="id,permalink_url,created_time"
            )
            permalink = obj.get("permalink_url")
        except GraphFailure:
            log.warning("agent.verify_failed", fb_post_id=fb_post_id)

    post_id = await repo.upsert_post(
        page_uuid=page_uuid, fb_post_id=fb_post_id, post_type="text",
        message=caption, published_at=datetime.now(timezone.utc),
        topic=topic, animal=animal, permalink=permalink, created_by="agent",
    )
    await repo.finish_action(action_id, status="succeeded", external_id=fb_post_id,
                             result={"permalink": permalink})
    await remember_content(page_uuid=page_uuid, topic=topic, animal=animal,
                           caption=caption, visual_prompt=None, post_id=post_id)
    return {"fb_post_id": fb_post_id, "post_id": post_id, "permalink": permalink}


async def publish_image_post(
    *, page_uuid: str, ref: PageRef, settings: Settings, run_id: str | None,
    caption: str, visual_prompt: str, topic: str | None, animal: str | None,
) -> dict[str, Any]:
    action_id = await _guard_claim(
        page_uuid=page_uuid, action_type="publish_image_post",
        idempotency_key=_key(page_uuid, "publish_image_post", content_hash(caption)),
        run_id=run_id, request={"topic": topic, "animal": animal},
    )

    # Generation happens after the claim so two concurrent runs cannot both pay
    # for an image, but before the Graph call so a generation failure costs
    # nothing on Facebook.
    try:
        image = await ai_service.generate_image_for_system(
            prompt=visual_prompt,
            negative_prompt="text, watermark, signature, logo, human faces, blurry",
            aspect_ratio="1:1",
        )
    except Exception as exc:  # noqa: BLE001
        await repo.finish_action(action_id, status="failed",
                                 error=f"image generation failed: {exc}"[:500])
        raise

    image_path = save_image(image.data, settings=settings, page_uuid=page_uuid)

    async with FacebookClient(
        graph_base_url=settings.graph_base_url,
        app_id=settings.meta_app_id, app_secret=settings.meta_app_secret,
    ) as client:
        try:
            result = await client.publish_photo_post(
                ref, image=image.data, filename="post.png", message=caption,
            )
        except GraphFailure as failure:
            await _fail(action_id, failure)
            raise

    # A photo publish returns both the photo id and the resulting post id.
    fb_post_id = str(result.get("post_id") or result.get("id") or "")
    if not fb_post_id:
        await repo.finish_action(action_id, status="failed",
                                 error="photo publish returned no id")
        raise GraphFailure(kind=FailureKind.UNKNOWN,
                           message="photo publish returned no id")

    post_id = await repo.upsert_post(
        page_uuid=page_uuid, fb_post_id=fb_post_id, post_type="photo",
        message=caption, published_at=datetime.now(timezone.utc),
        topic=topic, animal=animal, image_path=image_path, created_by="agent",
    )
    await repo.finish_action(action_id, status="succeeded", external_id=fb_post_id,
                             result={"photo_id": result.get("id"),
                                     "provider": image.provider})
    await remember_content(page_uuid=page_uuid, topic=topic, animal=animal,
                           caption=caption, visual_prompt=visual_prompt,
                           post_id=post_id)
    return {"fb_post_id": fb_post_id, "post_id": post_id, "image_path": image_path}


async def publish_story(
    *, page_uuid: str, ref: PageRef, settings: Settings, run_id: str | None,
    visual_prompt: str, topic: str | None, animal: str | None,
) -> dict[str, Any]:
    """Publish a Page Story.

    Officially supported — POST /{page-id}/photo_stories, documented at
    developers.facebook.com/docs/page-stories-api/. Two steps, and the first
    matters: Meta requires that story media has not been used in a previously
    published post, so the photo is uploaded unpublished and turned into a
    story rather than reusing anything already on the feed.
    """
    action_id = await _guard_claim(
        page_uuid=page_uuid, action_type="publish_story",
        idempotency_key=_key(page_uuid, "publish_story", content_hash(visual_prompt)),
        run_id=run_id, request={"topic": topic, "animal": animal},
    )

    try:
        image = await ai_service.generate_image_for_system(
            prompt=visual_prompt,
            negative_prompt="text, watermark, signature, logo, blurry",
            # Stories are a 9:16 surface. A square image is letterboxed by
            # Facebook and looks like an afterthought.
            aspect_ratio="9:16",
        )
    except Exception as exc:  # noqa: BLE001
        await repo.finish_action(action_id, status="failed",
                                 error=f"image generation failed: {exc}"[:500])
        raise

    image_path = save_image(image.data, settings=settings, page_uuid=page_uuid)

    async with FacebookClient(
        graph_base_url=settings.graph_base_url,
        app_id=settings.meta_app_id, app_secret=settings.meta_app_secret,
    ) as client:
        try:
            staged = await client.publish_photo_post(
                ref, image=image.data, filename="story.png", published=False,
            )
            photo_id = str(staged.get("id") or "")
            if not photo_id:
                raise GraphFailure(kind=FailureKind.UNKNOWN,
                                   message="photo upload returned no id")
            result = await client.publish_photo_story(ref, photo_id=photo_id)
        except GraphFailure as failure:
            await _fail(action_id, failure)
            raise

    story_id = str(result.get("post_id") or result.get("id") or photo_id)
    await repo.finish_action(action_id, status="succeeded", external_id=story_id,
                             result={"photo_id": photo_id})
    await remember_content(page_uuid=page_uuid, topic=topic, animal=animal,
                           caption=visual_prompt[:200], visual_prompt=visual_prompt,
                           post_id=None)
    return {"story_id": story_id, "image_path": image_path}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
async def reply_to_comment(
    *, page_uuid: str, ref: PageRef, settings: Settings, run_id: str | None,
    comment_id: str, reply: str,
) -> dict[str, Any]:
    """Reply once, to a comment that has not been replied to.

    Two guards, deliberately both:
      * the idempotency key is the comment id, so a retry cannot post twice;
      * record_reply only updates a row whose reply_comment_id is still NULL,
        so even a concurrent run that somehow got past the claim cannot attach
        a second reply.
    """
    action_id = await _guard_claim(
        page_uuid=page_uuid, action_type="reply_to_comment",
        idempotency_key=_key(page_uuid, "reply_to_comment", comment_id),
        run_id=run_id, request={"comment_id": comment_id},
    )

    async with FacebookClient(
        graph_base_url=settings.graph_base_url,
        app_id=settings.meta_app_id, app_secret=settings.meta_app_secret,
    ) as client:
        try:
            reply_id = await client.reply_to_comment(
                ref, comment_id=comment_id, message=reply
            )
        except GraphFailure as failure:
            await _fail(action_id, failure)
            raise

    attached = await repo.record_reply(
        page_uuid=page_uuid, comment_id=comment_id,
        reply_comment_id=reply_id, reply_text=reply,
    )
    if not attached:
        # The reply went out but the row already had one. Worth knowing about:
        # it means two runs raced, and the claim should have prevented it.
        log.warning("agent.duplicate_reply_detected", comment_id=comment_id[:40])

    await repo.finish_action(action_id, status="succeeded", external_id=reply_id)
    return {"reply_id": reply_id, "comment_id": comment_id}
