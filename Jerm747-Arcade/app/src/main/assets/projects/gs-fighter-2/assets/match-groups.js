(function(global){'use strict';
const valid=x=>x==='male'||x==='female';
function compatible(labels,a,b){return valid(labels[a])&&labels[a]===labels[b];}
function opponent(labels,fighter,current,pool){if(compatible(labels,fighter,current)&&pool.includes(current))return current;return pool.find(id=>id!==fighter&&compatible(labels,fighter,id))||(pool.includes(fighter)&&valid(labels[fighter])?fighter:null);}
function create(seed,onChange=()=>{}){let labels={...seed},ready=false,source='defaults',pending=null;
async function refresh(){ready=true;source='local';onChange();return labels;}
return{refresh,compatible:(a,b)=>compatible(labels,a,b),opponent:(fighter,current,pool)=>opponent(labels,fighter,current,pool),gender:id=>labels[id],get ready(){return ready},get source(){return source}};
}
global.Jerm747MatchGroups={create,compatible,opponent};if(typeof module!=='undefined')module.exports={create,compatible,opponent};
})(typeof window==='undefined'?globalThis:window);
