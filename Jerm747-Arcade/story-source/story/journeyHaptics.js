import * as zt from "react";
import * as Z from "react/jsx-runtime";
function createJourneyHaptics() {
 const nav=typeof navigator==='undefined'?null:navigator;
 const touch=!!nav&&(nav.maxTouchPoints>0||!!window.matchMedia?.('(pointer: coarse)').matches);
 const available=touch&&typeof nav?.vibrate==='function';
 let enabled=available,last=-Infinity;
 try{if(localStorage.getItem('jerm747-level9-haptics')==='off')enabled=false;}catch{}
 const stop=()=>{if(available)try{nav.vibrate(0);}catch{}};
 return {available,touch,get enabled(){return enabled;},setEnabled(value){enabled=available&&!!value;try{localStorage.setItem('jerm747-level9-haptics',enabled?'on':'off');}catch{}if(!enabled)stop();return enabled;},pulse(kind){if(!enabled||document.hidden||nav.userActivation?.hasBeenActive===false)return false;const now=Date.now();if(now-last<120)return false;try{const success=nav.vibrate(kind==='land'?7:10);if(success)last=now;return !!success;}catch{return false;}},stop};
}
function JourneyHapticButton({controller}) {
 const [enabled,setEnabled]=zt.useState(controller.enabled);
 if(!controller.touch)return null;
 return Z.jsx('button',{type:'button',className:'btn btn-ghost journey-haptic-toggle',disabled:!controller.available,'aria-pressed':enabled,title:controller.available?'Gentle vibration for jumps and landings':'This browser does not offer game vibrations',onClick:()=>{const next=controller.setEnabled(!enabled);setEnabled(next);if(next)controller.pulse('jump');},children:controller.available?`Haptics ${enabled?'on':'off'}`:'Haptics unavailable'});
}
const JOURNEY_SUMMIT_STORY=[
 ['Narrator','The climb falls quiet. Beyond the cherry blossoms, the last light settles over the river. Jerm and Kiana sit together at the summit.'],
 ['Jerm','No matter what happens next, I’m glad the music brought us here.'],
 ['Kiana','Me too. When your songs reached me, you didn’t even know I was listening. Now look at us.'],
 ['Narrator','She rests her head on his shoulder. Their hands meet, and neither rushes to let go. For a moment, there is nothing to prove.'],
 ['Kiana','You’re going to do great, Jerm. Go be yourself. You don’t have to carry their warning with you.'],
 ['Jerm','Thank you for bringing me up here. I needed this.'],
 ['Kiana','Then keep this part with you. Whatever happens down there, you have a place here.']
];
function JourneySummitScene({onFinish}) {
 const [beat,setBeat]=zt.useState(0),next=zt.useRef(null);zt.useEffect(()=>{next.current?.focus()},[beat]);
 const line=JOURNEY_SUMMIT_STORY[beat];
 return Z.jsxs('section',{className:'journey-summit',children:[Z.jsxs('div',{className:'journey-summit-art',children:[Z.jsx('img',{src:'/images/japan/summit-together.png',alt:'Jerm and Kiana sitting hand in hand at a sunset mountain overlook, her head resting on his shoulder above the cherry blossoms.'}),Z.jsx('span',{className:'journey-summit-caption',children:'THE SUMMIT · A PLACE WITH YOU'})]}),Z.jsxs('div',{className:'journey-dialogue journey-summit-dialogue',children:[Z.jsx('span',{children:line[0]}),Z.jsx('p',{'aria-live':'polite',children:line[1]}),Z.jsxs('footer',{children:[Z.jsx('small',{children:`${beat+1} / ${JOURNEY_SUMMIT_STORY.length}`}),Z.jsx('button',{type:'button',className:'btn btn-ghost',onClick:onFinish,children:'Skip scene'}),Z.jsx('button',{type:'button',className:'btn btn-ghost',disabled:beat===0,onClick:()=>setBeat(value=>Math.max(0,value-1)),children:'← Back'}),Z.jsx('button',{type:'button',className:'btn',ref:next,onClick:()=>beat<JOURNEY_SUMMIT_STORY.length-1?setBeat(beat+1):onFinish(),children:beat<JOURNEY_SUMMIT_STORY.length-1?'Continue →':'Keep this moment →'})]})]})]});
}

export {createJourneyHaptics,JourneyHapticButton,JourneySummitScene,JOURNEY_SUMMIT_STORY};
