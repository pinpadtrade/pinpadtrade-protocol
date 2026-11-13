import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
for (const dir of ['brand','reference']) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir,f);
    const buf = fs.readFileSync(p);
    let ihdr = '';
    if (buf.slice(1,4).toString()==='PNG') {
      ihdr = `PNG IHDR ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} bitdepth=${buf[24]} colortype=${buf[25]}`;
    } else ihdr = 'JPEG magic=' + buf.slice(0,3).toString('hex');
    const meta = await sharp(buf).metadata();
    const {data,info} = await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const hist = {a0:0,a1_254:0,a255:0}; let black0=0, n=info.width*info.height;
    const q = new Map();
    for (let i=0;i<data.length;i+=4){
      const a=data[i+3];
      if(a===0){hist.a0++; if(data[i]+data[i+1]+data[i+2]===0) black0++;}
      else if(a===255)hist.a255++; else hist.a1_254++;
      if(a>200){const k=((data[i]>>4)<<8)|((data[i+1]>>4)<<4)|(data[i+2]>>4);q.set(k,(q.get(k)||0)+1);}
    }
    const top=[...q.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,c])=>`#${((k>>8)&15).toString(16)}${((k>>4)&15).toString(16)}${(k&15).toString(16)}(${(100*c/n).toFixed(1)}%)`);
    console.log(`${p}\n  ${ihdr}\n  sharp: ${meta.format} ${meta.width}x${meta.height} channels=${meta.channels} hasAlpha=${meta.hasAlpha} space=${meta.space}\n  alpha: ${JSON.stringify(hist)} pureBlackTransparent=${black0}\n  dominant(4bit): ${top.join(' ')}`);
  }
}
