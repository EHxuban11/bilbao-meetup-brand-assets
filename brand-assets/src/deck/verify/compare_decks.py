"""Semantic comparison of two decks: per slide, layout name, then every visible element with
effective geometry (px), text runs with resolved colour, pictures with crop. Placeholders inherit
geometry and colour from their layout, so python-pptx-built and PptxGenJS-built decks compare equal."""
import sys
from pptx import Presentation
from pptx.util import Emu
NS = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
PX = 6350

def layout_colour(slide, idx):
    for ph in slide.slide_layout.placeholders:
        if ph.placeholder_format.idx == idx:
            for el in ph._element.iter(NS + 'defRPr'):
                for c in el.iter(NS + 'srgbClr'):
                    return c.get('val')
    return None

def describe(path):
    prs = Presentation(path); out = []
    for n, slide in enumerate(prs.slides, 1):
        out.append(f'--- slide {n}: {slide.slide_layout.name}')
        items = []
        for sh in slide.shapes:
            is_ph = sh.is_placeholder
            idx = sh.placeholder_format.idx if is_ph else None
            if is_ph and sh.placeholder_format.type is not None and 'SLIDE_NUMBER' in str(sh.placeholder_format.type):
                items.append('  slide number'); continue
            geo = f'@({round(sh.left / PX, 1)},{round(sh.top / PX, 1)}) {round(sh.width / PX, 1)}x{round(sh.height / PX, 1)}'
            if sh.shape_type is not None and 'PICTURE' in str(sh.shape_type) or sh._element.tag.endswith('pic'):
                src = sh._element.find('.//' + NS + 'srcRect')
                crop = '' if src is None else ' crop ' + ','.join(f'{k}={src.get(k, "0")}' for k in 'lrtb')
                items.append(f'  picture ph{idx if is_ph else "-"} {geo}{crop}'); continue
            if not sh.has_text_frame: items.append(f'  shape {geo}'); continue
            paras = []
            for p in sh.text_frame.paragraphs:
                runs = []
                for r in p._p:
                    tag = r.tag.split('}')[1]
                    if tag == 'br': runs.append('⏎')
                    elif tag == 'r':
                        t = ''.join(x.text or '' for x in r.iter(NS + 't'))
                        c = None
                        for sc in r.iter(NS + 'srgbClr'): c = sc.get('val'); break
                        if c is None and is_ph: c = layout_colour(slide, idx)
                        runs.append(f'[{c}]{t}')
                paras.append(''.join(runs))
            items.append(f'  text ph{idx if is_ph else "-"} {geo}: ' + ' ¶ '.join(paras))
        out += sorted(items)
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame.text.strip():
            out.append('  notes: ' + slide.notes_slide.notes_text_frame.text.strip()[:60])
    return out

a, b = describe(sys.argv[1]), describe(sys.argv[2])
import difflib
d = list(difflib.unified_diff(a, b, 'build.py', 'node', lineterm='', n=0))
print('\n'.join(d) if d else f'IDENTICAL ({len(a)} lines)')
