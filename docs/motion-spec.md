# Motion spec

Every animated deliverable, measured frame by frame on the designer's videos (`reference/live-screens/video/`, 1080p clips plus the 720p preview reel for screens whose clips were not delivered). All data is in `assets/motion/`. Everything runs at 30 fps.

## How to read a motion file

**Bot pose at a frame.** A frame is `null` (bot not drawn) or `{ "b": [dx, dy, rot, s], "e": [[x, y, w, h, a], [x, y, w, h, a]] }`, applied to the entry's `anchor: {cx, cy, rot, scale}`:

- body centre (the centroid of `assets/bots/<shape>.json`, which the path is centred on) = `(cx + dx·scale, cy + dy·scale)`
- body rotation = `anchor.rot + rot` degrees, clockwise, about the body centre
- body scale = `anchor.scale · s`, relative to the canonical shape file
- eyes: two fully rounded rects (pills), `w` wide, `h` tall, centred at `(x, y)` in the body's own frame. That frame is relative to the body centre, unrotated and in canonical px, so an eye rotates and scales with the body. `a` is the eye's extra rotation relative to the body (≈ 0). Eyes are listed left to right and filled `#000`.
- A blink is just `h` collapsing: the eye closes into a horizontal dash of about 25 canonical px, then reopens.

**Clips.** `clips.in` → `clips.loop` (repeat) → `clips.out`. The last `in` frame is the pose just before loop frame 0, and `out` frame 0 equals loop frame 0, so the joins are frame-perfect (verified: under 0.05 px). `stills.<name> = {clip, frame}` is the frame the published PNG shows.

**Text and logo.** Each screen file has a `text` object:

- `text.in` / `text.out`: `{dur, ease, travel: "line", starts: {<line key>: seconds}}`. Each line is clipped to its own line box and moves one line height: `in` goes from +L to 0 and `out` from 0 to −L (L = the line height of its role: 70 display, 126 hero, 48 body, 54 agenda).
- `text.logoFade`: the opacity fade of the brand logo in the `-logo` versions during the out clip. The logo is static through in and loop.

Line keys follow `docs/layout-live-screens.md`: `header0..2`, `hero0..2`, `foot0..1`, `time`, `name`, `company`, `talk0..1`, agenda `row{i}` (title), `row{i}.time`, `row{i}.detail{j}`, `partners` (22 only), and `wordmark` (clean Gracias).

Measured easings: every line comes **in** with `expoOut` over 1.0 s, and goes **out** with `cubicInOut` over 0.483 s. Values marked "assumed" in the file have no reference clip.

## Deliverables

| Screen | File | in / loop / out (frames) | Still | Bot |
| --- | --- | --- | --- | --- |
| 01 Pre-show | `preshow.json` `shapes.round` | 72 / 600 / 42 | loop 36 | purple round at 1.4375, cut by right and bottom edges |
| 02 Bienvenida | `welcome.json` `shapes.triangle` | 90 / 480 / 42 | loop 36 | red triangle |
| 03 / 22 Agenda | `agenda.json` `shapes.triangle` | 90 / 480 / 42 | loop 36 | triangle on the left at 0.73, mirrored program |
| 04 / 06 / 08 Speaker | `speaker.json` `shapes.<speaker bot shape>` | 90 / 480 / 42 | loop 36 (looks right) | the speaker's bot |
| 05 / 07 / 09 Q&A | `qa.json` `shapes.<shape>` | 90 / 480 / 42 | loop 36 (looks left) | same bot and anchor as the speaker screen |
| 10 Networking | `networking.json` `bots[6]` | 90 / 480 / 42 | loop 36 | six bots, see below |
| 11 Gracias | `thanks.json` `shapes.round` | 90 / 480 / 42 | loop 36 | orange round at 1.36, cut by the bottom edge |
| 12 Volvemos | `brb.json` `shapes.cloud` | 90 / 480 / 42 | **loop 18** | blue cloud, mirrored program |
| 13–15 Lower thirds | `lower-third.json` `shapes.cloud` + `timing` + `text` | 48 / 480 / 36 | loop 0 | icon bot in the pill cap |
| 16–20 Stingers | `stingers.json` | 48 each, cut at frame 24 (800 ms) | per stinger `still` | full-screen bot |
| 21 Logo bug | `logo-bug.json` | 24 / 300 / 18 | loop | SpaceXAI wordmark only |

### The speaker program (speaker, Q&A, welcome, agenda, Gracias, Volvemos, networking)

It's one choreography for every bot, captured on Hugo (square), Leire (cloud) and Xuban (round).

- **Loop (16 s):**
  - frames 0–60: look right (frame 36 is the speaker still), then a centred neutral hold to frame ~150;
  - frames 150–240: look around;
  - frames 240–480: the same thing mirrored (frame 276 = look left; a blink around frame 354).
- **Body:** rocks about the bottom centre of its bounding box, up to about ±9°. Eyes move within the face, and shrink and narrow on the far side when looking sideways.
- **In (3 s):** in frame i = loop frame 390 + i plus a vertical rise from below the screen. The rise is a damped spring (ζ ≈ 0.86, ω ≈ 5.5 rad/s) that arrives around frame 24 with a ~10 px overshoot.
- **Out (1.4 s):** blink (frames 1–5), recentre, a small lift (frames 5–10), then a back-in sink off the bottom by frame 36.
- **Q&A, agenda and Volvemos** run it mirrored: loop shifted by 240 frames, and the in and out mirrored.
- **Other shapes and sizes** are retargeted by `tools/motion-retarget.mjs`: rotation is shared, the pivot is the bottom of the bounding box, look offsets scale with body width and height, and the rise and sink scale with the distance from the bot's top to the bottom of the screen. Checked square → cloud and square → round: body 0.1–0.4 px and eyes 0.2–0.7 px RMS over the loop. In `speaker.json` / `qa.json`, `triangle` and `drop` are retargeted and anchored by the layout rule (neutral bounding box inside [1040, 210, 1840, 990], bottom-right).
- **Screens from the reel** (welcome, agenda, brb, thanks) use the rise measured on the reel. The Gracias out sink is also measured.

