# Credits

Everything in PocketBasketball is made for it in code, except the player model and these recordings. All are public domain (CC0 1.0),
which asks for no credit; they are listed here anyway, with thanks. `tools/sfx.py` cuts them into `audio/sfx.m4a`.

| Sounds | Recording | By |
|---|---|---|
| Net swish | [Basketball Net Swish Sound](https://freesound.org/people/Hann90/sounds/518048/) | Hann90 |
| Ball on the board and rim | [S02-28 Basketball hard against backboard](https://freesound.org/people/craigsmith/sounds/675319/) | craigsmith |
| Sneaker squeaks | [sneaker squeak rubber](https://freesound.org/people/shakaharu/sounds/88502/) | shakaharu |
| Dribble | [BasketballBounce](https://freesound.org/people/Blankened/sounds/505628/) | Blankened |
| Dribble | [Bouncing basketball](https://freesound.org/people/DigPro120/sounds/811910/) | DigPro120 |
| Referee's whistle | [Referee whistle blow, gymnasium](https://freesound.org/people/SpliceSound/sounds/218318/) | SpliceSound |

## Player model

The player you see is this game's own: `tools/body.py` builds it in Blender (the body, the kit, shoes, the head,
ten hairstyles, beards, faces, a headband, goggles) and writes `models/body.glb`. It is ours to use any way we like.

Its skeleton and its running, jumping and stance animations are the mannequin's from
[Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) by
[Quaternius](https://quaternius.com) (CC0 1.0; [OpenGameArt](https://opengameart.org/content/universal-animation-library)).
`tools/model.mjs` trims it to the clips the game uses (`models/player.glb`, 417 kB). The basketball moves on top of
those clips (the jump shot, layup, dunk, passes, the pump fake, defense, celebrations) are keyed in code in `js/court.js`.

## Motion capture

The dribbling arm is measured from the CMU Graphics Lab Motion Capture Database (subject 06, forward dribble), by way of
[sfd158/cmu-mocap](https://github.com/sfd158/cmu-mocap) and `tools/mocap/dribble.py`. The data used in this project was
obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

## The booth

The two commentators are recorded on a Mac with [Chatterbox](https://github.com/resemble-ai/chatterbox) (Resemble AI,
MIT license), each cloned from a reference clip spoken by [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M)
(Apache 2.0), a synthetic voice: no real person's voice is used. `tools/voice.py` records and packs them.

Libraries: [three.js](https://threejs.org) (MIT). Fonts: Archivo (SIL Open Font License), from Google Fonts.
