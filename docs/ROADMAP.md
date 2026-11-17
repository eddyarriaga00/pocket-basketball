# PocketBasketball roadmap

The order of work. [PLAN.md](PLAN.md) is the design. Update this file after every item.

## Ground rules

- Commit on `main` and push `main`; every push redeploys the GitHub Pages site, so run the tests in "How to test" first.
- Before a push that changes how the game plays, add a line to **Rollback points** with the commit `main` is on.
  To go back: `git revert --no-edit <commit>..main`, then push.
- All teams and players are fictional. No real league, team or player names.

## Rollback points

(newest first)

- `c70b508`, before career depth (trust, rival, feed, press, badges), the playoffs and awards night, the booth, team fouls and the pick-and-roll (2026-11-17).

## How to test

```
python3 tools/serve.py 8000          # then open http://localhost:8000 (phone: your computer's address on the same Wi-Fi)
node tools/smoke.js                  # a career loop with real input; must print "errors []"
node tools/balance.js 6              # six 48-minute computer games against the league's numbers
node tools/drill.js                  # the combine and the 3-point contest, shot by shot
node tools/career.js                 # five short seasons: playoffs, awards, contracts, free agency, retirement
```
The two node tools need Playwright (`npm i -g playwright`).

## M0 · Prototype (done, 2026-11-16)

- [x] Repo, GitHub Pages, manifest, offline service worker, icons
- [x] 30 fictional teams in the league's cities, 14 ratings, overall by position, six builds with ceilings
- [x] 3D arena: court markings, team paint and logo, hoops with glass and swishing nets, stands, player figures
      scaled by height with run, dribble, shoot, guard, contest and reach poses
- [x] Portrait camera that follows the ball; zoom
- [x] 5-on-5: spacing spots, cuts, drives, kick-outs, man defense with help, contests, box-outs
- [x] Shot model (rating × contest × release), blocks, shooting fouls, and-ones, free throws, rebounds, steals,
      interceptions, shot clock, quarters, overtime
- [x] Controls: floating stick, Shoot (meter) / Pass / Move, Call and Cut off the ball, Jump and Steal on
      defense, auto-guard when your thumb is up, keyboard
- [x] Teammate grade live and after the game, with what moved it
- [x] Career: create, draft night, hub (home, player, league, log), play or sim, skill points and upgrades,
      standings, news, season awards, next season with aging
- [x] Quick game; settings (quarter length, difficulty, season length); pause with sim-to-end
- [x] Tests: `tools/smoke.js`, `tools/balance.js`
- [x] Cameras (2026-11-16): player lock (the default, behind your player toward the rim in play), broadcast
      (the sideline) and overhead, in Settings and on the pause screen

## M1 · Feel (next)

- [x] Sound (2026-11-16): recorded CC0 squeaks, net, dribble, board and whistle (`tools/sfx.py`, credits in
      docs/CREDITS.md); the crowd, rim, horn, buzzer, catches and menu beat made in code; the crowd follows the home
      team, rises late in close games, hushes at the line and chants on defense; muffled on pause; Sound and Menu
      music switches in Settings

- [x] Balance against the league (2026-11-17, 4 games): 115.9 pts, 89.6 FGA at 47.3%, 35.1 threes at 33.8%, 23.9 FTA
      at 81%, 9 TOV, 9 STL, 3.4 BLK, 40 REB, 32 AST, 2 alley-oops (real: 114, 89 at 47.5%, 35 at 36%, 22, 14, 8, 5,
      44, 27). Help defense, closeouts and switches on screens. `tools/balance.js` prints make rates by shot type.
- [ ] Turnovers, blocks and fouls are still a little low; a few too many threes
- [x] The pick-and-roll: the big screens the handler's man, who gets caught; the big rolls (2026-11-17)
- [x] Team fouls and the bonus; contact fouls on drives; floaters (2026-11-17)
- [x] The booth: two original voices recorded with Chatterbox, 122 lines in 35 calls, wired to the game (2026-11-17)
- [x] Real player bodies (2026-11-17): Quaternius's CC0 mannequin with idle, walk, jog, sprint, jump and stance
      clips blended by speed; jersey, shorts, socks and shoes painted on by body region in team colors; numbers and
      hair; dribble, jumper, follow-through, contest, reach and defensive arms set in code; the ball in the real hand
