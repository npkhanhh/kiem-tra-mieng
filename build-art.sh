#!/usr/bin/env bash
# Builds docs/games/xoai/art/*.webp from the source PNGs in art/.
set -euo pipefail
cd "$(dirname "$0")"
src=art
out=docs/games/xoai/art
clean=(-channel A -level 8%,100% +channel)
mkdir -p "$out"

magick "$src/background.png" -quality 82 "$out/background.webp"
for f in beo-ready beo-poke; do
  magick "$src/$f.png" "${clean[@]}" -crop 1152x1169+78+27 +repage -resize x700 -quality 85 "$out/$f.webp"
done
for f in kid-point kid-cheer; do
  magick "$src/$f.png" "${clean[@]}" -trim +repage -resize 48% -quality 85 "$out/$f.webp"
done
for f in mango-happy mango-scared; do
  magick "$src/$f.png" "${clean[@]}" -crop 821x1167+243+73 +repage -resize x220 -quality 85 "$out/$f.webp"
done
magick "$src/pole.png" "${clean[@]}" -crop 2103x105+33+305 +repage -resize 1400x -quality 85 "$out/pole.webp"
magick "$src/plate.png" -fuzz 30% -transparent '#04fa09' -channel G -fx 'min(g,max(r,b))' +channel -trim +repage -resize 560x -quality 85 "$out/plate.webp"
