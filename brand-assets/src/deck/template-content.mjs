// The template deck's 13 example slides (one per layout), in talk.json form, with the
// designer's example copy and speaker notes (the notes repeat each layout's rules).
const HERE = new URL('./examples/', import.meta.url).pathname;

export const TEMPLATE_NOTES = {
  portada: 'Portada. El título de tu charla en dos líneas como máximo; tu nombre en blanco y la empresa en gris. El bot y su color ya vienen puestos: no los muevas.',
  seccion: 'Sección. Úsala solo si la charla tiene tres partes o más. Número en gris, título en una línea.',
  filas: 'Título y filas. Título a la izquierda; a la derecha, hasta cuatro filas numeradas. Cada fila: una línea en blanco (la idea) y como mucho una en gris (el detalle). Nada de viñetas. Para añadir una fila, copia la última y bájala 142 px (1 in = 144 px).',
  frase: 'Frase. Tu idea principal, en tres líneas como máximo. Sin nada más en la diapositiva.',
  cifra: 'Cifra. Un solo número, en el color de tu bot: es el único sitio donde se usa. Siempre con su unidad y su fuente.',
  'tres-cifras': 'Tres cifras. Como máximo tres, en blanco; la unidad en gris. Etiquetas cortas.',
  imagen: 'Imagen con título. La imagen va centrada entre las guías rojas (Ver > Guías): 680 px (4,7 in) de alto como máximo. Escálala desde una esquina con Mayús para no deformarla y luego Organizar > Alinear > Centrar y Alinear al medio. Sin bordes, sombras ni esquinas redondeadas.',
  'imagen-sola': 'Imagen sola. Para capturas y fotos verticales: lo más grande posible, 760 px (5,3 in) de alto como máximo, y Organizar > Alinear > Centrar y Alinear al medio. Recorta la captura antes de insertarla, no en la diapositiva.',
  'imagen-a-sangre': 'Imagen a sangre. Solo fotos horizontales, oscuras y de calidad (1920 × 1080 o más). Llena toda la diapositiva. Solo el pie encima, en blanco, sobre una zona oscura.',
  'dos-imagenes': 'Dos imágenes. Para comparar: las dos del mismo formato (16:9) y el mismo tamaño. Pie en blanco, detalle en gris.',
  cita: 'Cita. Doce palabras como máximo, con comillas “ ”. Autor en blanco, cargo en gris.',
  codigo: 'Código. Solo el fragmento que explicas, 14 líneas como máximo. Fuente monoespaciada, comentarios en gris. Nada de capturas del editor.',
  cierre: 'Cierre. Tu nombre, tu empresa y un solo enlace, sin https://. El bot ya viene puesto.',
};

/** speaker: { name, org, talk: [lines] } or null for the generic template. */
export function templateTalk(speaker) {
  const talkLines = speaker?.talk;
  const slides = [
    { layout: 'portada' },
    { layout: 'seccion', number: '01', title: 'Título de sección' },
    { layout: 'filas', title: 'Tres reglas por diapositiva', rows: [
      { text: 'Una idea por diapositiva', detail: 'Si necesitas dos, haz dos' },
      { text: 'Frases, no viñetas', detail: 'Blanco lo importante, gris el detalle' },
      { text: 'Cuatro filas como máximo', detail: 'Dos líneas por fila' },
    ] },
    { layout: 'frase', text: 'Una frase que el público pueda repetir al salir' },
    { layout: 'cifra', title: 'El set de stickers', figure: '12', label: 'Grok Bots distintos, cada uno con su color', source: 'Fuente: Grok Bot Ambassador Kit' },
    { layout: 'tres-cifras', title: 'La noche en cifras', figures: [
      { value: '3', label: 'Ponentes' }, { value: '45', unit: 'min', label: 'Por charla, con preguntas' }, { value: '4', unit: 'h', label: 'De 17:30 a 21:30' },
    ] },
    { layout: 'imagen', title: 'Imagen centrada, con título', image: 'foto-horizontal.jpg', caption: 'Foto: SpaceX', alt: 'Foto: SpaceX' },
    { layout: 'imagen-sola', image: 'foto-vertical.jpg', caption: 'Foto: SpaceX' },
    { layout: 'imagen-a-sangre', image: 'foto-horizontal.jpg', caption: 'Foto: SpaceX' },
    { layout: 'dos-imagenes', title: 'Dos imágenes, mismo tamaño', images: [
      { image: 'foto-horizontal.jpg', label: 'Plano general', detail: 'Foto: SpaceX', alt: 'Foto: SpaceX' },
      { image: 'foto-detalle.jpg', label: 'Detalle', detail: 'Recortado al mismo formato', alt: 'Foto: SpaceX' },
    ] },
    { layout: 'cita', quote: '“Lo simple se recuerda”', author: 'Nombre Apellido', role: 'Cargo, Empresa' },
    { layout: 'codigo', title: 'Código y prompts', code: '# Comentarios en gris, código en blanco\ndef saludar(nombre):\n    return f"Kaixo, {nombre}"\n\nsaludar("Bilbao")' },
    { layout: 'cierre' },
  ].map(s => ({ ...s, notes: TEMPLATE_NOTES[s.layout] }));
  return {
    speaker: { name: speaker?.name || 'Nombre Apellido', org: speaker?.org || 'Empresa' },
    title: talkLines ? talkLines.join(' ') : 'El título de tu charla',
    // lines the speaker already broke by hand are kept; single-line titles are balanced
    titleLines: talkLines && talkLines.length > 1 ? talkLines : undefined,
    link: 'linkedin.com/in/tu-perfil',
    slides,
    base: HERE,
  };
}
