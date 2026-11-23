// Time stamps are measured from the green flag in simulation seconds.
(() => {
  'use strict';
  const rounded = t => Math.round(t*1000)/1000;
  function cross(previous, current, mark, start, dt) {
    if (previous >= mark || current < mark || current <= previous) return null;
    return start + dt*(mark-previous)/(current-previous);
  }
  function sampleLaps(car, previous, current, samples, count, start, dt) {
    const before=car.laps.length;
    while (car.laps.length<count) {
      const t=cross(previous,current,(car.laps.length+1)*samples,start,dt);
      if(t===null)break;
      car.laps.push(t-car.lastCross);car.lastCross=t;
      if(car.laps.length===count)car.finT=t;
    }
    return before<count && car.laps.length===count;
  }
  function rows(entries, ended=false) {
    return [...entries].sort((a,b)=>{
      if(a.total!=null && b.total!=null)return a.total-b.total || a.slot-b.slot;
      if(a.total!=null)return -1;
      if(b.total!=null)return 1;
      return b.progress-a.progress || a.slot-b.slot;
    }).map((e,i)=>({id:e.id,name:e.name,position:i+1,
      status:e.total!=null?'finished':ended?'dnf':'racing',
      total:e.total==null?null:rounded(e.total),laps:e.laps.map(rounded),
      best:e.laps.length?rounded(Math.min(...e.laps)):null}));
  }
  function store(records, result) {
    const list=Array.isArray(records)?records.slice():[];
    const i=result.raceId?list.findIndex(r=>r?.raceId===result.raceId):-1;
    if(i<0)list.push(result);else list[i]=result;
    return list.slice(-300);
  }
  window.GPClassification={cross,sampleLaps,rows,store};
})();
