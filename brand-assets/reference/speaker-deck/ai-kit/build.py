#!/usr/bin/env python3
"""Builds a Grok Bot Bilbao Meetup talk deck from a talk.json file.

    python build.py talk.json               -> talk.pptx next to talk.json
    python build.py talk.json -o deck.pptx
    python build.py --layouts               -> every layout and its fields

Every position, size, colour and font comes from template.pptx, which sits next to this
script; this script only fills the layouts in, and checks the text against the limits in
DESIGN.md. Warnings mean a slide breaks a rule: fix talk.json and build again.

Needs python-pptx (pip install python-pptx). With fontTools installed, line lengths are
measured with the real font instead of estimated.
"""
import argparse
import copy
import io
import json
import struct
import sys
import unicodedata
import zipfile
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import PP_PLACEHOLDER
from pptx.enum.text import MSO_ANCHOR
from pptx.parts.image import Image
from pptx.util import Emu, Pt

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / 'template.pptx'
PX = 6350                      # EMU per px on the 1920 × 1080 canvas
GREY = RGBColor(0x77, 0x77, 0x77)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SIZE = {'numeral': 240, 'hero': 120, 'display': 64, 'body': 40, 'small': 32}
MAX_WORDS = 30
BREAK = object()

# layout key -> (layout name in template.pptx, fields: name -> description)
LAYOUTS = {
    'portada': ('01 Portada', {'': 'uses "title" and "speaker" from the top of talk.json'}),
    'seccion': ('02 Sección', {'number': '"01", "02"…', 'title': 'section name, 1 line'}),
    'filas': ('03 Título y filas', {'title': 'statement, up to 3 short lines', 'rows': '1–4 of {"text": idea, "detail": optional grey line}'}),
    'frase': ('04 Frase', {'text': 'the sentence to remember, up to 3 lines'}),
    'cifra': ('05 Cifra', {'title': 'statement, 1 line', 'figure': 'the number, up to 4 characters, e.g. "12", "3,5×"', 'label': 'what it means, 1 line', 'source': '"Fuente: …"'}),
    'tres-cifras': ('06 Tres cifras', {'title': 'statement, 1 line', 'figures': '1–3 of {"value": "45", "unit": optional "min", "label": 1 line}'}),
    'imagen': ('07 Imagen con título', {'title': 'statement, 1 line', 'image': 'path relative to talk.json', 'caption': 'optional, e.g. "Foto: Autor"'}),
    'imagen-sola': ('08 Imagen sola', {'image': 'path; screenshots and portrait photos', 'caption': 'optional'}),
    'imagen-a-sangre': ('09 Imagen a sangre', {'image': 'landscape photo, 1920 × 1080 or more', 'caption': 'optional, white'}),
    'dos-imagenes': ('10 Dos imágenes', {'title': 'statement, 1 line', 'images': 'exactly 2 of {"image", "label", "detail": optional}'}),
    'cita': ('11 Cita', {'quote': 'up to 12 words, with “ ”', 'author': 'name', 'role': 'optional, grey'}),
    'codigo': ('12 Código', {'title': 'statement, 1 line', 'code': 'up to 14 lines, use \\n', 'comment': 'optional comment prefix, default "#" (lines starting with it go grey)'}),
    'cierre': ('13 Cierre', {'': 'uses "speaker" and "link" from the top of talk.json'}),
}
ALIASES = {'sangre': 'imagen-a-sangre', 'cover': 'portada', 'closing': 'cierre'}


