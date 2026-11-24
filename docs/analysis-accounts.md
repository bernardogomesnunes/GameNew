# Analysis: accounts and the way into the game, for a public launch

Written 17 November 2026, from the code at the `claude/login-polish` branch and the live Neon Auth settings (read only). Tasks are ACCT-1 to ACCT-14 in `TASKS.md`, section 13.

## Verdict

Today's sign-in can carry a few thousand players. The plan limits are not the blocker: Neon's free plan includes 60,000 monthly active users. What blocks a public launch is the missing account flows. Nobody can reset a forgotten password, delete an account, or prove that an email is theirs. Sign-in also hangs on a database branch that is archived.

## What exists (measured 17 November)

| Part | State |
|---|---|
| Auth service | Neon Auth (managed Better Auth) on branch `auth (keep: holds sign-in)` (br-old-snow). That branch is **archived** since 12 November. Game data is on `production` (br-red-sound). See TECH-19. |
| Sign-in methods | Email and password only. Sign-up is open. |
| Email verification | Off: `verify_email_on_sign_up` false, `require_email_verification` false. |
| Password reset | Flow added 23 November (ACCT-2). `revoke_sessions_on_password_reset` is still false; the game revokes other sessions itself after the next sign-in. |
| Emails | Shared sender `auth@mail.myneon.app`, named "Neon Auth". |
| Google sign-in | Turned on in Neon with Neon's shared keys. The game has no Google button. |
| Allowed origins | `https://duild-seven.vercel.app` only, plus `allow_localhost` true. |
| Organization plugin | On (10 orgs, 100 members). The game does not use it. |
| Webhooks and log export | None on 17 November. Webhook receiver built in ACCT-12 (not yet switched on). Log export is not on this plan. |
| Database | Free plan. Compute 0.25 to 2 CU, region `aws-us-east-2`, 1 GB storage cap per project. `production` holds 85 MB. |
| Data access | Row-level security on every table, keyed on the JWT (see `analysis-scaling.md`). |
| Account deletion and export | None. |
| Privacy policy, terms, age check | None. |
| Content-Security-Policy | Present in `vercel.json`. |
| Guest play | Worlds are saved on the device, then moved to the account on first sign-in (`migrateLocalWorlds`). |

## Fixed in this branch

- **A wrong password showed nothing you could see.** The message was 11.5px grey text under "Create an account instead". A phone keyboard covered it. It now sits in red above the button, is read out (`role="alert"`), outlines the wrong field and selects the password. The SDK's raw errors (401, 429, network down, 5xx) become plain sentences. Empty or badly formed fields are caught before the request. Enter in either box submits.
- **The start screen and opening a world looked the same.** The start is now a night sky with pixel stars. Opening or making a world shows daylight and pixel ground growing behind the bar until it fills the screen.

## What a public launch needs, in order

### Must have before strangers sign up

1. **ACCT-1: give sign-in a live branch and a paid plan.** An archived branch has to be restored on the first request, so the first sign-in after a quiet spell waits for it. The free plan has no room to protect it, and its 1 GB cap blocks all saves once it is reached. Move to Launch, export users, and move Neon Auth onto `production` (TECH-19 lists what that move costs).
2. **ACCT-2: forgotten password.** Add "Forgot password?" with Better Auth's `forgetPassword` and `resetPassword`. Set `revoke_sessions_on_password_reset` to true so a reset logs out a thief.
3. **ACCT-3: your own email sender.** Send from your own domain (Resend or Postmark, with SPF, DKIM and DMARC). Mail from "Neon Auth" at a shared domain reads as phishing and often lands in spam.
4. **ACCT-4: verify the email.** Turn on `verify_email_on_sign_up` with the OTP method. Without it, a typo in the email makes an account nobody can recover, and anyone can sign up with someone else's address.
5. **ACCT-5: delete my account, and download my data.** Required by GDPR. Apple's App Store also requires in-app account deletion for any app that lets you create an account. It must remove `players`, `worlds`, `world_chunks`, `progression`, `templates` and the auth user.
6. **ACCT-6: privacy policy, terms and an age question.** A game draws children. COPPA (US) needs parental consent under 13, and GDPR sets the age between 13 and 16 by country. Simplest rule: an age gate at sign-up, and under the limit you play as a guest only.
7. **ACCT-7: bot protection.** Put Cloudflare Turnstile on sign-up and sign-in. Open sign-up with no check fills the user table with junk and burns MAU and email quota.
8. **ACCT-8: a domain of your own.** Put it in `trusted_origins` and set `allow_localhost` to false in production. Development uses a separate Neon branch with localhost allowed.

### Should have in the first months

