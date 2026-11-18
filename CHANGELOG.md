# Changelog

What changed, newest first. The full list is the git log; the order of work is [docs/ROADMAP.md](docs/ROADMAP.md).

## 2026-11-18 · the pocket player

- Replays start from the rim's side of the play, a little above the heads, so the scorer comes at the camera
  instead of the view sitting behind someone's back; the play-by-play line no longer sits under the REPLAY label.
  A one-time tip teaches the pump fake the first time a defender is right on you.
- More for the Look card: compression tights, and hair dyed blue, pink or green.
- An undershirt for your Look card (white, black or team color): sleeves and a collar under the tank top. Some of
  the league wears one. On a big play the reserves get up; the chairs stay where they are.
- The bench is the real thing: your actual reserves sit there in uniform, hands on their knees, and a coach in a
  dark suit stands at the end of each bench (they were gray blocks). They are set once a game, so they cost nothing
  to draw each frame beyond their triangles; Graphics: Low keeps the benches empty as before.
- The referees are dressed as referees: a striped shirt with short sleeves and long black pants, not a striped
  tank top and shorts.
- A defender sprinting back, far from the ball, runs with his arms pumping instead of spread like wings.
- Five more celebrations: the shrug, too small, ice in the veins, night night and the shush (the last three come
  out in clutch time). All of them can be your signature on the Look card. Computer players celebrate big shots too.
- The pump fake: a quick tap of Shoot shows the ball and pulls it back. A defender going up with the shot may leave
  his feet (good defenders bite less, and less each time you repeat it). Computer players fake against you too.
- Fixed: while the game was paused (the pause menu, halftime, a timeout) the players slowly folded over behind the card.
- A shot for the tie or the lead in the last four seconds hangs in the air: time slows and the sound drops until it
  comes down. Confetti in your team's colors when you win a title (career and season mode).
- Fixed: during a dunk, and for the first instant of any shot, the ball dropped into a dribble at the player's feet
  while his arms went up. It stays in the hands now; on a dunk it rides in the hand that is up. Opponents stand a
  little further apart so a defender's arms do not pass through the ball handler.
- Looks checked one by one on the new model and fixed: the afro no longer covers the eyes, cornrows are dark rows on
  a lighter scalp, twists have their bumps, a buzz cut is lighter than short hair; the shooting sleeve and the
  tattoos are painted on the model's own arm (shoulder to wrist) instead of floating at the elbow or not showing.
- The model shouts after a big play (an open mouth part), and the line where the shorts end on the thigh is clean
  instead of jagged.
- Passes snap: the ball loads at the chest, the arms shoot out at the target and hold a beat (down for a bounce pass,
  up for a lob). A receiver's hands go to the height the ball is coming in at.
- The layup is its own keyed move now: the ball comes up past the chest with the knee, the arm reaches full length
  and the fingers roll through it, the off arm stays loose. The new model blinks (its eyes are a separate part).
- A new player model, sculpted in Blender for this game (tools/body.py builds it; models/body.glb): tall and lean with
  longer legs, a tank jersey with a scoop neck, baggy shorts, crew socks, sneakers with a sole and a tongue, hands with
  fingers, and a smooth head with simple eyes and a cap of hair. Joints bend smoothly instead of hinging. It wears
  every team's kit, numbers and names.
- The model is yours to change: ten hairstyles (or bald) in five colors, three beards, five faces, a headband,
  goggles, and a build (slim, regular, strong, big). Heights run wider at every position (a 5'9" point guard to a 7'5"
  center), and a seven-footer's head is no bigger than a guard's. Every player in the league gets a look of his own.

## 2026-11-17 · the pocket look

