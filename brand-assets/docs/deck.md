# Speaker deck

The speakers' slide system (`reference/speaker-deck/`) rebuilt as code: the four PowerPoint templates, the talk builder and the speaker kits. Change a speaker, a bot, a colour or the event name in `config/event.js` and regenerate. The designer isn't needed.

## Commands

```bash
node src/deck/build.mjs                          # every template deck -> out/deck/Grok-Bot-Bilbao-*.pptx
node src/deck/build.mjs --speaker hugo           # one template (hugo | leire | xuban | template)
node src/deck/build.mjs --kit                    # also the speaker kits (…-kit.zip)
node src/deck/build.mjs talk.json [-o deck.pptx] [--speaker hugo] [--strict]
node src/deck/build.mjs --layouts                # every layout and its fields
src/deck/verify/verify.sh                        # check everything against the designer's files
```

A template deck has one example slide per layout, with the speaker's bot on the cover and closing slides, their name and company, and their talk title balanced over two lines. The example copy and speaker notes are the designer's.

## The designer's originals, and how ours relates

`reference/speaker-deck/ai-kit/` holds the designer's own kit sources: `build.py` (python-pptx), `SKILL.md` (instructions for Claude), `LEEME.md` (for the speaker) and `DESIGN.md` (the rules). They were salvaged from the partial kit downloads; the kits' `template.pptx` is the same file as `reference/speaker-deck/Grok-Bot-Bilbao-*.pptx`.

- **Their pipeline:** PptxGenJS generated `template.pptx`, a Python step fixed it up (placeholder names, guides, embedded font), and `build.py` fills it from `talk.json`.
- **Ours:** `src/deck/` generates the same template with PptxGenJS and does the same fix-ups in `postprocess.mjs`. After normalisation, every XML part (slides, layouts, master, notes, theme) is identical to the designer's four templates. Only three things differ: the bot PNGs (rendered by us from `assets/bots/`), timestamps, and the font, which is embedded only when a licensed file is present.
- **The designer's `build.py` works unchanged with our template.** That keeps `SKILL.md`, and a speaker who already has the kit, working. `--kit` rebuilds the kit zip from our template plus the designer's `build.py`/`SKILL.md`/`LEEME.md`/`DESIGN.md`.
- **Our builder is a Node port of `build.py`:** same `talk.json`, same layouts and fields, same checks, same messages and same line balancing. It builds from `config/event.js` instead of a template file, so a speaker's bot comes from the config (`--speaker`, or the speaker whose name matches `talk.json`).

## talk.json

The designer's format (see `SKILL.md`). Example with every layout: `examples/talk.example.json`.

```json
{
  "speaker": { "name": "Hugo Fernández", "org": "Acurio Ventures" },
  "title": "Innovación, inversión y el futuro de la IA",
  "link": "linkedin.com/in/…",
  "slides": [ { "layout": "portada" }, { "layout": "frase", "text": "…", "notes": "…" }, { "layout": "cierre" } ]
}
```

| layout | fields |
| --- | --- |
| `portada` | none: uses `title` and `speaker` |
| `seccion` | `number` ("01"), `title` |
| `filas` | `title`, `rows`: 1–4 of `{ "text", "detail" }` (detail optional, grey) |
| `frase` | `text` |
| `cifra` | `title`, `figure` (≤ 4 characters), `label`, `source` |
| `tres-cifras` | `title`, `figures`: 1–3 of `{ "value", "unit", "label" }` (unit optional, grey) |
| `imagen` | `title`, `image`, `caption` |
| `imagen-sola` | `image`, `caption` |
| `imagen-a-sangre` | `image` (landscape, ≥ 1920 px wide), `caption` |
| `dos-imagenes` | `title`, `images`: 2 of `{ "image", "label", "detail" }` |
| `cita` | `quote`, `author`, `role` |
| `codigo` | `title`, `code` (≤ 14 lines, `\n` between lines), `comment` (prefix, default `#`) |
| `cierre` | none: uses `speaker` and `link` |

- Every slide can take `notes`. Image paths are relative to `talk.json`.
- Layout names are matched like `build.py` does: accents and case don't matter, and `sangre`, `cover` and `closing` are aliases.
- **Our additions** (ignored by `build.py`):
  - English aliases matching the example pictures: `section`, `rows`, `statement`, `number`, `stats`, `image`, `image-solo`, `bleed`, `pair`, `quote`, `code`.
  - An optional `alt` for image alt text; the default is the caption or file name.

