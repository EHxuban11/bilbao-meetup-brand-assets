"""Recover the complete frames of a truncated ProRes .mov (index at the end, cut off),
using a complete ProRes .mov with the same format as the template for the moov atom.
usage: python3 tools/recover-prores.py <partial> <template.mov> <out.mov>"""
import struct, sys
part, tmpl, out = sys.argv[1:4]
b = open(part, 'rb').read()
# frames: [u32 size]['icpf']... laid out back to back inside mdat
mdat = b.find(b'mdat') - 4
pos = mdat + 8
frames = []
while pos + 8 <= len(b) and b[pos + 4:pos + 8] == b'icpf':
    size = struct.unpack('>I', b[pos:pos + 4])[0]
    if pos + size > len(b): break
    frames.append((pos, size)); pos += size
t = open(tmpl, 'rb').read()
def atoms(buf, start, end):
    i = start
    while i + 8 <= end:
        sz, typ = struct.unpack('>I4s', buf[i:i + 8]); yield i, sz, typ; i += sz
moov = next((i, sz) for i, sz, typ in atoms(t, 0, len(t)) if typ == b'moov')
M = bytearray(t[moov[0]:moov[0] + moov[1]])
CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'udta'}
n = len(frames)
def rebuild(buf):
    out = bytearray(); i = 8
    while i + 8 <= len(buf):
        sz, typ = struct.unpack('>I4s', buf[i:i + 8]); body = buf[i + 8:i + sz]
        if typ in CONTAINERS: body = rebuild(buf[i:i + sz])[8:]
        elif typ == b'stsz': body = struct.pack('>IIII', 0, 0, n) + b''.join(struct.pack('>I', s) for _, s in frames) if False else struct.pack('>III', 0, 0, n) + b''.join(struct.pack('>I', s) for _, s in frames)
        elif typ == b'stco': body = struct.pack('>II', 0, n) + b''.join(struct.pack('>I', o) for o, _ in frames)
        elif typ == b'co64': typ = b'stco'; body = struct.pack('>II', 0, n) + b''.join(struct.pack('>I', o) for o, _ in frames)
        elif typ == b'stsc': body = struct.pack('>IIIII', 0, 1, 1, 1, 1)
        elif typ == b'stts':
            ver, cnt, c0, d0 = struct.unpack('>IIII', body[:16]); body = struct.pack('>IIII', 0, 1, n, d0); dur = d0
        elif typ == b'stss': body = struct.pack('>II', 0, n) + b''.join(struct.pack('>I', k + 1) for k in range(n))
        out += struct.pack('>I4s', len(body) + 8, typ) + body; i += sz
    return struct.pack('>I4s', len(out) + 8, buf[4:8]) + out
newmoov = bytearray(rebuild(M))
# fix durations (mvhd, tkhd, mdhd) so players don't think it is longer
def fix(buf, name, ts_off, dur_off, scale_from=None):
    k = buf.find(name)
    return k
data = b[:pos]
open(out, 'wb').write(bytes(data[:mdat]) + struct.pack('>I', pos - mdat) + b'mdat' + bytes(data[mdat + 8:pos]) + bytes(newmoov))
print(f'{out}: {n} frames recovered')
