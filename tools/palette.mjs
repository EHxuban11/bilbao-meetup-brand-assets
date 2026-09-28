// Most frequent exact colours in an image (ignores black, transparent and greys).
import sharp from 'sharp';
for (const f of process.argv.slice(2)) {
  const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Map();
  for (let i = 0; i < data.length; i += 4) { if (data[i+3] < 250) continue; const [r,g,b] = [data[i],data[i+1],data[i+2]];
    if (Math.max(r,g,b) - Math.min(r,g,b) < 20 && !(r > 250)) continue;
    const k = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join(''); m.set(k, (m.get(k)||0)+1); }
  console.log(f.split('/').pop(), [...m].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,n])=>`${k}:${n}`).join('  '));
}