- Bug pass: a replay that began at the end of the half no longer sits on top of the halftime card (tapping "Second
  half" only skipped the replay); season games get the score by quarter, game flow and team stats too; a game simmed
  to the end labels its last quarters as one column. New test: tools/human.js plays whole games the way a sensible
  person would and counts everything the game says.
- Chat, from the title screen: one global room (the same one as Pocket Football's, on the same free service), a name
  you pick, a word filter, one line every two and a half seconds, mute and report on every line. Nothing touches
  the network until you open it.
- A shot goes up, in front of the shooter: the ball is no longer carried down by his knees or behind him on the way
  (hands a frame behind the pose, the dunk's wind-up), and it leaves from where you see it.
- The game in numbers, after a stats app: the final screen has the score by quarter, a game-flow chart (who led,
  by how much, lead changes, times tied) and the two teams side by side on seven stats. The Log tab opens on your
  season: averages with their league rank and your points game by game.
- The computer's players no longer drift (or get pushed) back over half court for a backcourt violation of their
  own making. After the first and third quarters a graphic gives the score and each side's leading scorer. A block
  from behind at a run is called a chase-down block.
- Tap a teammate on the floor and the ball goes to him. A perfect release leaves a green trail. A team on an 8-0 run
  gets a graphic. The clock turns red in clutch time (the last two minutes of a close game). On the road, the
  free-throw meter shakes with the crowd. Your legs show as an arc round your ring.
- More small things: the officials signal (both arms up on a three, a fist in the air on a foul); a dunk on a
  defender is called (POSTERIZED, and the bench is up); your badges show as they fire, on a chip with the badge's
  name and tier, on makes, steals and blocks. A tip card no longer sits under the REPLAY label.
- Small things from the big game: a broadcast graphic with a scorer's line when he reaches ten, twenty, thirty (or
  his third three); "Heating up" after three straight makes and "On fire" after five; the backboards light red at a
  horn or a shot-clock violation; cameras flash in the stands after a big play; the man bringing the ball up raises
  a hand to call the set as he crosses half court.
- The dunk has a wind-up: the ball cocked back behind the head on the way up, thrown down through the rim, knees
  tucked. Runners lean into it: forward as they take off, back as they stop, banked into a cut.
- Tap anyone on the Team tab for his card: a sheet with the player standing in his uniform, his ratings by group and
  what he is best at. The League tab opens on the standings (your conference first, games back) with the leaders a
  tap away; the next-game card shows the season so far and your last five results; milestones are tiles.
- Stuffed: a jumping defender's hand on the ball while the shooter still has it up in the air is a block too. After
  the game, your night on one banner (your face, points, line, grade). Your line, live, under the score. How to play
  opens one topic at a time.
- One scorebug: the score on top with each team's timeouts as dots, and a thin strip under it for pause, your grade
  and zoom. The pause menu opens on the matchup (badges, score, clock) and has switches for sound and commentary.
  Quick game sets its difficulty and quarter length right there. Build cards show what each build is good at;
  achievements are a grid of tiles.
- Menus after Pocket Football: the title is mode cards (an icon, a line on what it is); Season and Quick game pick
  from the whole league by conference and division, two teams to a row in their colors; Settings is four short groups
  with real switches.
- The hub has a bottom bar: five tabs with icons under your thumb, the page sliding in above it. Ratings on the Player
  tab are grouped (Scoring, Playmaking, Athleticism, Defense) with each group's average. Quick game picks its matchup
  from two team cards (badge, arrows to flick through the league, tap the name for the list). The pause menu's
  controls are a list you open, not a wall of text. The score pops when it changes; glass action buttons.
- Feet that plant: in a defensive stance, and standing over a dribble, each foot is set on the floor and steps (one at
  a time, never crossing) as the player moves; the legs are solved to reach them, knees out over the toes, hips low,
  back flat and leaning in, head up. A defender's hands work: one down at the ball, one out in the passing lane.
- Knees that work: a dip before a jumper, every landing absorbed, hips that shift with a crossover, a defender who
  walls up (taller, arms wide) chest to chest and stands his ground instead of running in place against a body. Off
  the ball the stance is lighter, hands ready; feet on the floor, one hand goes up in a shooter's eyes.
- A passer turns and steps into the pass; under a ball coming off the rim everyone boxes out, wide and low with the
  hands up for the board.
- Layups, floaters and hooks go up off one hand (the knee drives, the off arm keeps the defender away); the speed
  dribble pushes the ball out in front at the waist.
- A hand on the ball is a block: any defender whose hand meets a shot on its way up blocks it, every time (before,
  it was a roll of the dice and the ball could pass through a hand and drop).
- Teammates without the ball stand ready: on the balls of their feet, knees soft, hands out as a target.
- Defense with timing: the Steal button lights up when the ball is there to take (he is dribbling on your side, or
  crossing over in front of you); a reach at a protected ball is mostly a foul. Your slide is helped toward the line
  between your man and the rim. Every shot you guard is called: Smothered, Good contest, Hand down, Late, Left open.
- Your story, picked when you create your player: a Top prospect (rated higher, a top-five pick, a city that expects a
  star and gets loud on bad nights), a Prospect (the combine and interviews decide), or Undrafted (no call on draft
  night, three camp invites to choose from, a two-way deal at the end of the bench; you grow faster, good nights win
  fans fast, and the coach's trust turns the two-way into a real contract). Your rival is the one they took instead.
- Dribbling with a rhythm: quick, low pounds with a man on you and long, high pushes at a run (the ball out ahead of
  you); the ball stays on the side away from the defender, changing hands with a crossover (or through the legs when he
  is right there); the shoulder turns to shield it; the body leans over the ball and rides the bounce.
- Defense you can play: in a stance you face your man and slide (feet wide, sitting low, a shuffle that never crosses
  the feet), one hand up on the ball and one in the passing lane. Get set in front of a driver and you cut him off
  ("Cut off"): he loses his speed toward the rim. Your hands go up by themselves when your man rises to shoot.
- At the final horn the winners celebrate and the losers put their hands on their knees.
- Players blink and turn their heads to follow the ball. Five face types, sports goggles, a number on the shorts.
- Before the tip, after the lineups: a close-up of you with a broadcast name graphic. Home shows you against the man
  you guard; the Team tab opens on a banner in the team's colors; awards night shows the winners' faces.
- Ball racks in the shooting drills; the green release reads "Perfect".
- Create your player shows him as you build him (height, skin, hair, facial hair); the height slider works again.
- Signature picks on the Look card: your celebration and your dribble (low and quick, or high and loose). Tattoos.
- Bounce passes, a white shockwave after a slam or an ankle-breaker, a few bounces at the free-throw line, referees in
  stripes, stanchion pads in the home colors, benches in the pocket style.
- Made dunks: most of the time the dunker hangs on the rim for a moment (with a yell) before he drops. Chest passes
  push out with both arms; a man about to catch puts his hands up. Starting lineups have headshots, Home opens on your
  player card, the Look card shows you as you change, and the player of the game gets a card.
- A perfect release (Excellent, the green) always goes in, free throws too. Only a block stops it.
- New hair: fade, cornrows, locs, a bun and a mohawk (on the Look card too). Beards show again. The title screen's
  player dribbles and works his moves. Sneakers are high-tops with a swoop in the team's second color. A thin outline
  on players (off on Low graphics).
- A simpler body, pocket style: smooth rounded shapes instead of the muscled mannequin (a rounded torso, tapered
  arms and legs, mitten hands, chunky rounded shoes), on the same skeleton so every animation still plays. Heads a
  little bigger.
- Jerseys cut like real tank tops: smooth armholes and a neckline with a trim band in the second color, no more
  zigzag edges or stray colors where the jersey met skin.
- Faces: hair with a real hairline (straight across, square at the temples, over the ears, down to the nape), a
  rounded high-top, upper lids, a slight smile, one smooth head (no seam at the jaw), beards that follow the jaw.
- Dribble moves you can see: the crossover goes across in front, going fast it is behind the back, from a standstill
  (or as the second move of a combo) between the legs, and back to the same hand a hesitation; the spin turns the
  player all the way round with the ball palmed. The computer's ball handlers use them too.
- Ankle-breakers: a move that beats your man can put him on the floor (more often in a Takeover). It can happen to you.
- Celebrations after your big plays: a flex or a roar after a dunk, the three goggles or a finger up after a three, a
  chest thump on an and-one, a flex when you start a Takeover. The other team's stars celebrate now and then.
- A black-and-white look for every screen: white primary buttons, neutral dark panels, no yellow.
- Drawn heads, pocket style: round heads with big eyes, ears, a nose and a mouth, and hair made to fit (short, buzz,
  high-top, afro, and new twists), headbands that sit on the forehead, full beards with sideburns, goatees.
- Jerseys: a design for every team (side panels, pinstripes, chest bands, fades, yokes, sashes), white Association
  and black City uniforms, baggy shorts with side stripes, names on the back, numbers edged to read on any color.
- Takeover: good plays fill a meter over the buttons; full, tap it for 25 seconds of hot hands, in a column of white
  light. Two misses in a row cool you off.
- Locker room (Player tab): pick what your team wears at home: Icon, Association, Statement (the second color) or City.
- Gear on the Look card: wristbands, a leg sleeve or both, knee pads; other players wear some too. Shoes get a midsole in
  the team's second color.
- Team tab: your roster with headshots, numbers, heights, ages and hometowns.
- Names that fit together: every player comes from somewhere (about three in four from the U.S., the rest from
  Nigeria, Senegal, Serbia, Lithuania, France, Spain and Latin America, Brazil, Germany and the Nordics, Greece and
  Türkiye, Australia and Canada, Japan), and his name, hometown and look come from the same place. No two players on
  one roster share a first or last name. Your hometown when you create your player (optional).
- Name tags under you and the ball handler (Settings › Name tags); your own name in quick games and the daily challenge.

## 2026-11-17 · the overnight build

**Sound and the booth**
- An arena that reacts: a synthesized crowd (murmur, roar, oohs, groans, applause, the "DE-FENSE" chant, "M-V-P"),
  the arena organ, and recorded public-domain squeaks, net, dribble, board and whistle.
- A two-voice broadcast booth (Chatterbox, cloned from original synthetic voices): calls for threes, dunks,
  alley-oops, step-backs, blocks, steals, runs, crunch time, the final, and an opening for every city.
- An arena announcer through the building's speakers: the home team's intro, two minutes left, the last minute.
- Players talk on the floor: "Screen!", "Switch!", "Shot!", "Box out!", "Help!", "Get back!", from where they stand.
- A heartbeat under the crowd in the last thirty seconds of a close game.
- Sound on iPhones with the silent switch on.

**Players and the arena**
- Real bodies: a rigged mannequin (Quaternius, CC0) in team kits with numbers, chest wordmarks, trim, faces and
  hair; builds (bigs wider); running, jumping and stances blended by speed; a dribble from motion capture; the other basketball arms set in code.
- Your Look card: your jump shot (standard, quick, high), hair, hair color, facial hair (stubble, goatee, beard), headband, arm sleeve, shoes. Everyone else gets his own hair.
- Team benches in warmups and the coaches, across from the broadcast camera with the scorer's table.
- Two referees in gray and black: the lead on the baseline, the trail on the far sideline, trading places on a
  change of ends.
- A lit arena: a polished hardwood floor, a center-hung scoreboard with the live score, LED ribbons, darker stands.
- Cameras: player lock (the default, high and wide behind you), broadcast, overhead.

**On the floor**
- Balanced against the real league: about 114 points a team on 47% shooting, 35 threes, 22 free throws.
- Post up as a big: swipe down on Move inside sixteen feet, back your man down, hook over him.
- Your shots: a big going up contested in the paint shoots a hook; a jumper drifting away from the rim is a fadeaway.
- Fast breaks: after a steal or a defensive board, with the defense not back, they push it at the rim.
- Fliers show off on open breakaways: windmills, reverses and 360s in real games.
- Get hot (three straight, or a big night) and the defense sends a double team: find the open man.
- Call a play from the pause menu for three trips: Get me the ball (the others clear out), Pick-and-roll, Feed the post.
- Call a pick: the Pick button brings your big to screen your man, then he rolls.
- Dribble moves on the Move button (swipe: crossover either way, step-back, spin; euro step near the rim).
- The pick-and-roll, help defense, closeouts, switches, post-ups and hooks, alley-oops, floaters, one- and
  two-handed dunks, misses that rattle on the rim, charges, strips, team fouls and the bonus, fouling out,
  holding for the last shot, fouling to stop the clock, timeouts, stamina, a jump ball.
- Foul trouble: too many fouls too early and the coach sits you for the rest of the quarter.
- Inbound plays from the baseline and the sideline; if you take it out, Pass throws it in.
- The bench: computer players tire and sub out at dead balls, rested starters come back, reserves get minutes.
- The rules: eight seconds, backcourt, three seconds in the lane (with a warning), goaltending. Jump at a shot on
  its way up and you can block it in the air.
- Markers: the arrow over your pass target, the ring under your man, a release flash; the coverage on every shot.
- Your highlights after the game: your best plays of the night (dunks, threes, and-ones, blocks, assists, shots
  at the buzzer) replayed in 3D with the crowd and the booth, and saved as a vertical 1080x1920 video with sound.
- Replays of dunks and buzzer-beaters, an opening flyover with the starting lineups, halftime stats, a shot chart and box score.
- Settings: Player lock distance (closer, default, farther), large buttons.
- Settings › Graphics: Low for older phones (no refs, benches or banners, lower resolution).
- Controllers, a left-handed layout, shot timing (easy, normal, hard), vibration on Android.

**Career**
- Fixed: a simulated stretch of a quick game (fouling out) could leave the score blank.
- The pre-draft combine (shooting and measurements; it moves your pick), team interviews, draft night in 3D, a rival from your draft class you guard in rival
  games, coach trust and your role (off the bench you check in later), a word from the coach, game goals, team
  practice, life between games, press conferences, a feed, followers and shoe endorsements.
- Fourteen badges (Fadeaway Artist and Post Scorer new tonight), career highs and milestones, injuries now and then.
- The league turns over: veterans retire, rookies arrive, free agents and trades move players between teams.
- A real schedule (your division most often), back-to-backs with heavy legs, injuries around the league.
- League leaders, All-Star picks, the Rising Stars game (rookies against sophomores) in your first two seasons, the All-Star Game, the 3-Point Contest and the Dunk Contest (a 360, a windmill,
  a reverse, from as far as the free-throw line; five judges), a play-in, playoff series, awards night.
- Banners in the rafters: win a title or have your jersey retired and it hangs in that arena for good.
- Your rival posts about you before your games: clap back or let the game talk.
- Player of the Week every seven games, and the All-Star fan vote's first returns on your hub.
- Share your player card: an image of you in your team's colors with your numbers.
- Twenty-two achievements across every career on your device, from your draft to the Hall of Fame.
- A record book: the best single games and seasons by any career on your device.
- Training camp every summer: pick a focus; the shooting and dunk drills decide how much you grow.
- Contracts: a rookie deal, an extension, free agency, trade requests, earnings; retirement and the Hall of Fame.
- Up to six careers, backups to a file, Auto-upgrade, Sim 5 games, Sim to the playoffs, Edit teams.

**Other modes**
- Daily challenge: a new late-game situation every day (down two with the ball, hold the lead, an eight-point comeback...), with a streak.
- Season: one team, the whole team under your thumbs, to a title; playoff series (best of 1 to 7 by the season's
  length), points, rebounds and assists leaders, a Finals MVP, and next seasons with the same team (players age,
  rookies arrive, your titles count). Quick game with whole-team control.
  Practice: the 3-point and dunk contests, the drill, and a shoot-around with no clock.

## 2026-11-16 · the prototype

- 5-on-5 in portrait, the shot meter, the teammate grade, a career from creation to the next season, quick game.
