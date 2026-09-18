"""The Meta Graph API client.

Only the official Graph API. No browser automation, no cookies, no scraping,
no unofficial endpoints — those are against Meta's terms and get Pages
disabled, which is the opposite of managing one.

Two rules this file exists to enforce:

1. **A token never leaves this process in readable form.** It goes into an
   Authorization header and nowhere else. It is not logged, not returned, not
   put in a URL query string (which would land in access logs on every hop),
   and not included in any error this raises.

2. **Every failure is classified before it reaches a caller.** See errors.py —
   the difference between "retry" and "stop" is the difference between a blip
   and a rate-limit block.
"""
from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from typing import Any

import httpx

from ...logging_config import get_logger
from .errors import GraphFailure, classify, from_network_error

log = get_logger(__name__)

#: Long enough for an image upload on a slow link, short enough that a wedged
#: connection does not hold an agent run open indefinitely.
DEFAULT_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=60.0, pool=10.0)
UPLOAD_TIMEOUT = httpx.Timeout(connect=10.0, read=180.0, write=180.0, pool=10.0)


@dataclass(slots=True)
class PageRef:
    """A Page and the token that acts on its behalf."""
    page_id: str
    access_token: str


class FacebookClient:
    """Thin, explicit wrapper over the Graph endpoints this project uses.

    Deliberately not a general-purpose SDK. Every method here corresponds to
    something the agent actually does, so that the set of things this system
    can do to a Page is readable in one file.
    """

    def __init__(
        self,
        *,
        graph_base_url: str,
        app_id: str = "",
        app_secret: str = "",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base = graph_base_url.rstrip("/")
        self._app_id = app_id
        self._app_secret = app_secret
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> "FacebookClient":
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=DEFAULT_TIMEOUT)
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    # -- internals ---------------------------------------------------------
    def _appsecret_proof(self, token: str) -> str | None:
        """Proves the call came from our app, not just from a stolen token.

        Meta recommends this on every server-side call. Without it a leaked
        Page token is usable by anyone; with it, an attacker also needs the app
        secret. Cheap, so it is always on when a secret is configured.
        """
        if not self._app_secret:
            return None
        return hmac.new(
            self._app_secret.encode("utf-8"), token.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        token: str,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        files: dict[str, Any] | None = None,
        timeout: httpx.Timeout | None = None,
        absolute_url: str | None = None,
    ) -> dict:
        if self._client is None:
            raise RuntimeError("FacebookClient must be used as an async context manager")

        url = absolute_url or f"{self._base}/{path.lstrip('/')}"
        query = dict(params or {})
        proof = self._appsecret_proof(token)
        if proof:
            query["appsecret_proof"] = proof

        # The token goes in the header, never in `query`. A token in a URL is a
        # token in nginx's access log, in Cloudflare's, and in any proxy in
        # between.
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = await self._client.request(
                method, url,
                params=query or None,
                data=data or None,
                files=files or None,
                headers=headers,
                timeout=timeout or DEFAULT_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            # No answer. This is emphatically not "it did not happen".
            log.warning("facebook.network_error", path=path, error=type(exc).__name__)
            raise from_network_error(exc) from exc

        try:
            payload = response.json()
        except ValueError:
            payload = None

        if response.status_code >= 400 or (isinstance(payload, dict) and "error" in payload):
            failure = classify(
                http_status=response.status_code,
                payload=payload if isinstance(payload, dict) else None,
                retry_after_header=response.headers.get("Retry-After"),
            )
            log.warning(
                "facebook.api_error", path=path, kind=failure.kind.value,
                code=failure.code, status=response.status_code,
                fbtrace_id=failure.fbtrace_id,
            )
            raise failure

        return payload if isinstance(payload, dict) else {"data": payload}

    # -- tokens ------------------------------------------------------------
    async def exchange_code_for_token(
        self, *, code: str, redirect_uri: str
    ) -> dict:
        """OAuth step 2: authorisation code -> short-lived user token."""
        if self._client is None:
            raise RuntimeError("FacebookClient must be used as an async context manager")
        response = await self._client.get(
            f"{self._base}/oauth/access_token",
            params={
                "client_id": self._app_id,
                "client_secret": self._app_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        payload = response.json() if response.content else {}
        if response.status_code >= 400 or "error" in payload:
            raise classify(http_status=response.status_code, payload=payload)
        return payload

    async def exchange_for_long_lived(self, *, user_token: str) -> dict:
        """Short-lived user token (~1 hour) -> long-lived (~60 days).

        Page tokens derived from a long-lived user token generally do not
        expire on their own, which is what makes unattended operation possible
        at all. Skipping this step would mean the agent stops working an hour
        after connection.
        """
        if self._client is None:
            raise RuntimeError("FacebookClient must be used as an async context manager")
        response = await self._client.get(
            f"{self._base}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": self._app_id,
                "client_secret": self._app_secret,
                "fb_exchange_token": user_token,
            },
        )
        payload = response.json() if response.content else {}
        if response.status_code >= 400 or "error" in payload:
            raise classify(http_status=response.status_code, payload=payload)
        return payload

    async def debug_token(self, *, token: str) -> dict:
        """What Meta thinks this token is: scopes, expiry, validity.

        The source of truth for the capability flags. Asking Meta beats
        assuming that what we requested is what we were granted — users can
        untick permissions on the consent screen.
        """
        if self._client is None:
            raise RuntimeError("FacebookClient must be used as an async context manager")
        response = await self._client.get(
            f"{self._base}/debug_token",
            params={
                "input_token": token,
                "access_token": f"{self._app_id}|{self._app_secret}",
            },
        )
        payload = response.json() if response.content else {}
        if response.status_code >= 400 or "error" in payload:
            raise classify(http_status=response.status_code, payload=payload)
        return payload.get("data", {})

    async def list_pages(self, *, user_token: str) -> list[dict]:
        """Pages this user manages, with a Page token and tasks for each."""
        payload = await self._request(
            "GET", "/me/accounts",
            token=user_token,
            params={"fields": "id,name,category,access_token,tasks", "limit": 100},
        )
        return payload.get("data", [])

    # -- reading the page --------------------------------------------------
    async def get_page(self, page: PageRef, *, fields: str | None = None) -> dict:
        return await self._request(
            "GET", f"/{page.page_id}",
            token=page.access_token,
            params={"fields": fields or "id,name,category,fan_count,link,about"},
        )

    async def recent_posts(self, page: PageRef, *, limit: int = 15) -> list[dict]:
        """The Page's own recent posts.

        `published_posts` rather than `feed`: feed includes posts by other
        people on the Page, which would make the agent think the Page had
        posted when it had not.
        """
        payload = await self._request(
            "GET", f"/{page.page_id}/published_posts",
            token=page.access_token,
            params={
                "fields": (
                    "id,message,created_time,permalink_url,status_type,"
                    "attachments{media_type},"
                    "comments.summary(true).limit(0),"
                    "reactions.summary(true).limit(0),"
                    "shares"
                ),
                "limit": limit,
            },
        )
        return payload.get("data", [])

    async def post_comments(
        self, page: PageRef, *, fb_post_id: str, limit: int = 50
    ) -> list[dict]:
        payload = await self._request(
            "GET", f"/{fb_post_id}/comments",
            token=page.access_token,
            params={
                "fields": "id,message,created_time,from{id,name},parent{id},"
                          "comment_count,like_count",
                "filter": "toplevel",
                "order": "reverse_chronological",
                "limit": limit,
            },
        )
        return payload.get("data", [])

    async def post_insights(
        self, page: PageRef, *, fb_post_id: str
    ) -> dict[str, int]:
        """Per-post metrics, flattened to plain numbers.

        Returns only what Meta actually gave us. A metric that is missing is
        absent from the dict rather than present as zero, so the evaluator can
        tell "no reach" from "reach unknown".
        """
        payload = await self._request(
            "GET", f"/{fb_post_id}/insights",
            token=page.access_token,
            params={"metric": "post_impressions,post_impressions_unique,"
                              "post_clicks"},
        )
        out: dict[str, int] = {}
        for entry in payload.get("data", []):
            name = entry.get("name")
            values = entry.get("values") or []
            if not name or not values:
                continue
            value = values[0].get("value")
            if isinstance(value, int):
                out[name] = value
        return out

    # -- publishing --------------------------------------------------------
    async def publish_text_post(self, page: PageRef, *, message: str) -> str:
        """Publish a text post. Returns the Facebook post id."""
        payload = await self._request(
            "POST", f"/{page.page_id}/feed",
            token=page.access_token,
            data={"message": message},
        )
        post_id = payload.get("id")
        if not post_id:
            raise GraphFailure(
                kind=classify(http_status=200, payload=None).kind,
                message="feed publish returned no id",
            )
        return str(post_id)

    async def publish_photo_post(
        self, page: PageRef, *, image: bytes, filename: str,
        message: str | None = None, published: bool = True,
    ) -> dict:
        """Publish (or stage) a photo.

        `published=False` uploads without posting and returns a photo id — the
        first half of the Story flow, and also how a photo can be prepared and
        attached later.
        """
        data: dict[str, Any] = {"published": "true" if published else "false"}
        if message and published:
            data["message"] = message
        return await self._request(
            "POST", f"/{page.page_id}/photos",
            token=page.access_token,
            data=data,
            files={"source": (filename, image, "image/png")},
            timeout=UPLOAD_TIMEOUT,
        )

    async def publish_photo_story(self, page: PageRef, *, photo_id: str) -> dict:
        """Turn an unpublished photo into a Page Story.

        Officially supported: POST /{page-id}/photo_stories, documented at
        developers.facebook.com/docs/page-stories-api/. Note Meta's stated
        constraint — the media must not already have been used in a published
        post — which is why the photo is uploaded with published=false.
        """
        return await self._request(
            "POST", f"/{page.page_id}/photo_stories",
            token=page.access_token,
            data={"photo_id": photo_id},
        )

    async def reply_to_comment(
        self, page: PageRef, *, comment_id: str, message: str
    ) -> str:
        """Reply to a comment. Returns the new comment id."""
        payload = await self._request(
            "POST", f"/{comment_id}/comments",
            token=page.access_token,
            data={"message": message},
        )
        reply_id = payload.get("id")
        if not reply_id:
            raise GraphFailure(
                kind=classify(http_status=200, payload=None).kind,
                message="comment reply returned no id",
            )
        return str(reply_id)

    async def get_object(self, page: PageRef, *, object_id: str,
                         fields: str) -> dict:
        """Read any object by id — used to verify that a publish landed."""
        return await self._request(
            "GET", f"/{object_id}",
            token=page.access_token,
            params={"fields": fields},
        )
