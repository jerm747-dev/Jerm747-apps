from PIL import Image, ImageFilter
import numpy as np
cov=Image.open('/home/claude/in/21e57de9-jerm747-games-source-7/jerm747-games/public/projects/gs-fighter-2/cover.jpg').convert('RGBA')
logo=Image.open('/mnt/user-data/attachments/31fc3f05-14e7-5fbb-b2c6-785b1a170320/7692ba11-image.png').convert('RGB')
a=np.asarray(logo).astype(float)
lum=a.max(axis=2)
ys,xs=np.where(lum>40); print(xs.min(),xs.max(),ys.min(),ys.max())
x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
pad=70
crop=logo.crop((x0-pad,y0-pad,x1+pad,y1+pad))
TW=640
k=TW/crop.width; crop=crop.resize((TW,round(crop.height*k)),Image.LANCZOS)
c=np.asarray(crop).astype(float)
# alpha from brightness (unpremultiply black), sharp logo layer
al=np.clip(c.max(axis=2)/255*1.6,0,1)
rgb=np.clip(c/np.maximum(al[...,None],1e-3),0,255)
fg=Image.fromarray(np.dstack([rgb,al*255]).astype(np.uint8),'RGBA')
# dark plate: dilated, blurred silhouette to hide the old logo underneath
sil=Image.fromarray(((c.max(axis=2)>70)*255).astype(np.uint8))
sil=sil.filter(ImageFilter.MaxFilter(61)).filter(ImageFilter.GaussianBlur(14))
plate=Image.new('RGBA',crop.size,(6,6,12,0)); plate.putalpha(sil.point(lambda v:min(255,int(v*1.0))))
cx,cy=642,510
pos=(cx-TW//2,cy-crop.height//2)
print(pos,crop.size)
cov.alpha_composite(plate,pos); cov.alpha_composite(fg,pos)
cov.convert('RGB').save('/home/claude/work/gs2-cover.jpg',quality=88)
