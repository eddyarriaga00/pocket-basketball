# Accounts and saves in an account

The game's accounts live on the same Firebase project as the chat (`blockfootball-a13c9`, shared with Pocket Football).
Two things have to be switched on once, in the Firebase console, by the project's owner. **Done on 2026-11-23:** Email/Password is enabled, `eddyarriaga00.github.io` is an authorized domain, and the rules below are published. Until they are, the Account
page says so and nothing breaks: careers stay on the phone as before.

## 1. Turn on email and password sign-in

Firebase console → the project → **Build → Authentication → Sign-in method** → **Email/Password** → Enable (leave
"Email link" off) → Save. Anonymous sign-in (used by the chat) stays on.

While there, **Authentication → Settings → Authorized domains** should list `eddyarriaga00.github.io` (it is needed for
the password-reset and confirmation emails to link back to the game).

## 2. Publish the database rules

Firebase console → **Build → Realtime Database → Rules**. Replace the whole text with the contents of
`docs/firebase-rules.json` from this repository and press **Publish**.

The file is the chat's rules as they are now (identical to Pocket Football's `docs/firebase-rules.json`) plus two new
parts, `saves` and `accounts`:

- `saves/<uid>`: one copy of a player's whole save. Only that player can read or write it, and only when signed in with
  a password (an anonymous chat session cannot). Each field is checked: the save at most 6 MB of text, a time that is
  not in the future, a device id, and three short labels (a name, how many players, up to three player names).
- `accounts/<uid>`: the account's name and when it last saved. Same owner-only rule.

Pocket Football keeps working: its chat paths are unchanged. If Pocket Football's rules are ever changed, paste the union
of the two files, not one over the other.

## What is stored, and deleting it

An account holds an email address and a password (kept by Firebase Authentication, never by the game), a name, and the
copy of the save. **Delete my account** on the Account page removes the save copy, the `accounts` entry and the sign-in.
The owner can also delete a user from **Authentication → Users**; their `saves/<uid>` entry can then be removed from the
Realtime Database data view.

## Free plan limits

The Spark plan allows 1 GB stored and 10 GB downloaded a month. A save is usually 50–300 KB after gzip, so the limits
are far away for a hobby game, but a few thousand active players copying up after every game would reach them.
