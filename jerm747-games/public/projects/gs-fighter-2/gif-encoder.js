// Dependency-free GIF89a writer. A fixed RGB332 palette and frequent LZW clears
// bound memory and keep the code width at 9 bits. Index zero is transparency.
export function encodeGIF(frames,width,height,fps=8){
 if(!frames.length||width<1||height<1||width>1024||height>1024)throw Error('GIF requires frames and dimensions up to 1024px.');
 const out=[],byte=n=>out.push(n&255),word=n=>{byte(n);byte(n>>8)},str=s=>{for(const c of s)byte(c.charCodeAt(0))};
 str('GIF89a');word(width);word(height);byte(0xf7);byte(0);byte(0);
 for(let n=0;n<256;n++){byte(Math.round((n>>5)*255/7));byte(Math.round(((n>>2)&7)*255/7));byte((n&3)*85);}
 byte(0x21);byte(0xff);byte(11);str('NETSCAPE2.0');byte(3);byte(1);word(0);byte(0);
 for(const pixels of frames){
  if(pixels.length!==width*height*4)throw Error('Mismatched GIF frame size');
  byte(0x21);byte(0xf9);byte(4);byte(9);word(Math.max(2,Math.round(100/fps)));byte(0);byte(0);
  byte(0x2c);word(0);word(0);word(width);word(height);byte(0);byte(8);
  const bytes=[];let bits=0,nbits=0;
  const code=n=>{bits|=n<<nbits;nbits+=9;while(nbits>=8){bytes.push(bits&255);bits>>>=8;nbits-=8;}};
  code(256);let sinceClear=0;
  for(let i=0;i<pixels.length;i+=4){if(sinceClear===120){code(256);sinceClear=0;}const n=pixels[i+3]<128?0:((pixels[i]>>5)<<5)|((pixels[i+1]>>5)<<2)|(pixels[i+2]>>6);code(pixels[i+3]<128?0:Math.max(1,n));sinceClear++;}
  code(257);if(nbits)bytes.push(bits&255);
  for(let i=0;i<bytes.length;i+=255){byte(Math.min(255,bytes.length-i));for(const b of bytes.slice(i,i+255))byte(b);}byte(0);
 }
 byte(0x3b);return new Uint8Array(out);
}
