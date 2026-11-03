#!/usr/bin/env bash
# Builds docs/games/xoai/sfx/*.mp3 from the Freesound previews in sfx/.
set -euo pipefail
cd "$(dirname "$0")"
src=sfx
out=docs/games/xoai/sfx
mkdir -p "$out"

# clip <name> <source> <start s> <length s> <fade-out s> <gain dB> [fade-in s]
clip() {
  ffmpeg -v error -y -ss "$3" -t "$4" -i "$src/$2" \
    -af "volume=$6dB,afade=d=${7:-0.005},areverse,afade=d=$5,areverse" \
    -ac 1 -b:a 64k "$out/$1.mp3"
}

clip tick   185833-marimba-note-struck.mp3         0    0.35 0.15 0
clip knock  629987-knocking-on-wood-door.mp3       0.11 0.2  0.08 18
clip shake  840568-shaking-a-tree-with-a-stick.mp3 0.53 1.0  0.3  8
clip rustle 106114-bushmovement.mp3                0    1.2  0.4  6
clip swoosh 349698-light-slow-swoosh.mp3           0.39 0.9  0.25 12
clip thud   405705-found-matress-hit.mp3           0    0.5  0.25 0
clip bump   653910-soft-hit.mp3                    0    0.25 0.08 0
clip chime  541985-gasp-chimes-success-4.mp3       0    0.8  0.1  0
clip wind   443065-leaves-rustling.mp3             1.3  3.0  1.0  25.6 0.6
