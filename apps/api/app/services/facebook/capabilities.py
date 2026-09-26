"""What this connection can actually do.

The rule from the brief, and it is the right one: a capability reports true
only when it is genuinely supported. Not when we asked for the permission —
when Meta granted it *and* the Page token carries the task to use it.

Those two are different, and the difference is invisible until something
fails. A user can untick a permission on the consent screen, and an admin can
hold a Page role that reads but cannot publish. Either produces a connection
that looks fine and then throws a permission error the first time the agent
tries to post — at which point the agent has already generated an image.

So the flags are computed from `debug_token` scopes plus the Page's `tasks`,
and the dashboard shows exactly that.
"""
from __future__ import annotations

from typing import Any

#: Granted scopes, per Meta's permissions reference.
SCOPE_SHOW_LIST = "pages_show_list"
SCOPE_READ_ENGAGEMENT = "pages_read_engagement"
SCOPE_READ_USER_CONTENT = "pages_read_user_content"
SCOPE_MANAGE_POSTS = "pages_manage_posts"
SCOPE_MANAGE_ENGAGEMENT = "pages_manage_engagement"
SCOPE_READ_INSIGHTS = "read_insights"

#: Page-level tasks that appear on /me/accounts.
TASK_CREATE_CONTENT = "CREATE_CONTENT"
TASK_MODERATE = "MODERATE"
TASK_MANAGE = "MANAGE"
TASK_ANALYZE = "ANALYZE"

#: What the OAuth flow asks for.
#:
#: pages_read_user_content and pages_manage_engagement are here because comment
#: management needs them and they are easy to forget: reading a comment someone
#: else wrote is a different permission from reading the Page, and replying is
#: a different one again from posting.
REQUESTED_SCOPES: tuple[str, ...] = (
    SCOPE_SHOW_LIST,
    SCOPE_READ_ENGAGEMENT,
    SCOPE_READ_USER_CONTENT,
    SCOPE_MANAGE_POSTS,
    SCOPE_MANAGE_ENGAGEMENT,
    SCOPE_READ_INSIGHTS,
)


def detect(
    *, granted_scopes: list[str] | tuple[str, ...], page_tasks: list[str] | tuple[str, ...]
) -> dict[str, Any]:
    """Compute capability flags, plus why each one is false.

    The `missing` map is the useful half: "Stories unavailable" on its own
    sends someone hunting through Meta's dashboard, while "Stories unavailable
    — needs pages_manage_posts" is actionable.
    """
    scopes = {s.strip() for s in granted_scopes if s}
    tasks = {t.strip().upper() for t in page_tasks if t}

    def need(required_scopes: set[str], required_tasks: set[str]) -> list[str]:
        missing = sorted(required_scopes - scopes)
        # An empty task list means we could not read them, not that none were
        # granted. Treating unknown as "denied" would report a working Page as
        # incapable; treating it as "granted" would over-promise. We report the
        # scope requirement and let the first real call be the arbiter.
        if tasks:
            missing += sorted(required_tasks - tasks)
        return missing

    checks: dict[str, tuple[set[str], set[str]]] = {
        "can_read_page": ({SCOPE_READ_ENGAGEMENT}, set()),
        "can_read_comments": ({SCOPE_READ_USER_CONTENT}, set()),
        "can_publish_posts": ({SCOPE_MANAGE_POSTS}, {TASK_CREATE_CONTENT}),
        "can_publish_images": ({SCOPE_MANAGE_POSTS}, {TASK_CREATE_CONTENT}),
        # Page Stories are officially supported — POST /{page-id}/photo_stories,
        # see developers.facebook.com/docs/page-stories-api/. They need the same
        # publishing permission and the CREATE_CONTENT task.
        "can_publish_stories": ({SCOPE_MANAGE_POSTS}, {TASK_CREATE_CONTENT}),
        # Reels publishing (POST /{page-id}/video_reels) needs pages_show_list,
        # pages_read_engagement and pages_manage_posts, per Meta's Reels
        # Publishing API — the first two are what reading the Page already needs.
        "can_publish_reels": ({SCOPE_SHOW_LIST, SCOPE_READ_ENGAGEMENT,
                               SCOPE_MANAGE_POSTS}, {TASK_CREATE_CONTENT}),
        "can_manage_comments": ({SCOPE_MANAGE_ENGAGEMENT}, {TASK_MODERATE}),
        "can_read_insights": ({SCOPE_READ_INSIGHTS}, set()),
    }

    capabilities: dict[str, Any] = {}
    missing: dict[str, list[str]] = {}
    for name, (req_scopes, req_tasks) in checks.items():
        gaps = need(req_scopes, req_tasks)
        capabilities[name] = not gaps
        if gaps:
            missing[name] = gaps

    capabilities["missing"] = missing
    capabilities["granted_scopes"] = sorted(scopes)
    capabilities["page_tasks"] = sorted(tasks)
    return capabilities


def summarise(capabilities: dict[str, Any]) -> str:
    """A one-line human summary for logs and the dashboard."""
    able = [k.removeprefix("can_").replace("_", " ")
            for k, v in capabilities.items()
            if k.startswith("can_") and v is True]
    if not able:
        return "no capabilities — the connection cannot do anything useful"
    return "can " + ", ".join(sorted(able))


def blocks_action(capabilities: dict[str, Any], action_type: str) -> str | None:
    """Return why an action cannot run, or None if it can.

    Called before the agent decides, so that a Page without publishing rights
    never even considers a post — rather than deciding to post, generating an
    image, and discovering the problem at the last step.
    """
    needed = {
        "publish_text_post": "can_publish_posts",
        "publish_image_post": "can_publish_images",
        "publish_story": "can_publish_stories",
        "publish_reel": "can_publish_reels",
        "reply_to_comment": "can_manage_comments",
        "reply_to_comments": "can_manage_comments",
        "fetch_insights": "can_read_insights",
    }.get(action_type)

    if needed is None:
        return None
    if capabilities.get(needed) is True:
        return None

    gaps = (capabilities.get("missing") or {}).get(needed) or []
    if gaps:
        return f"{needed} is unavailable — missing {', '.join(gaps)}"
    return f"{needed} is unavailable on this connection"