## What the builder checks

These are the same checks with the same wording as `build.py`. `--strict` also fails on warnings.

- **Errors (nothing is saved):**
  - unknown layout
  - `filas` with other than 1–4 rows, or `tres-cifras` with other than 1–3 figures
  - `dos-imagenes` with anything but exactly 2 images
  - more than 14 code lines
  - a missing image or missing required field (`portada` title/speaker, `frase` text, `cifra` figure, `cita` quote, `cierre` speaker)
- **Warnings:**
  - text that runs past its line limit
  - more than 30 words on a slide (code excluded)
  - a title over 8 words (10 for `filas`) or ending in a full stop
  - rows ending in a full stop
  - a figure over 4 characters, or without a source
  - a quote over 12 words
  - a code line over 88 characters
  - an image enlarged more than 1.25×, or narrower than its layout needs
  - a link too long for the pill, or no link

**Line lengths.** With the licensed font in `fonts/`, lines are measured with it, as `build.py` does with the embedded font and fontTools. Without it, both estimate 0.52 em per character. Titles break into lines of similar length (CSS `text-wrap: balance`) with soft line breaks.

## The font

- The event font is Universal Sans Display (Family Type), a commercial font. It is not in the repo, and the copy embedded in the designer's decks is licensed only for those decks, so we never extract it.
- **With a licensed file:** put it at `fonts/UniversalSansDisplay-Regular.ttf` (any `fonts/universal*sans*display*.ttf|otf` is picked up). Every deck then embeds it, and text is measured with it. `DECK_FONT=/path/to/font.ttf` overrides the location.
- **The file must be TrueType (`.ttf`, glyf outlines).** PowerPoint only embeds TrueType, and the designer's embedded copy is TrueType. An `.otf` with CFF outlines is used for measuring but not embedded.
- **Its OS/2 `fsType` must allow embedding.** A restricted-licence font is refused with a warning.
- **Embedding format:** PowerPoint stores embedded fonts as Embedded OpenType. `ppt/fonts/font1.fntdata` is an EOT v2.1 header (uncompressed, no XOR) followed by the raw `.ttf`. `src/deck/eot.mjs` writes it; its header layout was checked against the designer's file.
  - The typeface name in the slides is the font's own family name. The designer's font is called "Universal Sans Display 400".
  - `build.py` can read our embedded font back with fontTools. We checked this with the free stand-in font embedded, and got identical measured line counts.
- **Without a licensed file:** slides name "Universal Sans Display 400" and nothing is embedded. PowerPoint substitutes a font unless the presenter has it installed.

## Bots on the cover and closing slides

The overlays are rendered from `assets/bots/<shape>.json` (the traced outline and neutral face) as 1920 × 1080 transparent PNGs. Placement was measured on the designer's templates:

- **Cover:** the bot is 600 px tall, its right edge at x 1960 and bottom edge at y 450, cut by the top and right edges of the slide.
- **Closing:** the bot is 780 px tall, its right edge at x 1960 and top edge at y 450, cut by the bottom and right edges.

Against the designer's PNGs (round, square and cloud), silhouette IoU is 0.998–0.999 and eye IoU is 0.975–0.997. The ↗ icon in the link pill is `M7 7h10v10M6.6 17.4L17 7` (24-unit box, stroke 2), IoU 0.997.

## Files

```
src/deck/build.mjs             CLI
src/deck/deck.mjs              talk.json -> slides, checks (port of build.py)
src/deck/layouts.mjs           the 13 layouts (geometry measured from the templates)
src/deck/template-content.mjs  the template's example slides and notes
src/deck/text.mjs              measuring, wrapping, balancing (port of build.py)
src/deck/bots.mjs              bot overlays and the arrow icon
src/deck/postprocess.mjs       placeholder names, guides, font embedding
src/deck/eot.mjs               TrueType -> EOT
src/deck/examples/             example photos (Foto: SpaceX, from the designer's template)
src/deck/verify/               comparison tools and verify.sh
examples/talk.example.json     every layout filled in
```