### Networking

`bots` are in `config/event.js` order: drop `#FFCC00`, round `#FF6700`, cloud `#FF309B`, round `#1084FE`, square `#00C972`, triangle `#EE3342`. Each has `{shape, color, anchor, clips, phase, pop, popIndex}`.

- Every bot runs the speaker program of its shape at its own `phase`: networking frame t = program loop frame (phase + t) mod 480.
- **Entrance:** a scale pop, `backOut` with overshoot 1.2 over 26.5 frames (peak 1.055 at about frame 16 of the pop). Bot `popIndex` k starts at 9.1 + 3k frames, bottom row first, 0.1 s apart. There is no rise.
- **Checks:** loop frame 36 matches the still within 0.15–0.8 px for every bot. The phases agree with the 1080p intro clip (five of six) and the reel.
- **Assumed (no reference):** the out is a shrink with `backIn` 1.2 over 18 frames in reverse pop order, and the loop is 480 frames long.

### Stingers (`stingers.json`)

Structure: `{anchor: {cx: 960, cy: 540, rot: 0, scale: 1}, transitionFrame: 24, frames: 48, stingers: [{id, shape, color, move, source, still, clip: [48 frames]}]}`.

Frames use the normal format with this anchor: `b.xy` is the body centre offset from the screen centre in px, `b.rot` and `b.s` are absolute versus the canonical shape, and eyes are canonical body-local.

The bot covers the whole screen from about frame 6 to 34 and blinks on frames 22–26, hiding the cut at frame 24. The face path is:

1. entry ease-out, frames 1–16;
2. slow drift through the centre at about 6 px per frame, frames 16–28;
3. exit ease-in, frames 28–41.

| id | Bot | Move | Source and accuracy |
| --- | --- | --- | --- |
| stinger-1 | round `#FF6700` | rises from the bottom, exits at the top | `stinger-1.webm`, exact (eyes 0.05 px) |
| stinger-2 | cloud `#1084FE` | left → right | reel, face path within ~5 px on frames 6–32 |
| stinger-3 | drop `#FF9800` | from the top, exits at the bottom | reel, within ~10 px (frame 4: 67 px) |
| stinger-4 | triangle `#FF309B` | grows from the centre, shrinks away | `stinger-4.webm`, exact (0.14 px) |
| stinger-5 | square `#00BCA6` | right → left, rolling | reel, x within ~5 px; roll angle at entry and exit approximate |

Stills: stinger-1 frame 4, stinger-2 frame 3, stinger-3 frame 3, stinger-4 frame 36, stinger-5 frame 4.

### Lower third (`lower-third.json`)

- **Pill:** x 80, y 862–990, fully rounded, black.
  - In: width 0 → text width + padding (Leire: 924 px), `expoOut`, starting at frame 4.55, over 26.5 frames.
  - Out: `quartInOut` from frame 12.5, over 23 frames.
- **Icon:** the speaker's `lowerThirdBot` at 0.1102 of canonical size, centred in the pill cap (body centre 143.94, 926.72).
  - Scale: in `backOut` 1.1 from frame 3.1 over 20 frames; out `backIn` 1.5 over 32.5 frames (swells about 10% first).
  - Its eyes look around and blink during the loop.
- **Text:** name 40 px white, detail 32 px grey, x 213.
  - In: `expoOut` from 0.433 / 0.492 s.
  - Out: `cubicInOut` from 0 / 0.058 s.
  - Numbers are in `timing` and `text`.

### Logo bug (`logo-bug.json`)

Opacity only; there is no scale or position change. The wordmark box is x 1611–1835, y 90–117.

- In: linear 0 → 1 from 0.1 s over 0.6 s.
- Out: linear 1 → 0 from 0 over 0.5 s, inside a 0.6 s out clip.
- The in/loop split (24/300) is inferred from `logo-bug_full.webm`.

## Assumptions and gaps

- **Out clips never seen:** welcome, agenda, brb, networking, Q&A. Their text out timings copy the measured speaker and Gracias patterns, and the bot out uses the program's out.
- **Not in any reference:** agenda-with-partners (22) partner row timing, and the preshow-logo out.
- **Networking:** the loop length and out.
- **Triangle and drop on speaker/Q&A screens:** retargeted, never seen in the reference.
- **Stingers 2, 3 and 5:** fitted on the 720p reel, so there is more error at the fast entry and exit frames.

## Rebuilding

`node tools/motion-build-all.mjs` regenerates every file from the raw captures in `tools/scratch/motion/` (not committed).

- **Capture:** `tools/mocap.mjs <video> <hex> <anchor.png | -> <out.raw.json> [--shape assets/bots/<s>.json --shape-scale k] [--fit-scale] [--register-all] [--ss/--to] [--x0 --x1 --y0 --y1]`.
- **Text fits:** `tools/motion-text-fit.mjs`.
- **Checks against a capture:** `tools/motion-validate.mjs`.
- **Retargeting check:** `tools/motion-retarget.mjs`.
