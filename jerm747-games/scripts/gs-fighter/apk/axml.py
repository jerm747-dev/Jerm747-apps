# Minimal Android binary XML reader/patcher (string pool + start-element attributes).
import struct, sys
def parse(b):
    assert struct.unpack_from('<H',b,0)[0]==3
    off=8; strings=[]; sp=None; res=[]; elems=[]
    while off<len(b):
        t,hs,sz=struct.unpack_from('<HHI',b,off)
        if t==1:
            sc,stc,flags,so,sso=struct.unpack_from('<IIIII',b,off+8); utf8=flags&0x100
            offs=struct.unpack_from('<%dI'%sc,b,off+hs)
            for o in offs:
                p=off+so+o
                if utf8:
                    n=b[p]; p+=2 if n&0x80 else 1
                    l=b[p]; 
                    if l&0x80: l=((l&0x7f)<<8)|b[p+1]; p+=2
                    else: p+=1
                    strings.append((b[p:p+l].decode('utf8'),p,l,'u8'))
                else:
                    l=struct.unpack_from('<H',b,p)[0]; p+=2
                    strings.append((b[p:p+2*l].decode('utf16'),p,l,'u16'))
        elif t==0x180:
            res=list(struct.unpack_from('<%dI'%((sz-8)//4),b,off+8))
        elif t==0x102:
            ns,name,ast,asz,acnt=struct.unpack_from('<iiHHH',b,off+16)
            attrs=[]
            for i in range(acnt):
                a=off+16+ast+i*asz
                ans,an,araw,vsz,_,vt,vd=struct.unpack_from('<iiiHBBI',b,a)
                attrs.append(dict(name=strings[an][0],raw=araw,type=vt,data=vd,pos=a))
            elems.append((strings[name][0],attrs))
        off+=sz
    return strings,elems
if __name__=='__main__':
    b=open(sys.argv[1],'rb').read(); s,e=parse(b)
    for name,attrs in e:
        print(name,{a['name']:(s[a['raw']][0] if a['raw']>=0 else (a['type'],a['data'])) for a in attrs})
