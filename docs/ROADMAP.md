# PocketBasketball roadmap

The order of work. [PLAN.md](PLAN.md) is the design. Update this file after every item.

## Ground rules

- Commit on `main` and push `main`; every push redeploys the GitHub Pages site, so run the tests in "How to test" first.
- Before a push that changes how the game plays, add a line to **Rollback points** with the commit `main` is on.
  To go back: `git revert --no-edit <commit>..main`, then push.
- All teams and players are fictional. No real league, team or player names.

## Rollback points

(newest first)

- *(none yet: `main` starts at the prototype)*

## How to test

```
python3 tools/serve.py 8000          # then open http://localhost:8000 (phone: your computer's address on the same Wi-Fi)
node tools/smoke.js                  # a career loop with real input; must print "errors []"
node tools/balance.js 6              # six 48-minute computer games against the league's numbers
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

- [ ] **Scoring is ~20% low.** Last balance run (3 games): 89 pts, 82 FGA at 40.7%, 43 3PA at 31.1%, 11.5 FTA,
      12.7 steals (targets 114 / 89 at 47.5% / 35 at 36% / 22 / 8). Raise two-point finishing, fewer contested
      threes from the computer, non-shooting fouls and the bonus, fewer reach-in steals.
- [ ] On-ball screens: the big comes up and sets one; the handler uses it; the defense goes over or switches
- [x] Real player bodies (2026-11-17): Quaternius's CC0 mannequin with idle, walk, jog, sprint, jump and stance
      clips blended by speed; jersey, shorts, socks and shoes painted on by body region in team colors; numbers and
      hair; dribble, jumper, follow-through, contest, reach and defensive arms set in code; the ball in the real hand
- [ ] Faces and hair styles (Quaternius Universal Base Characters, CC0), jersey trim, shorts that sway
- [ ] Dribble moves on swipes of the right thumb (crossover, behind the back, step-back, spin)
- [ ] Euro step and floater on drives; dunk variety
- [ ] Haptics on release and makes
- [ ] Replays of dunks, blocks and game-winners
- [ ] Out-of-bounds inbound plays (a man takes it out on the sideline or baseline)
- [ ] Backcourt and three-second violations, goaltending

## M2 · Career depth

- [ ] Minutes and role: starters and bench, substitutions, fatigue, foul trouble; you check in off the bench
- [ ] Coach trust from grades; a talk with the coach every few games
- [ ] Pre-draft combine (shooting, agility, vertical) and two team interviews
- [ ] Rival at your position from your draft class
- [ ] Press conferences and a social feed
- [ ] Badges (twelve, three tiers each), earned by doing
- [ ] Career highs on the broadcast; the record book

## M3 · The season around you

- [ ] Real schedule (division, conference, other conference weights), back-to-backs
- [ ] League leaders from simmed box scores; awards night (MVP, ROY, 6MOY, DPOY, MIP, All-League)
- [ ] All-Star weekend: three-point contest and dunk contest mini-games, the game
- [ ] Play-in and best-of-seven playoffs, Finals MVP
- [ ] Injuries (day-to-day, out for weeks)

## M4 · Contracts and legacy

- [ ] Rookie deal, extensions, free agency with offers, trade requests
- [ ] Ten-man rosters to fifteen; trades and signings across the league
- [ ] Retirement, jersey retirement, Hall of Fame

## M5 · More modes and polish

- [ ] Season mode (one team, switching), training camp, standalone contests
- [ ] Edit teams on your device; several careers; save export and import
- [ ] Commentary recorded on a local speech model
- [ ] Controller support; landscape and desktop layouts
- [ ] Online head to head by code
