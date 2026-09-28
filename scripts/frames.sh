#!/usr/bin/env bash
# Turns recorded frames into videos and contact sheets.
#   scripts/frames.sh <frames dir> <out prefix> [first frame] [count] [step]
# Writes <prefix>.mp4 (60 fps, H.264, yuv420p, faststart), <prefix>-4x.mp4
# (four times slower) and <prefix>-sheet.png (count frames, every step-th).
set -euo pipefail
dir=$1
out=$2
first=${3:-0}
count=${4:-10}
step=${5:-3}

ffmpeg -loglevel error -y -framerate 60 -i "$dir/f%04d.png" \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset slow -crf 20 \
  -pix_fmt yuv420p -movflags +faststart "$out.mp4"
ffmpeg -loglevel error -y -framerate 15 -i "$dir/f%04d.png" \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=60" -c:v libx264 -preset slow -crf 20 \
  -pix_fmt yuv420p -movflags +faststart "$out-4x.mp4"

sel=""
for ((i = 0; i < count; i++)); do
  n=$((first + i * step))
  sel+="eq(n\\,$n)+"
done
sel=${sel%+}
cols=$(( count < 5 ? count : 5 ))
rows=$(( (count + cols - 1) / cols ))
ffmpeg -loglevel error -y -i "$dir/f%04d.png" \
  -vf "select='$sel',scale=iw/2:-1,tile=${cols}x${rows}:padding=6:color=white" \
  -frames:v 1 -fps_mode vfr "$out-sheet.png"
echo "$out.mp4 $out-4x.mp4 $out-sheet.png"
