# Bao's Fantasy Game

## Play online

The GitHub Pages version uses Supabase Auth and PostgreSQL for registered
accounts, wallets, quests and leaderboards. Sign up with a unique username,
email address and password. If email confirmation is enabled, follow the
verification link before logging in. The browser-only Guest option keeps its
progress on that browser and does not submit scores to the online leaderboard.
Supabase's built-in mail service is restricted to authorized project-team
addresses. To let the public receive signup emails, configure a custom SMTP
provider and sender in the Supabase dashboard; keep its credentials there.

In Supabase Authentication URL Configuration, set the Site URL to
`https://nguyenbaole02112000-lab.github.io/fantasygame/` and include the same
URL in the allowed redirect URLs. The project URL and publishable key in
`supabase-client.js` are intended for browser use. Never add a secret key,
service-role key, database password, or player password to the client or Git.

The SQL migrations in `supabase/migrations` establish the schema and access
rules. `supabase/functions/verify-run` must be deployed as an Edge Function;
it uses Supabase's server-only default environment variables. Client-submitted
actions are replayed on the server before score and Candy updates are accepted.
This detects inconsistent play but cannot prevent every automated player.

The shop exchanges 10 Coin for 5 Candy, up to five times per day. Shop and
daily quests reset at midnight in Asia/Ho_Chi_Minh; weekly quests reset at
midnight on Monday. Online games stop just before the daily reset. Their
verified progress is assigned to the period in which they started. If it
arrives after the period closes, completed rewards are settled automatically.
Special Quests are reserved for future entity unlocks and currently empty.

Admin membership is maintained by the project owner in the private
`game_private.admin_roles` table, using a verified Supabase user ID. No admin
password or role is stored in the browser. Admin Mode is a per-session trial:
it does not permanently unlock characters or award gameplay progress.

Unverified run snapshots remain in the browser and are retried after
reconnection. Do not clear browser data while a sync warning is visible.

## Local testing

Install Node.js 22.13 or newer and run `node account-server.js`, then open
`http://[::1]:8080/`. This starts the separate local account server. Its local
accounts are not Supabase accounts, and local game results are not sent to the
online leaderboard. Local account data is stored in `.fantasy-game` in the
user's home directory, outside the website; keep that directory to preserve
local accounts. The separate local server identifies its Guest by the IPv6
address it sees; an address can be shared or change and is not a secure
credential. Back up `.fantasy-game` separately before moving computers.

Run `node build.cjs` to validate and build the static site in `.tools/site-build`.
For a Supabase preview on this computer, run `node preview.cjs` and open
`http://127.0.0.1:8080/index.html?auth=cloud`. This opt-in preview uses the
same Supabase project; the local account server remains separate.

Run `node tests/replay-parity.cjs`, `node tests/reset-timing.cjs` and
`node tests/run-sync.cjs` to check
the simulator and reset handling. UI smoke tests use mocked online responses
and the local Codex Playwright/Chrome installation. Database SQL tests use
generated fixtures in a transaction and roll them back; `tests/local-sql.cjs`
additionally requires PGlite 0.3.14 in `.tools/pglite/package` or an absolute
module path in the `PGLITE_MODULE` environment variable.
`node tests/local-server.cjs` checks the separate local account server using a
new temporary data directory rather than the player's local database.
