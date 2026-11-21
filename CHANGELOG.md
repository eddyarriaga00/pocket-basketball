# Changelog

What changed, newest first. The full list is the git log; the order of work is [docs/ROADMAP.md](docs/ROADMAP.md).

## 2026-11-18 · the pocket player

- The play book is 115 plays and 16 defenses. A play is now a formation, a man it is for, a screener and an action, so "Horns", "Floppy", "Elevator doors", "Spain pick", "UCLA cut", "Hammer", "Pistol", "Four corners" and the rest each put the five in different places and send the ball to a different man. Isolations and post-ups for every position, picks with either big, pin-downs and flares, backdoors, the give and go, handoffs and the weave, eleven formations. On defense: 2-3, 3-2 and 1-3-1 zones, box and one, traps, deny or double their scorer, gamble, no fouls, no threes, wall the rim. The pause menu files them under headings.
- The opening is three camera shots where it was one sweep: a crane down from the rafters, a slide along the baseline at floor level, a jib swinging round center court, then the push in on you.
- The coach and your teammates say something about what you just did, now and then: a line under the call after a three, a dime, a steal, a bad shot, getting crossed.
- More cartoon: the points float up off the rim, stars fly off a dunk and a block, speech bubbles over a man who bit on a fake, and words for more of what you do (DIME!, ANKLES!, SHOOK!, CLAMPS!, BOARD!, AND 1!, HOT!). What is done to you comes in black.
- The big calls on screen are drawn like a comic caption (outlined, tilted, popping in), with more words for a make than SPLASH and BUCKET; the small ones sit in a pill.
- The play book: twelve plays on offense where there were three (pick-and-pop, five out, cutters, find the shooter, handoff, screen for me, drive and kick, push the pace, slow it down), and four calls on defense (press up, pack the paint, double the ball, full-court press). Pause to call one for three trips; tap it again to call it off.
- Both benches call plays by themselves about every other trip, so the computer's offense is no longer the same look each time down.
- A slightly quicker game: players move a touch faster, the computer decides sooner with the ball, inbounds and dead balls take less time. About a tenth more trips in a game.
- Settings › Ball: the classic orange, a blacked-out one, an all-white one, or a red, white and blue street ball.
- Settings › Shot meter: switch it off to shoot by the look of the jump, with a wider green window for doing it.
- Pigeons on the asphalt by the park fence: walk at them and they go up, and come back when you have gone.
- The park has more going on outside the fence: people walking the sidewalk, kids on skateboards who carve along and pop the board (not in the snow), a grind rail and a kicker ramp down the block, a cart with an umbrella in the home color and its vendor, and a few birds wheeling overhead by day.
- Sixteen more achievements (first dunk, double-double, 15 rebounds, 10 assists, five steals, five blocks, seven threes, a playoff win, 70 overall, five and ten seasons, $25M, the Fan favorite and GOAT ranks, five badges, five trophies), a bar on the page showing how far along you are, and every achievement is now worth a skill point.
- Your look: pick your dunk (tomahawk, two-hand, or the windmill from the Fan favorite rank) and two more signature celebrations (finger wag, chest thump).
- Settings: comic hit effects and camera shake can each be switched off, and a button brings the first-game tips back.
- The tutorial is eleven steps, up from seven: it now teaches the dunk and the dribble combo and walks you round the park and through defense. How to play has a Dunking card and covers combos and timed blocks.
- More lines: about forty new reactions on the timeline, in the park and between the regulars.
- In the park you can now dunk standing at the rim too (the rule added for games did not cover it).
- Comic-book hits: a spiked burst with a word in it pops where a block (BLOCK!, NOPE!, SWAT! on a chase-down), a steal, a picked-off pass or a dunk lands; a small plain burst where a defender gets a hand into a shot; stars go round the head of a man put on the floor. A blocked ball is swatted harder and the game holds a beat longer on it.
- Your defense counts for more: a hand you get up yourself bothers the shot twice as much as before, and your blocks are a matter of timing (up near the top of your jump as he lets it go), on jump shots too.
- Dribbling: moves chain much sooner (a crossover is ready again in about half a second instead of over a second), moves strung together build a combo that is harder to stay in front of, and beating your man gives a second of extra speed with dust at your heels.
- Around the rim: the whole stanchion and backboard rock when a dunk pulls the rim down, a missed dunk kicks high off the back iron with a groan from the building, and sneakers squeak on a hard landing.
- Fixed: you could not dunk on demand. A dunk needed a dunk rating of 55, a run at the rim and a lucky roll, so standing at the rim (or playing a shooter or playmaker build) Shoot always laid it in. Now Shoot at the rim is a dunk every time for your player: within 5.5 ft standing, about 7.5 to 9 ft on the run.
- Fixed: a player who came down with a rebound could start a jump shot before his feet were back on the floor, and floated up a second time.
- Dunks, reworked: he gets higher (more for a leaper and a dunker) and stays up longer, the arm now comes down through the rim (it used to stop above it), a new two-hand dunk with the ball taken back over the head, a longer hang on the rim with the body swinging and the rim springing when he lets go, show-off dunks on more breakaways, a leaper takes off from further out, your player goes up to dunk more often with a run at the rim, and a defender under a poster is sometimes put on the floor.
- More small things on the floor: a blocker wags a finger once he lands, the man who was dunked on stands with his hands on his hips, tired players at a dead ball now also put their hands on their hips or wipe their brow (not only hands on knees), the losers at the final horn do not all stand the same way, and the officials make the T for a timeout and put an arm out on a turnover.
- Faster park: everything out there that stands still and is one plain color (trees, parked cars, posts, roofs, furniture) is joined into a few meshes, and each person at the fence and each passing car is one mesh. The first view of the park went from 192 draws a frame to 129. Jersey lettering on the side of a player the camera cannot see is no longer drawn. `tools/perf.js` prints draws, triangles and geometries for the park and an arena game.
- Timeouts have a huddle: both fives stand round their benches while the camera goes to the side that called it, and are back on their spots when play resumes. A replay no longer starts under a cut scene's camera.
- Between two free throws the nearest teammates step in for a hand slap. A scorer points to the man who passed him the ball. The end stands wave at a visiting shooter at the line.
- A park regular standing between you and the camera no longer drops his name tag on top of your controls.
- The park has a neighborhood, and every city's is its own (made from the city's name, so it is the same each visit): a layered skyline with stepped towers, spires, masts and one landmark; buildings behind the trees with windows lit at night; a street with parked cars and two that keep driving by, headlights on after dark; storefronts with awnings; people stopped at the fence and sitting on the bench; drifting clouds. Palms in warm cities, pines in cold ones (snow on them and on the roofs in winter), dry grass in the desert.
- Smaller controls in a tidier arc (Shoot 76, Pass 56, Move 50, Pick 42; the stick to match). Settings > Large buttons is about the old size.
- Your phone: notifications slide in on the right. In a game, people watching react to what you just did (a dunk, a three, a steal, ten points, twenty). In the park it is the timeline, league news, who followed you and what is open today; one that points somewhere can be tapped and the arrow takes you there.
- The park talks: the regulars talk to each other, say more (and say your name), react to streaks and dunks, and each one has a Talk button with a tip or something on his mind; the first chats of the day get you a few followers.
- The feed: more people posting after a game (opposing fans, fantasy, film room, kicks), likes and replies on every post, a like button, and Show more.
- Defense that looks like defense: a defender who stays down on a shot puts a hand in the shooter's face (before, a quarter to a half of contested shots went up over hands at the waist); a man closing out on a shooter who just caught it comes with a hand high; off the ball, defenders sit in a stance and open up to see the ball and their man instead of standing upright. All of it is how they look: nobody's shot gets harder.
- Walking and running, redone against how people move: one stride drives the walk, jog and sprint clips at a person's cadence for the speed (about 1.9 steps a second at a brisk walk, 2.75 at a jog, 3.6 at a run), and the foot on the floor goes back as fast as the floor does, so feet no longer skate (about half the ground speed before; under a tenth at a jog now). Backing up is a backpedal, not a moonwalk. A slow walk takes real steps instead of a shuffle. tools/gait.js measures it.
- The fadeaway, done properly: pull the stick away from the rim as you shoot (a standstill works) and you hop back, lean, and kick the lead leg; out of a post-up it is a turnaround instead of the hook. The league's shot-makers fade now and then with a hand in their face.
- More cut scenes: a timeout cuts to a camera drifting in low over the floor; the night a title is won, paper falls in the winners' colors, the flashes keep going and the cameras stay on the champions.
- Cut scenes: the camera comes down out of the sky the first time you walk into the park; a slow pass along the sideline at the end of a quarter; at the final horn it finds the winners' best player and then pulls up over the floor. Black bars, a line of type, a tap skips.
- Your close-up before the tip: you look into the camera instead of off at the ball.
- UI: one sign over each door (its name and what is behind it), park messages are a small pill under the top row instead of big letters over the doors, menus slide up, and menu tiles press in.
- The park keeps your clock: a bright day (blue sky, clouds, the sun, lamps off), the last of the sun in the early
  evening, and night (a darker sky, more stars, more windows lit).
