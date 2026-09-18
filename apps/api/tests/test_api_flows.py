"""End-to-end API tests against a running server and a real database.

    python -m tests.test_api_flows            # expects the API on BACKEND_PORT

These are integration tests on purpose. The behaviour worth protecting here —
that a rotated refresh token kills its whole family, that one account cannot
touch another's My Apps, that quota is not oversold — is behaviour of the API
plus the database together. A mocked database would have happily passed the
refresh-rotation bug this suite now guards against: the revocation was issued
and then rolled back by the exception reporting it, which only a real
transaction reproduces.

Every test creates its own account and cleans up nothing: the rows are small and
a failed run is easier to investigate with its data still present.
"""
from __future__ import annotations

import json
import os
import pathlib
import ssl
import sys
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar


def _load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = pathlib.Path(__file__).resolve().parents[3] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    return env


ENV = _load_env()
API_PORT = ENV.get("BACKEND_PORT", "8010")

DIRECT = f"http://127.0.0.1:{API_PORT}/api"

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _choose_base() -> str:
    """Always the local API unless someone deliberately says otherwise."""
    return os.environ.get("PICKIXO_API") or DIRECT


BASE = _choose_base()


def _refuse_if_production() -> None:
    """Refuse to run the DEFAULT target when that target is serving real users.

    This suite creates accounts, and accounts are rows in whatever database the
    API is attached to. That caught us twice. First by pointing at
    https://pickixo.com; the obvious fix was to force the target back to
    localhost — which fixed nothing, because there is one API process and one
    database on this machine, so the "local" API IS production. Two hundred and
    then another thirty-six junk users went into the live table before that sank
    in.

    The URL was never the thing that mattered. What matters is whether the
    database on the other end holds real users. So the check is on APP_ENV, and
    it is a hard stop rather than a warning: a warning is something you scroll
    past at the exact moment you are concentrating on something else.

    To run these properly, give them their own database and their own API:

        createdb pickixo_test && apply database/schema/*.sql
        DATABASE_URL=...pickixo_test  BACKEND_PORT=8011  python run.py
        PICKIXO_API=http://127.0.0.1:8011/api python -m tests.test_api_flows

    The guard deliberately only covers the DEFAULT target. Setting PICKIXO_API
    is someone stating where they want the writes to go, and the failure this
    exists to prevent was never a deliberate choice — it was a default quietly
    pointing somewhere it should not have. Guarding the explicit form too would
    just mean a second variable to set, and a guard people routinely disable is
    not a guard.

    PICKIXO_ALLOW_PRODUCTION_TESTS=1 overrides even the default. It exists so
    the escape hatch is explicit and greppable, not so it gets used.
    """
    if os.environ.get("PICKIXO_API"):
        return
    if os.environ.get("PICKIXO_ALLOW_PRODUCTION_TESTS") == "1":
        return
    # The process environment wins over the .env file, matching how the API
    # itself resolves settings.
    app_env = os.environ.get("APP_ENV") or ENV.get("APP_ENV", "development")
    if app_env.strip().lower() != "production":
        return

    sys.exit(
        "\n  REFUSING TO RUN: APP_ENV=production.\n\n"
        "  These tests create accounts, and this API is attached to the live\n"
        "  database. Point them at a test database instead:\n\n"
        "    DATABASE_URL=<test db> BACKEND_PORT=8011 python run.py\n"
        "    PICKIXO_API=http://127.0.0.1:8011/api python -m tests.test_api_flows\n\n"
        "  Override only if you are certain: PICKIXO_ALLOW_PRODUCTION_TESTS=1\n"
    )


_refuse_if_production()

# A Secure cookie cannot travel over plain HTTP, and a correct client will not
# send one back. That is the cookie behaving properly, not a bug — but it means
# the session tests cannot work over an http target when Secure is on.
#
# Whether that is the case is OBSERVED rather than inferred. Reading
# SESSION_COOKIE_SECURE out of .env guesses at a different process's
# configuration, and guessed wrong the moment a test API was started with its own
# settings: the suite skipped three tests that would have passed. The cookie
# either came back or it did not, and the jar knows which.
NO_COOKIES_REASON = (
    "the session cookie did not survive the round trip, which is what a Secure "
    "cookie does over plain HTTP. Target an HTTPS origin, or run the API with "
    "SESSION_COOKIE_SECURE=false."
)


def require_session_cookie(case: unittest.TestCase, client: "Client") -> None:
    """Skip, rather than fail, when the transport cannot carry the session."""
    if client.refresh_cookie is None:
        case.skipTest(NO_COOKIES_REASON)

_target_host = urllib.parse.urlparse(BASE).hostname or ""
if _target_host not in LOCAL_HOSTS:
    print(
        f"\n  WARNING: targeting {BASE}, which is not local.\n"
        "  These tests create accounts. Do not run them against production.\n",
        file=sys.stderr,
    )


