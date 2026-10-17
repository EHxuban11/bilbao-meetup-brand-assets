// The 13 slide layouts of the speaker deck, as PptxGenJS slide masters.
// Geometry is in px on the 1920 × 1080 design canvas (1 in = 144 px, 1 pt = 2 px),
// measured from the designer's templates (reference/speaker-deck/*.pptx).

export const FONT = 'Universal Sans Display 400';
export const MONO = 'Courier New';
export const WHITE = 'FFFFFF', GREY = '777777', BLACK = '000000';

export const px = v => v / 144;                       // px -> inches
export const box = (x, y, w, h) => ({ x: px(x), y: px(y), w: px(w), h: px(h) });

// Text roles (pt): size / line spacing. On the 1920 canvas, px = 2 × pt.
export const ROLE = {
  numeral: { fontSize: 120, lineSpacing: 114 },
  hero:    { fontSize: 60,  lineSpacing: 63 },
  display: { fontSize: 32,  lineSpacing: 35 },
  body:    { fontSize: 20,  lineSpacing: 24 },
  small:   { fontSize: 16,  lineSpacing: 19 },
  code:    { fontSize: 16,  lineSpacing: 24 },
};

const text = (role, color, valign, extra = {}) => ({
  fontFace: FONT, ...ROLE[role], color, align: 'left', valign, margin: 0, ...extra,
});

// Placeholder helper: name, PowerPoint type, box, style, prompt text.
const ph = (name, type, [x, y, w, h], style, prompt) => ({
  placeholder: { options: { name, type, ...box(x, y, w, h), ...style }, text: prompt },
});

// Guides shown with View > Guides (px): margins, right column, image zone.
export const GUIDES = { vertical: [80, 964, 1840], horizontal: [90, 200, 880, 990] };

export const SLIDE_NUMBER = { margin: 0, ...box(1640, 952, 200, 38), fontFace: FONT, fontSize: 16, color: GREY, align: 'right' };

// Stats columns: 570 px wide on a 1784/3 px pitch (as in the reference).
export const statX = i => 80 + (i * 1784) / 3;
// Rows: number column at 964, text column at 1156, rows every 142 px.
export const ROW = { numX: 964, textX: 1156, y0: 90, step: 142, numW: 128, numH: 48, textW: 684, textH: 102 };

/**
 * Layout definitions. `key` is the id used in talk.json; `title` is the PowerPoint
 * layout name (shown under Home → New Slide). `assets` carries rendered images.
 */