- [ ] Faces and hair styles (Quaternius Universal Base Characters, CC0), jersey trim, shorts that sway
- [x] Dribble moves on the Move button: swipe for a crossover either way, a step-back, a spin (2026-11-17)
- [x] Alley-oops to cutters (yours with Cut or Call), post-ups and hook shots for bigs, floaters (2026-11-17)
- [x] Stamina: sprinting drains it, empty legs are slow and short (2026-11-17)
- [ ] Euro step; dunk variety
- [x] Vibration on releases, makes, steals and blocks (Android) (2026-11-17)
- [x] Replays of dunks, your and-ones and shots at the buzzer (2026-11-17)
- [ ] Out-of-bounds inbound plays (a man takes it out on the sideline or baseline)
- [ ] Backcourt and three-second violations, goaltending

## M2 · Career depth

- [x] Coach trust from grades sets your role; followers; a social feed; press conferences with three answers (2026-11-17)
- [x] A draft-class rival in your division, with head-to-head stats and rival games (2026-11-17)
- [x] Twelve badges, bronze to gold, earned by doing the thing in games, each with a small effect (2026-11-17)

- [x] Off the bench: a sixth man checks in mid-first quarter, a bench player in the second (2026-11-17)
- [ ] Substitutions, fatigue and foul trouble during a game
- [x] A word from the coach every five games; ask for more minutes (it works when you've earned it) (2026-11-17)
- [x] Game goals: three a game by position, +2 skill points each (2026-11-17)
- [x] Team practice between games: the spot-up drill for up to 5 skill points (2026-11-17)
- [x] League leaders; your games count at full length for leaders, awards and value (2026-11-17)
- [x] Pre-draft combine: fifteen spot-up shots in 45 seconds that move your draft stock (2026-11-17)
- [ ] Combine agility and vertical drills; team interviews
- [ ] Career highs on the broadcast; the record book

## M3 · The season around you

- [x] Play-in (7-10) and playoff series (best of 1/3/5/7 by season length), a bracket, the Finals (2026-11-17)
- [x] Awards night: MVP, Rookie of the Year, DPOY, Sixth Man, Most Improved, All-League teams, Finals MVP; All-Star picks at midseason (2026-11-17)

- [ ] Real schedule (division, conference, other conference weights), back-to-backs
- [ ] League leaders from simmed box scores
- [x] All-Star weekend 3-Point Contest: five racks, money balls, against seven of the league's shooters (2026-11-17)
- [ ] Dunk contest; the All-Star game itself
- [ ] Injuries (day-to-day, out for weeks)

## M4 · Contracts and legacy

- [x] Rookie deal scaled by pick, an extension offer with a year left, free agency with four offers (money, years,
      projected role, team strength), trade requests, career earnings (2026-11-17)
- [ ] Ten-man rosters to fifteen; trades and signings across the league
- [x] Retirement from 33 and the Hall of Fame vote; your athleticism slips after 30 (2026-11-17)
- [ ] Jersey retirement ceremony

## M5 · More modes and polish

- [x] Whole-team control in quick games: you are the ball handler, or the man guarding it; Switch on defense (2026-11-17)
- [ ] A season mode for a whole team; training camp; the contests from the menu
- [x] Up to six careers on a device; back one up to a file and bring it in on another device (2026-11-17)
- [x] Practice: the 3-point contest and the spot-up drill from the menu, with a best score (2026-11-17)
- [x] Edit teams on your device: city, nickname, short name, colors (2026-11-17)
- [ ] Commentary recorded on a local speech model
- [x] Game controllers (2026-11-17)
- [ ] Landscape and desktop layouts
- [ ] Online head to head by code
