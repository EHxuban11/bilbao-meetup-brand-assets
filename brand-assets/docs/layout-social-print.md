# Social posts and poster: measured layout

Measured from `reference/social/*.png` and the poster PDF (`reference/print/`). Tools:
- `tools/measure.mjs`: text baselines. Baselines are ±0.5 px. Text x is the layout x; ink starts 1–4 px right of it.
- `tools/logo-fit.mjs`: logo boxes and IoU.
- `tools/fit-bot.mjs`: bot poses relative to `assets/bots/<shape>.json`.
- `tools/pdf2svg.mjs` + `tools/pdf-extract.mjs`: the poster's exact vectors.

Type sizes come from cap height (0.705 em) and x-height (≈ 0.53 em). Colours: white, grey `#777777`, red `#EE3342`. Pills are white with black text.

## Rules inferred

- **Margins are 80 px** on every side for social (screens use 90 top/bottom). The feed post's wordmark sits 90 from the bottom.
- The **agenda block is the screen agenda**: agenda 40/54, first line white, the rest grey, time red on the row's first baseline, 18 px extra between rows. Horizontal keeps the screen columns (times x 964, text x 1156). Story moves them to x 80 / 272 (same 192 gap).
- **Top-left block**: display 64. "Grok Bot" / "Bilbao Meetup" are 70 apart; the grey date sits **76** below "Bilbao Meetup" (on screens it's 70). Horizontal first baseline 128 (screens: 148).
- **@2x** files are the same layout rendered at device scale 2: the @2x downscaled against 1x gives a mean difference of 0.39/255, so no layout change.
- **Story Partners** = Story moved up 60 px plus a centred partner row. **Partners Story** = Partners Feed with the partner stack moved down 240 and the header down 180.
- **Partners Horizontal** logos are exactly **1.25×** the Partners Feed/Story logos.
- **Logo rows**: logos share one baseline (Acurio word baseline = LA PERRERA bottom) with **64 px** gaps. Relative widths are always Acurio 1 : clickers 1.066 : La Perrera 1.238. The poster uses different proportions, see below.
- **Wordmark**: all social posts use the **SpaceXAI** wordmark (`spacexai-wordmark.svg`, IoU 0.975–0.989), 49.79 px tall (w 407.96).

## Components

**Link pill** (Horizontal, Horizontal Partners, Partners Horizontal): white, x **954–1840** (w 886), y **938–1000** (h 62), radius **31** (fully round). Its right and bottom edges sit on the margins.
- Text "https://luma.com/spacexai-euskadi": small 32, black. Ink starts x 979, so the layout x is ≈ 978 (≈ 24 px padding). Baseline 980 = pill top + 42.
- Arrow ↗: 18 × 18 px box at x 1801–1819, y 960–978 (vertically centred on the pill), 3 px stroke with butt caps. Three strokes: the top bar (y 961.5, x 1802→1819), the right bar (x 1817.5, y 960→977), and the diagonal from (1802, 976) to (1817, 961). Right inset 21 px.

**LINK INSTAGRAM pill** (stories; a placeholder for the Instagram link sticker): white, h 62, r 31, x **392–687** (w 295, centred on 540).
- Text "LINK INSTAGRAM": small 32, capitals, black, ink x 418–661 (≈ 26 px padding each side), baseline = pill top + 42.

## Horizontal (1920 × 1080) and @2x (3840 × 2160, all ×2)

| Element | Value |
| --- | --- |
| Grok Bot / Bilbao Meetup | display, white, x 80, baselines 128 / 198 |
| Lunes, 19 de octubre | display, grey, x 80, baseline 274 |
| Agenda times (x 964, red) | 118, 244, 424, 604, 838 |
| Agenda text (x 1156) | 118, 172 · 244, 298, 352 · 424, 478, 532 · 604, 658, 712, 766 · 838, 892 |
| SpaceXAI wordmark | x 81.02, y 950.12, w 407.96, h 49.79 (bottom 1000) |
| Link pill | see above |
| Bot | triangle `#EE3342`, x 477.20, y 649.53, rot −11.46, scale 0.6504, IoU 0.9946 |

Bot eyes, body-local (x, y, w, h, a): (−2.2, 62.7, 93.4, 238.3, −14.3) and (182.9, 29.8, 82.6, 239.9, −12.8). The same face is used in every triangle post.

## Horizontal Partners (1920 × 1080)
As Horizontal, except:
- Bot: triangle, x 389.05, y 590.40, rot −11.52, scale 0.5076 (IoU 0.9941).
- Partner row, baseline ≈ 880:

| Logo | x | y | w | h | IoU |
| --- | --- | --- | --- | --- | --- |
| acurio-ventures | 80.01 | 837.07 | 167.94 | 61.97 | 0.957 |
| clickers | 311.97 | 848.29 | 179.08 | 36.48 | 0.936 |
| la-perrera | 555.00 | 853.20 | 207.96 | 26.64 | 0.971 |

## Story (1080 × 1920) and @2x

| Element | Value |
| --- | --- |
| Grok Bot / Bilbao Meetup | display, white, x 80, baselines 308 / 378 |
| Lunes, 19 de octubre | display, grey, x 80, baseline 454 |
| Agenda times (x 80, red) | 707, 833, 1013, 1193, 1427 |
| Agenda text (x 272) | 707, 761 · 833, 887, 941 · 1013, 1067, 1121 · 1193, 1247, 1301, 1355 · 1427, 1481 |
| LINK INSTAGRAM pill | y 1552–1614, text baseline 1594 |
| SpaceXAI wordmark | x 336.02, y 1674.12, w 407.96, h 49.79 (centred on 540) |
| Bot | triangle, **flipped**, x 840.63, y 539.33, rot 10.06, scale 0.4790, IoU 0.9947 (overlaps the date line's right end) |

## Story Partners (1080 × 1920)
Story shifted up 60, plus a partner row:
- Header baselines 248 / 318 / 394.
- Times 647, 773, 953, 1133, 1367 (text lines likewise −60).
- Pill y 1487–1549 (text baseline 1529).
- Wordmark y 1592–1642.
- Bot: x 840.63, y 479.33 (otherwise identical).

Partner row (baseline ≈ 1760, centred: 166.7–913.7, 64 px gaps):

| Logo | x | y | w | h | IoU |
| --- | --- | --- | --- | --- | --- |
| acurio-ventures | 166.74 | 1711.90 | 187.92 | 69.35 | 0.961 |
| clickers | 418.74 | 1724.69 | 198.93 | 40.53 | 0.942 |
| la-perrera | 681.69 | 1730.11 | 232.03 | 29.73 | 0.977 |

## Partners Feed (1080 × 1350)

| Element | Value |
| --- | --- |
| Grok Bot / Bilbao Meetup / date | display, x 80, baselines 128 / 198 / 274 (date grey) |
| "Con el apoyo de" | body 40, grey, x 80, baseline 598 |
| acurio-ventures | x 80.06, y 635.92, w 360.79, h 133.14 (IoU 0.979) |
| clickers | x 79.98, y 829.97, w 382.99, h 78.03 (IoU 0.980) |
| "Nos acoge" | body 40, grey, x 80, baseline 1018 |
| la-perrera | x 79.99, y 1055.97, w 445.93, h 57.13 (IoU 0.989) |
| SpaceXAI wordmark | x 81.02, y 1210.12, w 407.96, h 49.79 (bottom 1260 = 1350 − 90) |
| Bot | drop `#457BBE`, x 873.22, y 560.50, rot −18.05, scale 0.9317, clipped by the right edge, IoU 0.9984 |

Stack rhythm: caption baseline → logo top +38; Acurio bottom → clickers top +61; clickers bottom → "Nos acoge" baseline +110; caption → La Perrera top +38.

## Partners Story (1080 × 1920)
The Partners Feed stack moved down 240, header down 180:
- Header 308 / 378 / 454.
- "Con el apoyo de" 838; Acurio x 80.06, y 875.92.
- clickers x 79.98, y 1069.97; "Nos acoge" 1258; La Perrera x 79.99, y 1295.97 (logo sizes as Feed).
- LINK INSTAGRAM pill y 1498–1560 (text baseline 1540).
- Wordmark x 336.03, y 1620.13.
- Bot: drop, x 849.88, y 632.68, rot −17.94, scale 0.9985, clipped right (IoU 0.9985).

## Partners Horizontal (1920 × 1080)

| Element | Value |
| --- | --- |
| Top-left block | as Horizontal (128 / 198 / 274) |
| Bot | drop `#457BBE`, x 448.70, y 632.95, rot −15.97, scale 0.998, IoU 0.9982 (the source of `drop.json`) |
| "Con el apoyo de" | body 40, grey, x 964, baseline 118 |
| acurio-ventures | x 963.95, y 163.22, w 450.91, h 166.39 (IoU 0.981) |
| clickers | x 964.00, y 405.66, w 478.92, h 97.57 (IoU 0.975) |
| "Nos acoge" | body 40, grey, x 964, baseline 613 |
| la-perrera | x 964.00, y 657.72, w 557.98, h 71.49 (IoU 0.988) |
| Link pill | as Horizontal |
| SpaceXAI wordmark | x 81.02, y 950.12, w 407.96, h 49.79 |

Drop eyes (all posts): frontal, body-local ±64.4, 62.9, 69–72 × 181, a ≈ 0.

## Poster 50 × 70 cm

Source: Adobe Illustrator 30.8 PDF.
- TrimBox 500 × 700 mm, BleedBox/MediaBox 3 mm bleed; the marks version adds a CropBox with a 7.8 mm slug.
- `/UserUnit 10`: 1 PDF unit = 10 pt = 3.5278 mm.
- Everything is vector with outlined text (`tools/pdf2svg.mjs` converts it losslessly).
- Coordinates below are **mm from the trim box top-left**.

**Rule: the poster is the screen system at 0.4 mm per px.** Display 64 px → 25.6 mm, agenda 40/54 px → 16.0/21.4 mm, row gap 18 px → 7.2 mm, small 32 px → 12.8 mm, pill 62 px → 24.8 mm, the 192 px column gap → 76.8 mm. Margins are **30 mm**.

Colours (CMYK, from the PDF):

| Use | CMYK | Screen equivalent |
| --- | --- | --- |
| Background (over the bleed: −3…503 × −3…703), QR modules, pill text | **C60 M40 Y40 K100** (rich black) | #000 |
| White text, logos, pill, QR card | C0 M0 Y0 K0 | #FFF |
| Grey text | C54.6 M46.1 Y45.7 K11.1 | #777 |
| Red (times, bot) | C0 M94.1 Y74.8 K0 | #EE3342 |

| Element | Value (mm) |
| --- | --- |
| "Grok Bot Meetup" | display 25.6, white, x 30, baseline 54.2 |
| "La Perrera, Bilbao" | white, baseline 84.6 (leading **30.4**) |
| "Lunes, 19 de octubre" | grey, baseline 115.0 |
| SpaceXAI wordmark | x 277.3, y 28.2, w 193.4, h 23.6 (right 470.7). The **SpaceXAI** version (IoU 0.982 vs 0.899 for the classic) |
| Bot | triangle, **flipped**, centroid x 383.55, y 176.92, rot 10.02, scale **0.19615 mm per canonical unit** (= 0.4904 in 0.4 mm/px units), IoU 0.9944 |
| Agenda times | red, 16.0 mm, x 30, on each row's first baseline |
| Agenda text | x 106.8 (= 30 + 76.8), 16.0 mm, leading 21.4, rows +28.6 |
| Agenda baselines | 183.0, 204.4 · 233.0, 254.4, 275.8 · 304.4, 325.8, 347.2 · 375.8, 397.2, 418.6, **437.6** · 466.2, 487.6. The wrapped line "con sus objetivos y herramientas" is only 19.0 below its first line, not 21.4 |
| acurio-ventures | x 30.00, y 546.93, w 56.84, h 20.98 |
| clickers | x 108.45, y 549.04, w 87.99, h 17.93 |
| la-perrera | x 218.04, y 551.65, w 99.07, h 12.69 (gaps 21.6 mm = 54 px; bottoms 567.9 / 567.0 / 564.3) |
| "Os esperamos allí" | display 25.6, white, x 30, baseline 629.2 |
| Link pill | white, x 30.0–246.8, y 645.2–670.0 (h 24.8, radius 12.4), **no arrow** |
| Pill text | "https://luma.com/spacexai-euskadi", rich black, 12.8 mm, ink from x 40.3 (≈ 10 mm padding), baseline 662.2 |
| QR card | white, x 338–470, y 538–670 (132 mm, corner radius 16). Modules 4 mm, 29 × 29, quiet zone 8 mm. `qrGroup(url, { x: 338, y: 538, size: 132 })` from `src/lib/qr.js` reproduces it exactly |

The poster's logo proportions differ from social: clickers is relatively larger. Use the per-layout boxes above rather than one scale.

## Logos and QR (for reference)

| File | Source | Check |
| --- | --- | --- |
| `assets/logos/spacexai-wordmark.svg` | official brand zip, geometry untouched, tight viewBox (aspect 8.193) | IoU 0.958 on screens (28 px tall), 0.989 on social @2x |
| `assets/logos/spacex-wordmark.svg` | Wikimedia "SpaceX logo black.svg", tight viewBox (aspect 8.179) | IoU 0.950 on the clean Gracias screen (only use) |
| `assets/logos/acurio-ventures.svg` | exact vectors from the poster PDF | IoU 0.979 on Partners Feed |
| `assets/logos/clickers.svg` | exact vectors from the poster PDF | IoU 0.980 on Partners Feed |
| `assets/logos/la-perrera.svg` | exact vectors from the poster PDF | IoU 0.989 on Partners Feed |
| `src/lib/qr.js` | EC level **M**, mask **0**, version 3 (the encoder's defaults for this URL) | module-exact; 0 pixels differ at 10 px/mm; decodes |
