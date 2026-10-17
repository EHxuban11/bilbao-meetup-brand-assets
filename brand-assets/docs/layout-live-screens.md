# Live screens: measured layout

Measured from `reference/live-screens/stills/` (1920 × 1080). Text with `tools/measure.mjs` (baseline = most common glyph bottom, so ±0.5 px: the designer's baselines are fractional, and the `-logo` renders land a half pixel off the clean ones). Bots with `tools/fit-bot.mjs` (silhouette registration against `assets/bots/<shape>.json`, IoU reported). Logos with `tools/logo-fit.mjs`.

Type sizes are inferred from cap height (Universal Sans Display cap height = 0.705 em, x-height ≈ 0.53 em) and match `config/theme.js`: display 64/70, hero 120/126, body 40/48, agenda 40/54, small 32/38. Colours: white `#FFFFFF`, grey `#777777`, red `#EE3342` (times only), SpaceX wordmark `#F0F0FA`.

Text x is the layout x (80, 964, 1156, 212); measured ink starts 1–8 px right of it (side bearing).

## Shared grid

| Element | Value |
| --- | --- |
| Top-left block (display 64/70) | baselines **148, 218, 288**, x 80 |
| Hero block (hero 120/126) | baselines **195, 321, 447**, x 80 |
| Bottom-left block | last baseline **980**; body 40/48 so the line above is **932** |
| Speaker block | stacked upward from 980, see below |
| Agenda times | x **964**, red, agenda 40/54 |
| Agenda text | x **1156**, first line white, detail lines grey |
| SpaceXAI wordmark (`-logo` versions) | box x **1610.6–1839.4**, y **90.0–118.0** (w 228.75, h 27.92): right edge on the 1840 margin, top on the 90 margin. IoU 0.958 |
| Logo versions | identical to clean except the wordmark box (checked by pixel diff). Exception: `01-preshow-logo` is a different loop frame (bot 70 px lower) |

## Screens (clean version; `-logo` adds the wordmark above)

### 01 Antes de empezar (pre-show)
| Line | Role | Colour | x | Baseline |
| --- | --- | --- | --- | --- |
| Grok Bot | display | white | 80 | 148 |
| Bilbao Meetup | display | white | 80 | 218 |
| Lunes, 19 de octubre | display | grey | 80 | 288 |
| Empezamos a las 18:00 | body | grey | 80 | 980 |

Bot: round `#7761AA`, x 1361.62, y 691.74, rot −5.99 (from eyes), scale 1.4311, clipped by the right and bottom edges, IoU 0.9985. Logo version: same but y 761.87.
Eyes, body-local (x, y, w, h, a): (47.5, 61, 85.5, 182.4, 0), (224.5, 61, 70.6, 181.7, 0): the look-right face.

### 02 Bienvenida
| Line | Role | Colour | x | Baseline |
| --- | --- | --- | --- | --- |
| Bienvenidos | hero | white | 80 | 195 |
| Ongi etorri | hero | grey | 80 | 321 |
| Grok Bot Bilbao Meetup | body | white | 80 | 932 |
| Lunes, 19 de octubre | body | grey | 80 | 980 |

Bot: triangle `#EE3342`, x 1442.73, y 703.01, rot 0.07, scale 0.9989, IoU 0.9993. This still is the source of `assets/bots/triangle.json`, so rot 0 / scale 1 is expected.

### 03 Agenda (and 22 Agenda with partners)
Top-left block: Grok Bot 148, Bilbao Meetup 218 (white), Lunes, 19 de octubre 288 (grey).

| Time (x 964, red) | Baselines (x 1156; first white, rest grey) |
| --- | --- |
| 17:30 | 128 Apertura de puertas · 182 Recepción y bienvenida |
| 18:00 | 254 Hugo Fernández · 308 Acurio Ventures · 362 Innovación, inversión y el futuro de la IA |
| 18:45 | 434 Leire Legarreta · 488 We Are Clickers · 542 Proyectos punteros de IA en Euskadi |
| 19:30 | 614 Xuban Ceccon · 668 Grok Bot · 722 Agentes de IA ya montados · 776 con sus objetivos y herramientas |
| 20:00 | 848 Networking, pizza y bebidas · 902 Hasta las 21:30 |

Rule: line pitch 54; next row starts 72 below the previous row's last line (54 + 18 gap). The time sits on the row's first baseline. First baseline 128 means the agenda block top is on the 90 margin.

Bot 03: triangle `#EE3342`, **flipped**, x 427.21, y 723.06, rot −0.02, scale 0.7263, IoU 0.9982. The same look-right face as 02 (mirrored).
Bot 22: triangle, **flipped**, x 354.19, y 646.58, rot −2.19, scale 0.5912, IoU 0.997. Eyes local (185.2, 16.2, 89, 208), (−24.3, 35.3, 98.4, 211.4), a −5.2.
Partner row (22 only), common baseline ≈ **963** (Acurio word baseline, LA PERRERA bottom); 64 px gaps:

| Logo | x | y | w | h |
| --- | --- | --- | --- | --- |
| acurio-ventures.svg | 80.0 | 920.1 | 167.94 | 61.97 |
| clickers.svg | 312.1 | 931.7 | 178.90 | 36.45 |
| la-perrera.svg | 555.0 | 937.0 | 207.87 | 26.63 |

### 04 / 06 / 08 Speaker (Hugo, Leire, Xuban)
Top-left block: Grok Bot 148, Bilbao Meetup 218. Bottom block stacked upward from the last talk line:

| Line | Role | Colour | Baseline (1-line talk) | Baseline (2-line talk: Xuban) |
| --- | --- | --- | --- | --- |
| time (e.g. 18:00) | display 64 | red | 619 | 571 |
| name | hero | white | 755 | 707 |
| company | hero | grey | 881 | 833 |
| talk line 1 | body | white | 980 | 932 |
| talk line 2 | body | white | | 980 |

Rule: talk lines are body 40/48 ending at 980; company = first talk baseline − 99; name = company − 126; time = name − 136.

Bots, the **look-right pose** (= speaker loop frame 36, see `docs/motion-spec.md`):

| Screen | Shape | Colour | x | y | rot | scale | IoU |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 04 Hugo | square | #42B870 | 1425.10 | 596.52 | −5.67 | 0.9948 | 0.9991 |
| 06 Leire | cloud | #ED3A95 | 1412.17 | 676.99 | −5.22 | 0.9944 | 0.9989 |
| 08 Xuban | round | #FFFFFF | 1415.25 | 596.60 | −5.17 (eyes) | 0.9949 | 0.9985 |

Eyes, body-local (x, y, w, h, a): Hugo (20, 2.9, 98.5, 222.2, 0.5), (197.9, 4.4, 82.7, 220.1, 0.5). Leire (31.6, 2.1, 92.5, 206.2, 0.1), (197.7, 2.2, 78, 205.2, 0.1). Xuban (21.8, 2.6, 100.2, 224.1, 0), (202.1, 2.6, 84.4, 222.1, 0).
Neutral pose (loop frame 90) for all three: bbox bottom-right on (1840, 990), i.e. `theme.grid.botBox`.

### 05 / 07 / 09 Q&A
| Line | Role | Colour | Baseline |
| --- | --- | --- | --- |
| Grok Bot / Bilbao Meetup | display | white | 148 / 218 |
| speaker's time | display | red | 619 |
| Preguntas | hero | white | 755 |
| y respuestas | hero | grey | 881 |
| "Name · Company" | body | name white, " · Company" grey | 980 |

The split in the footer line: Hugo's name ink ends x 363 and the grey middle dot starts at 378.
Bots, the **look-left pose** (= speaker loop frame 276; same body, not mirrored):

| Screen | Shape | x | y | rot | scale | IoU |
| --- | --- | --- | --- | --- | --- | --- |
| 05 Hugo | square | 1494.68 | 596.57 | 4.72 | 0.9950 | 0.9991 |
| 07 Leire | cloud | 1467.48 | 676.84 | 5.19 | 0.9942 | 0.9987 |
| 09 Xuban | round | 1484.98 | 596.69 | 5.18 (eyes) | 0.9950 | 0.9987 |

Eyes are the speaker eyes mirrored about the body (e.g. Hugo (−198, 1.1, 83.4, 220.1), (−20.1, 2.5, 98.5, 222.1)).

### 10 Networking
| Line | Role | Colour | Baseline |
| --- | --- | --- | --- |
| Networking | hero | white | 195 |
| Pizza y bebidas | hero | white | 321 |
| Hasta las 21:30 | hero | grey | 447 |

Six vivid bots (fits are slightly lower where they overlap):

| Shape | Colour | x | y | rot | scale | IoU | Eyes (local) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| drop | #FFCC00 | 1293.25 | 277.67 | 0.42 | 0.5963 | 0.9959 | frontal ±64.4, 62.7, 69.4×179.4 |
| round | #FF6700 | 1093.20 | 522.42 | −9.75 (eyes) | 0.4075 | 0.9863 | (50.5, 41.3, 97.3×193.9), (226, 41.2, 81.5×189) |
| cloud | #FF309B | 1464.97 | 536.26 | −7.05 | 0.4423 | 0.9752 | (52.2, 57.1, 89.7×176.3), (215.5, 56.5, 75.8×176.3) |
| round | #1084FE | 972.66 | 823.02 | 6.03 (eyes) | 0.4083 | 0.9969 | look-left (−201.9, 2.2), (−21.7, 2.3) |
| square | #00C972 | 1297.13 | 802.80 | −0.93 | 0.4651 | 0.9865 | neutral (∓92.5, 81.6, 100×258) |
| triangle | #EE3342 | 1659.12 | 848.01 | 3.54 | 0.3991 | 0.9941 | frontal (−97.3, 100, 114.4×293.2), (113.6, 81.4, 114.5×295.7), a −5.1 |

Z-order (front to back, from the overlaps): the green square is over the blue round. The yellow drop's lower edge meets the pink cloud.

### 11 Gracias
| Line | Role | Colour | Baseline |
| --- | --- | --- | --- |
| Gracias | hero | white | 195 |
| Eskerrik asko | hero | grey | 321 |
| Grok Bot Bilbao Meetup | body | white | 932 |
| Lunes, 19 de octubre | body | grey | 980 |

Clean version: **classic SpaceX wordmark** (`spacex-wordmark.svg`, colour `#F0F0FA`) x 1654.15, y 100.62, w 185.64, h 22.70 (right edge 1839.8), IoU 0.950. Logo version: the SpaceXAI wordmark in the standard box instead.
Bot: round `#F8981D`, x 1262.53, y 695.42, rot −5.17 (eyes), scale 1.3522, clipped, IoU 0.999. Eyes local (22, 2.6, 100.2, **167.9**), (202.2, 2.6, 84.3, 167.9): look-right with the eyes squashed (shorter than the 222 of the speaker pose).

### 12 Volvemos enseguida
| Line | Role | Colour | Baseline |
| --- | --- | --- | --- |
| Volvemos | hero | white | 195 |
| enseguida | hero | white | 321 |
| Grok Bot Bilbao Meetup | body | white | 980 |

Bot: cloud `#457BBE`, x 1475.02, y 684.69, rot 6.03, scale 0.9882, IoU 0.9974. Eyes local (−220.9, 49.7, 65.3×167), (−58, 49.6, 78.7×169): looking left and down.

### 13–15 Lower thirds (alpha, 1920 × 1080)
Opaque black (`#000000`, alpha 255) rounded rectangle, **radius 36**, x **80**, bottom **990** (on the margin).

| | Height | Width | Name baseline | Detail baselines |
| --- | --- | --- | --- | --- |
| 13 Hugo | 128 (y 862–990) | 964 | 921 | 961 |
| 14 Leire | 128 | 924 | 921 | 961 |
| 15 Xuban | 164 (y 826–990) | 703 | 884 | 924, 962 |

- Name: body 40, white, x 212. Detail: small 32, grey, x 212, "Company · Talk" (Xuban wraps as "Grok Bot · Agentes de IA ya montados" / "con sus objetivos y herramientas").
- Pitch: name → first detail 40, detail → detail 38 (small line). Name baseline = pill top + 59 (58 for Xuban). Last detail baseline = pill bottom − 29.
- Width = text right edge + 45 (right padding).
- Icon bot: ≈ 86 px wide (ink x 101–187), centred at x ≈ 144 (= 80 + 64) and vertically centred on the pill; frontal face with ≈ 9 × 20 px eyes.
  - Hugo: triangle `#EE3342`, flipped, x 144.16, y 933.5, rot −4.78, scale 0.0993 (IoU 0.987). The icon is not Hugo's square bot.
  - Leire: cloud `#ED3A95`, x 144.04, y 926.35, rot 0.14, scale 0.1101 (IoU 0.987).
  - Xuban: round `#FFFFFF`, x 144.23, y 907.28, rot 0.31, scale 0.113 (IoU 0.989).

### 16–20 Stingers (alpha, one frame of the transition)
Single huge bots, heavily clipped; fits are approximate where little of the outline is visible.

| Still | Shape | Colour | x | y | rot | scale | IoU |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16 stinger-1 | round | #FF6700 | 946.3 | 377.4 | 0 (no eyes) | 3.368 | 0.959 |
| 17 stinger-2 | cloud | #1084FE | −338.1 | 898.2 | 167.32 | 4.036 | 0.9999 |
| 18 stinger-3 | drop | #FF9800 | 803.9 | −552.5 | −102.2 | 6.311 | 0.932 |
| 19 stinger-4 | triangle | #FF309B | 960.38 | 368.34 | 5.19 | 1.9043 | 0.998 |
| 20 stinger-5 | square | #00BCA6 | 2550.6 | 462.1 | −103.7 | 2.942 | 0.998 |

Stinger-4 shows the triangle's **frontal face**: eyes local (−97.5, 99.6, 114.9×296.2), (113.9, 80.4, 115×296.2), a −5.2.

### 21 Logo bug (alpha)
Only the SpaceXAI wordmark, white, in the standard box (x 1610.6, y 90.0, w 228.75, h 27.92).

## Notes for the scene author
- The canonical `triangle.json` is the welcome pose: its "rot 0" is tilted −5.2° from upright, and its `face` is the look-right face. The triangle's **neutral/frontal face** in canonical units is ≈ (−97.4, 99.8) and (113.8, 80.9), 114.7 × 295, a −5.2 (networking and stinger-4 agree).
- `drop.json` (canonical upright, rot 0 = eyes vertical) has the frontal face ±64.3, 62.9, 69 × 181; the networking drop matches it.
- Re-run `tools/fit-bot.mjs` if a canonical shape file changes; every pose above is relative to the current files.
