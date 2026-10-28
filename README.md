# Kiểm tra miệng

Random student picker games for the classroom. Static HTML, CSS and JS, no build step.

- `docs/index.html`: game list
- `docs/games/xoai/`: mango tree game

GitHub Pages serves `docs/` from `main`: https://npkhanhh.github.io/kiem-tra-mieng/

Source images are in `art/`. After replacing one, run `./build-art.sh` to rebuild the WebP files in `docs/games/xoai/art/`.

Run locally:

```sh
python3 -m http.server 8765 --directory docs
```
