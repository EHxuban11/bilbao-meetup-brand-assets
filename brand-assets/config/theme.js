// Design system: measured from the designer's files (see reference/ and docs/).
// Change these only to change the *system*; content lives in config/event.js.

export default {
  canvas: { w: 1920, h: 1080, fps: 30 },
  margin: { top: 90, bottom: 90, side: 80 },   // safe area 1760 × 900

  font: {
    family: 'Universal Sans Display',          // licensed file goes in fonts/ (see fonts/README.md)
    fallback: 'Inter Display',                 // free stand-in used when the licensed font is missing
    mono: 'Courier New',
    standInTracking: { hero: -1.1 },          // px, only applied while the stand-in renders
  },

  // Type roles: size and line height in px (1920 × 1080 canvas). One weight only (400).
  type: {
    numeral: { size: 240, line: 228 },
    hero:    { size: 120, line: 126 },
    display: { size: 64,  line: 70 },
    body:    { size: 40,  line: 48 },
    agenda:  { size: 40,  line: 54 },          // agenda rows on screens and social
    small:   { size: 32,  line: 38 },
  },

  color: {
    black: '#000000',
    white: '#FFFFFF',
    grey: '#777777',
    red: '#EE3342',          // times only
    spacex: '#F0F0FA',       // SpaceX wordmark off-white
    eye: '#000000',
  },

  // Live-screen grid (baselines in px). Measured, not guessed.
  grid: {
    headerBaseline: 148,     // first line of the top-left block (display 64/70)
    heroBaseline: 195,       // first line of a hero title (hero 120/126)
    footBaseline: 980,       // last line of the bottom-left block
    rightColumn: 964,        // agenda times
    agendaText: 1156,        // agenda titles and details
    botBox: [1040, 210, 1840, 990], // neutral bot fits this box, bottom-right aligned
  },
};
