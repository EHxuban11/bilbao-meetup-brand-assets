// TrueType -> Embedded OpenType (EOT v2.1, uncompressed, no XOR), the format PowerPoint
// stores in ppt/fonts/*.fntdata. Layout verified against the designer's template header:
// 244-byte header for "Universal Sans Display 400", then the raw TrueType file.
// Spec: https://www.w3.org/Submission/EOT/

function tables(buf) {
  const n = buf.readUInt16BE(4); const t = {};
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16; const tag = buf.toString('latin1', o, o + 4);
    t[tag] = { offset: buf.readUInt32BE(o + 8), length: buf.readUInt32BE(o + 12) };
  }
  return t;
}

function nameRecord(buf, t, id) {
  const base = t.name.offset; const count = buf.readUInt16BE(base + 2), strOff = base + buf.readUInt16BE(base + 4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const r = base + 6 + i * 12;
    const [pid, eid, lid, nid, len, off] = [0, 2, 4, 6, 8, 10].map(k => buf.readUInt16BE(r + k));
    if (nid !== id) continue;
    if (pid === 3 && (eid === 1 || eid === 0)) { // Windows, UTF-16BE
      const s = buf.subarray(strOff + off, strOff + off + len); const le = Buffer.alloc(len);
      for (let k = 0; k + 1 < len; k += 2) { le[k] = s[k + 1]; le[k + 1] = s[k]; }
      const v = le.toString('utf16le'); if (lid === 0x409 || !best) best = v;
    } else if (pid === 1 && !best) best = buf.toString('latin1', strOff + off, strOff + off + len);
  }
  return best || '';
}

/** Facts PowerPoint needs about a font file. */
export function inspectFont(ttf) {
  const t = tables(ttf);
  if (!t['OS/2'] || !t.head || !t.name) throw new Error('not a complete OpenType font (missing OS/2, head or name)');
  const os2 = t['OS/2'].offset;
  const version = ttf.readUInt16BE(os2);
  return {
    trueType: !!t.glyf && !t['CFF '] && !t.CFF2,
    fsType: ttf.readUInt16BE(os2 + 8),
    weight: ttf.readUInt16BE(os2 + 4),
    italic: (ttf.readUInt16BE(os2 + 62) & 1) ? 1 : 0,
    panose: ttf.subarray(os2 + 32, os2 + 42),
    unicodeRange: [0, 1, 2, 3].map(i => ttf.readUInt32BE(os2 + 42 + i * 4)),
    codePageRange: version >= 1 ? [ttf.readUInt32BE(os2 + 78), ttf.readUInt32BE(os2 + 82)] : [0, 0],
    checkSumAdjustment: ttf.readUInt32BE(t.head.offset + 8),
    family: nameRecord(ttf, t, 1), style: nameRecord(ttf, t, 2),
    version: nameRecord(ttf, t, 5), full: nameRecord(ttf, t, 4),
    typoFamily: nameRecord(ttf, t, 16),
  };
}

/** Can this font legally be embedded for editing/viewing? (OS/2 fsType) */
export function embeddable(fsType) {
  if (fsType & 0x0002) return { ok: false, why: 'restricted-license embedding (fsType bit 1): the foundry does not allow embedding' };
  if (fsType & 0x0200) return { ok: false, why: 'bitmap-only embedding (fsType bit 9)' };
  return { ok: true, why: fsType === 0 ? 'installable' : `fsType 0x${fsType.toString(16)}` };
}

export function toEOT(ttf, { familyName } = {}) {
  const f = inspectFont(ttf);
  const str = s => { const b = Buffer.from(s, 'utf16le'); const h = Buffer.alloc(2); h.writeUInt16LE(b.length); return Buffer.concat([h, b]); };
  const pad = () => Buffer.alloc(2);
  const fixed = Buffer.alloc(80);
  let o = 0; const u32 = v => { fixed.writeUInt32LE(v >>> 0, o); o += 4; }, u16 = v => { fixed.writeUInt16LE(v, o); o += 2; };
  u32(0); u32(ttf.length); u32(0x00020001); u32(0);            // EOTSize (later), FontDataSize, Version, Flags
  f.panose.copy(fixed, o); o += 10;
  fixed[o++] = 1; fixed[o++] = f.italic;                        // Charset DEFAULT_CHARSET, Italic
  u32(f.weight); u16(f.fsType); u16(0x504C);                    // Weight, fsType, MagicNumber
  f.unicodeRange.forEach(u32); f.codePageRange.forEach(u32);
  u32(f.checkSumAdjustment); u32(0); u32(0); u32(0); u32(0);    // CheckSumAdjustment, Reserved1–4
  const family = familyName || f.family;
  const head = Buffer.concat([fixed, pad(), str(family), pad(), str(f.style), pad(), str(f.version), pad(), str(f.full), pad(), str('')]);
  const eot = Buffer.concat([head, ttf]);
  eot.writeUInt32LE(eot.length, 0);
  return eot;
}

/** Read an EOT header back (used by the self-check). */
export function readEOTHeader(eot) {
  let o = 80; const str = () => { const n = eot.readUInt16LE(o); o += 2; const s = eot.toString('utf16le', o, o + n); o += n; return s; };
  const skip = () => { o += 2; };
  const h = { size: eot.readUInt32LE(0), fontDataSize: eot.readUInt32LE(4), version: eot.readUInt32LE(8).toString(16), flags: eot.readUInt32LE(12), magic: eot.readUInt16LE(34).toString(16) };
  skip(); h.family = str(); skip(); h.style = str(); skip(); h.version_name = str(); skip(); h.full = str(); skip(); h.root = str();
  h.headerSize = o; return h;
}