export function layouts({ event, accent, assets }) {
  const TITLE = ph('title', 'title', [80, 90, 1760, 70], text('display', WHITE, 'top'), 'Título');
  return [
    {
      key: 'cover', title: '01 Portada', number: false,
      objects: [
        { image: { ...box(0, 0, 1920, 1080), data: assets.coverBot, altText: 'Grok Bot' } },
        { text: { text: event.name.join('\n'), options: { ...box(80, 90, 900, 140), ...text('display', WHITE, 'top') } } },
        ph('title', 'title', [80, 360, 1760, 552], text('hero', WHITE, 'bottom'), 'Título de la charla'),
        ph('speaker', 'body', [80, 952, 1300, 38], text('small', WHITE, 'bottom'), 'Nombre Apellido · Empresa'),
      ],
    },
    {
      key: 'section', title: '02 Sección',
      objects: [
        ph('number', 'body', [80, 90, 400, 70], text('display', GREY, 'top'), '01'),
        ph('title', 'title', [80, 400, 1760, 590], text('hero', WHITE, 'bottom'), 'Título de sección'),
      ],
    },
    {
      key: 'rows', title: '03 Título y filas',
      objects: [
        ph('title', 'title', [80, 90, 804, 300], text('display', WHITE, 'top'), 'Título, tres líneas como máximo'),
        ph('rows', 'body', [964, 90, 876, 800], text('body', WHITE, 'top'), 'Filas: copia las de la diapositiva de ejemplo'),
      ],
    },
    {
      key: 'statement', title: '04 Frase',
      objects: [ph('title', 'title', [80, 300, 1560, 690], text('hero', WHITE, 'bottom'), 'Una frase, tres líneas como máximo')],
    },
    {
      key: 'number', title: '05 Cifra',
      objects: [
        TITLE,
        ph('figure', 'body', [80, 560, 1560, 280], text('numeral', accent, 'bottom'), '12'),
        ph('label', 'body', [80, 864, 1560, 48], text('body', WHITE, 'bottom'), 'Qué significa la cifra'),
        ph('source', 'body', [80, 952, 1300, 38], text('small', GREY, 'bottom'), 'Fuente: de dónde sale'),
      ],
    },
    {
      key: 'stats', title: '06 Tres cifras',
      objects: [
        TITLE,
        ...[0, 1, 2].flatMap(i => [
          ph(`figure${i + 1}`, 'body', [statX(i), 700, 570, 218], text('hero', WHITE, 'bottom'), ['3', '45 min', '4 h'][i]),
          ph(`label${i + 1}`, 'body', [statX(i), 942, 570, 48], text('body', GREY, 'bottom'), 'Etiqueta'),
        ]),
      ],
    },
    {
      key: 'image', title: '07 Imagen con título',
      objects: [TITLE, ph('caption', 'body', [80, 952, 1300, 38], text('small', GREY, 'bottom'), 'Foto: autor')],
    },
    {
      key: 'image-solo', title: '08 Imagen sola',
      objects: [ph('caption', 'body', [80, 952, 1300, 38], text('small', GREY, 'bottom'), 'Foto: autor')],
    },
    {
      key: 'bleed', title: '09 Imagen a sangre', number: false,
      objects: [
        ph('image', 'image', [0, 0, 1920, 1080], { valign: 'top', margin: 0 }, ''),
        ph('caption', 'body', [80, 952, 1300, 38], text('small', WHITE, 'bottom'), 'Foto: autor'),
      ],
    },
    {
      key: 'pair', title: '10 Dos imágenes',
      objects: [
        TITLE,
        ...[80, 992].flatMap((x, i) => [
          ph(`image${i + 1}`, 'image', [x, 302, 848, 477], { valign: 'top', margin: 0 }, ''),
          ph(`label${i + 1}`, 'body', [x, 811, 848, 38], text('small', WHITE, 'top'), 'Pie'),
          ph(`note${i + 1}`, 'body', [x, 849, 848, 38], text('small', GREY, 'top'), 'Detalle en gris'),
        ]),
      ],
    },
    {
      key: 'quote', title: '11 Cita',
      objects: [
        ph('title', 'title', [80, 300, 1560, 612], text('hero', WHITE, 'bottom'), '“Cita corta”'),
        ph('author', 'body', [80, 952, 1300, 38], text('small', WHITE, 'bottom'), 'Nombre Apellido · Cargo, Empresa'),
      ],
    },
    {
      key: 'code', title: '12 Código',
      objects: [TITLE, ph('code', 'body', [80, 200, 1760, 720], text('code', WHITE, 'top', { fontFace: MONO }), 'código, 14 líneas como máximo')],
    },
    {
      key: 'closing', title: '13 Cierre', number: false,
      objects: [
        { image: { ...box(0, 0, 1920, 1080), data: assets.closingBot, altText: 'Grok Bot' } },
        ph('title', 'title', [80, 90, 1200, 252], text('hero', WHITE, 'top'), 'Gracias'),
        ph('name', 'body', [80, 828, 900, 38], text('small', WHITE, 'top'), 'Nombre Apellido'),
        ph('org', 'body', [80, 866, 900, 38], text('small', GREY, 'top'), 'Empresa'),
        { text: { text: '', options: { ...box(80, 928, 588, 62), shape: 'roundRect', rectRadius: px(31), fill: { color: WHITE }, valign: 'middle' } } },
        ph('link', 'body', [104, 928, 500, 62], text('small', BLACK, 'middle'), 'linkedin.com/in/tu-perfil'),
        { image: { ...box(620, 941, 36, 36), data: assets.arrow, altText: '' } },
      ],
    },
  ];
}

// Layout keys accepted in talk.json, with Spanish aliases.
export const LAYOUT_ALIASES = {
  cover: 'cover', portada: 'cover',
  section: 'section', seccion: 'section', 'sección': 'section',
  rows: 'rows', filas: 'rows', 'titulo-y-filas': 'rows',
  statement: 'statement', frase: 'statement',
  number: 'number', cifra: 'number',
  stats: 'stats', 'tres-cifras': 'stats',
  image: 'image', 'imagen-con-titulo': 'image',
  'image-solo': 'image-solo', 'imagen-sola': 'image-solo',
  bleed: 'bleed', 'imagen-a-sangre': 'bleed', sangre: 'bleed',
  pair: 'pair', 'dos-imagenes': 'pair',
  quote: 'quote', cita: 'quote',
  code: 'code', codigo: 'code', 'código': 'code',
  closing: 'closing', cierre: 'closing',
};
