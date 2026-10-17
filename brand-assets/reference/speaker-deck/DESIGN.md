# Grok Bot Bilbao Meetup · Speaker slides

This is how to build your talk deck so it looks like part of the show. It uses the same black canvas, type, grid and bots as the event screens that come before and after you. The rules are strict on purpose: the less a slide does, the easier it is to read from the back of the room and on the livestream.

![The 13 layouts](examples/overview.png)

## Start here

Every speaker gets a kit: a .zip with this file, their `template.pptx` (with the event font embedded and their bot already placed), a `build.py` that lays the deck out, and instructions for an AI (`SKILL.md`).

| Speaker | Kit | Bot | Accent |
| --- | --- | --- | --- |
| Hugo Fernández | `Grok-Bot-Bilbao-Hugo-Fernandez-kit.zip` | square | green `#42B870` |
| Leire Legarreta | `Grok-Bot-Bilbao-Leire-Legarreta-kit.zip` | cloud | pink `#ED3A95` |
| Xuban Ceccon | `Grok-Bot-Bilbao-Xuban-Ceccon-kit.zip` | round | white `#FFFFFF` |
| Anyone else | `Grok-Bot-Bilbao-plantilla-kit.zip` | round | white `#FFFFFF` |

**With an AI (recommended).** Attach the .zip to a new Claude chat, together with your outline and images, and say: "Use the attached kit (read SKILL.md) to make the slides for my talk." Claude writes the content into `talk.json` and `build.py` does the layout. Every slide lands on the grid, in the right font, and anything that breaks a rule below is sent back to be fixed before the deck is saved. You can edit the result by hand afterwards.

**By hand.** Open `template.pptx` in PowerPoint. It has one example slide per layout. Duplicate the one you need, replace the copy, and delete the examples you don't use. Each example's speaker notes repeat its rules, and **Home → New Slide** offers every layout.

**Either way,** send the .pptx and a PDF export to the organisers before the event.

## The ten rules

They follow SpaceX's visual discipline, as seen in its launch webcasts and on spacex.com: black, big type, real hardware, exact numbers, nothing decorative.

1. **Black canvas, nothing else.** No gradients, textures, shadows, glows, outlines, 3D, or transparency effects. The room is dark and the stream is compressed; flat black and white stay sharp in both.
2. **One idea per slide.** If a slide needs an "and", make two slides. Slides are cheap and attention isn't.
3. **Titles are statements.** Write what the audience should conclude, not the topic: "Los agentes ya reservan vuelos", not "Agentes". Use sentence case, no full stop, and two lines at most.
4. **Big or nothing.** Nothing on a slide is smaller than 32 px (16 pt). If it doesn't fit at that size, it doesn't go on the slide; put it in your speaker notes.
5. **30 words at most per slide**, code excluded. The audience reads faster than you talk, so anything more competes with you.
6. **Text left, images centred.** Text is always left-aligned, never centred or justified. Images are always centred in their zone.
7. **Everything on the grid.** Keep 90 px at the top and bottom and 80 px at the sides. Nothing touches the edge except full-bleed photos and your bot.
8. **Numbers are facts.** Use digits, a unit and a source. Round honestly and never show more precision than you have.
9. **Real images only.** Use photos, screenshots, product and data. No clip art, stock photos of handshakes, AI-generated "futuristic" illustrations, emoji, or icon packs.
10. **Motion only where it explains.** Use a cut, or a fade of 0.3 s or less, the same on every slide. The only build allowed is rows appearing one by one.

## Canvas and grid

![Grid](examples/00-grid.png)

| | px | PowerPoint |
| --- | --- | --- |
| Canvas | 1920 × 1080, 16:9 | 13.333 × 7.5 in |
| Margins | 90 top and bottom, 80 sides | 0.625 in, 0.556 in |
| Safe area | 1760 × 900 | |
| Right column | starts at x 964 | 6.69 in |
| Image zone under a title | y 200–880, centred on the slide | 1.39–6.11 in |
| Caption, source, name | bottom-left, on the bottom margin | |
| Page number | bottom-right, grey | automatic |

In PowerPoint, 1 in = 144 px and 1 pt = 2 px. The templates have red guides on the margins, the right column and the image zone: turn them on with **View → Guides**.

## Type

One family, one weight: **Universal Sans Display Regular**. Hierarchy comes from size and colour only. Never use bold, italic, underline or ALL CAPS.

| Role | px (line) | pt | Used for | Limit |
| --- | --- | --- | --- | --- |
| Numeral | 240 (228) | 120 | the one key figure on a *Cifra* slide | 4 characters |
| Hero | 120 (126) | 60 | cover title, section, statement, quote, "Gracias" | 2–3 lines |
| Display | 64 (70) | 32 | slide titles | 1 line; 3 in *Título y filas* |
| Body | 40 (48) | 20 | rows, labels | 2 lines per row |
| Small | 32 (38) | 16 | your name, captions, sources, code, page numbers | 1 line |

- **The font is embedded in the template.** It travels inside the .pptx, so you don't need to install anything. In PowerPoint's font menu it's called **Universal Sans Display 400**.
- **Present from PowerPoint** (Mac or Windows, 2019 or later, or Microsoft 365), or from the PDF you export from it. Keynote and Google Slides don't read embedded fonts and swap in a substitute.
- **Don't extract, install or share the font.** It's licensed for these event decks only.
- **Balanced titles.** Titles break into lines of similar length, like CSS `text-wrap: balance`: "Proyectos punteros / de IA en Euskadi", never "Proyectos punteros de IA en / Euskadi". Running text never leaves one word alone on its last line. With the kit, `build.py` sets the breaks for you. By hand, break the line yourself with **Shift + Enter**.
- **Code** is the one exception: it uses a monospace font (Courier New in the template) at 32 px, with comments in grey.

