# PocketBasketball: game plan

5-on-5 pro basketball for a phone held upright, played in the browser, with **your career** as the main mode: one
player you create, from draft night to the Hall of Fame. Same family and same stack as PocketFootball and PocketFall.

This file is the design: what the game is, why, and how each system works. [ROADMAP.md](ROADMAP.md) is the order
of work and what is done.

---

## 1. Pillars

1. **You are one player.** In a career you control only yourself. Your teammates and the other team are the
   computer. Every system (the camera, the controls, the grade, the story) is built around one player's view.
2. **One-handed menus, two-thumb games.** Menus work with one thumb. On the floor it is the left thumb on the
   stick and the right thumb on three buttons, all in the bottom half of a tall screen.
3. **Real basketball, short sessions.** Real rules, real spacing, real shot values, tuned against league numbers.
   A game takes 8-12 minutes by default (3-minute quarters), and every game can be simmed.
4. **Your story, not a grind.** Growth you can see coming (the ceiling on every rating is shown from day one), no
   paid shortcuts, nothing lost when you put the phone down.
5. **Built from scratch and offline.** Plain JavaScript, three.js, no build step, every model, texture and sound
   made in code, installable to the home screen, playable offline.

## 2. What the research says

**Controls on phones.** Reviewers favour one gesture per action with a clear timing indicator, and dedicated
buttons for passing and shooting; on-screen controls that are too sensitive were the main complaint about the
mobile port of the biggest basketball series. Drag-to-aim shooting reads well but gets called fiddly.
→ Buttons for shoot / pass / move, a hold-and-release meter for the jumper, no drag-aiming. A floating stick
(it appears under your thumb) so you never miss it.
([PocketGamer, Flick NBA Basketball](https://www.pocketgamer.com/flick-nba-basketball/review),
[Gamezebo, Basketball Odyssey](https://www.gamezebo.com/reviews/basketball-odyssey-review-not-quite-a-slam-dunk/),
[GameSpot, NBA 2K21 Arcade Edition](https://www.gamespot.com/reviews/nba-2k21-arcade-edition-review-air-ball/1900-6417676/))

**Portrait.** Portrait is how people hold a phone most of the time, and the hard part is keeping every control in
thumb reach. Grip studies on portrait action games use Fitts' law to place buttons; the bottom corners are the
easy reach, the top corners the hardest. → Everything you press lives in the bottom 45% of the screen; the top
holds only things you read (score, clock, grade).
([Casino Beats on portrait-first design](https://casinobeats.com/?p=49452),
[portrait-mode grip study](https://openaccess.cms-conferences.org/publications/book/979-8-950676-08-6/article/979-8-950676-08-6_25),
[Roblox portrait mode and dynamic thumbstick](https://devforum.roblox.com/t/introducing-portrait-mode-dynamic-thumbstick/40576))

**Career modes.** What players ask for again and again: see where your build is heading instead of finding out a
hundred hours in; fewer, stronger perks; progression that only goes up; less grind and no pay-to-skip; and a story
that actually follows through. → Rating ceilings shown at creation, about a dozen badges that each matter,
skill points earned by how you play (the teammate grade), never sold.
([Game Informer on the grind](https://gameinformer.com/preview/2019/08/21/visual-concepts-promises-to-ease-the-grind-in-mycareer),
[Digital Trends review](https://digitaltrends.com/gaming/nba-2k20-review),
[RealSport101 on build changes](https://realsport101.com/article/nba-2k25-mycareer-myplayer-changes-give-mixed-feelings),
[2K Courtside Report](https://nba.2k.com/2k25/courtside-report/myplayer-and-mycareer/))

**Shot making.** In tracking data, the distance to the nearest defender predicts a three better than the shot's
distance; catch-and-shoot threes go in about 36% of the time, pull-ups about 31-33%.
→ The shot model is shooter rating × contest (nearest defender, in front of the shot or not) × release timing, with
distance mostly deciding *which* shot it is (rim, short, mid, three, deep).
([CMU shot probability poster](https://www.stat.cmu.edu/cmsac/poster2020/posters/Varadarajan-NBAShotProb.pdf),
[NBA.com, expected FG%](https://www.nba.com/news/intro-to-expected-field-goal-percentage),
[True shooting ability](https://bestballstats.com/2022/09/18/true-shooting-ability-separating-shooting-talent-from-shot-circumstances/))

**Our own games.** PocketFootball's career (combine, draft day, a coach, a rival, press, a social feed, awards
night, the Hall of Fame) is the template people already like; its stack (classic scripts, three.js r159 from
cdnjs, a network-first service worker, GitHub Pages) is proven on phones. PocketBasketball reuses all of it.

## 3. The league

- **30 teams** in the real league's cities, two conferences of three divisions, with this game's own nicknames
  and colors (the Boston Brahmins, the San Francisco Fog, the Memphis Blues...). Real league, team and player
  names are trademarks and likeness rights, so the game uses none of them, or names made to sound like them.
  A later build adds **Edit teams** (city, nickname, short name, colors) kept on your device, as PocketFootball does.
- **Rosters** of ten (fifteen later), fictional players with 14 ratings, ages and growth.
- **Season** of 10, 20, 41 or 82 games (a setting), then the play-in (7-10 seeds) and best-of-seven playoffs
  (shorter series for short seasons). Standings break ties on head-to-head, then conference record.
- **The league sims around you**: every other game on your game day is played by team strength, with box scores
  generated for league leaders.

## 4. On the floor

**Court.** Feet: x across (-25..25), z along (-47..47), rims at z = ±41.75, ten feet up. Real markings: the
23.75-foot arc, 22 feet in the corners, the 16-foot lane, the restricted area.

**Camera.** Player lock by default, the way console career modes are played: high behind your own player (about
32 ft up and 42 ft back, a 52° lens, picked from three tunings on 2026-11-16), looking
down the floor at the rim being attacked, swinging around (not cutting) when the ball changes hands; on a tall
screen your player and the rim both stay in the picture. Broadcast is the second option: low on the scorer's-table sideline, the way the big console games show the game,
panning along the court with the ball and leading toward the rim it is heading for, stopping short of the
baselines so the rim stays in the picture. Your team attacks left to right in the first build. Overhead (high
behind your direction of attack, the half court top to bottom) is the other option, in Settings and on the pause
screen. +/− to zoom. Later: a "player lock" camera that keeps you centred, and the far basket after halftime.

**Controls (portrait, two thumbs).**

| | Left thumb | Big button | Pass button | Small button |
|---|---|---|---|---|
| You have the ball | move (edge = sprint) | **Shoot** (hold, release at the top) | **Pass** (open man or stick direction) | **Move** (crossover; can shake your man) |
| Teammate has it | move | Jump | **Call** for it | **Cut** to the rim |
| Defense | move; lift = auto-guard | **Jump** (contest, block, board) | **Steal** (reach; fouls if you overdo it) | Help (later: switch onto the ball) |

Keyboard and game controllers map to the same three actions.

**The shot.**
1. Which shot: a dunk (dunk rating, moving, close), a layup inside 9 feet, otherwise a jumper.
2. Open make rate from the shooter's rating: rim about .55-.85, short .34-.56, mid .32-.54, three .25-.47,
   minus 1.4 points a foot past 26 feet.
3. Contest: the nearest defender, 0 feet takes 40% off, 6 feet takes nothing; a defender in the air in front of
   the shot takes more, one chasing from behind barely matters.
4. Release (yours): the meter fills over the jump; let go in the green band near the top for an "Excellent"
   release (a big boost), "Slightly early / late" is neutral, worse costs a lot. The band is wider for better
   shooters. The computer releases with a spread that tightens with its ratings.
5. Then a block check (defenders in the air close in front), a foul check (more on drives), and make or miss.
   Misses come off the rim with a real bounce; rebounds go to whoever is in reach, the better rebounder more often.

**Free throws** with the same meter (no jump), and-ones, three shots on a fouled three.

**The computer.** Five-out spacing spots per position (point, wings, a corner, the dunker spot) that shift with
the ball; off-ball cuts and relocations; a ball handler that weighs the shot it has (make rate × points against
the contest), drives open lanes, kicks to the open man, and runs out of time sensibly. Man defense that sits
between its man and the rim, sags off the ball, helps a little toward it, contests shooters and boxes out.

**Your teammate grade** (the career's heartbeat, shown live): up for buckets, assists, boards, steals, blocks,
contests, beating your man; down for forced shots, early bad shots, turnovers, fouls and your man scoring.
After the game: what moved it, and the skill points it earned.

**Tuning targets** (per team per 48 minutes, the real league): 114 points, 89 FGA at 47.5%, 35 threes at 36%,
22 free throws, 14 turnovers, 8 steals, 44 rebounds, 27 assists. `tools/balance.js` plays full computer games and
prints these next to the real ones.

## 5. Career (the main mode)

The arc, PocketFootball's shape with basketball's beats:

1. **Create** — name, position (PG..C), build (Sharpshooter, Slasher, Playmaker, Two-Way Wing, Stretch Big,
   Rim Protector), height (taller: better at the rim and on the glass; shorter: quicker with the ball), skin tone,
   number. The screen shows the starting ratings and the **ceiling** of each, so the build's future is clear.
2. **Pre-draft** — a combine: a timed shooting drill, a lane agility run and a max vertical, each a 30-second
   mini-game on the real court. Your scores and two team interviews move your draft stock.
3. **Draft night** — a stage, the commissioner's walk, the pick, the cap. Lottery teams pick first.
4. **The season** — a hub with the next game (both badges, records, the man you'll guard), Play or Sim,
   your numbers, the standings, the news.
   - **Minutes and role**: starter, sixth man or bench, from your rating against the man ahead of you and the
     coach's trust (built by your grades). Off the bench you check in partway through the first quarter.
   - **Fatigue and substitutions** for everyone; the coach sits you when you're gassed or in foul trouble.
   - **Practice** between games: one short drill that earns a little skill and trust.
   - **Rival**: a player at your position, same draft class, on a division team; head-to-head stats all career.
   - **Media**: a short press conference after big games (tone choices change trust and followers), a social
     feed that reacts to your nights, headlines.
   - **Milestones**: career highs called out on the broadcast, the first 30-point game, triple-doubles.
5. **All-Star weekend** — the three-point contest and the dunk contest as mini-games if you're invited, then the
   game.
6. **Awards night** — MVP, Rookie of the Year, Sixth Man, Defensive Player, Most Improved, All-League teams,
   decided by the same stats the league sims.
7. **Playoffs** — the play-in, best-of-seven series, the Finals and its MVP, a parade.
8. **Contracts** — a four-year rookie deal, an extension window, restricted and then unrestricted free agency
   with offers from teams that can fit you (role, contender or not, money), trade requests.
9. **Growth** — skill points from grades (a win adds a bonus), costs that rise with the rating, ceilings by
   build; young players gain in the offseason, players past 30 slip. **Badges** (about a dozen, three tiers each:
   Catch & Shoot, Deep Range, Acrobat, Posterizer, Floor General, Lockdown, Glass Cleaner, Pick Pocket, Rim
   Protector, Clutch...) earned by doing the thing in games, never lost.
10. **Legacy** — career totals, the record book, jersey retirement, the Hall of Fame vote at retirement.

**Saves**: the career lives on the device (several careers, backups, export to a file), the way PocketFootball's do.

## 6. Other modes

- **Quick game**: any two teams, you control one player (the prototype has this).
- **Season**: one team, you control the ball handler (switching), every game.
- **3-point contest and dunk contest**: standalone mini-games.
- **Training camp**: guided drills that teach the meter, passing and defense.
- **Online** (later): head to head by code, phone to phone, as planned for PocketFootball.

## 7. Presentation

- **Look**: a lit arena, hardwood made in code with the home team's paint and logo, the crowd in the stands,
  glass backboards and nets that swish. Players are low-poly figures built from primitives, scaled by height,
  with procedural running, dribbling, shooting and defensive stances; later, motion-captured shooting and
  dunking (PocketFootball's mocap tools).
- **Broadcast**: a scorebug with the shot clock, a play feed, big calls on makes ("SPLASH", "SLAM"),
  replays of dunks and buzzer beaters, two commentators recorded on a local speech model (as PocketFootball).
- **Sound**: sneaker squeaks, the dribble, rim and net, the crowd swelling on runs, the horn.
- **Haptics** on shot release and on a make (where the phone supports it).

## 8. Technology

- three.js r159 loads as an ES module (an import map points at jsDelivr) with its glTF loader; the game's own files
  stay classic `<script>`s on one global (`window.PB`), added in order once the library is in. No build step.
- `js/data.js` league, names, ratings, badges · `js/court.js` the arena, the players' bodies, the cameras ·
  `js/game.js` the game on the floor (state, AI, physics, controls, HUD, replays, drills) · `js/audio.js` the mix ·
  `js/booth.js` the commentators · `js/career.js` menus and the career.
- Assets and the tools that make them (each runs on a Mac; the sources live in git-ignored folders):
  - `models/player.glb` (417 kB) from Quaternius's CC0 mannequin and animations by `tools/model.mjs`
    (glTF-Transform: keep 14 clips, drop finger/scale/position tracks, thin keyframes, quantize).
  - `audio/sfx.m4a` (106 kB) from six CC0 Freesound recordings by `tools/sfx.py` (cut, trim, level, pack).
  - `audio/vo.pack` from `tools/commentary.json` by `tools/voice.py` (Chatterbox, two original voices cloned from
    Kokoro reference clips; the take length is capped by its word count).
- One random source (`PB.rand`, seedable). `PB.Game.dbg`: autopilot, fast-forward, replays, the live state.
- Tests (Playwright, served over a local server like the real site): `tools/smoke.js`, `tools/balance.js`,
  `tools/drill.js`, `tools/career.js`.
- GitHub Pages hosting; a network-first service worker for offline play; a web manifest for home-screen install.
- Performance: about 125 draw calls and 140k triangles a frame; ten skinned players; blob shadows; the resolution
  steps down by itself (2x, 1.5x, 1x) when a phone cannot hold about 45 frames a second.

## 9. Monetisation

None planned. Nothing is sold, nothing speeds up growth. If that ever changes it is cosmetics only.

## 10. Risks

| Risk | Plan |
|---|---|
| Portrait camera can't show the whole width | Follow the ball across; zoom; a player-lock camera option |
| Thumb controls feel imprecise | Floating stick, big targets in the bottom corners, auto-guard on defense, aim assist on passes |
| Computer games don't look like basketball | Balance tool against league numbers; spacing spots, cutting, screens next |
| Grind | Skill points from grades, ceilings visible, sim any game |
| Trademarks | Fictional league, editable on your device only |
