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

The players' body and its running, jumping and stance animations are the mannequin from
[Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) by
[Quaternius](https://quaternius.com) (CC0 1.0; [OpenGameArt](https://opengameart.org/content/universal-animation-library)).
`tools/model.mjs` trims it to the clips the game uses (`models/player.glb`, 417 kB). The kit, numbers, hair and the
basketball arm poses are added in code.

Libraries: [three.js](https://threejs.org) (MIT). Fonts: Archivo (SIL Open Font License), from Google Fonts.
