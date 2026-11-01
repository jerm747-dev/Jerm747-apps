from PIL import Image, ImageFilter
import numpy as np
old=np.asarray(Image.open('/home/claude/in/gs2apk/a/assets/brand/gs-fighter.png'))
print('old alpha corners',old[0,0,3],old[512,10,3],old[512,768,3])
logo=Image.open('/mnt/user-data/attachments/31fc3f05-14e7-5fbb-b2c6-785b1a170320/7692ba11-image.png').convert('RGB')
x0,x1,y0,y1=542,1309,172,749; pad=40
crop=logo.crop((x0-pad,y0-pad,x1+pad,y1+pad))
k=min(1500/crop.width,1010/crop.height); crop=crop.resize((round(crop.width*k),round(crop.height*k)),Image.LANCZOS)
c=np.asarray(crop).astype(float)
al=np.clip(c.max(axis=2)/255*1.6,0,1)
rgb=np.clip(c/np.maximum(al[...,None],1e-3),0,255)
fg=Image.fromarray(np.dstack([rgb,al*255]).astype(np.uint8),'RGBA')
sil=Image.fromarray(((c.max(axis=2)>70)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(22))
plate=Image.new('RGBA',crop.size,(4,6,12,0)); plate.putalpha(sil.point(lambda v:int(v*.85)))
out=Image.new('RGBA',(1536,1024),(0,0,0,0)); pos=((1536-crop.width)//2,(1024-crop.height)//2)
out.alpha_composite(plate,pos); out.alpha_composite(fg,pos)
out.save('/home/claude/work/gs-fighter-ii-brand.png',optimize=True)
# preview on checker/purple
pv=Image.new('RGBA',out.size,(90,40,120,255)); pv.alpha_composite(out); pv.convert('RGB').resize((768,512)).save('/home/claude/work/brand-preview.jpg')