def key(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower().strip().replace(' ', '-')
    return ALIASES.get(s, s)


# ---------------------------------------------------------------------------
# Measuring text with the font embedded in the template

def load_widths():
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return None
    with zipfile.ZipFile(TEMPLATE) as z:
        fonts = [n for n in z.namelist() if n.startswith('ppt/fonts/')]
        if not fonts:
            return None
        blob = z.read(fonts[0])
    size = struct.unpack_from('<I', blob, 4)[0]          # EOT: the font is the last FontDataSize bytes
    font = TTFont(io.BytesIO(blob[-size:]))
    cmap, hmtx, upm = font.getBestCmap(), font['hmtx'], font['head'].unitsPerEm
    return lambda ch: hmtx[cmap.get(ord(ch), '.notdef')][0] / upm


WIDTH = load_widths()


def text_width(s, px):
    return sum(WIDTH(c) if WIDTH else 0.52 for c in s) * px


def wrap(text, px, width):
    """Greedy wrap, like PowerPoint: as many words per line as fit."""
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if line and text_width(trial, px) > width:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + [line] if line else lines


def line_count(s, px, width):
    return sum(max(1, len(wrap(para, px, width))) for para in str(s).split('\n'))


def balance(text, px, width):
    """CSS text-wrap: balance. Keep the line count greedy wrapping gives, then find the
    narrowest width that still fits in that many lines, so the lines come out even."""
    out = []
    for para in str(text).split('\n'):
        lines = wrap(para, px, width)
        if len(lines) > 1:
            lo, hi = max(text_width(w, px) for w in para.split()), width
            for _ in range(24):
                mid = (lo + hi) / 2
                if len(wrap(para, px, mid)) <= len(lines):
                    hi = mid
                else:
                    lo = mid
            lines = wrap(para, px, hi)
        out.append(lines or [''])
    return out


# ---------------------------------------------------------------------------

class Deck:
    def __init__(self, talk, base):
        self.talk, self.base = talk, base
        self.errors, self.warnings = [], []
        self.prs = Presentation(TEMPLATE)
        self.layouts = {l.name: l for l in self.prs.slide_layouts}
        self.font = self.find_font()
        # drop the template's example slides
        ids = self.prs.slides._sldIdLst
        for sid in list(ids):
            self.prs.part.drop_rel(sid.rId)
            ids.remove(sid)

    def find_font(self):
        for layout in self.prs.slide_layouts:
            for el in layout._element.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}latin'):
                return el.get('typeface')
        return 'Arial'

    # checks
    def warn(self, n, msg):
        self.warnings.append(f'slide {n}: {msg}')

    def err(self, n, msg):
        self.errors.append(f'slide {n}: {msg}')

    def fits(self, n, field, s, style, width, lines=1):
        if not s:
            return
        got = line_count(s, SIZE[style], width)
        if got > lines:
            self.warn(n, f'{field} runs to {got} lines (max {lines}): "{s}". Shorten it or split the slide.')

    def statement(self, n, field, s, max_words=8):
        if not s:
            return
        if len(s.split()) > max_words:
            self.warn(n, f'{field} has {len(s.split())} words; titles are statements of {max_words} words or fewer.')
        if s.rstrip().endswith('.'):
            self.warn(n, f'{field} ends with a full stop; drop it.')

    def image(self, n, rel):
        if not rel:
            self.err(n, 'missing "image"')
            return None
        p = (self.base / rel).resolve()
        if not p.exists():
            self.err(n, f'image not found: {rel}')
            return None
        return p

    # filling
    def slide(self, layout_key):
        return self.prs.slides.add_slide(self.layouts[LAYOUTS[layout_key][0]])

    @staticmethod
    def placeholders(slide):
        by_idx = {ph.placeholder_format.idx: ph for ph in slide.placeholders}
        names = {ph.name: ph.placeholder_format.idx for ph in slide.slide_layout.placeholders
                 if ph.placeholder_format.type != PP_PLACEHOLDER.SLIDE_NUMBER}
        return {name: by_idx[idx] for name, idx in names.items() if idx in by_idx}

    @staticmethod
    def put(ph, paragraphs):
        """paragraphs: list of lists of (text, colour or None). None keeps the layout's colour;
        a BREAK item is a soft line break inside the paragraph."""
        tf = ph.text_frame
        tf.clear()
        for i, runs in enumerate(paragraphs):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            for item in runs:
                if item is BREAK:
                    p.add_line_break()
                    continue
                text, colour = item
                r = p.add_run()
                r.text = text
                if colour is not None:
                    r.font.color.rgb = colour

    def textbox(self, slide, x, y, w, h, paragraphs, px, line_px):
        tb = slide.shapes.add_textbox(Emu(x * PX), Emu(y * PX), Emu(w * PX), Emu(h * PX))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.TOP
        for i, (text, colour) in enumerate(paragraphs):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.line_spacing = Pt(line_px / 2)
            if i:
                p.space_before = Pt(3)
            r = p.add_run()
            r.text = text
            r.font.name = self.font
            r.font.size = Pt(px / 2)
            r.font.color.rgb = colour
        return tb

    def contain(self, slide, path, zone, n):
        w, h = Image.from_file(str(path)).size
        x, y, zw, zh = zone
        k = min(zw / w, zh / h)
        if k > 1.25:
            self.warn(n, f'{path.name} is {w} × {h} px and will be enlarged {k:.1f}×; use a sharper image (at least {int(w * k)} × {int(h * k)}).')
        dw, dh = w * k, h * k
        slide.shapes.add_picture(str(path), Emu(int((x + (zw - dw) / 2) * PX)), Emu(int((y + (zh - dh) / 2) * PX)),
                                 Emu(int(dw * PX)), Emu(int(dh * PX)))

    def fill_picture(self, ph, path, n, min_w):
        w, h = Image.from_file(str(path)).size
        if w < min_w:
            self.warn(n, f'{path.name} is {w} px wide; this layout needs at least {min_w}.')
        ph.insert_picture(str(path))

    # ------------------------------------------------------------------
    def build(self):
        t = self.talk
        speaker = t.get('speaker') or {}
        name, org = speaker.get('name', ''), speaker.get('org', '')
        link = str(t.get('link', '')).removeprefix('https://').removeprefix('http://').removeprefix('www.').rstrip('/')
        if not t.get('slides'):
            self.errors.append('talk.json has no "slides"')
            return

        for n, s in enumerate(t['slides'], 1):
            lk = key(s.get('layout', ''))
            if lk not in LAYOUTS:
                self.err(n, f'unknown layout "{s.get("layout")}". Use one of: {", ".join(LAYOUTS)}')
                continue
            slide = self.slide(lk)
            ph = self.placeholders(slide)
            used = set()

            def put(field, paragraphs):
                self.put(ph[field], paragraphs)
                used.add(field)

            def plain(field, value):
                if value:
                    put(field, [[(line, None)] for line in str(value).split('\n')])

            def balanced(field, value, style, width):
                """Titles break into even lines (text-wrap: balance), with soft line breaks."""
                if value:
                    paras = []
                    for lines in balance(value, SIZE[style], width):
                        runs = []
                        for j, line in enumerate(lines):
                            runs += ([BREAK] if j else []) + [(line, None)]
                        paras.append(runs)
                    put(field, paras)

            words = []
            if lk == 'portada':
                title = t.get('title', '')
                if not title or not name:
                    self.err(n, 'portada needs "title" and "speaker": {"name", "org"} at the top of talk.json')
                self.fits(n, 'title', title, 'hero', 1760, 2)
                balanced('title', title, 'hero', 1760)
                put('speaker', [[(name, None), (f' · {org}', GREY)]] if org else [[(name, None)]])

            elif lk == 'seccion':
                plain('number', s.get('number', ''))
                self.statement(n, 'title', s.get('title'))
                self.fits(n, 'title', s.get('title'), 'hero', 1760, 1)
                balanced('title', s.get('title'), 'hero', 1760)
                words += [s.get('title', '')]

            elif lk == 'filas':
                rows = s.get('rows') or []
                if not 1 <= len(rows) <= 4:
                    self.err(n, f'filas takes 1–4 rows, got {len(rows)}; split the list over two slides.')
                self.statement(n, 'title', s.get('title'), 10)
                self.fits(n, 'title', s.get('title'), 'display', 804, 3)
                balanced('title', s.get('title'), 'display', 804)
                for i, row in enumerate(rows[:4]):
                    row = row if isinstance(row, dict) else {'text': str(row)}
                    y = 90 + i * 142
                    self.textbox(slide, 964, y, 128, 48, [(f'{i + 1:02d}', GREY)], 40, 48)
                    lines = [(row.get('text', ''), WHITE)] + ([(row['detail'], GREY)] if row.get('detail') else [])
                    self.textbox(slide, 1156, y, 684, 102, lines, 40, 48)
                    for field in ('text', 'detail'):
                        self.fits(n, f'row {i + 1} {field}', row.get(field), 'body', 684, 1)
                        if str(row.get(field, '')).rstrip().endswith('.'):
                            self.warn(n, f'row {i + 1} {field} ends with a full stop; drop it.')
                    words += [row.get('text', ''), row.get('detail', '')]
                words += [s.get('title', '')]

            elif lk == 'frase':
                self.fits(n, 'text', s.get('text'), 'hero', 1560, 3)
                if not s.get('text'):
                    self.err(n, 'frase needs "text"')
                balanced('title', s.get('text'), 'hero', 1560)
                words += [s.get('text', '')]

            elif lk == 'cifra':
                fig = str(s.get('figure', ''))
                if not fig:
                    self.err(n, 'cifra needs "figure"')
                if len(fig) > 4:
                    self.warn(n, f'figure "{fig}" is longer than 4 characters; round it or move the unit into the label.')
                if not s.get('source'):
                    self.warn(n, 'every number needs a source: add "source": "Fuente: …"')
                self.statement(n, 'title', s.get('title'))
                self.fits(n, 'title', s.get('title'), 'display', 1760, 1)
                self.fits(n, 'label', s.get('label'), 'body', 1560, 1)
                self.fits(n, 'source', s.get('source'), 'small', 1300, 1)
                balanced('title', s.get('title'), 'display', 1760)
                plain('figure', fig)
                plain('label', s.get('label'))
                plain('source', s.get('source'))
                words += [s.get('title', ''), s.get('label', ''), s.get('source', '')]

            elif lk == 'tres-cifras':
                figs = s.get('figures') or []
                if not 1 <= len(figs) <= 3:
                    self.err(n, f'tres-cifras takes 1–3 figures, got {len(figs)}')
                self.statement(n, 'title', s.get('title'))
                self.fits(n, 'title', s.get('title'), 'display', 1760, 1)
                balanced('title', s.get('title'), 'display', 1760)
                for i, f in enumerate(figs[:3], 1):
                    value, unit = str(f.get('value', '')), f.get('unit')
                    runs = [(value, None)] + ([(f' {unit}', GREY)] if unit else [])
                    put(f'figure{i}', [runs])
                    self.fits(n, f'figure {i}', f'{value} {unit or ""}'.strip(), 'hero', 570, 1)
                    plain(f'label{i}', f.get('label'))
                    self.fits(n, f'label {i}', f.get('label'), 'body', 570, 1)
                    words += [f.get('label', '')]
                words += [s.get('title', '')]

            elif lk in ('imagen', 'imagen-sola'):
                p = self.image(n, s.get('image'))
                if lk == 'imagen':
                    self.statement(n, 'title', s.get('title'))
                    self.fits(n, 'title', s.get('title'), 'display', 1760, 1)
                    balanced('title', s.get('title'), 'display', 1760)
                if p:
                    self.contain(slide, p, (80, 200, 1760, 680) if lk == 'imagen' else (80, 160, 1760, 760), n)
                self.fits(n, 'caption', s.get('caption'), 'small', 1300, 1)
                plain('caption', s.get('caption'))
                words += [s.get('title', ''), s.get('caption', '')]

            elif lk == 'imagen-a-sangre':
                p = self.image(n, s.get('image'))
                if p:
                    self.fill_picture(ph['image'], p, n, 1920)
                    used.add('image')
                plain('caption', s.get('caption'))
                words += [s.get('caption', '')]

            elif lk == 'dos-imagenes':
                imgs = s.get('images') or []
                if len(imgs) != 2:
                    self.err(n, f'dos-imagenes takes exactly 2 images, got {len(imgs)}')
                self.statement(n, 'title', s.get('title'))
                self.fits(n, 'title', s.get('title'), 'display', 1760, 1)
                balanced('title', s.get('title'), 'display', 1760)
                for i, im in enumerate(imgs[:2], 1):
                    p = self.image(n, im.get('image'))
                    if p:
                        self.fill_picture(ph[f'image{i}'], p, n, 848)
                        used.add(f'image{i}')
                    plain(f'label{i}', im.get('label'))
                    plain(f'note{i}', im.get('detail'))
                    self.fits(n, f'image {i} label', im.get('label'), 'small', 848, 1)
                    self.fits(n, f'image {i} detail', im.get('detail'), 'small', 848, 1)
                    words += [im.get('label', ''), im.get('detail', '')]
                words += [s.get('title', '')]

            elif lk == 'cita':
                q = str(s.get('quote', '')).strip()
                if not q:
                    self.err(n, 'cita needs "quote"')
                if q and not q.startswith('“'):
                    q = '“' + q.strip('"\'«»“”') + '”'
                if len(q.split()) > 12:
                    self.warn(n, f'the quote has {len(q.split())} words (max 12)')
                self.fits(n, 'quote', q, 'hero', 1560, 3)
                balanced('title', q, 'hero', 1560)
                role = s.get('role')
                put('author', [[(s.get('author', ''), None)] + ([(f' · {role}', GREY)] if role else [])])
                words += [q]

            elif lk == 'codigo':
                code = str(s.get('code', '')).rstrip('\n')
                prefix = s.get('comment', '#')
                lines = code.split('\n')
                if len(lines) > 14:
                    self.err(n, f'code has {len(lines)} lines (max 14); show only the part you explain.')
                longest = max((len(l) for l in lines), default=0)
                if longest > 88:
                    self.warn(n, f'a code line is {longest} characters (max 88); wrap it by hand.')
                self.statement(n, 'title', s.get('title'))
                self.fits(n, 'title', s.get('title'), 'display', 1760, 1)
                balanced('title', s.get('title'), 'display', 1760)
                put('code', [[(l or ' ', GREY if prefix and l.lstrip().startswith(prefix) else None)] for l in lines])
                words += [s.get('title', '')]

            elif lk == 'cierre':
                if not name:
                    self.err(n, 'cierre needs "speaker": {"name", "org"} at the top of talk.json')
                put('title', [[('Gracias', None)], [('Eskerrik asko', GREY)]])
                plain('name', name)
                plain('org', org)
                if link:
                    if text_width(link, 32) > 500:
                        self.warn(n, f'link "{link}" is too long for the pill; use a shorter URL.')
                    plain('link', link)
                else:
                    self.warn(n, 'no "link" at the top of talk.json; the pill will be empty.')

            count = sum(len(str(w).split()) for w in words if w)
            if count > MAX_WORDS:
                self.warn(n, f'{count} words on the slide (max {MAX_WORDS}); move detail to the notes or split it.')

            # remove empty placeholders so nothing says "Click to add text"
            for field, p in ph.items():
                if field not in used:
                    p._element.getparent().remove(p._element)
            # python-pptx doesn't carry the page number over from the layout
            for lp in slide.slide_layout.placeholders:
                if lp.placeholder_format.type == PP_PLACEHOLDER.SLIDE_NUMBER:
                    el = copy.deepcopy(lp._element)
                    for t in el.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'):
                        t.text = str(n)   # cached value; PowerPoint recomputes it
                    slide.shapes._spTree.append(el)

            if s.get('notes'):
                slide.notes_slide.notes_text_frame.text = str(s['notes'])

        self.prs.core_properties.title = f'{t.get("title", "")} · {name}'.strip(' ·')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('talk', nargs='?', help='talk.json')
    ap.add_argument('-o', '--out', help='output .pptx (default: next to talk.json)')
    ap.add_argument('--strict', action='store_true', help='treat warnings as errors')
    ap.add_argument('--layouts', action='store_true', help='list layouts and their fields')
    a = ap.parse_args()

    if a.layouts or not a.talk:
        for k, (name, fields) in LAYOUTS.items():
            print(f'{k}  ({name})')
            for f, d in fields.items():
                print(f'    {f + ": " if f else ""}{d}')
        return

    src = Path(a.talk)
    talk = json.loads(src.read_text(encoding='utf-8'))
    deck = Deck(talk, src.resolve().parent)
    deck.build()
    for w in deck.warnings:
        print('warning:', w)
    for e in deck.errors:
        print('error:', e)
    if deck.errors or (a.strict and deck.warnings):
        print('Not saved. Fix talk.json and build again.')
        sys.exit(1)
    out = Path(a.out) if a.out else src.with_suffix('.pptx')
    deck.prs.save(out)
    measured = 'measured with the embedded font' if WIDTH else 'estimated; install fontTools to measure exactly'
    print(f'Saved {out} · {len(talk["slides"])} slides · {len(deck.warnings)} warnings · line lengths {measured}')


if __name__ == '__main__':
    main()
