// Everything that is *content* lives here. Change a name, a time, a colour or a logo
// in this file and re-run `npm run build` (or a single target, see README).
//
// Text is written with explicit line breaks (arrays) so every screen breaks lines
// exactly where you want. Keep accents: Fernández, inversión.

export default {
  name: ['Grok Bot', 'Bilbao Meetup'],          // two-line event name used on most screens
  nameOneLine: 'Grok Bot Bilbao Meetup',
  date: 'Lunes, 19 de octubre',
  venue: 'La Perrera, Bilbao',
  link: 'luma.com/spacexai-euskadi',            // shown as text (no https://)
  url: 'https://luma.com/spacexai-euskadi',     // encoded in the QR code

  // Run of show. `lines` are the grey detail lines under the title.
  agenda: [
    { time: '17:30', title: 'Apertura de puertas', lines: ['Recepción y bienvenida'] },
    { time: '18:00', speaker: 'hugo' },
    { time: '18:45', speaker: 'leire' },
    { time: '19:30', speaker: 'xuban' },
    { time: '20:00', title: 'Networking, pizza y bebidas', lines: ['Hasta las 21:30'] },
  ],

  // Each speaker has their own bot (shape + colour). The same bot is used on their
  // speaker screen, Q&A screen and in their slide deck.
  speakers: {
    hugo: {
      name: 'Hugo Fernández', company: 'Acurio Ventures',
      talk: ['Innovación, inversión y el futuro de la IA'],
      time: '18:00',
      bot: { shape: 'square', color: '#42B870' },
      lowerThirdBot: { shape: 'triangle', color: '#EE3342' },
    },
    leire: {
      name: 'Leire Legarreta', company: 'We Are Clickers',
      talk: ['Proyectos punteros de IA en Euskadi'],
      time: '18:45',
      bot: { shape: 'cloud', color: '#ED3A95' },
      lowerThirdBot: { shape: 'cloud', color: '#ED3A95' },
    },
    xuban: {
      name: 'Xuban Ceccon', company: 'Grok Bot',
      talk: ['Agentes de IA ya montados', 'con sus objetivos y herramientas'],
      time: '19:30',
      bot: { shape: 'round', color: '#FFFFFF' },
      lowerThirdBot: { shape: 'round', color: '#FFFFFF' },
    },
  },

  // Fixed screens of the night (copy + bot). Screens are numbered in run-of-show order.
  screens: {
    preshow:    { bot: { shape: 'round', color: '#7761AA' }, note: 'Empezamos a las 18:00' },
    welcome:    { title: ['Bienvenidos'], subtitle: ['Ongi etorri'], bot: { shape: 'triangle', color: '#EE3342' } },
    agenda:     { bot: { shape: 'triangle', color: '#EE3342' } },
    qa:         { title: ['Preguntas'], subtitle: ['y respuestas'] },
    networking: { title: ['Networking', 'Pizza y bebidas'], subtitle: ['Hasta las 21:30'] },
    thanks:     { title: ['Gracias'], subtitle: ['Eskerrik asko'], bot: { shape: 'round', color: '#F8981D' } },
    brb:        { title: ['Volvemos', 'enseguida'], bot: { shape: 'cloud', color: '#457BBE' } },
  },

  // Networking cluster and stingers use the vivid palette.
  networkingBots: [
    { shape: 'drop', color: '#FFCC00' },
    { shape: 'round', color: '#FF6700' },
    { shape: 'cloud', color: '#FF309B' },
    { shape: 'round', color: '#1084FE' },
    { shape: 'square', color: '#00C972' },
    { shape: 'triangle', color: '#EE3342' },
  ],
  stingers: [
    { shape: 'round', color: '#FF6700', move: 'rise' },      // rises from the bottom
    { shape: 'cloud', color: '#1084FE', move: 'sweep' },     // sweeps left to right
    { shape: 'drop', color: '#FF9800', move: 'drop' },       // drops from the top
    { shape: 'triangle', color: '#FF309B', move: 'pulse' },  // grows from the centre and shrinks away
    { shape: 'square', color: '#00BCA6', move: 'roll' },     // rolls in from the right
  ],

  // Partner logos (white, transparent SVGs in assets/logos/).
  partners: [
    { name: 'Acurio Ventures', logo: 'acurio-ventures.svg', role: 'support' },
    { name: 'We Are Clickers', logo: 'clickers.svg', role: 'support' },
    { name: 'La Perrera', logo: 'la-perrera.svg', role: 'venue' },
  ],
  partnerCopy: { support: 'Con el apoyo de', venue: 'Nos acoge' },

  // Brand marks. `logo` versions of the live screens carry `brandLogo` top-right.
  brandLogo: 'spacexai-wordmark.svg',   // official SpaceXAI wordmark (white)
  hostLogo: 'spacex-wordmark.svg',      // classic SpaceX wordmark (used on social, print, clean "Gracias")
};
