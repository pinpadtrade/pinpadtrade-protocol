import sharp from 'sharp';
const hex=(r,g,b)=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
const {data,info}=await sharp('brand/LOGO PINPAD PNG.png').raw().toBuffer({resolveWithObject:true});
const px=(x,y)=>{const i=(y*info.width+x)*4;return hex(data[i],data[i+1],data[i+2])};
console.log('bg',px(50,50),px(1900,1900));
console.log('purple',px(1140,890),px(1120,870),px(1160,900));
console.log('white tile',px(860,860),'ring',px(900,620),'ring-shade',px(1100,1250),'underside',px(1000,1370));
const t=await sharp('brand/LOGO PINPAD PNG...png').raw().toBuffer({resolveWithObject:true});
// bbox of alpha>0
let x0=9e9,y0=9e9,x1=0,y1=0;
for(let y=0;y<t.info.height;y++)for(let x=0;x<t.info.width;x++){if(t.data[(y*t.info.width+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
console.log('alpha bbox',x0,y0,x1,y1);
const r=await sharp('reference/SAMPUL PINPAD JPG.jpg.jpeg').raw().toBuffer({resolveWithObject:true});
const rp=(x,y)=>{const i=(y*r.info.width+x)*3;return hex(r.data[i],r.data[i+1],r.data[i+2])};
console.log('banner bg',rp(100,100),rp(300,250),'dot',rp(750,331));
