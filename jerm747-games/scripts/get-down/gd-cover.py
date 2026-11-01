import sys
from PIL import Image
import numpy as np
W,H=1280,720
bg=Image.open('level10/arena.png').convert('RGBA')
s=max(W/bg.width,H/bg.height);bg=bg.resize((round(bg.width*s),round(bg.height*s)),Image.LANCZOS)
bg=bg.crop(((bg.width-W)//2,(bg.height-H)//2,(bg.width-W)//2+W,(bg.height-H)//2+H))
arr=np.zeros((H,W,4),np.uint8);arr[...,3]=np.clip(150*(1-np.arange(H)/380),0,150)[:,None].astype(np.uint8)
bg=Image.alpha_composite(bg,Image.fromarray(arr))
def cell(p,c,r):
  im=Image.open(p).convert('RGBA');cw=im.width//3;t=im.crop((c*cw,r*cw,(c+1)*cw,(r+1)*cw));return t.crop(t.getbbox())
og=cell('level10/og-jerm.png',0,0);jm=cell('level10/jimmy.png',0,0).transpose(Image.FLIP_LEFT_RIGHT)
fh=380
for im,x in ((og,270),(jm,W-270)):
  k=fh/im.height;f=im.resize((round(im.width*k),fh),Image.LANCZOS)
  bg.alpha_composite(f,(x-f.width//2,H-55-fh))
t=Image.open('arcade-motion/get-down-title.png').convert('RGBA');t=t.crop(t.getbbox());k=600/t.width;t=t.resize((600,round(t.height*k)),Image.LANCZOS)
bg.alpha_composite(t,((W-t.width)//2,34))
bg.convert('RGB').save(sys.argv[1],quality=88)