- Small things: every game and the park fade up out of black; the park's rings breathe and their signs bob; the arena
  lights show in the polish of the floor; a small celebration on every third straight make in the park and when a
  letter is handed out in H-O-R-S-E. tools/parkmonkey.js does random things in the park and reports anything odd
  (three runs, 370 actions: nothing).
- The park at night: a glow round every lamp, a boombox on the bench, trash cans, a rack of balls by the gym door.
- The park's camera never ends up behind a backboard or looking straight down at you: pressed against the wall, a
  fence or a hoop it swings round to the open side.
- The game fills the phone's visible height (it follows the height the browser reports, and re-fits when that
  changes): on an iPhone a strip at the bottom could be left black.
- A puff at the feet on a hard cut and where a player comes down from a big jump (dust on the park's asphalt, a pale
  scuff on the hardwood).
- The look: the arena's crowd is lit instead of nearly black (the top of the screen was a dark void), and the park has
  a city behind it: a skyline with lit windows, stars and a crescent moon. The park's guide arrow is smaller.
- The ball stays in a fast hand: hand positions are carried along with the player's own movement since the last
  drawn frame, so on a dunk the ball goes up with the arm instead of hanging under it for a moment.
- The dribble follows where you are going, not where you were: the ball is pushed toward the stick's direction (on a
  cut the stick turns before your feet do, and the ball used to land the old way, up to six feet off, behind you or
  through your body), it comes back up quicker when you run away from it, it goes round your legs instead of through
  them, and it never gets out of reach. tools/dribblemove.js measures it frame by frame while standing, walking,
  sprinting, cutting, zigzagging, stopping, circling and backing up.
