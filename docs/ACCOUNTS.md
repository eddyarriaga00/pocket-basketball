# Accounts and saves in an account

The game's accounts live on the same Firebase project as the chat (`blockfootball-a13c9`, shared with Pocket Football).
Two things have to be switched on once, in the Firebase console, by the project's owner. **Done on 2026-11-23:** Email/Password is enabled, `eddyarriaga00.github.io` is an authorized domain, and the rules below are published. Until they are, the Account
page says so and nothing breaks: careers stay on the phone as before.

## 1. Turn on email and password sign-in

Firebase console → the project → **Build → Authentication → Sign-in method** → **Email/Password** → Enable (leave
"Email link" off) → Save. Anonymous sign-in (used by the chat) stays on.

While there, **Authentication → Settings → Authorized domains** should list `eddyarriaga00.github.io` (it is needed for
the password-reset and confirmation emails to link back to the game).

## 1b. Google and GitHub sign-in

The sign-in page also has **Continue with Google** and **Continue with GitHub** (a pop-up window; a chat that has you
signed in anonymously is linked to the account, as email sign-up does). Signing in with Google or GitHub skips the email
confirmation, and the account page has no password row; deleting the account asks the provider to confirm it is you.

- **Google: on since 2026-11-24.** Authentication → Sign-in method → Google → Enable, with a support email. Its public
  name on Google's consent screen is the project's public-facing name (Project settings → General).
- **GitHub: not on yet.** It needs a GitHub OAuth app of its own (the one on another Firebase project cannot be reused,
  because a GitHub OAuth app has one callback URL):
  1. github.com → Settings → Developer settings → OAuth Apps → **New OAuth App**. Homepage URL
     `https://eddyarriaga00.github.io/pocket-basketball/`; authorization callback URL
     `https://blockfootball-a13c9.firebaseapp.com/__/auth/handler`.
  2. Register it, then **Generate a new client secret**.
  3. Firebase → Authentication → Sign-in method → Add new provider → **GitHub** → Enable, paste the Client ID and the
     Client secret → Save.
  Until then the GitHub button says GitHub sign-in is not switched on yet.

A GitHub or Google account with the same email as an existing password account is refused with "That email already
has an account here" (Firebase's one account per email setting); sign in with the password instead.

## 2. Publish the database rules

Firebase console → **Build → Realtime Database → Rules**. Replace the whole text with the contents of
`docs/firebase-rules.json` from this repository and press **Publish**.

The file is the chat's rules as they are now (identical to Pocket Football's `docs/firebase-rules.json`) plus two new
parts, `saves` and `accounts`:

- `saves/<uid>`: one copy of a player's whole save. Only that player can read or write it, and only when signed in with
  a password, Google or GitHub (an anonymous chat session cannot). Each field is checked: the save at most 6 MB of text, a time that is
  not in the future, a device id, and three short labels (a name, how many players, up to three player names).
- `accounts/<uid>`: the account's name and when it last saved. Same owner-only rule.

Pocket Football keeps working: its chat paths are unchanged. The project is also shared with PocketSoccer (its
`soccer/<uid>` saves): always publish the union of all the games' rules, never one file over another. PocketSoccer's
`docs/firebase-rules.json` is that union; the version published on 2026-11-24 is it with Google and GitHub allowed.

## What is stored, and deleting it

An account holds an email address and a password (kept by Firebase Authentication, never by the game), a name, and the
copy of the save. **Delete my account** on the Account page removes the save copy, the `accounts` entry and the sign-in.
The owner can also delete a user from **Authentication → Users**; their `saves/<uid>` entry can then be removed from the
Realtime Database data view.

## Online play: the park and games (rules published 2026-11-25, runs 2026-11-26)

Online play uses the same project, with anonymous sign-in (as the chat), under three paths in `docs/firebase-rules.json`:

- `bpark/<ROOM>/<uid>`: who is in a park (`PUBLIC`, or a private code of 4 to 8 capitals and digits): a name, what the
  player looks like and his ratings (`k`, up to 2000 characters), where he is (`s`, a short line a few times a second)
  and when he came. Only he can write his own entry; anyone signed in can read a room. It is removed when he leaves or
  his connection drops.
- `bchal/<to>/<from>`: a challenge and its answer. Only the two of them can write it, and only the one it is for can
  read his own.
- `bgame/<gid>`: a game. `m` (who hosts, the guests as `,uid,uid,`, the teams) is written once by the host; `s` (the
  host's frames, up to 12000 characters) only by the host and read only by the guests; `i/<uid>` (each guest's stick and
  buttons) only by that guest and read only by the host. The host removes the game when it ends. A run (more than two
  people in one game) is the same game with up to nine guests; its invitations are challenges marked `run`.

A game sends about fifteen frames a second to the guest: 0.5 KB in a 1 on 1, about 2 KB in a full game, so roughly
25 MB (1 on 1) to 120 MB (full game) downloaded per hour played. Within the Spark plan's 10 GB a month that is some
80 hours of full games a month across everyone; past that, Firebase stops serving until the month turns over (nothing is
charged on Spark). In a run each guest downloads the same frames, so a full game with nine guests is nine times the
download. `tools/online.js` plays two windows against each other with no network (`KIND=3` or `KIND=5`);
`tools/online-run.js` three (`KIND=5` for a full game, `LOW=1` for low graphics, which a software GPU needs there).

## Free plan limits

The Spark plan allows 1 GB stored and 10 GB downloaded a month. A save is usually 50–300 KB after gzip, so the limits
are far away for a hobby game, but a few thousand active players copying up after every game would reach them.