def _tls_handlers() -> list:
    """TLS for the target origin.

    Certificate verification is disabled ONLY for localhost, where the
    development certificate is self-signed and there is nothing to verify it
    against. Against a real hostname the certificate is checked normally — a
    test suite that silently accepted any certificate for pickixo.com would be
    unable to notice the one failure mode most worth noticing.
    """
    if not BASE.startswith("https://"):
        return []

    host = urllib.parse.urlparse(BASE).hostname or ""
    if host not in ("localhost", "127.0.0.1", "::1"):
        return []

    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return [urllib.request.HTTPSHandler(context=context)]


class Client:
    """Minimal HTTP client with its own cookie jar, so each 'browser' is separate."""

    def __init__(self) -> None:
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar), *_tls_handlers()
        )
        self.token: str | None = None

    def request(self, method: str, path: str, body: dict | None = None,
                auth: bool = False) -> tuple[int, dict]:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(BASE + path, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        if auth and self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        def decode(raw: bytes) -> dict:
            # Not everything in front of the API speaks JSON. nginx returns an
            # HTML page when it rate limits, and a test that explodes on
            # json.loads reports a parse error instead of the 503 that actually
            # happened.
            if not raw:
                return {}
            try:
                return json.loads(raw)
            except ValueError:
                return {"_non_json_body": raw[:200].decode("utf-8", "replace")}

        try:
            with self.opener.open(req, timeout=20) as response:
                return response.status, decode(response.read())
        except urllib.error.HTTPError as exc:
            return exc.code, decode(exc.read())

    def get(self, p, **kw):    return self.request("GET", p, **kw)
    def post(self, p, b=None, **kw):  return self.request("POST", p, b, **kw)
    def put(self, p, b=None, **kw):   return self.request("PUT", p, b, **kw)
    def patch(self, p, b=None, **kw): return self.request("PATCH", p, b, **kw)
    def delete(self, p, **kw): return self.request("DELETE", p, **kw)

    def sign_up(self, email: str, password: str = "a-long-enough-passphrase"):
        status, body = self.post("/auth/sign-up",
                                 {"email": email, "password": password})
        if status == 201:
            self.token = body["access_token"]
        return status, body

    @property
    def refresh_cookie(self) -> str | None:
        for cookie in self.jar:
            if cookie.name == "pickixo_session":
                return cookie.value
        return None


def unique_email(prefix: str) -> str:
    # example.com is reserved for documentation and always parses; .test is a
    # special-use TLD that a correct email validator rejects.
    return f"{prefix}{time.time_ns()}@example.com"


class ServerAvailable(unittest.TestCase):
    def test_00_server_is_up(self) -> None:
        client = Client()
        try:
            status, body = client.get("/health")
        except Exception as exc:  # noqa: BLE001
            self.fail(
                f"cannot reach {BASE}: {exc}\n\n"
                "  Start the API:      cd apps/api && .venv/Scripts/python.exe run.py\n"
                "  Or aim elsewhere:   PICKIXO_API=<url> python -m tests.test_api_flows\n"
            )
        self.assertEqual(status, 200, f"API not reachable at {BASE}")
        self.assertTrue(body["database"], "database is not reachable")


class PublicSurface(unittest.TestCase):
    def setUp(self) -> None:
        self.client = Client()

    def test_catalogue_is_readable_signed_out(self) -> None:
        status, body = self.client.get("/apps?vertical=tools")
        self.assertEqual(status, 200)
        self.assertTrue(body, "expected seeded tools")

    def test_search_groups_by_vertical(self) -> None:
        status, body = self.client.get("/search?q=CV")
        self.assertEqual(status, 200)
        self.assertIn("jobs", body["groups"])
        self.assertTrue(any(r["name"] == "CV Builder" for r in body["groups"]["jobs"]))

    def test_sitemap_excludes_everything_not_shipped(self) -> None:
        """§55: only live/beta public products may enter the sitemap."""
        status, body = self.client.get("/sitemap-data")
        self.assertEqual(status, 200)
        routes = [entry["route"] for entry in body["apps"]]
        for private in ("/dashboard", "/my-apps", "/settings", "/admin"):
            self.assertNotIn(private, routes)

        status, apps = self.client.get("/apps?limit=200")
        planned = {a["route"] for a in apps if a["status"] == "planned"}
        self.assertFalse(
            planned & set(routes),
            "a product that has not shipped reached the sitemap",
        )

    def test_every_product_resolves_at_its_own_route(self) -> None:
        """A route in the registry must actually serve that product.

        This exists because it did not. Products whose slug differs from the
        last segment of their route (ai-chat lives at /ai/chat) were 404ing on
        their own landing page while still being listed in the sitemap — an
        error page submitted to search engines as content.
        """
        status, apps = self.client.get("/apps?limit=200")
        self.assertEqual(status, 200)
        for app in apps:
            with self.subTest(slug=app["slug"]):
                code, body = self.client.get(
                    f"/app-by-route?route={urllib.parse.quote(app['route'], safe='')}"
                )
                self.assertEqual(
                    code, 200,
                    f"{app['slug']} is listed at {app['route']} but nothing resolves there",
                )
                self.assertEqual(body["slug"], app["slug"])

    def test_sitemap_entries_all_resolve(self) -> None:
        _, data = self.client.get("/sitemap-data")
        for entry in data["apps"]:
            with self.subTest(route=entry["route"]):
                code, _ = self.client.get(
                    f"/app-by-route?route={urllib.parse.quote(entry['route'], safe='')}"
                )
                self.assertEqual(
                    code, 200,
                    f"{entry['route']} is in the sitemap but does not resolve",
                )

    def test_private_routes_require_auth(self) -> None:
        for path in ("/me", "/me/apps", "/me/recent", "/admin/overview"):
            status, _ = self.client.get(path)
            self.assertEqual(status, 401, f"{path} was reachable signed out")

    def test_unconfigured_features_report_themselves_honestly(self) -> None:
        """§123: never claim a capability that is not configured."""
        _, providers = self.client.get("/auth/providers")
        _, status_body = self.client.get("/ai/status")
        _, health = self.client.get("/health")
        # Whatever the truth is, these three must agree with each other.
        self.assertEqual(
            status_body["available"], health["ai_providers_ready"] > 0,
            "AI availability disagrees with the number of ready providers",
        )
        self.assertIsInstance(providers["google"], bool)


class Authentication(unittest.TestCase):
    def setUp(self) -> None:
        self.client = Client()

    def test_short_password_is_refused_with_the_requirement(self) -> None:
        status, body = self.client.sign_up(unique_email("weak"), "short")
        self.assertEqual(status, 400)
        self.assertEqual(body["error"]["code"], "weak_password")
        self.assertIn("minLength", body["error"]["meta"])

    def test_sign_up_then_sign_in(self) -> None:
        email = unique_email("ok")
        status, body = self.client.sign_up(email)
        self.assertEqual(status, 201)
        self.assertEqual(body["user"]["email"], email)
        self.assertEqual(body["user"]["role"], "user")

        fresh = Client()
        status, body = fresh.post("/auth/sign-in",
                                  {"email": email,
                                   "password": "a-long-enough-passphrase"})
        self.assertEqual(status, 200)

    def test_refresh_token_never_appears_in_a_response_body(self) -> None:
        """An XSS bug must not be able to read a 30-day credential."""
        status, body = self.client.sign_up(unique_email("cookie"))
        self.assertEqual(status, 201)
        self.assertNotIn("refresh_token", body)
        require_session_cookie(self, self.client)

    def test_duplicate_email_is_refused(self) -> None:
        email = unique_email("dup")
        self.assertEqual(self.client.sign_up(email)[0], 201)
        status, body = Client().sign_up(email)
        self.assertEqual(status, 409)
        self.assertEqual(body["error"]["code"], "email_taken")

    def test_wrong_password_and_unknown_account_are_indistinguishable(self) -> None:
        """Otherwise sign-in becomes an account-enumeration oracle."""
        email = unique_email("enum")
        self.client.sign_up(email)

        _, wrong = Client().post("/auth/sign-in",
                                 {"email": email, "password": "wrong-passphrase-x"})
        _, missing = Client().post("/auth/sign-in",
                                   {"email": unique_email("nobody"),
                                    "password": "wrong-passphrase-x"})
        self.assertEqual(wrong["error"]["code"], missing["error"]["code"])
        self.assertEqual(wrong["error"]["code"], "invalid_credentials")


class RefreshRotation(unittest.TestCase):
    """The regression guard for the bug this suite exists because of."""

    def test_rotation_issues_a_new_token_each_time(self) -> None:
        client = Client()
        client.sign_up(unique_email("rot"))
        require_session_cookie(self, client)
        first = client.refresh_cookie
        self.assertEqual(client.post("/auth/refresh")[0], 200)
        self.assertNotEqual(first, client.refresh_cookie,
                            "refresh token was not rotated")

    def test_replaying_a_rotated_token_kills_the_whole_family(self) -> None:
        victim = Client()
        victim.sign_up(unique_email("steal"))
        require_session_cookie(self, victim)

        # The attacker copies the refresh token at this moment.
        stolen = victim.refresh_cookie

        # The victim carries on using the session, rotating as they go.
        self.assertEqual(victim.post("/auth/refresh")[0], 200)
        self.assertEqual(victim.post("/auth/refresh")[0], 200)

        # Replay the stolen value directly, with no cookie jar of its own —
        # this is the attacker holding one captured string and nothing else.
        request = urllib.request.Request(
            BASE + "/auth/refresh", data=b"", method="POST")
        request.add_header("Cookie", f"pickixo_session={stolen}")
        opener = urllib.request.build_opener(*_tls_handlers())
        try:
            with opener.open(request, timeout=20) as response:
                replay_status = response.status
        except urllib.error.HTTPError as exc:
            replay_status = exc.code
        self.assertEqual(replay_status, 401, "a replayed token was accepted")

        # And the victim's own live token must now be dead too: once a token has
        # demonstrably leaked, logging the user out beats leaving the attacker
        # a working session.
        status, _ = victim.post("/auth/refresh")
        self.assertEqual(
            status, 401,
            "family was not revoked — the reuse defence did not actually fire",
        )


class MyApps(unittest.TestCase):
    def setUp(self) -> None:
        self.client = Client()
        self.client.sign_up(unique_email("apps"))

    def _ids(self) -> list[str]:
        _, entries = self.client.get("/me/apps", auth=True)
        return [e["app"]["id"] for e in entries]

    def test_add_is_idempotent(self) -> None:
        self.assertEqual(self.client.post("/me/apps", {"slug": "ai-chat"},
                                          auth=True)[0], 201)
        self.assertEqual(self.client.post("/me/apps", {"slug": "ai-chat"},
                                          auth=True)[0], 201)
        self.assertEqual(len(self._ids()), 1)

    def test_pin_sorts_first_regardless_of_order(self) -> None:
        for slug in ("ai-chat", "pdf-compressor", "cv-builder"):
            self.client.post("/me/apps", {"slug": slug}, auth=True)
        last = self._ids()[-1]
        self.assertEqual(
            self.client.patch(f"/me/apps/{last}/pin", {"is_pinned": True},
                              auth=True)[0], 204)
        _, entries = self.client.get("/me/apps", auth=True)
        self.assertEqual(entries[0]["app"]["id"], last)
        self.assertTrue(entries[0]["is_pinned"])

    def test_reorder_persists(self) -> None:
        for slug in ("ai-chat", "pdf-compressor", "cv-builder"):
            self.client.post("/me/apps", {"slug": slug}, auth=True)
        reversed_ids = list(reversed(self._ids()))
        self.assertEqual(
            self.client.put("/me/apps/order", {"app_ids": reversed_ids},
                            auth=True)[0], 200)
        self.assertEqual(self._ids(), reversed_ids)

    def test_unknown_slug_is_not_found(self) -> None:
        status, _ = self.client.post("/me/apps", {"slug": "no-such-product"},
                                     auth=True)
        self.assertEqual(status, 404)

    def test_one_account_cannot_touch_another_accounts_list(self) -> None:
        self.client.post("/me/apps", {"slug": "ai-chat"}, auth=True)
        mine = self._ids()[0]

        other = Client()
        other.sign_up(unique_email("other"))
        self.assertEqual(other.delete(f"/me/apps/{mine}", auth=True)[0], 404)
        self.assertEqual(other.patch(f"/me/apps/{mine}/pin", {"is_pinned": True},
                                     auth=True)[0], 404)
        # Mine is untouched.
        self.assertEqual(self._ids(), [mine])

    def test_recommendations_exclude_what_is_already_added(self) -> None:
        self.client.post("/me/apps", {"slug": "ai-chat"}, auth=True)
        _, recommended = self.client.get("/me/recommended", auth=True)
        self.assertNotIn("ai-chat", [a["slug"] for a in recommended])

    def test_opening_a_product_shows_up_in_recently_used(self) -> None:
        self.assertEqual(self.client.post("/apps/ai-chat/opened", auth=True)[0], 204)
        _, recent = self.client.get("/me/recent", auth=True)
        self.assertEqual(recent[0]["app"]["slug"], "ai-chat")


class Quota(unittest.TestCase):
    def test_guest_and_signed_in_allowances_are_separate(self) -> None:
        guest = Client()
        _, guest_status = guest.get("/ai/status")
        self.assertTrue(guest_status["quota"]["is_guest"])

        member = Client()
        member.sign_up(unique_email("quota"))
        _, quotas = member.get("/me/quota", auth=True)
        text = next(q for q in quotas if q["kind"] == "text")
        self.assertFalse(text["is_guest"])
        self.assertGreater(text["limit"], guest_status["quota"]["limit"],
                           "signed-in users should get a larger allowance")


if __name__ == "__main__":
    print(f"testing against {BASE}\n")
    unittest.main(verbosity=2)
