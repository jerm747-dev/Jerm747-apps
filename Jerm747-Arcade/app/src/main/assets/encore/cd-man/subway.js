/* Platform Two. Side-on station scenery; all positions use CD Man's 432-unit canvas. */
(() => {
  'use strict';
  const tiles = new Map();
  const TAU = Math.PI * 2;
  const mod = (x, span) => (x % span + span) % span;
  const sections = [
    {name:'NORTH LINE', sub:'PLATFORM 02', band:'#286069', glaze:'#a3b2aa', light:'#c1c7ae', accent:'#a2c4af'},
    {name:'CROSS TOWN', sub:'TRANSFER HALL', band:'#4e567e', glaze:'#8398ad', light:'#a7b5c3', accent:'#d5a87b'},
    {name:'CENTRAL', sub:'FARE CONCOURSE', band:'#814e49', glaze:'#b3a28c', light:'#cfbba0', accent:'#e7c68b'}
  ];
  function rect(c, color, x, y, w, h) {
    c.fillStyle=color;c.fillRect(x,y,w,h);
  }
  function poly(c, color, points) {
    c.fillStyle=color;c.beginPath();c.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);
    c.closePath();c.fill();
  }
  function stroke(c, color, width, points) {
    c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);
    c.stroke();
  }
  function circle(c, color, x, y, radius) {
    c.fillStyle=color;c.beginPath();c.arc(x,y,radius,0,TAU);c.fill();
  }
  function label(c,text,x,y,size,color,align='left'){
    c.fillStyle=color;c.textAlign=align;c.font='bold '+size+'px Arial, sans-serif';c.fillText(text,x,y);
  }
  function tile(key,w,h,paint){
    if(!tiles.has(key)){
      const img=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):document.createElement('canvas');
      img.width=w;img.height=h;paint(img.getContext('2d'));tiles.set(key,img);
    }
    return tiles.get(key);
  }
  function repeat(c, image, offset, y, width){
    for(let x=-Math.floor(mod(offset,image.width)); x<width; x+=image.width)c.drawImage(image,x,y);
  }

  // The continuous vaulted wall and each of its section plaques are painted once.
  function paintBay(c,section){
    const w=600;
    rect(c,'#374953',0,0,w,330);
    rect(c,section.glaze,0,62,w,220);
    for(let row=0;row<14;row++){
      const y=66+row*15;
      rect(c,'#647c80',0,y,w,1);rect(c,'#d4d4b647',0,y+1,w,1);
      for(let x=row%2?-20:0; x<w;x+=40){
        rect(c,'#687e82',x,y+1,1,14);
        if((row*3+x/20)%7===0)rect(c,'#dde7cc19',x+1,y+2,38,12);
      }
    }
    rect(c,'#334854',0,152,w,23);rect(c,section.band,0,155,w,16);
    rect(c,section.accent,0,156,w,2);rect(c,section.accent,0,168,w,1);
    rect(c,'#435964',0,268,w,10);rect(c,'#718283',0,270,w,2);
    // Broad vault ribs at the sides of each bay, with a cold central work light.
    const ceiling=c.createLinearGradient(0,0,0,111);
    ceiling.addColorStop(0,'#192534');ceiling.addColorStop(.55,'#344854');ceiling.addColorStop(1,section.light);
    c.fillStyle=ceiling;c.beginPath();c.moveTo(0,0);c.lineTo(w,0);c.lineTo(w,114);
    c.bezierCurveTo(503,42,438,28,300,28);c.bezierCurveTo(162,28,97,42,0,114);c.closePath();c.fill();
    for(const [y,col,ww] of [[58,'#293743',6],[65,'#71817d',2]]){
      c.strokeStyle=col;c.lineWidth=ww;c.beginPath();c.moveTo(0,y+55);
      c.bezierCurveTo(160,y-56,440,y-56,w,y+55);c.stroke();
    }
    const glow=c.createRadialGradient(300,51,4,300,51,138);
    glow.addColorStop(0,'rgba(255,238,180,.40)');glow.addColorStop(1,'rgba(255,238,180,0)');
    rect(c,glow,162,14,276,171);
    rect(c,'#34434b',237,43,126,8);rect(c,'#d7d5af',242,48,116,4);rect(c,'#fff2bc',246,49,108,2);
    // Enamel mosaic roundel and a large station name stay readable above the train.
    rect(c,'#34494f',183,90,234,48);rect(c,section.band,185,92,230,44);
    c.strokeStyle=section.accent;c.lineWidth=1;c.strokeRect(189.5,96.5,221,35);
    circle(c,'#d3c9a6',211,114,12);circle(c,section.band,211,114,9.5);
    label(c,'R',211,118,13,'#f3dfaf','center');
    label(c,section.name,234,113,19,'#efe6c5');
    label(c,section.sub,235,126,8,'#d9d8be');
    // A small outlined route diagram is physically part of the opposite platform wall.
    rect(c,'#415764',76,185,68,54);rect(c,'#c6c7b0',78,187,64,50);
    rect(c,section.band,81,190,58,6);label(c,'LINE MAP',83,195,5,'#f0e9cb');
    stroke(c,'#b47759',2,[83,223,96,210,117,210,134,200]);
    stroke(c,'#528087',2,[85,205,101,220,121,220,134,227]);
    for(const [x,y] of [[95,211],[103,219],[117,210],[126,206]])circle(c,'#ece5c8',x,y,1.9);
    rect(c,'#485d65',0,278,w,18);rect(c,'#e1c17c',0,277,w,3);
    rect(c,'#253946',0,287,w,7);
  }
  function paintColumn(c){
    rect(c,'#142634',23,0,22,319);rect(c,'#536c70',24,0,4,319);
    rect(c,'#38565c',29,0,10,319);rect(c,'#263f49',37,0,4,319);
    poly(c,'#233946',[0,25,24,52,25,83,4,49]);poly(c,'#516769',[0,26,25,52,24,57,2,32]);
    poly(c,'#233946',[45,54,68,28,68,44,45,80]);poly(c,'#53696b',[45,54,68,27,67,34,45,60]);
    rect(c,'#253945',20,47,28,9);rect(c,'#708384',20,48,28,2);
    for(let y=66;y<302;y+=32){
      rect(c,'#829490',25,y,2,2);rect(c,'#182c36',40,y,2,3);
    }
    rect(c,'#233946',20,305,27,11);rect(c,'#1b2e39',18,315,31,9);
    rect(c,'#85958b',19,315,29,2);
  }
  function paintCar(c){
    // One articulated stainless-steel car. Its undercarriage is behind the playable plane.
    rect(c,'#203443',1,12,279,76);
    poly(c,'#788c94',[2,18,8,8,26,3,251,3,268,8,278,16,278,21,2,21]);
    rect(c,'#adc0be',15,6,241,2);rect(c,'#3c535e',19,10,239,2);
    rect(c,'#91a7aa',4,19,272,62);rect(c,'#526d79',4,58,272,23);
    rect(c,'#335466',4,54,272,6);rect(c,'#cca773',4,54,272,2);
    for(let y=64;y<79;y+=4){rect(c,'#3e5865',5,y,270,1);rect(c,'#799395',5,y+1,270,1)}
    for(const x of [12,48,111,147,210,246]){
      rect(c,'#344d59',x,23,27,26);rect(c,'#ccbe94',x+2,25,23,22);
      poly(c,'#9fa99c',[x+2,25,x+12,25,x+2,41]);
      rect(c,'#58717a',x+12,25,2,22);rect(c,'#e4cc95',x+4,26,6,2);
      // Human-scale silhouettes quietly occupy the passing train.
      if(x===48||x===210){
        circle(c,'#656c66',x+20,38,3.6);poly(c,'#656c66',[x+13,47,x+15,43,x+20,40,x+24,43,x+24,47]);
      }
    }
    for(const x of [80,179]){
      rect(c,'#354c5a',x,20,24,60);rect(c,'#97a9a8',x+1,21,22,57);
      for(const k of [0,11]){rect(c,'#3c5560',x+3+k,26,7,22);rect(c,'#b8bd9d',x+4+k,27,5,19)}
      rect(c,'#5a727a',x+11,21,2,57);rect(c,'#b8c4ba',x+2,62,8,1);
    }
    rect(c,'#273e4b',0,81,280,6);rect(c,'#a8b1a8',3,80,273,2);
    for(const x of [36,224]){
      rect(c,'#2c3c46',x-12,86,39,7);
      circle(c,'#1b2b37',x,92,7);circle(c,'#4a6068',x,92,3.4);
      circle(c,'#1b2b37',x+16,92,7);circle(c,'#4a6068',x+16,92,3.4);
    }
    rect(c,'#283a47',280,25,5,52);
    for(let y=29;y<76;y+=6)rect(c,'#667780',281,y,3,2);
  }
  function paintTracks(c){
    rect(c,'#152936',0,0,120,158);
    for(let x=-40;x<140;x+=24)poly(c,'#394753',[x,61,x+8,61,x+42,131,x+28,131]);
    for(const [y,col] of [[24,'#5f757a'],[27,'#253b49'],[53,'#7a827c'],[57,'#2c404b'],[97,'#566770'],[102,'#192d38']])rect(c,col,0,y,120,3);
    rect(c,'#263d49',0,145,120,13);
  }
  function drawSky(c,width,height,cameraX=0,time=0){
    const scale=height/432,w=width/scale,cam=cameraX/scale;
    c.save();c.scale(scale,scale);c.imageSmoothingEnabled=false;
    rect(c,'#182e3d',0,0,w,432);
    const bay=600,offset=cam*.67;
    const first=Math.floor(offset/bay);
    // Adjacent stops keep their own paint. Scrolling cannot abruptly recolor a visible wall.
    for(let i=first;i<=(offset+w)/bay;i++){
      const section=i<1?0:i<3?1:2;
      c.drawImage(tile('bay'+section,bay,304,ctx=>paintBay(ctx,sections[section])),Math.round(i*bay-offset),0);
    }
    repeat(c,tile('track',120,158,paintTracks),cam*.8,291,w);
    // A complete three-car train passes, then the wall and map are visible again.
    const span=4400,head=mod(time*142-cam*.69+490,span)-890;
    const car=tile('car',285,101,paintCar);
    for(const wrap of [head-span,head,head+span]){
      for(let n=0;n<3;n++){
        const x=Math.round(wrap+n*285);
        if(x>-285&&x<w){
          c.drawImage(car,x,219);
          if(n===2){rect(c,'#f0d7a2',x+268,270,7,4);rect(c,'#b98978',x+272,279,3,3)}
        }
      }
    }
    // The two-aspect signals sit trackside. The amber lens limits their brightness
    // so a rail signal cannot be mistaken for a collectible note on the platform.
    for(let x=373-mod(cam*.82,930);x<w-4;x+=930){
      rect(c,'#344b53',x,257,4,64);rect(c,'#7c8f8b',x,259,1,60);
      rect(c,'#20343e',x-5,238,14,26);rect(c,'#607477',x-5,238,14,2);
      circle(c,'#bb8e61',x+2,246,3.3);circle(c,'#4a6564',x+2,257,3.3);
      rect(c,'#273943',x-7,241,17,2);rect(c,'#273943',x-7,252,17,2);
    }
    const col=tile('girder',69,324,paintColumn);
    for(let x=70-mod(cam*.85,465);x<w;x+=465)c.drawImage(col,Math.round(x),0);
    rect(c,'#142430',0,0,w,11);rect(c,'#5b7476',0,11,w,3);rect(c,'#273f4c',0,14,w,4);
    for(let x=20-mod(cam*.85,58);x<w;x+=58)rect(c,'#89958a',x,5,2,2);
    c.restore();
  }
  function paintEdge(c){
    rect(c,'#1d313c',0,0,80,92);rect(c,'#e4c57a',0,0,80,6);
    for(let x=2;x<80;x+=6){rect(c,'#aa8a55',x,2,2,2);rect(c,'#ffe5a0',x,2,1,1)}
    rect(c,'#b2b8a4',0,6,80,6);rect(c,'#687e81',0,12,80,3);
    rect(c,'#334e58',0,15,80,77);
    for(let row=0;row<4;row++)for(let x=-40+(row%2)*20;x<80;x+=40){
      const y=18+row*18;rect(c,'#526b70',x+1,y,38,16);
      rect(c,'#637a78',x+1,y,38,1);rect(c,'#405b65',x+1,y+15,38,1);
    }
    rect(c,'#293f49',0,40,80,6);rect(c,'#758583',0,40,80,1);
    rect(c,'#273c47',0,76,80,7);rect(c,'#6a7b7c',0,76,80,1);
  }
  function drawRoad(c,screenX,topY,width,height,worldX=0,kind='ground'){
    if(width<=0||height<=0)return;
    c.save();c.translate(Math.round(screenX),Math.round(topY));c.beginPath();c.rect(0,0,width,height);c.clip();
    if(kind==='ledge'){
      rect(c,'#243d4b',0,0,width,23);rect(c,'#acc1bb',0,0,width,3);rect(c,'#557b86',0,4,width,3);
      for(let x=-mod(worldX,22);x<width;x+=22){
        stroke(c,'#709198',2,[x,18,x+10,9,x+20,18]);rect(c,'#9aaba5',x+2,6,2,2);
      }
      rect(c,'#4b6774',0,18,width,3);rect(c,'#d1a557',0,0,5,5);rect(c,'#d1a557',width-5,0,5,5);
    }else{
      const edge=tile('edge',80,92,paintEdge);
      repeat(c,edge,worldX,0,width);
    }
    c.restore();
  }
  function drawTower(c,screenX,groundY,time=0,raised=false){
    const open=typeof raised==='number'?Math.max(0,Math.min(1,raised)):raised?1:0;
    c.save();c.translate(Math.round(screenX),Math.round(groundY));
    // Exit portal on the far wall. The actual jump target sits in front on the platform.
    rect(c,'#243e48',45,-161,108,151);rect(c,'#78918b',49,-157,100,142);
    rect(c,'#1f343e',55,-138,87,126);
    const glow=c.createLinearGradient(0,-132,0,-18);glow.addColorStop(0,'#f0c98b');glow.addColorStop(1,'#3c5360');
    rect(c,glow,58,-134,80,118);
    for(let i=0;i<8;i++){const w=28+i*7,y=-105+i*12;rect(c,'#566975',98-w/2,y,w,5);rect(c,'#c4b28d',98-w/2,y,w,2)}
    rect(c,'#205a59',46,-167,106,26);rect(c,'#d5dab6',47,-168,104,2);
    label(c,'EXIT  ↑',99,-149,17,'#f5edd0','center');
    // Enamel fare reader, steel cabinet and three moving arms around the contact axle.
    rect(c,'#192e3a',-15,-45,30,45);rect(c,'#6d8588',-12,-40,24,38);
    rect(c,'#9eaeab',-12,-40,5,38);rect(c,'#455e6a',8,-39,4,36);
    poly(c,'#c1c9b6',[-16,-44,-10,-51,10,-51,16,-45,13,-39,-12,-39]);
    rect(c,'#233e46',-8,-48,14,5);rect(c,open?'#a0f5c6':'#ecc878',-5,-47,8,2);
    circle(c,'#1c3340',0,-25,7);
    const angle=-.27+open*Math.PI*.64;
    for(let i=0;i<3;i++){
      const a=angle+i*TAU/3,x=Math.cos(a)*27,y=-25+Math.sin(a)*15;
      stroke(c,'#233947',5,[0,-25,x,y]);stroke(c,'#c6cfbe',2,[0,-26,x,y-1]);
    }
    circle(c,'#8faaa9',0,-25,4);circle(c,'#e1dcb8',-1,-26,1.5);
    rect(c,'#364d57',-49,-87,3,88);rect(c,'#193b43',-82,-97,70,22);
    rect(c,'#92b7a8',-81,-97,68,2);
    label(c,open?'GATE OPEN':'JUMP GATE',-47,-83,9,'#f2e4b4','center');
    c.restore();
  }
  globalThis.Subway=Object.freeze({drawSky,drawRoad,drawTower});
})();
