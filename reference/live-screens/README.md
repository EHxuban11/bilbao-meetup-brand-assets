# Grok Bot Bilbao Meetup · Live screens

Screens, loops and stream overlays for the night. Everything is 1920 × 1080 at 30 fps. Folders are numbered in run-of-show order.

| Folder | What's in it |
| --- | --- |
| `stills/` | a PNG of every screen, lower third, stinger and the logo bug |
| `video/` | every screen as in → loop → out clips |
| `preview/` | a ~51 s reel of every screen, 1080p and 720p (for sharing) |

## In → loop → out

Every screen is three clips that join frame-perfectly, plus a preview:

```
video/04-speaker-hugo/
  speaker-hugo_1-in.mp4     entrance; its last frame flows into the loop's first
  speaker-hugo_2-loop.mp4   seamless; repeat it for as long as you need
  speaker-hugo_3-out.mp4    exit; starts from the loop's first frame, ends on black
  speaker-hugo_full.mp4     in + one loop + out, for previewing
```

In Resolume, QLab, vMix or OBS, play `_1-in`, then `_2-loop` on repeat, then `_3-out` when you move on.

| # | Screen |
| --- | --- |
| 01 | Antes de empezar (pre-show) |
| 02 | Bienvenida |
| 03 | Agenda |
| 04 · 05 | Hugo Fernández: speaker, then Q&A |
| 06 · 07 | Leire Legarreta: speaker, then Q&A |
| 08 · 09 | Xuban Ceccon: speaker, then Q&A |
| 10 | Networking |
| 11 | Gracias |
| 12 | Volvemos enseguida (be right back) |
| 13–15 | Lower thirds, one per speaker |
| 16–20 | Stinger transitions |
| 21 | SpaceXAI logo bug |
| 22 | Agenda with partners: the agenda plus the Acurio Ventures, We Are Clickers and La Perrera logos. Use it instead of 03 whenever you want the partners on screen |

Full screens are H.264 `.mp4`.

## SpaceXAI logo versions

Every full screen also comes in a `-logo` version, with the official SpaceXAI wordmark (white, unaltered) in the top-right corner. Pick clean or logo per screen:

```
video/04-speaker-hugo/         clean
video/04-speaker-hugo-logo/    with the SpaceXAI logo
stills/04-speaker-hugo-logo.png
```

- The logo holds still through the in and the loop, so it stays perfectly steady across screens. It fades only in the last frames of the out, so every out still ends on black.
- The logo version of Gracias shows SpaceXAI instead of the SpaceX wordmark.
- `video/21-logo-bug/` is the logo alone with alpha, to key over anything in OBS or vMix.
- The preview reel also has a logo version: `preview/grokbot-bilbao-preview-logo.mp4`.

## Livestream (OBS / vMix)

- **Full screens:** the `.mp4` clips above.
- **Lower thirds** (also good for the after-movie): `lower-<name>_1-in / _2-loop / _3-out`, as ProRes 4444 `.mov` or VP9 `.webm`, both with alpha.
- **Stinger transitions** (optional): five, all with the transition point at **800 ms**, as `.mov` or `.webm` with alpha.

  | File | Bot | Move |
  | --- | --- | --- |
  | `stinger-1` | orange round | rises from the bottom |
  | `stinger-2` | blue cloud | sweeps left to right |
  | `stinger-3` | amber drop | drops from the top |
  | `stinger-4` | pink triangle | grows from the centre and shrinks away |
  | `stinger-5` | teal square | rolls in from the right |

## Design

Black canvas, Universal Sans Display 400, white and #777 text, red #EE3342 for times only. Margins are 90 px top and bottom and 80 px at the sides. Each speaker has their own bot, and their slides (see `04 Speaker Kit Deck`) use the same bot and accent so the screens and the talks read as one show.
