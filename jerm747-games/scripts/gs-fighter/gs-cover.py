# Run from the gs-fighter-2 project folder: python3 gs-cover.py cover.jpg
import sys
from PIL import Image, ImageEnhance
import numpy as np
W,H=1280,720
bg=Image.open('images/groove-squad/level10/arena.png').convert('RGB')
s=max(W/bg.width,H/bg.height);bg=bg.resize((round(bg.width*s),round(bg.height*s)),Image.LANCZOS)
bg=bg.crop(((bg.width-W)//2,(bg.height-H)//2,(bg.width-W)//2+W,(bg.height-H)//2+H))
bg=ImageEnhance.Brightness(bg).enhance(0.62).convert('RGBA')
y=np.arange(H)[:,None];x=np.arange(W)[None,:]
v=np.clip(110*((np.abs(x-W/2)/(W/2))**2)+70*(y/H)**3,0,170).astype(np.uint8)
ov=np.zeros((H,W,4),np.uint8);ov[...,3]=v;bg=Image.alpha_composite(bg,Image.fromarray(ov))
def fig(p,h,flip=False):
  im=Image.open(p).convert('RGBA');im=im.crop(im.getbbox());k=h/im.height;im=im.resize((round(im.width*k),h),Image.LANCZOS)
  return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
st=fig('portraits-hd/static.webp',700);nk=fig('portraits-hd/nika.webp',700,True)
bg.alpha_composite(st,(W//2-60-st.width,H-st.height+40));bg.alpha_composite(nk,(W//2+60,H-nk.height+40))
logo=Image.open('brand/gs-fighter.png').convert('RGBA');logo=logo.crop(logo.getbbox());k=520/logo.width;logo=logo.resize((520,round(logo.height*k)),Image.LANCZOS)
bg.alpha_composite(logo,((W-logo.width)//2,H-logo.height-22))
bg.convert('RGB').save(sys.argv[1],quality=88)
