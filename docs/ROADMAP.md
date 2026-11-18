# PocketBasketball roadmap

The order of work. [PLAN.md](PLAN.md) is the design. Update this file after every item.

## Ground rules

- Commit on `main` and push `main`; every push redeploys the GitHub Pages site, so run the tests in "How to test" first.
- Before a push that changes how the game plays, add a line to **Rollback points** with the commit `main` is on.
  To go back: `git revert --no-edit <commit>..main`, then push.
- All teams and players are fictional. No real league, team or player names.

## Rollback points

(newest first)

- `79c453b`, before the 240-clip booth pack (if the booth misbehaves, roll back `audio/vo.pack` and `js/vo.js` only) (2026-11-17).
- `9f22d5c`, team interviews in, before the badge colors and the highlight reels (2026-11-17).
- `5ad04d5`, before the second half of the night: mocap dribble, violations, inbounds, the Dunk Contest, training camp (2026-11-17).
- `c70b508`, before career depth (trust, rival, feed, press, badges), the playoffs and awards night, the booth, team fouls and the pick-and-roll (2026-11-17).

## How to test

```
python3 tools/serve.py 8000          # then open http://localhost:8000 (phone: your computer's address on the same Wi-Fi)
node tools/smoke.js                  # a career loop with real input; must print "errors []"
node tools/balance.js 6              # six 48-minute computer games against the league's numbers
node tools/drill.js                  # the combine and the 3-point contest, shot by shot
node tools/career.js                 # five short seasons: playoffs, awards, contracts, free agency, retirement
node tools/invariants.js 2            # two computer games checked every tick for states that must never happen
node tools/frames.js shot side 12 0.08 6   # an animation frame by frame on one sheet (.shots/): fake, layup, dunk, pass, c-shrug ...
node tools/looks.js .shots/looks.png hair   # every hairstyle, beard and accessory on the model (also: body, arm)
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
- [x] Rebalanced (2026-11-17, 8 games, with inbounds and violations): 111.9 pts, 83.8 FGA at 47.1%, 36.2 threes at
      37.1%, 23.4 FTA, 13.8 TOV (travels and balls lost under pressure), 10 STL, 3.4 BLK, 19.7 PF
- [x] Rebounds: blocked shots count as misses, a longer window for long rebounds: about 42 a team (2026-11-17)
- [x] The pick-and-roll: the big screens the handler's man, who gets caught; the big rolls (2026-11-17)
- [x] Team fouls and the bonus; contact fouls on drives; floaters (2026-11-17)
- [x] The booth: two original voices recorded with Chatterbox, 122 lines in 35 calls, wired to the game (2026-11-17)
- [x] Real player bodies (2026-11-17): Quaternius's CC0 mannequin with idle, walk, jog, sprint, jump and stance
      clips blended by speed; jersey, shorts, socks and shoes painted on by body region in team colors; numbers and
      hair; dribble, jumper, follow-through, contest, reach and defensive arms set in code; the ball in the real hand
- [x] Faces, hair styles and colors, headbands, arm sleeves, shoe colors: your Look card, and variety across the league (2026-11-17)
- [x] Endorsements: shoe companies call as your following grows, with yearly money and a signature colorway (2026-11-17)
- [x] Builds (bigs wider, guards leaner), a gather before the jumper, misses that rattle on the rim (2026-11-17)
- [x] Jersey trim at the neckline, armholes and the shorts' hem, in the team's second color (2026-11-17)
- [ ] Shorts that sway
- [x] Two referees who work the play (lead and trail, switching on a change of ends) (2026-11-17)
- [x] The dribbling arm from motion capture (CMU subject 06), in step with the ball (2026-11-17)
- [x] Dribble moves on the Move button: swipe for a crossover either way, a step-back, a spin (2026-11-17)
- [x] Alley-oops to cutters (yours with Cut or Call), post-ups and hook shots for bigs, floaters (2026-11-17)
- [x] Stamina: sprinting drains it, empty legs are slow and short (2026-11-17)
- [x] Euro step on drives (a sideways swipe near the rim), one- and two-handed dunks, computer crossovers that can leave you stumbling (2026-11-17)
- [x] Vibration on releases, makes, steals and blocks (Android) (2026-11-17)
- [x] Replays of dunks, your and-ones and shots at the buzzer (2026-11-17)
- [x] Your highlights after the game: the top five plays of the night replayed in 3D (2026-11-17)
- [x] Inbound plays: a man takes it out on the baseline after a basket or the nearest sideline after a dead ball;
      the clocks wait for the pass (the game clock runs after baskets until the last two minutes) (2026-11-17)
- [x] Eight seconds, backcourt, three seconds in the lane (yours, with a warning), goaltending; a jump timed on a
      shot's way up blocks it in the air (2026-11-17)

## M2 · Career depth

- [x] Coach trust from grades sets your role; followers; a social feed; press conferences with three answers (2026-11-17)
- [x] A draft-class rival in your division, with head-to-head stats and rival games (2026-11-17)
- [x] Twelve badges, bronze to gold, earned by doing the thing in games, each with a small effect (2026-11-17)

- [x] Off the bench: a sixth man checks in mid-first quarter, a bench player in the second (2026-11-17)
- [x] Foul trouble: two fouls in the first quarter, three in the second, four in the third and you sit the rest of it (2026-11-17)
- [x] Substitutions and fatigue: computer players tire and the bench checks in at dead balls; rested starters go back
      in; reserves show up in the box score. You never come out (2026-11-17). Balance with the bench (6 games): 116.6
      pts, 87.7 FGA at 49%, 33.8 threes at 38%, 22.2 FTA, 13.3 TOV, 42.3 REB
- [x] A word from the coach every five games; ask for more minutes (it works when you've earned it) (2026-11-17)
- [x] Game goals: three a game by position, +2 skill points each (2026-11-17)
- [x] Life between games: small choices (a camp, film, a party, a podcast, a trainer, a hospital visit) (2026-11-17)
- [x] Team practice between games: the spot-up drill for up to 5 skill points (2026-11-17)
- [x] League leaders; your games count at full length for leaders, awards and value (2026-11-17)
- [x] Pre-draft combine: fifteen spot-up shots in 45 seconds that move your draft stock (2026-11-17)
- [x] Combine measurements: height in shoes, wingspan, vertical, lane agility, sprint; elite testing moves you up (2026-11-17)
- [x] Team interviews before the draft: two teams near your pick ask a question; win one over and it may take you (2026-11-17)
- [x] Career highs and twelve milestones (2026-11-17)
- [x] The record book (best single games and seasons by any career on the device); career highs called by the booth (2026-11-17)

## M3 · The season around you

- [x] Play-in (7-10) and playoff series (best of 1/3/5/7 by season length), a bracket, the Finals (2026-11-17)
- [x] Awards night: MVP, Rookie of the Year, DPOY, Sixth Man, Most Improved, All-League teams, Finals MVP; All-Star picks at midseason (2026-11-17)

- [x] A real schedule (the division most, then the conference), back-to-backs that start you with heavy legs (2026-11-17)
- [x] League leaders from simmed box scores (the League tab's Leaders view)
- [x] All-Star weekend 3-Point Contest: five racks, money balls, against seven of the league's shooters (2026-11-17)
- [x] The All-Star Game: East against West, the best at every position, an All-Star MVP (2026-11-17)
- [x] Dunk Contest: two dunks, the top two to a final; Move picks two-hand, tomahawk, reverse, windmill or 360,
      take off from as far as the free-throw line; five judges; also in Practice (2026-11-17)
- [x] Injuries around the league (a game to a few weeks; a team without its star is weaker, and it's news) (2026-11-17)

## M4 · Contracts and legacy

- [x] Rookie deal scaled by pick, an extension offer with a year left, free agency with four offers (money, years,
      projected role, team strength), trade requests, career earnings (2026-11-17)
- [x] The league turns over: veterans retire, a rookie class arrives every summer, free agents move, trades now and
      then during the season (2026-11-17)
- [ ] Ten-man rosters to fifteen
- [x] Retirement from 33 and the Hall of Fame vote; your athleticism slips after 30 (2026-11-17)
- [x] Banners: your titles and your retired jersey hang in that team's arena from then on, in every mode (2026-11-17)

## Done overnight, not on the list above (2026-11-17)

- [x] The arena announcer (team intros, the clock, the crowd), the arena organ, the M-V-P chant, iPhone sound with the silent switch on
- [x] Timeouts, holding for the last shot, fouling to stop the clock, fouling out, the bonus on the scorebug
- [x] The radar, pass and defense markers, release coverage text, a release flash
- [x] Your portrait on the hub, draft night and awards night in 3D, faces with eyes, nose and mouth
- [x] League news (big games, streaks, your rival), more life events and press questions, retired careers on the device
- [x] Sim 5 games, Sim to the playoffs; skill points scaled by season length; every build starts near 60

## M5 · More modes and polish

- [x] Whole-team control in quick games: you are the ball handler, or the man guarding it; Switch on defense (2026-11-17)
- [x] Season mode: one team, the whole team under your thumbs, standings, your leaders, an eight-team playoff (2026-11-17)
- [x] Season mode playoff series (best of 1/3/5/7 by length), rebounds and assists, a Finals or team MVP (2026-11-17)
- [x] Training camp: one focus a summer (shooting, finishing, playmaking, defense, the glass); shooting and finishing
      come with a drill that sets the gains (2026-11-17)
- [x] Up to six careers on a device; back one up to a file and bring it in on another device (2026-11-17)
- [x] Practice: the 3-point contest and the spot-up drill from the menu, with a best score (2026-11-17)
- [x] Edit teams on your device: city, nickname, short name, colors (2026-11-17)
- [x] Commentary recorded on a local speech model: 274 clips, four voices (play-by-play, analyst, arena announcer,
      players on the floor) (2026-11-17)
- [x] Game controllers (2026-11-17)
- [x] A phone turned sideways gets a turn-upright screen and the game pauses; desktops keep the centered column (2026-11-17)
- [ ] Online head to head by code
- [x] Daily challenge: a late-game situation a day, the same for everyone, with a streak (2026-11-17)
- [x] Season mode keeps going: next season with the same team, aging, rookies, a title count (2026-11-17)
- [x] Achievements across careers; a 3D title screen; a Graphics setting for older phones (2026-11-17)
- [x] Highlights: replayed after games with the crowd and the booth, saved as a 1080x1920 video with sound; a player
      card image to share (2026-11-17)

## Later: ideas not started

- A zone defense for computer teams (tried 2026-11-17: the simple 2-3 gave up 120 shots a game; it needs real
  closeouts and rotations before it can ship)
- Fifteen-man rosters, two-way contracts, trades you propose
- Draw calls: one atlas for each player's number and wordmark (the shadows are one instanced mesh since 2026-11-17)
- Online head to head by code
