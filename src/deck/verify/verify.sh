#!/bin/sh
# Regenerates the decks and checks them against the designer's originals.
#  1. template decks vs reference/speaker-deck/*.pptx: every XML part, normalised
#  2. a talk built by the designer's build.py vs the same talk built by us: every element
#  3. build.py's warnings/errors vs ours on a talk that breaks every rule
# Needs: python3 -m pip install --user python-pptx   (fontTools optional)
set -e
cd "$(dirname "$0")/../../.."
T=$(mktemp -d); V=src/deck/verify
node src/deck/build.mjs --out "$T/decks" > /dev/null
for n in plantilla Hugo-Fernandez Leire-Legarreta Xuban-Ceccon; do
  mkdir -p "$T/ref/$n" "$T/gen/$n"
  (cd "$T/ref/$n" && unzip -q "$OLDPWD/reference/speaker-deck/Grok-Bot-Bilbao-$n.pptx")
  (cd "$T/gen/$n" && unzip -q "$T/decks/Grok-Bot-Bilbao-$n.pptx")
  printf '%s: ' "$n"
  # font data, bot renders, timestamps and (without a licensed font) the font wiring are expected to differ
  node $V/xmldiff.mjs "$T/ref/$n" "$T/gen/$n" fntdata media/ core.xml Content_Types presentation.xml | head -1
done
mkdir -p "$T/kit" && cp reference/speaker-deck/ai-kit/build.py "$T/kit/" && cp "$T/decks/Grok-Bot-Bilbao-Hugo-Fernandez.pptx" "$T/kit/template.pptx"
python3 "$T/kit/build.py" examples/talk.example.json -o "$T/py.pptx" | tail -1
node src/deck/build.mjs examples/talk.example.json -o "$T/node.pptx" --speaker hugo | tail -1
printf 'example talk, build.py vs ours: '; python3 $V/compare_decks.py "$T/py.pptx" "$T/node.pptx"
python3 "$T/kit/build.py" $V/talk.bad.json -o "$T/bad.pptx" > "$T/bad-py.txt" || true
node src/deck/build.mjs $V/talk.bad.json -o "$T/bad-node.pptx" --speaker leire > "$T/bad-node.txt" || true
printf 'rule checks, build.py vs ours: '; diff "$T/bad-py.txt" "$T/bad-node.txt" > /dev/null && echo "identical ($(wc -l < "$T/bad-py.txt" | tr -d ' ') lines)" || diff "$T/bad-py.txt" "$T/bad-node.txt"
rm -rf "$T"
