/* v158: approved replacement slots; preserves legacy save/stat IDs. */
(()=>{'use strict';
const aliases={"major": "unk-major", "cyon": "ronnie", "sheila": "unk-engineer", "rayburn": "unk-supporter", "tank": "dee-dee", "billie": "angela"};
for(const [from,to]of Object.entries(aliases)){
 const set=window.Jerm747FighterSets[from];if(!set)throw Error('Missing replacement '+from);
 for(const registry of ['ARCADE_MOTION_FRAMES','ARCADE_MOTION_SOURCES','ARCADE_SHEET_HEIGHTS','ARCADE_SPRITE_MASKS']){
  const map=window[registry]||{};for(const k of Object.keys(map))if(k.startsWith(to+'-'))delete map[k];
  for(const k of Object.keys(map))if(k.startsWith(from+'-')){map[to+k.slice(from.length)]=map[k];delete map[k];}
 }
 window.ARCADE_BASE_FRAMES[to]=window.ARCADE_BASE_FRAMES[from];delete window.ARCADE_BASE_FRAMES[from];
 window.Jerm747FighterSets[to]={...set,version:158};delete window.Jerm747FighterSets[from];
 delete window.JERM747_FIGHTER_GENDERS[from];
}
Object.assign(window.JERM747_FIGHTER_GENDERS,{"mama-love": "female", "pg": "male", "ronnie": "male", "unk-major": "male", "unk-engineer": "female", "unk-supporter": "male", "john-henry": "male", "chaundra": "male", "wornitha": "female", "dee-dee": "male", "angela": "female", "neese": "female", "kay": "male", "nitabug": "female"});
window.JERM747_REPLACEMENT_ALIASES=aliases;
})();