## Colour

| Colour | Hex | Used for |
| --- | --- | --- |
| Black | `#000000` | the canvas, always |
| White | `#FFFFFF` | what matters: titles, first lines, figures |
| Grey | `#777777` | detail: second lines, units, sources, captions, page numbers |
| Your accent | your bot's colour | your bot, and the single figure on a *Cifra* slide. Nothing else |

- **Red is off-limits.** `#EE3342` marks times on the event screens.
- **One accent per slide, at most.** If everything is highlighted, nothing is.
- **Charts** are white and grey. The series that makes your point may use your accent. Label lines directly instead of using a legend, and drop gridlines, 3D and pie charts.

## Images

- **Centre every image**, horizontally and vertically, in its zone:
  - Under a title: the zone is y 200–880, so the image is at most 680 px (4.7 in) tall.
  - With no title: at most 760 px (5.3 in) tall, which leaves room for the caption.
  - In PowerPoint, drag a corner with **Shift** held to keep proportions, then **Arrange → Align → Align Center** and **Align Middle**. Both zones are centred on the slide, so this puts the image exactly in place.
- **Contain, don't crop.** Show the whole image as large as it fits. The one exception is full-bleed photos, which fill the slide edge to edge.
- **Never** stretch, rotate, frame, round, shadow or border an image.
- **Screenshots:**
  - Crop them before you insert them, never on the slide.
  - Zoom the browser or app to 150% so the text is readable from the back.
  - Hide bookmarks, notifications, tabs and personal data. Use dark mode where you can.
- **Resolution:** at least as big as the image appears on the slide. Full-bleed photos need 1920 × 1080 or more.
- **Credit** every image you didn't make: "Foto: Autor", bottom-left, in grey.
- **Two images** side by side must have the same format and the same size.
- **Video:** embed it (don't link to it) as MP4 (H.264). The same placement rules apply. It starts on click and is muted unless the sound is the point.

## Layouts

Each example slide in the template is one of these. The layout names appear under **New Slide** in PowerPoint.

| # | Layout | Use it for | Limits |
| --- | --- | --- | --- |
| 01 | **Portada** (cover) | your title, name and company; your bot is already on it | title 2 lines |
| 02 | **Sección** (section) | chapters, only if the talk has three or more | number + 1 line |
| 03 | **Título y filas** (title + rows) | a short list, agenda style: numbered rows in the right column, idea in white, detail in grey | 4 rows, 2 lines each |
| 04 | **Frase** (statement) | the sentence you want people to remember | 3 lines, nothing else |
| 05 | **Cifra** (figure) | one number that matters, in your accent | number, label, source |
| 06 | **Tres cifras** (three figures) | comparisons and scale; figures white, units grey | 3 figures |
| 07 | **Imagen con título** (image + title) | a photo, diagram or screenshot that needs a headline | 1 image |
| 08 | **Imagen sola** (image) | screenshots and portrait photos, as large as possible | 1 image |
| 09 | **Imagen a sangre** (full bleed) | one strong landscape photo, edge to edge | caption only |
| 10 | **Dos imágenes** (two images) | before and after, A vs B | same format and size |
| 11 | **Cita** (quote) | someone else's words, with “ ” | 12 words |
| 12 | **Código** (code) | the snippet or prompt you're explaining | 14 lines |
| 13 | **Cierre** (closing) | thanks, your name, one link | 1 link |

**A typical deck:** Portada → one Frase with your main point → content slides → Cierre. Plan on about one slide per minute of talk. Your closing slide stays up until the organisers switch to the Q&A screen.

## Words

- **Language:** write in Spanish, unless your talk is in Basque or English. Keep accents on everything: Fernández, inversión.
- **Capitals:** use sentence case. When separate items are stacked, each starts with a capital. When one sentence wraps onto a second line, it carries on in lowercase.
- **Punctuation:** no full stops at the end of titles, rows or captions.
- **Numbers:**
  - Use digits (3, not "tres") and put the unit after a space: 45 min, 42 %.
  - Use a decimal comma: 3,5.
  - Write times in 24 h (18:45) and dates as on the event ("Lunes, 19 de octubre").
- **Links:** give the domain and path only, with no `https://` or `www`: `luma.com/spacexai-euskadi`.
- **"IA", not "AI"**, in Spanish.

## Bots and logos

- **Your bot appears twice,** on the cover and the closing slide, already placed. Don't move, recolour, stretch or redraw it, and don't add other bots or stickers. The bots belong to the event screens.
- **No logos on your slides.** The event screens carry SpaceX and Grok branding, and your company is named on your cover and closing slides. If you're showing a product, show the product itself.

## Before you send it

- [ ] Every slide has one idea and 30 words or fewer.
- [ ] Every title is a statement, in sentence case, with no full stop.
- [ ] Nothing is smaller than 32 px (16 pt), bold, italic or centred.
- [ ] Every image is centred, uncropped (unless full-bleed), unstretched and credited.
- [ ] Every number has a unit and a source.
- [ ] Only your bot's colour is used as an accent, and never red.
- [ ] Videos are embedded, and there's a PDF export alongside the file.
- [ ] You've looked at it on a TV or projector, from 5 metres away.

## What the builder checks

With the kit, `build.py` refuses to save a deck that breaks a hard limit:
- an unknown layout,
- more than 4 rows or 3 figures,
- more than 14 lines of code,
- a missing image.

It warns about everything it can measure:
- text that runs past its line limit (measured with the embedded font; titles are also balanced automatically),
- more than 30 words on a slide,
- titles over 8 words or ending in a full stop,
- figures without a source,
- images too small for their size on screen,
- links too long for the pill.

What it can't check is in `SKILL.md`: statements rather than topics, and no invented numbers, quotes or images.
