# Fonts

The event type is **Universal Sans Display, Regular (400)** by Family Type (universalsans.com). It is a commercial font and is **not** in this repo.

## Getting pixel-exact output

1. Buy a licence for Universal Sans Display Regular at universalsans.com. A Desktop licence covers rendering images, video and PDFs; add Social or Broadcast if the foundry's terms require it for how the material is used.
2. Put the font file here with one of these names (the first match wins):
   - `UniversalSansDisplay-Regular.woff2`
   - `UniversalSansDisplay-Regular.woff`
   - `UniversalSansDisplay-Regular.otf`
   - `UniversalSansDisplay-Regular.ttf`
3. Re-render. The renderer prints a warning while the licensed file is missing.

Files in this folder, other than `stand-in/` and this README, are ignored by git, so the licensed font never gets committed.

## Stand-in

Without the licensed file, everything renders with **Inter Display Regular** (`stand-in/`, SIL Open Font License, see `stand-in/LICENSE.txt`). The layout is the same because text is placed by baseline, not by box. Lines at 40 and 64 px come out within a few pixels of the original width. Lines at 120 px come out a little wider.

## Do not extract the font from the designer's PowerPoints

The PPTX templates in `reference/speaker-deck/` embed Universal Sans. The designer's notes say that embedded copy is licensed for those decks only, so don't extract it or reuse it here.