9. **ACCT-9: sign in with Google and Apple.** On phones, one tap beats typing a password. Use your own OAuth keys, because Neon's shared Google keys are for development. If the game ships on iOS with Google sign-in, Apple requires Sign in with Apple too.
10. **ACCT-10: sessions.** Add "Sign out of all devices" and a session list. Decide how long a session lasts (Better Auth's default is 7 days, refreshed on use).
11. **ACCT-11: a player name.** Today the display name is the part of the email before the @. Shared worlds and leaderboards need a chosen, unique, moderated name.
12. **ACCT-12: see what is happening.** Turn on the `user.created` webhook and auth log export. Alert on sign-in failure spikes and 5xx responses. Add an admin view to find an account and its worlds for support.

### For growth past about 10,000 players

13. **ACCT-13: database capacity.** Keep compute awake (TECH-16), raise the autoscaling ceiling above 2 CU, and add `player_id` to `world_chunks` so row-level security stops running a subquery per row (`analysis-scaling.md`). Add a second region, or a read replica, if many players are far from us-east-2. EU players' data residency is a GDPR question too.
14. **ACCT-14: two devices on one world.** Saves are last-writer-wins today. Shared or multi-device play needs the revision check described in `analysis-scaling.md`.

## ACCT-7 setup: Cloudflare Turnstile

The code is built and off by default. Two switches turn it on: a build variable (the widget) and a Neon Auth setting (the check). Do the widget first, then the check, or every sign-in is refused.

1. Cloudflare dashboard, Turnstile, Add widget. Hostnames: the production domain, the Vercel preview domain, and `localhost` for development. Mode: Managed. Copy the **site key** (public) and the **secret key** (private).
2. Vercel, Project, Settings, Environment Variables: add `VITE_TURNSTILE_SITE_KEY` = the site key, for Production (and Preview if wanted). Redeploy, because Vite reads it at build time. The secret key never goes here.
3. Check the widget: open Sign in on the deployed site. A Turnstile box appears under the password field, and the Network tab shows `challenges.cloudflare.com` loaded only after the form opens.
4. Neon Console, the project, Auth, captcha setting (Better Auth `captcha` plugin): provider Cloudflare Turnstile, paste the **secret key**, save. The server then reads the token from the `x-captcha-response` header on sign-up and sign-in and rejects requests without a valid one. The exact label may differ by console version.
5. Test sign-up and sign-in on the live site. Then try one without the widget (curl to the sign-up route), which must fail.

Details:
- With no `VITE_TURNSTILE_SITE_KEY`, no script loads, no widget shows and no header is sent. Sign-in works as before.
- `vercel.json` allows `https://challenges.cloudflare.com` in `script-src` and `frame-src`. Nothing else changed in the policy.
- A token works once. The form asks for a new one after every attempt.
- Gap: the sign-in the app runs after a confirmed email code (only if the server did not sign in on its own) sends no token. With `auto_sign_in_after_verification` on, that path is not used.
- Google and Apple sign-in (ACCT-9) are not covered by the plugin's header check and are untouched.

## Passwords and sessions (ACCT-2, ACCT-10, 23 November)

Endpoints the game calls on Neon Auth (Better Auth client): `requestPasswordReset`, `resetPassword`, `listSessions`, `revokeSession`, `revokeOtherSessions`, `revokeSessions`, plus `getSession` to mark this device.

**Reset flow.** "Forgot password?" sends `requestPasswordReset` with `redirectTo` set to this app's origin plus `/?reset=1`. The emailed link goes through Neon Auth and lands on `/?reset=1&token=...` (or `&error=INVALID_TOKEN`). The game moves the token into memory, clears it from the address bar, and shows a new-password panel. The reply is the same whether or not the email has an account.

**Revoking sessions on reset.** `revoke_sessions_on_password_reset` is false on Neon, and changing it is a Neon setting, so the game does not touch it. A reset leaves the browser signed out, so there is no session to revoke with yet. The game sets a flag at reset and calls `revokeOtherSessions` right after the next successful sign-in (flag kept in `localStorage`, cleared on success). Gap: a thief's session lives until that sign-in. Setting the flag to true in Neon closes the gap and needs no code change.

**Session length.** Decision: keep Neon Auth's default. Better Auth's default is `expiresIn` 7 days with `updateAge` 1 day, so a session ends after 7 days idle and renews when used after a day. Neon Auth does not let the client change it, and the game does not try. Read from the Better Auth source in `node_modules`; the live Neon value was not read in this task. Check the live value with `get_neon_auth_config` if it matters.

**Session list.** The account panel shows each session as browser and system (from the user-agent) with last active time. This device is marked and has no Sign out. "Sign out other devices" calls `revokeOtherSessions`. "Sign out everywhere" asks first, calls `revokeSessions`, and signs this device out too.

## Costs, from Neon's published plans (17 November 2026)

- Free: 60,000 MAU per project for auth, 1 GB storage, 5 GB egress a month. Running out of compute hours or egress suspends the database until the next month.
- Launch: up to 1M MAU per project, usage-based compute and storage.
- `production` used 636 MB of egress so far this month, with a handful of players. At a few hundred daily players the free egress runs out first.

## Delete my account and download my data (ACCT-5, 23 November)

Account panel, section "Your data".

- **Download my data** builds one JSON file in the browser from the normal reads (worlds list, each world's metadata and chunks, progression, designs). Chunk bytes are base64. A world that cannot be read is listed under `failed` in the file. It works with or without migration 0009.
- **Delete my account** asks twice: a yes/no showing the world count, then the word DELETE typed out. The game then (1) calls `delete_my_account_data()` (migration 0009), which deletes for the caller's own JWT identity only, (2) asks Neon Auth to delete the sign-in user (Better Auth `deleteUser`), (3) signs out. Saves are blocked in the client between steps 1 and 3 so an autosave cannot re-create a world.
- **The button is hidden** until the database answers the function's dry run. A database without 0009 shows only Download.
- **Neon setting needed for step 2.** Better Auth answers 404 from `/delete-user` unless the server has `user.deleteUser.enabled`. The game cannot change that, and the Neon Auth settings this project's tools expose do not list it (read in code, not tested against the live service: the auth config could not be read in this task). If Neon has not enabled it, the game data is still deleted, the player is signed out, and the panel says: "Your worlds and progress are deleted. Your sign-in record could not be removed from the game". The owner then removes the user in the Neon console (Auth, Users) or by asking Neon to enable user deletion.
- **Fresh session.** Better Auth refuses `deleteUser` on a session older than its freshness window unless the password is sent. The panel then shows a password field, and retries only the sign-in step. The data is not deleted twice.

## ACCT-12 setup: webhook, alert, support lookup (24 November)

Built, all additive. Nothing runs until the owner does the steps below.

**Skipped: auth log export.** `get_neon_auth_config` returns `logs_export` null: this plan does not offer it. Revisit if the plan changes (ACCT-1).

**Webhook receiver.** `api/auth-webhook.js` (Vercel function, URL `https://duild-seven.vercel.app/api/auth-webhook`). It checks Neon's Ed25519 detached JWS against the keys at `<Neon Auth URL>/.well-known/jwks.json`, rejects a timestamp more than 5 minutes off, and answers 401 on a bad signature, 500 if no auth URL can be found, 413 over 64 KB. For `user.created` it logs one JSON line: tag `neon-auth-webhook`, event id, user id, provider, email domain (not the address), verified flag. It writes nothing to the database. Read the lines in Vercel, project, Logs, search `neon-auth-webhook`.

Do not subscribe `user.before_create`. Neon rejects the sign-up when that endpoint fails, so an outage would block every new account. `user.created` is non-blocking: a failing endpoint costs a log line only.

**Alert.** `scripts/check-save-failures.mjs` counts `save_failures` rows from the last 24 hours and exits 1 over `SAVE_FAILURE_THRESHOLD` (default 10). `.github/workflows/save-failure-alert.yml` runs it daily at 06:17 UTC and on demand. A failed run makes GitHub email repository watchers.

**Support lookup.** `ADMIN_DATABASE_URL='...' node scripts/admin-lookup.mjs <email | auth user id | player id> [--json]`. Prints the sign-in record, chosen name, worlds (live and deleted) with chunk counts, last save time, and the last 10 `save_failures`. Read-only: one select per statement, sent as a read-only batch, and the connection string is never printed.

Both scripts need a role that can read across players. Row-level security hides other players' rows from ordinary roles. The project owner role bypasses it. Use the pooled connection string of `production` (br-red-sound-aea4rbqt).

### Owner steps

1. **Vercel**: nothing to add if `VITE_NEON_URL` is set for Production (it is: the game needs it). The function derives the Neon Auth URL from it, the same way the game does. Optional override: `NEON_AUTH_URL` (Neon Console, Auth, Configuration; no trailing slash). Redeploy so the new `api/` function is built.
2. **Check the endpoint** after the deploy: `curl -i https://duild-seven.vercel.app/api/auth-webhook` answers 405. An unsigned POST answers 401.
3. **Neon Console**, Auth, Configuration, Webhooks, branch `production`: enabled, URL `https://duild-seven.vercel.app/api/auth-webhook`, events `user.created` only, timeout 5. CLI equivalent: `neon neon-auth config webhook update --enabled --url https://duild-seven.vercel.app/api/auth-webhook --enabled-events user.created --timeout 5`.
4. **Test**: create one test account. A `neon-auth-webhook` line with its user id appears in Vercel Logs within seconds. Delete the test account after.
5. **GitHub**, repository Settings, Secrets and variables, Actions: secret `ALERTS_DATABASE_URL` = a `production` connection string for the owner role. Optional variable `SAVE_FAILURE_THRESHOLD`. Then Actions, Save failure alert, Run workflow once to confirm it prints a count and exits 0.
6. **Support machine**: keep a connection string in the shell as `ADMIN_DATABASE_URL` when using the lookup. Never commit it.

Limits: the webhook has no retry store, so a missed `user.created` is not replayed (Neon has no redelivery). The alert counts rows only; `save_failures` is written by the client after retries, so a player who cannot sign in logs nothing (PLAY-1).
