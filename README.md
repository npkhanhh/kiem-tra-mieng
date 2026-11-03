# Kiểm tra miệng

Random student picker games for the classroom. Static HTML, CSS and JS, no build step.

- `docs/index.html`: game list
- `docs/games/xoai/`: mango tree game

GitHub Pages serves `docs/` from `main`: https://npkhanhh.github.io/kiem-tra-mieng/

Source images are in `art/`. After replacing one, run `./build-art.sh` to rebuild the WebP files in `docs/games/xoai/art/`.

Source sounds are in `sfx/`: CC0 previews from Freesound. Run `./build-sfx.sh` to cut and level them into `docs/games/xoai/sfx/`.

- tick: Marimba note struck, https://freesound.org/s/185833/
- knock: Knocking on Wood Door (1), https://freesound.org/s/629987/
- shake: shaking a tree with a stick, https://freesound.org/s/840568/
- rustle: bushmovement.wav, https://freesound.org/s/106114/
- swoosh: light slow swoosh, https://freesound.org/s/349698/
- thud: found matress hit, https://freesound.org/s/405705/
- bump: soft-hit.wav, https://freesound.org/s/653910/
- chime: GASP_Chimes_Success_4, https://freesound.org/s/541985/
- wind: gust of wind.wav, https://freesound.org/s/80937/

Run locally:

```sh
python3 -m http.server 8765 --directory docs
```
