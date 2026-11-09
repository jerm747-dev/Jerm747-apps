/* v150: Tank and Billie, 40 distinct starter drawings each; future target 70. */
(()=>{'use strict';
const data=window.STARTER_150_FRAMES;
window.ARCADE_BASE_FRAMES??={};window.ARCADE_MOTION_FRAMES??={};window.ARCADE_MOTION_SOURCES??={};window.ARCADE_SHEET_HEIGHTS??={};window.Jerm747FighterSets??={};
const contacts={pHigh:1,pMid:2,pLow:3,kHigh:4,kMid:5,kLow:6};
const p=n=>({sheet:'motion',frame:n});
function pose(a,moves,time=0){
 if(a.action==='down')return {sheet:'ko',frame:a.defeatTime>=0?Math.min(5,Math.floor(a.defeatTime/.2)):5};
 if(a.hitAge>=0&&a.hitAge<.3){if(a.hitAge>=.24)return p(33);const offset=a.hitHeight==='low'?31:a.hitHeight==='mid'?29:27;return p(offset+(a.hitAge>=.12?1:0));}
 if(a.attack){const move=a.attack.move,spec=moves[move];if(!spec)return p(0);const t=a.attack.elapsed/spec.duration;if(move==='wave')return p(t<.16||t>=.85?0:8);const n=contacts[move];return p(n===undefined?0:(t>=.32&&t<.7?n:0));}
 if(a.launch>0)return p(a.launchAge<.025?21:22);
 if(a.y<0)return p(a.vy<0?(a.jumpAge<.2?22:23):24);
 if(a.landAge>=0&&a.landAge<.18)return p(a.landAge<.08?25:26);
 if((a.duckAmount||0)>0)return p(a.duckTarget?(a.duckAmount<.5?17:a.duckAmount<1?18:19):20);
 if(a.action==='block'||a.action==='back-block')return p(7);
 if(a.action==='step'||a.action==='backstep'){const start=a.action==='backstep'?15:13;return p(start+(Math.floor((a.gait||0)*2)%2));}
 if(a.movePhase==='start')return p(13+(a.moveAge>=.06?1:0));
 if(a.movePhase==='stop')return p(a.moveAge<.06?14:0);
 if(a.action==='run')return p(11+(Math.floor((a.gait||0)*2)%2));
 return p(9+Math.floor(time*3.2)%2);
}
const seq=(label,frames,sheet='motion')=>({label,frames,sheet});
for(const [id,name,gender]of [['tank','Tank','male'],['billie','Billie','female']]){
 const entry=data[id],frames=entry.frames,ref=entry.referenceHeight;if(frames.length!==40)throw Error(name+' requires 40 starter drawings');const src=`/images/groove-squad/${id}-40/${id}-atlas.png?v=150`;
 window.ARCADE_BASE_FRAMES[id]=frames.slice(0,9);
 for(const type of ['motion','reaction','legs','back']){window.ARCADE_MOTION_FRAMES[id+'-'+type]=frames;window.ARCADE_MOTION_SOURCES[id+'-'+type]=src;window.ARCADE_SHEET_HEIGHTS[id+'-'+type]=ref;}
 window.ARCADE_MOTION_FRAMES[id+'-ko']=frames.slice(34,40);window.ARCADE_MOTION_SOURCES[id+'-ko']=src;window.ARCADE_SHEET_HEIGHTS[id+'-ko']=ref;
 if(window.JERM747_FIGHTER_GENDERS)window.JERM747_FIGHTER_GENDERS[id]=gender;
 const sequences={idle:seq('Ready and breathing',[0,9,10]),run:seq('Alternating run strides',[11,12]),walk:seq('Forward steps',[13,14]),backstep:seq('Backward steps',[15,16]),duck:seq('Lower, crouch, rise',[17,18,19,20]),jump:seq('Prepare, jump, land',[21,22,23,24,25,26]),hitHigh:seq('High impact and recovery',[27,28,33]),hitMid:seq('Middle impact and recovery',[29,30,33]),hitLow:seq('Low impact and recovery',[31,32,33]),block:seq('Standing block',[0,7,0]),wave:seq('Special release',[0,8,0]),fall:seq('Six-drawing starter knockdown',[0,1,2,3,4,5],'ko')};
 for(const [move,n]of Object.entries(contacts))sequences[move]=seq(move+' · starter guard/contact/guard',[0,n,0]);
 window.Jerm747FighterSets[id]={displayName:name,version:150,baseSrc:src,pose,sequences,groundedArt:true,referenceHeight:ref,completedFrames:40,targetFrames:70,starterFallFrames:6};
}
})();
