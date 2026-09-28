---
name: grok-bot-bilbao-slides
description: Builds a speaker's talk deck (.pptx) for the Grok Bot Bilbao Meetup in the event's design system, with the Universal Sans font embedded and every slide on the event grid. Use when a speaker asks to make, draft, restyle or update their slides or presentation for the Bilbao Meetup.
---

# Grok Bot Bilbao Meetup slides

You're helping a speaker turn their talk into slides. The design is fixed: `template.pptx` holds every layout, with the font embedded and the speaker's bot already placed. **You write the content; `build.py` does the layout.** Never position, size, colour or style anything yourself. That's what keeps every deck on the grid.

## Files

| File | What it is |
| --- | --- |
| `DESIGN.md` | the rules and limits. Read it all before writing anything |
| `template.pptx` | the layouts, the embedded font and the speaker's bot. Don't edit it |
| `build.py` | turns `talk.json` into the .pptx and checks every limit |
| `talk.example.json` | every layout filled in; copy its shape |
| `examples/*.png` | what each layout looks like (`overview.png` shows all 13) |

## Workflow

1. **Read `DESIGN.md`** and look at `examples/overview.png`.
2. **Get the talk.** If the speaker hasn't given you an outline, notes or a script, ask for one. Also ask for:
   - their name and company,
   - the one link for the closing slide,
   - the images they want to show.
   Don't start from nothing.
3. **Plan it slide by slide** in the chat: layout, title and fields for each slide. One idea per slide. Use about one slide per minute of talk, opening with `portada`, then a `frase` with the main point, and ending with `cierre`. Wait for the speaker's OK if they're around to give it.
4. **Write `talk.json`**, following `talk.example.json` and the schema below.
5. **Build:**

   ```sh
   pip install python-pptx fonttools   # once; fontTools makes the line checks exact
   python build.py talk.json -o "Nombre-Apellido-Grok-Bot-Bilbao.pptx"
   ```

6. **Fix every warning and error** by editing `talk.json`, then build again. Shorten the text, split the slide, or swap the layout. Don't ignore a warning, and don't work around the checks. Repeat until the build is clean (`--strict` fails on warnings).
7. **Deliver** the .pptx and tell the speaker:
   - Open it in **PowerPoint** (Mac or Windows, 2019 or later, or 365). The font travels inside the file.
   - Keynote and Google Slides don't read embedded fonts and will show a substitute. If they use either of those, they should export a PDF from PowerPoint for the talk.
   - They can edit anything by hand afterwards. New slides from **Home → New Slide** use the same layouts.

If you can render previews (for example with LibreOffice), note that the preview may substitute the font. Check positions and fit, not the typeface.

## talk.json

```json
{
  "speaker": { "name": "Hugo Fernández", "org": "Acurio Ventures" },
  "title": "Innovación, inversión y el futuro de la IA",
  "link": "linkedin.com/in/…",
  "slides": [
    { "layout": "portada" },
    { "layout": "frase", "text": "…", "notes": "what to say on this slide" },
    { "layout": "cierre" }
  ]
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

- **Every slide** can take `notes`: speaker notes, where detail that doesn't fit on the slide goes.
- **Image paths** are relative to `talk.json`.
- **Field help:** `python build.py --layouts` lists every layout and field.

## Content rules that the script can't check

- **Titles are statements** of what to conclude ("Los agentes ya reservan vuelos"), not topics ("Agentes").
- **Never invent numbers, quotes, sources or images.** If the speaker hasn't given one, ask, or leave it out of that slide.
- **No AI-generated images, stock clip art, emoji or icons.** Use only images the speaker provides: photos, screenshots, product, data.
- **Write in Spanish** unless the speaker says otherwise. Use sentence case and keep accents. No full stops on titles or rows. Use digits with units (45 min, 3,5 %).
- **Don't put line breaks in titles.** `build.py` balances them with the real font; a `\n` forces a break and should only separate two distinct lines.
- **Your job is to cut, not to fill.** 30 words at most per slide. When in doubt, split the slide or move the detail to `notes`.
