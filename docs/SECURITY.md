# Security posture

What is actually enforced, and what is not yet. Claims here are testable; where a
test exists it is named.

---

## Enforced

**Passwords are never stored.** Argon2id (64 MB, t=3, p=2), salted per password,
with automatic rehash when parameters change. Comparison against a dummy hash
when an account does not exist, so timing does not distinguish "no such user"
from "wrong password".

**Account enumeration is closed.** Wrong password and unknown account return the
same code, `invalid_credentials`, with the same status.
→ `test_wrong_password_and_unknown_account_are_indistinguishable`

**Refresh tokens are opaque and stored only as SHA-256.** A dump of `sessions`
yields nothing usable. Tokens rotate on every use, and replaying a rotated token
revokes the entire family — being logged out beats leaving an attacker a live
session.
→ `test_replaying_a_rotated_token_kills_the_whole_family`

This one is worth reading the code for. The first implementation issued the
revocation *inside* the transaction and then raised to report it, which rolled
the revocation back: the stolen token was rejected, the family stayed live, and
the defence looked like it worked while doing nothing. The fix is structural —
`rotate_session` decides under the row lock and applies consequences after the
commit — and the test above exists because of it.

**Tokens never reach JavaScript.** Both the refresh and access tokens are
httpOnly cookies. An XSS bug can act inside the current page but cannot
exfiltrate a credential.
→ `test_refresh_token_never_appears_in_a_response_body`

**CSRF.** `SameSite=lax` on both cookies: the browser will not attach them to a
cross-site POST/PATCH/PUT/DELETE, which is every state-changing route.

**Transport.** The web tier serves HTTPS — TLS 1.3 negotiated, TLS 1.2 as the
floor — and both cookies are set `Secure`, so neither is ever sent in clear. The
certificate is self-signed in development; production needs a real one. The API
listens on plain HTTP bound to loopback, which never touches a network; in
production nginx terminates TLS and proxies plaintext to both processes.

**Privilege escalation is blocked in the database, not the application.** A
trigger refuses any change to `users.role` or `users.status` unless
`pickixo.privileged` is set, which only the admin path does. Application code is
exactly what an attacker who finds a mass-assignment bug gets to run, so the
check does not live there.
→ `privilege: role change blocked by trigger`

**Admin is a role on the row loaded for this request**, not an email comparison
and not a JWT claim. A token minted before a demotion still says `role: admin`;
the admin panel is precisely where that must not be trusted.

**One account cannot reach another's data.** No route takes a user id from the
client; every user-scoped query carries the caller's own id.
→ `test_one_account_cannot_touch_another_accounts_list`

**Quota cannot be oversold.** Consumed atomically in one statement whose WHERE
clause refuses at the limit. Verified with 20 concurrent connections against a
limit of 5: exactly 5 granted.

**The database is not reachable from the network.** `listen_addresses =
localhost`, and `pg_hba.conf` allows only loopback with scram-sha-256. No `trust`
anywhere.

**The application role cannot alter the schema.** `pickixo_app` is
NOSUPERUSER/NOCREATEDB/NOCREATEROLE with DML only, no DDL, and `UPDATE`/`DELETE`
revoked on `audit_logs` so it cannot rewrite its own trail.

**Provider API keys are server-side only.** There is no `api_key` column on
`ai_providers` and there must never be one; the admin API reports
`configured: true|false`. No key appears in any response, and `.env` is
gitignored — verified by `git ls-files` in the commit flow.

**Errors carry a code, never internals.** One handler renders every failure as a
stable code plus a translation key. Stack traces, SQL, upstream bodies and
provider names go to the log with a request id and nowhere else. Pydantic's
default validation body is suppressed, because for a sign-in form it would echo
the submitted password back.

**Google sign-in verifies the id_token properly.** Signature checked against
Google's JWKS (cached, refetched on rotation), audience pinned to our client id,
issuer checked. Decoding without verification and trusting the payload is the
classic way this integration becomes "anyone can claim any email". An unverified
Google email is refused rather than linked, since otherwise anyone able to create
a Google account with someone else's address could take over their Pickixo
account.

---

## Not yet enforced

Listed plainly rather than omitted.

- **Row-level security.** Ownership is enforced in the query layer only. RLS
  would be defence in depth underneath it; it is not in place.
- **Login rate limiting / lockout.** `LOGIN_MAX_ATTEMPTS` and
  `LOGIN_LOCKOUT_SECONDS` are configured but not consulted. Argon2 makes online
  guessing slow, not impossible. **This is the most important gap.**
- **Per-IP request throttling.** Only the daily quota limits AI; nothing limits
  request rate generally.
- **Email verification.** The `auth_tokens` table and the `verify_email` purpose
  exist; no email is sent, so addresses are unverified for email sign-ups.
- **Password reset.** Same: the table supports it, the flow is not built.
- **Content Security Policy.** Other security headers are set; CSP is not.
- **A certificate a browser will trust.** Development uses a self-signed one,
  which browsers correctly refuse without a click-through. `pickixo.com` needs a
  certificate from a real CA, issued to the actual domain.

---

## Before production

1. Set `APP_ENV=production` and an https `SITE_URL`. The API refuses to start
   otherwise, and refuses too if `SESSION_COOKIE_SECURE` is false — it is
   already true by default.
2. Build login rate limiting.
3. Put nginx, holding a real certificate, in front of both processes; neither
   should be exposed directly. The Node HTTPS server in `apps/web/server.mjs` is
   for local development, not for terminating public traffic.
4. Rotate `JWT_SECRET` and `GUEST_KEY_SALT` away from the development values.
5. Confirm `.env` is absent from every backup destination (§94).
