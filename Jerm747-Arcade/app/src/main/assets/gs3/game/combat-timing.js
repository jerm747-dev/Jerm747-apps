/* Shared strike cadence. Times are clip seconds; contact width is real-time scaled. */
(function(){'use strict';
 const ground=['lp','mp','hp','lk','mk','hk','sweep'];
 function contacts(rule,fallback=0){return rule?.contacts?.length?rule.contacts:[rule?.active??fallback];}
 function linkAt(rule,fallback,speed,end=Infinity){const frames=contacts(rule,fallback);return Math.min(end,frames[frames.length-1]+.13*speed);}
 function contactIndex(time,rule,fallback,speed,used){return contacts(rule,fallback).findIndex((at,i)=>!used.has(i)&&time>=at-.06&&time<=at+.13*speed);}
 function damageAt(total,rule,index){const count=contacts(rule).length;return Math.floor(total/count)+(index<total%count?1:0);}
 window.GSFCombatTiming={ground,contacts,linkAt,contactIndex,damageAt,queueLimit:2,queueMaxAge:1000};
})();