- The park is home. After the start screen (your player over the arena, Tap to start) you are in your city's park, on
  foot. One side of the park is a brick wall with a lit door for every mode: My Player, Season, Quick game, the gym,
  My Career, the closet, Blacktop, Classics and the daily challenge. The pick-up rings (1 on 1, 2 on 2, 3 on 3) and
  Pro-Am are along the other sideline. Every back button and the career's home button come back to the park, and
  you come out of the door you went in. The classic menu is still there for a first visit with no player.
- Menu (top left in the park) opens over it with everything: you (rank, followers, skill points, park record), your
  next game in one tap, your career's pages, a map of the park (tap a ring and you are there), every mode, and the
  rest (My Player, achievements, the record book, chat, how to play, the walk-through again, settings). The park has a
  minimap too.
- A walk-through the first time: walk, sprint, shoot, make one, a dribble move, the menu, then into the MY CAREER
  door. It picks up where you left off, and Skip ends it. A new player starts in the park and goes to the draft
  through that door.
- Fixed: after Tap to start, the park came up with no stick, no buttons and no Menu, so you could not move. The start
  screen's 3D player kept the game's controls hidden; now every game clears it as it starts. tools/start.js checks
  that way in with real touches (the stick has to move you, Menu has to open), from the start screen and the others.
