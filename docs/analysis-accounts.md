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
| Password reset | No flow in the game. `revoke_sessions_on_password_reset` is false. |
| Emails | Shared sender `auth@mail.myneon.app`, named "Neon Auth". |
| Google sign-in | Turned on in Neon with Neon's shared keys. The game has no Google button. |
| Allowed origins | `https://duild-seven.vercel.app` only, plus `allow_localhost` true. |
| Organization plugin | On (10 orgs, 100 members). The game does not use it. |
| Webhooks and log export | None. |
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

## Costs, from Neon's published plans (17 November 2026)

- Free: 60,000 MAU per project for auth, 1 GB storage, 5 GB egress a month. Running out of compute hours or egress suspends the database until the next month.
- Launch: up to 1M MAU per project, usage-based compute and storage.
- `production` used 636 MB of egress so far this month, with a handful of players. At a few hundred daily players the free egress runs out first.
