import sys
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageFont, ImageChops
import numpy as np
W,H=1280,720
ART='/home/claude/in/GS-Fighter-III-Lab-v0_36-Brush-Fighters/fighter-lab/fighter-artwork/'
OUT='/home/claude/work/'
title=Image.open(OUT+'intro0.png').convert('RGB')

def ellipse_mask(w,h,feather):
    y=np.linspace(-1,1,h)[:,None];x=np.linspace(-1,1,w)[None,:]
    r=np.sqrt(x**2+y**2)
    a=np.clip((1-r)/feather,0,1)
    return Image.fromarray((a*255).astype(np.uint8))
def fig(p,h,flip=False):
    im=Image.open(p).convert('RGBA');im=im.crop(im.getbbox());k=h/im.height
    im=im.resize((round(im.width*k),h),Image.LANCZOS)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def spiral(p,size,alpha=.85):
    im=Image.open(p).convert('RGBA');im=im.crop(im.getbbox());im=im.resize((size,round(im.height*size/im.width)),Image.LANCZOS)
    a=np.array(im);a[...,3]=(a[...,3]*alpha).astype(np.uint8);return Image.fromarray(a)
def vignette(img,strength=150):
    y=np.arange(H)[:,None];x=np.arange(W)[None,:]
    v=np.clip(strength*((np.abs(x-W/2)/(W/2))**2.2)+90*(y/H)**3,0,200).astype(np.uint8)
    ov=np.zeros((H,W,4),np.uint8);ov[...,3]=v;return Image.alpha_composite(img,Image.fromarray(ov))
def logo_cut(width):
    box=(300,20,1400,890);lg=title.crop(box).convert('RGBA')
    m=ellipse_mask(lg.width,lg.height,.32);lg.putalpha(m)
    return lg.resize((width,round(lg.height*width/lg.width)),Image.LANCZOS)
def base(dim=.5):
    l=title.crop((0,0,560,941)).resize((W,H),Image.LANCZOS); r=title.crop((1112,0,1672,941)).resize((W,H),Image.LANCZOS)
    g=Image.fromarray(np.tile(np.clip((np.arange(W)-420)/440*255,0,255).astype(np.uint8),(H,1)))
    bg=Image.composite(r,l,g).filter(ImageFilter.GaussianBlur(3))
    return vignette(ImageEnhance.Brightness(bg).enhance(dim).convert('RGBA'),120)
FLIP_NIKA = len(sys.argv)>1 and sys.argv[1]=='flip'

def fighters(bg,h,inset,akx_off=0):
    ak=fig(ART+'akeem-body-brush.png',h,False); nk=fig(ART+'nika-body-brush.png',h,FLIP_NIKA)
    sc=spiral(ART+'spiral-cyan.png',560); sg=spiral(ART+'spiral-gold.png',560)
    bg.alpha_composite(sc,(inset+ak.width//2-280,H-h//2-sc.height//2-40))
    bg.alpha_composite(sg,(W-inset-nk.width//2-280,H-h//2-sg.height//2-40))
    bg.alpha_composite(ak,(inset,H-ak.height+30)); bg.alpha_composite(nk,(W-inset-nk.width,H-nk.height+30))

# GS Fighter III cover
bg=base(.55); fighters(bg,700,10)
lg=logo_cut(640); bg.alpha_composite(lg,((W-lg.width)//2,(H-lg.height)//2+10))
bg.convert('RGB').save(OUT+'gs3-cover.jpg',quality=88)

# Fighter Lab cover
bg=base(.42); fighters(bg,640,60)
lg=logo_cut(470); bg.alpha_composite(lg,((W-lg.width)//2,30))
d=ImageDraw.Draw(bg)
f=ImageFont.truetype('/usr/share/fonts/truetype/inter/InterDisplay-Black.ttf' if False else [p for p in __import__('glob').glob('/usr/share/fonts/**/*Inter*Display*Black*',recursive=True)][0],64)
f2=ImageFont.truetype([p for p in __import__('glob').glob('/usr/share/fonts/**/*Inter*Display*SemiBold*',recursive=True)][0],24)
def ctext(y,t,font,fill,spacing=0):
    w=d.textlength(t,font=font)+spacing*(len(t)-1);x=(W-w)/2
    for ch in t:
        d.text((x+3,y+4),ch,font=font,fill=(0,0,0,200)); d.text((x,y),ch,font=font,fill=fill); x+=d.textlength(ch,font=font)+spacing
ctext(470,'FIGHTER LAB',f,(255,236,200,255),6)
ctext(548,'v0.36 · BRUSH FIGHTERS',f2,(120,230,240,255),4)
bg.convert('RGB').save(OUT+'lab-cover.jpg',quality=88)