- Fixes from a full bug pass: each visit to the park left its sky picture in graphics memory (about one more for every
  visit, and the park is visited all the time now); "Play next game" from the park went past what the career had
  waiting (a word from the coach, an endorsement, All-Star weekend and its contests, a rival's post), which the menu
  now lists under Waiting in My Career and the MY CAREER card names; in H-O-R-S-E the keyboard could still jump at or
  reach for the regular's ball during his shot.
- H-O-R-S-E: walk up to a regular and his card offers it next to the 1 on 1. Set a shot from anywhere; he has to
  make the same one from the same spot, or take a letter (and you have to match his). Whoever sets keeps going until
  he misses. Spell it and you are out. It counts in your park record.
- The park has the beat playing and a few voices around the court, and walking out of it is quiet (it used to
  sound the end-of-game horn, the crowd and the booth's sign-off).
- A green chevron on the ground points the way to the MY CAREER door on the walk-through's last step, and for a
  new player headed to the draft; it goes when you get there.
- The menu has Today: your three quests with their progress, and what the day still holds (the daily reward, the
  prize wheel, the daily challenge, the gym's five workouts); tap one to go to it. The daily reward now comes in the
  park too, and pick-up keeps a win streak (and your best).
- Quests are never doubled up any more (two of the same quest could be handed out together).
- The prize wheel by the park's gate: one spin a day, for skill points (1 to 5) or followers (500 to 20,000). It
  opens right over the park.
- Two regulars shoot around, one at each rim, with balls of their own: they walk to a spot, rise up, and chase it
  down, through the net or off the iron and away.
- The regulars talk: a word when you come by ("You got next?", "Run it?"), something when you score near them or
  miss, a reaction to a crossover. Walk right up to one and he stops and looks at you, and his card offers a 1 on 1
  against him, under his handle.
- Sized for phones from the smallest iPhone SE up: a ring's card is a slim bar at the top (under the walk-through when
  that is up) instead of a box over your player and the stick, nothing from the park shows through the open menu, the
  map fits the screen, the menu's tiles go to two columns on narrow phones, and the park camera keeps your player a
  little higher, clear of the controls. The career's home button says Park.
- The park camera no longer goes through a hoop's stanchion (and you cannot walk through one), and a regular standing
  between the camera and you steps out of the picture.

- My Player: every player you build has his own career, shown as a card in his uniform with his overall, build,
  height, weight, team and season. Tap one to play him, or build another (up to ten on a device). The title goes
  straight to the last one you played, or to the cards.
- The builder works in steps, the way the console game's does: Profile (name, hometown, number, position, your story),
  Body (height, weight and wingspan, each trading something: heavier is stronger inside and slower, longer arms block,
  steal and rebound better and shoot a little worse), Build (the archetype and the starting ratings it gives), Look.
- The Park: your player on foot in his city's park at dusk, a chain-link fence, trees, lights, park regulars wandering
  and hanging around. Shoot around at either rim, and walk into a ring: pick-up 1 on 1 (to 11), 2 on 2 or 3 on 3 (to 21)
  on the park court, Pro-Am (5 on 5 with park players), the gym (drills and contests: in your career each one is a
  daily workout worth a skill point), the closet (your look), or back to your season. Park games build your followers
  and a park record; every third win is a skill point.
- Rank (the console game's rep, by followers): Rookie, Rotation, Starter, Fan favorite, All-Star, Superstar, MVP, Legend
  and GOAT. Each rank pays skill points and unlocks new gear in the Look card: Volt, Royal, Infrared, Chrome, MVP purple
  and Diamond shoes, gold and chrome headbands, sleeves and wristbands, platinum hair. Nothing you already had is
  locked.
- Quests on the career hub, three at a time, over the next few games: score, rebound, assist, threes, steals, blocks,
  wins, road wins, good grades. Each one done pays skill points and followers, and another takes its place. Sized to
  your role's minutes and the quarter length.
- A daily reward for coming back: a skill point and followers each day, more on a seven-day run.
- The Playoff Picker: before each playoff series, pick who wins it; every right pick is a skill point.
- Around the World in Practice: a make from each of ten spots, in order, before 60 seconds run out.
- Watch a quick game: the two teams play it out on the broadcast, no controls.
- Blacktop (from the phone versions of the console game): half court, one rim, 1 on 1, 2 on 2 or 3 on 3, first to 11,
  15 or 21, win by two. Scored by 2s and 3s or by 1s and 2s; after a basket the other side checks it up at the top of
  the key, or the scorer keeps it (make it, take it). After a stop the ball has to be taken back past the arc, or the
  basket does not count. No free throws, no clock but the shot clock. Played on an asphalt floor, with your career
  player if you have one. The players walk out to the check: nobody is moved there.
- Classics (the console game's Paragon, the phone game's Rewind): twelve great nights from this league's own history,
  replayed from the last minutes with the score and the ball as they were: a Game 7 buzzer-beater, a nine-point
  comeback in ninety seconds, a fifty-point night. A goal on each, and up to three stars.
- The full box score, on the final screen and in the pause menu while the game is on: minutes, points, rebounds,
  assists, steals, blocks, turnovers, fouls, field goals, threes, free throws and plus/minus for every man who played,
  with a team line. On a phone the table slides sideways under the names.
- Player of the Month in your conference, and Rookie of the Month in your first year (yours to win, or the league's).
- The League tab has a Schedule page: last night's scores around the league, and your season game by game with the
  results and your points. The standings show every team's streak.
- Hot zones on the Player tab: what you shoot from each of ten zones of the floor this season. A zone where you are
  well above the league (on four tries or more) turns green, and your shot is a little better from it.
- Coaches call timeouts: a bench that has watched an 8-0 run stops the game at the next whistle (yours or theirs).
- Career stats season by season on the Log tab: games, minutes, points, rebounds, assists, steals, blocks and the
  shooting splits, with a career line.
- Passing. A pass is thrown to the man, not to a spot on the floor: it bends to where he is as it comes, so a receiver
  who keeps moving (you, above all) is hit in the hands instead of watching it go by. Passes have more zip (58 feet a
  second, flatter), the Pass button with the stick held goes where the stick points and never behind you, a teammate
  with a defender in the passing lane is passed over for an open one, and your passes are picked off only by a man
  standing in the lane.
- Nobody jumps from place to place in view. The worst of it: the moment a pass crossed half court, every trailing
  teammate was moved up to the line, as far as 47 feet in one frame. Trailers now run up the floor. The inbounder jogs
  out to the line with the ball and steps back in after his pass. A man going up for a lob jumps for it. Where players
  must be somewhere else at once (the free-throw line-up, a substitution, the start of a period, your check-in) the
  picture cuts, the way a broadcast changes cameras. A test steps whole games a tick at a time and reports any
  player who moves more than a stride without a cut (`tools/teleport.js`): none.
- Awards night is the league's, not just yours: Most Valuable Player, Defensive Player, Rookie, Sixth Man, Most
  Improved and Clutch Player of the Year, Coach of the Year, three All-League teams, two All-Defensive teams, the
  All-Rookie team, and the scoring, rebounding, assists, steals and blocks titles, every one with a name from around
  the league. The League tab has an Awards page: the MVP, Defensive Player and Rookie races as they stand, and who
  won what in the seasons behind you.
- Your numbers are the ones you put up. They are no longer scaled up to a full-length game; the rest of the league's
  lines are kept at the quarter length you play instead, so the leaders and the awards compare like with like.
- Minutes like a real rotation. A starter opens both halves and closes (about 35 of 48 minutes), a sixth man is first
  off the bench in each half (about 24), a reserve gets a run in each half (about 13). When your stint is up you sit at
  the next dead ball, the game plays on without you, and you check back in when the coach calls; your minutes are on
  the final screen.
- Time you do not play is somebody's box score: the minutes on the bench and a game simmed to the end give every point,
  rebound and assist to a player, spread by ratings and minutes, and both box scores add up to the final.
- Teammates space the floor when you drive: the big man slides to the baseline for the dump-off, the others go to the
  corners and the wings, and a covered teammate moves along the arc to get open.
- The defense answers your drives. Help defense, the bump and the charge used to react only to the computer's drives,
  so nobody ever stepped in front of yours. Now the nearest defender steps in when you beat your man, the big man
  drops into the lane to protect the rim, and your own defender slides to where you are going, not where you were.
- Bringing the ball up is the point guard's job: unless you play the point, the computer no longer hands you the ball
  in the backcourt. With the ball there you get a warning at four seconds, and if you are standing still at six you
  give it to the nearest teammate instead of being whistled (a new player used to lose trip after trip to the count).
- A screener plants with his arms crossed. The goggles celebration frames the eyes; the chest thump is back (the
  chest pass had taken its pose). In a replay, a bystander standing in front of the lens steps out of the shot.
- The title's buttons no longer jump when the arena loads behind them (up to 158 px on a phone).
- No two players in a league share a full name. A visiting kit never looks like the home side's. An overtime game
  says so on the final screen.
- Tested in Safari's engine (WebKit) as an iPhone, not only Chrome's: the whole game runs clean there. Sound comes
  back after a call or the lock screen interrupts it.
- Fixed: backing a man down in the post, your player shook between two facings; his back now stays to the basket.
- Fixed: two players held at the half-court line could stand inside each other.
- The inbounder holds the ball over his head in both hands.
- Small phones (320 to 380 wide): the grade no longer sits on your points in the scorebug. The reason for a grade
  change has the row to itself for a moment, instead of being cut to a few letters.
- Fixed: the trail behind a shot and the cameras flashing in the stands were there for the first game of a sitting
  and gone from the second on.
- On defense, an arrow on the floor in front of your man shows where he is going with the ball: green while you are
  between him and the rim, red once he has a step on you.
- A substitute checks in at the scorer's table and runs on (he used to appear where the other man stood).
- The opening tip is won at the top of the jump, at the two centers' fingertips, and tapped back to the point guard
  (the ball used to drop between them and jump into a guard's hands).
- Fixed: a rebound caught in the air went straight into a dribble, bouncing on the floor under a man still two feet
  up. He comes down with it in both hands now, and dribbles once his feet are back on the floor.
- The free throw is shot: the ball comes up from the routine to the set point as the meter fills, goes, and the
  follow-through is held while it is in the air (the ball used to leave from hands held still at the chest).
- Fixed: every game left its floor, stands, players and skeletons behind in graphics memory (about 170
  geometries and 60 textures a game, the floor's seven-megabyte picture among them). A long session could fill a
  phone's memory and take the page down. A new game now lets go of the last one first; four games in a row hold
  steady (`tools/session.js` checks it).
- More of a life around the games: ten more things that come up between them (a kid with a sign, a players' fine
  jar, a terrible car commercial ...), none repeated until you have seen the rest, and five more questions from the
  press (a triple-double, a game that came down to the last possession, a rout, a night of defense, a night of assists).
  The fans online have more to say after a game, and your rival's posts depend on who has been winning.
- The first few pump fakes say what happened ("hold Shoot to shoot"), for anyone who taps the button to shoot. Settings › Controls
  can make a quick tap shoot at once instead.
- A dunk is carried all the way to the rim: he arrives as the ball goes down, the hand at the iron (he used to let
  it go from two or three feet out). It pulls the rim down and lets it go: it springs back, the net with it. The
  rim shivers when a shot comes off the iron.
- The ball turns the way it travels: backspin on a shot and a pass, forward off the dribble, and it sits still in
  the hands of a man holding it (it used to spin the same way all the time).
- Every arena's floor has a design of its own as well as its own wood: the classic solid key, a darker stain inside
  the three-point line, a two-tone key, or an open key edged in the team's color. Edit teams lets you pick one.
- In the dunk contest and the drills the camera no longer whips around when you get under the rim or past it.
- On defense, a reach goes at the ball (down for a low dribble), and anyone off the floor without the ball has his
  hands up: a block try or a rebound no longer goes up with the arms held out in front. A man going up for a
  block or a board faces the ball, whichever way he was drifting (he could turn his back to the shooter in the air).
- Faces change with the moment: a grin in a celebration, a scowl after a shot he should have made or a pass thrown
  away, heavy eyes when he is tired at a stoppage.
- The model's build script rigs the body and everything from the neck up separately, and stops with an error if the
  body comes out badly rigged (one build did, silently: every player stood stiff with his arms out for eight minutes
  on the live site before it was caught and put back).
- The lower-third for a player having a night shows his face next to his line.
- A dribbler's off arm hangs loose when nobody is on him and pumps at a run; it comes up as a bar across his body
  only when a defender crowds him (it was held out stiff all the time).
- Sharper pictures of players: the Look card, your hub card, the create screen and the Player of the Game are drawn
  at twice the size (they were soft on a phone's screen). The Player of the Game shouts in his picture again.
- Fixed: a few seconds on the title screen (which runs at thirty frames a second on purpose) made the game think
  the phone was slow and draw every game after it at a lower resolution. Games are as sharp as the phone allows
  again. A phone that really cannot keep up at the lowest resolution now also drops the outlines and the bench.
- Fixed: a phone in Low Power Mode (which holds every web page to thirty frames a second) was also taken for a slow
  phone and lost its sharpness. The game now checks that drawing less actually bought something; if it did not, the
  cap is coming from outside and everything goes back to full quality.
- Season mode shows your team: all ten players with a headshot, height, rating and points a game, and the starting
  five is yours to set (tap two players and they trade places).
- Big plays land with a beat: the game holds for a few frames on a block, a dunk and broken ankles.
- An open teammate standing in his range puts a hand up for the ball now and then: it shows you who is open.
- Whoever is whistled for a foul puts a hand up: that one is on him.
- A shot he should have made, or a pass thrown to the other team: both hands go to the head.
- Heavy legs at a stoppage: hands on the knees. You, when your stamina is low; one or two others late in a game.
- Sizing up: a ball handler standing with room to work keeps the ball moving (between the legs, behind the back, a
  crossover) instead of pounding one dribble. It is rhythm only: it gives the defense nothing extra to steal.
- Replays start from the rim's side of the play, a little above the heads, so the scorer comes at the camera
  instead of the view sitting behind someone's back; the play-by-play line no longer sits under the REPLAY label.
  A one-time tip teaches the pump fake the first time a defender is right on you.
- More for the Look card: five more hairstyles (curly, a ponytail, long, braids, spiky), a mustache and a chinstrap,
  three more faces (happy, stern, sleepy), a bicep band, socks worn high or low, four cuts of
  shoe (low, high-top, two-tone, gum sole),
  compression tights, and hair dyed blue, pink or green.
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
- The model is yours to change: fifteen hairstyles (or bald) in eight colors, five beards, eight faces, a headband,
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
