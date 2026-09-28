#!/usr/bin/env bash
# Records the demo and writes the videos and posters used by the docs site
# into docs-site/public/videos. Needs `pnpm build`, ffmpeg, and the example
# server:  PORT=3301 node scripts/serve.mjs
#   scripts/make-videos.sh [examples url]
#
# For each recording <name> it writes:
#   <name>.mp4     normal speed, 60 fps
#   <name>-4x.mp4  four times slower
#   <name>.png     poster for both, a frame from the middle of the open
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=${1:-http://127.0.0.1:3301/examples/index.html}
REC=${REC:-${TMPDIR:-/tmp}/morphcard-rec}
OUT=docs-site/public/videos
mkdir -p "$OUT" "$REC"

# The list is held for 18 frames, so frame 24 is 100 ms into the open.
POSTER=24

record() { # name, then VAR=value pairs for scripts/record.mjs
  local name=$1
  shift
  env "$@" TAG="$name" OUT="$REC" node scripts/record.mjs | tail -1 >"$REC/$name.json"
}

encode() { # name
  local name=$1 dir=$REC/$1
  local even="scale=trunc(iw/2)*2:trunc(ih/2)*2"
  local x264=(-c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart)
  ffmpeg -loglevel error -y -framerate 60 -i "$dir/f%04d.png" -vf "$even" "${x264[@]}" "$OUT/$name.mp4"
  ffmpeg -loglevel error -y -framerate 15 -i "$dir/f%04d.png" -vf "$even,fps=60" "${x264[@]}" "$OUT/$name-4x.mp4"
  ffmpeg -loglevel error -y -i "$dir/f$(printf %04d $POSTER).png" -frames:v 1 "$OUT/$name.png"
}

record open-close-light URL="$BASE?layout=frame"
record open-close-dark URL="$BASE?layout=frame&theme=dark"
record interrupt-light URL="$BASE?layout=frame" INTERRUPT=150 HOLD_END=30
record interrupt-dark URL="$BASE?layout=frame&theme=dark" INTERRUPT=150 HOLD_END=30
record reduced URL="$BASE?layout=frame&reduce"
record desktop-light URL="$BASE?layout=frame&w=1280&h=800" W=1280 H=800 DPR=1
record desktop-dark URL="$BASE?layout=frame&w=1280&h=800&theme=dark" W=1280 H=800 DPR=1

for name in open-close-light open-close-dark interrupt-light interrupt-dark reduced desktop-light desktop-dark; do
  encode "$name"
done

# A small GIF for the README: phone, light, half speed, 15 fps, 320 px wide.
ffmpeg -loglevel error -y -framerate 30 -i "$REC/open-close-light/f%04d.png" \
  -vf "fps=15,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer" \
  "$OUT/demo.gif"

ls -la "$OUT"
