'use strict';
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const icons = {
 gallery:'<rect x="3" y="4" width="7" height="6" rx="1"/><rect x="14" y="4" width="7" height="6" rx="1"/><rect x="3" y="14" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/>',
 rows:'<rect x="3" y="4" width="5" height="5" rx="1"/><rect x="3" y="15" width="5" height="5" rx="1"/><path d="M11 6.5h10M11 17.5h10"/>',
 home:'<path d="m3 10 9-7 9 7v10H15v-6H9v6H3z"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.7"/><path d="m16 16 5 5"/>',
 live:'<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
 list:'<path d="M6 3.5h12v17L12 17l-6 3.5z"/>',
 user:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-6.8 14.2-6.8 15 0"/>',
 down:'<path d="m6 9 6 6 6-6"/>',left:'<path d="m14.5 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',
 play:'<path fill="currentColor" stroke="none" d="M5.5 3.8a.8.8 0 0 1 1.3-.6l13.3 8.1a.8.8 0 0 1 0 1.4L6.8 20.8a.8.8 0 0 1-1.3-.6z"/>',
 pause:'<path stroke-width="4" d="M8 5v14m8-14v14"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m4 12 5.2 5L20 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
 cc:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10a2.8 2.8 0 1 0 0 4m8-4a2.8 2.8 0 1 0 0 4"/>',
 settings:'<path d="M3 6h7m4 0h7M3 12h2m5 0h11M3 18h10m5 0h3"/><circle cx="12" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
 full:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
 sound:'<path d="M3 9h4l5-4v14l-5-4H3zM15.5 8.5a5 5 0 0 1 0 7m2.7-10a9 9 0 0 1 0 13"/>',
 mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
 back:'<path d="M20 12H4m7-7-7 7 7 7"/>',replay:'<path d="M3 9a9 9 0 1 1 1 9M3 4v5h5"/>',
 star:'<path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.5l6.3-.9z"/>'
};
const icon = name => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
const originals = [
 {id:'block-party-blvd',name:'Block Party Blvd.',first:'Block Party',last:'Blvd.',genre:'Sitcom',blurb:'The whole neighborhood shows up when three friends turn an ordinary Saturday into a block party.',seconds:12,width:1080,file:'master-1080p.mp4',cc:true},
 {id:'hi-top-highway',name:'Hi-Top Highway',first:'Hi-Top',last:'Highway',genre:'Animation',blurb:'Lace up for a fast trip across the city with a skater who knows every shortcut.',seconds:10,width:540,file:'hi-top-highway-540p.mp4'},
 {id:'saturday-fresh',name:'Saturday Fresh',first:'Saturday',last:'Fresh',genre:'Sketch',blurb:'A quick-witted comedy crew takes the stage for sketches and late-night laughs.',seconds:10,width:540,file:'saturday-fresh-540p.mp4'},
 {id:'uptown-cousins',name:'Uptown Cousins',first:'Uptown',last:'Cousins',genre:'Sitcom',blurb:'Two cousins share a couch, a neighborhood, and very different ideas about growing up.',seconds:10,width:540,file:'uptown-cousins-540p.mp4'}
];
const additionalTitles = [
 {id:'midnight-frequency',name:'Midnight Frequency',first:'Midnight',last:'Frequency',genre:'Music video',clipId:'block-party-blvd',blurb:'After the city signs off, a late-night DJ turns the booth into her own music video.'},
 {id:'kickflip-crew',name:'Kickflip Crew',first:'Kickflip',last:'Crew',genre:'Animation',clipId:'hi-top-highway',blurb:'A neighborhood skate crew has one afternoon to land the trick they’ve been chasing all summer.'},
 {id:'mic-check',name:'Mic Check',first:'Mic',last:'Check',genre:'Sketch',clipId:'saturday-fresh',blurb:'Two comics, one microphone, and a roomful of regulars who know all their old material.'},
 {id:'sunday-supper',name:'Sunday Supper',first:'Sunday',last:'Supper',genre:'Sitcom',clipId:'uptown-cousins',blurb:'Three generations gather at Grandma’s table. Everyone brings a dish, and somebody always brings news.'}
];
// Playback uses the original clip. Watchlists and resume positions use each catalog title’s ID.
const clips = new Map(originals.map(title => [title.id, title]));
const titles = [...originals, ...additionalTitles].map(title => {
 const clip = clips.get(title.clipId || title.id);
 return {...title, clip, seconds:clip.seconds, cc:Boolean(clip.cc)};
});
const byId = id => titles.find(t=>t.id===id);
const art = t => 'art/'+t.id+'.webp';
const media = t => 'media/titles/'+t.clip.id+'/';
const navItems = [['home','Home'],['search','Search'],['live','Live TV'],['list','My List']];
const homeGenres = ['All',...new Set(titles.map(t=>t.genre))];
const filters = ['All','Live','On-Demand','Music Videos'];
const storage = {
 get(k, fallback){try {const x=localStorage.getItem('flow.v1.'+k);return x===null?fallback:JSON.parse(x)}catch{return fallback}},
 set(k,v){try{localStorage.setItem('flow.v1.'+k,JSON.stringify(v))}catch{/* The current session still works when persistence is unavailable. */}}
};
let profile = storage.get('profile','Guest');
if(!['Guest','Kia','Jerm'].includes(profile)) profile='Guest';
let prefs = Object.assign({intro:true,cc:false,rate:1,format:'auto',plan:'Free',display:'auto'},storage.get('preferences',{}));
const savePrefs=()=>storage.set('preferences',prefs);
document.documentElement.dataset.display=prefs.display;
const accountData = new Map();
function account(){
 if(!accountData.has(profile)) accountData.set(profile,Object.assign({saved:[],progress:{}},storage.get('account.'+profile,{})));
 return accountData.get(profile);
}
const saveAccount=()=>storage.set('account.'+profile,account());
let featuredId=titles[0].id, genre='All', query='', filter='All';
let lineupView=storage.get('lineupView','grid')==='rows'?'rows':'grid';
const scrolled={};
const defaultRoute={page:'home',sheet:null,item:null,watch:null};
let route={...defaultRoute}, initialized=false;
const focusHistory=new Map();
let positionKey=0;
history.replaceState({flow:route,key:positionKey},'','');
function describeFocus(){const el=document.activeElement;if(!el||!el.dataset)return null;return [...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>'['+a.name+'="'+CSS.escape(a.value)+'"]').join('')||null}
function go(update,replace=false){
 const next={...route,...update};
 if(!replace)focusHistory.set(positionKey,describeFocus());
 positionKey=replace?positionKey:positionKey+1;
 history[replace?'replaceState':'pushState']({flow:next,key:positionKey},'','');
 applyRoute(next);
}
function back(){if(positionKey>0)history.back();else go(defaultRoute,true)}
window.addEventListener('popstate',e=>{positionKey=e.state?.key||0;applyRoute(e.state?.flow||defaultRoute);const sel=focusHistory.get(positionKey);if(sel)requestAnimationFrame(()=>{const root=route.sheet?$('#panel'):route.watch?$('.cinema'):$('#shell');const el=root?.querySelector(sel);if(el?.checkVisibility?.()||el?.getClientRects().length)el.focus({preventScroll:true})})});
function openPage(page){if(route.page===page&&!route.sheet&&!route.watch)return;go({...defaultRoute,page})}
function openSheet(sheet,item=null){go({sheet,item},Boolean(route.sheet))}
function announce(text){$('#announcement').textContent=text}
function artTitle(t){return '<span>'+t.first+'</span>'+(t.id==='block-party-blvd'?'<em>'+t.last+'</em>':t.last)}
function meta(t){
 const separator=' <span aria-hidden="true">·</span> ';
 const parts=[t.genre];
 if(!t.clipId)parts.push('Season 1');
 parts.push(t.clipId?'Sample from '+t.clip.name:t.seconds+'s sample');
 return parts.join(separator)+(t.cc?' <span class="small-tag">CC</span>':'');
}
function button(text,iconName,attrs,kind='secondary'){return '<button class="btn '+kind+'" '+attrs+'>'+icon(iconName)+text+'</button>'}
function iconButton(label,name,attrs){return '<button class="icon-btn" aria-label="'+label+'" title="'+label+'" '+attrs+'>'+icon(name)+'</button>'}
function chip(text,kind,active){return '<button class="chip" data-'+kind+'="'+text+'" aria-pressed="'+(text===active)+'">'+text+'</button>'}
function card(t,selectsSpotlight=false){
 const progress=account().progress[t.id]||0;
 const action=selectsSpotlight
   ? 'data-spotlight="'+t.id+'" aria-pressed="'+(t.id===featuredId)+'" aria-label="Feature '+t.name+', '+t.genre+'"'
   : 'data-details="'+t.id+'" aria-label="'+t.name+', '+t.genre+', details"';
 return '<button class="card" '+action+'><div class="poster"><img class="fallback" src="assets/flow-mark.svg" alt=""><img class="poster-art" src="'+art(t)+'" alt=""><img class="corner-mark" src="assets/flow-mark.svg" alt=""><strong class="poster-title '+t.id+'" aria-hidden="true">'+artTitle(t)+'</strong>'+(progress?'<span class="progress"><i style="width:'+Math.min(100,100*progress/t.seconds)+'%"></i></span>':'')+'</div><div class="card-info"><strong>'+t.name+'</strong><small>'+t.genre+' <span aria-hidden="true">·</span> '+t.seconds+'s sample</small></div></button>';
}
function grid(items,view='grid',selectsSpotlight=false){
 return '<div class="'+(view==='rows'?'program-rows':'grid')+'">'+items.map(t=>card(t,selectsSpotlight)).join('')+'</div>';
}
function viewControl(){
 const rows=lineupView==='rows';
 const label=rows?'Switch to poster grid':'Switch to compact list';
 return '<button class="view-switch" data-switch-view aria-label="'+label+'" title="'+label+'">'+icon(rows?'gallery':'rows')+'</button>';
}
const footer='<footer class="footer"><img src="assets/flow-mark.svg" alt="">Flowtainment</footer>';
function profileHeader(){
 $('#profile-btn').innerHTML='<span class="avatar">'+(profile==='Guest'?icon('user'):profile[0])+'</span><span class="profile-name">'+profile+'</span>'+icon('down');
 $('#profile-btn').setAttribute('aria-label','Profiles and settings, '+profile);
}
function header(){
 $('#nav').innerHTML=navItems.map(([id,name])=>'<button data-page="'+id+'" '+(route.page===id?'aria-current="page"':'')+'>'+icon(id)+'<span>'+name+'</span></button>').join('');
 profileHeader();
}
function lineup(){
 return titles.filter(t=>genre==='All'||t.genre===genre);
}
function hero(t){
 const visible=lineup();
 const position=visible.findIndex(title=>title.id===t.id)+1;
 return '<img class="hero-photo" src="'+art(t)+'" alt=""><img class="watermark" src="assets/flow-mark.svg" alt=""><div class="hero-copy"><span class="eyebrow">In the spotlight</span><h1>'+artTitle(t)+'</h1><div class="meta">'+meta(t)+'</div><p class="hero-desc">'+t.blurb+'</p><div class="actions">'+button(account().progress[t.id]?'Resume':'Play sample','play','data-play="'+t.id+'"','primary')+button('Details','info','data-details="'+t.id+'"')+'</div></div><div class="feature-controls" '+(visible.length===1?'hidden':'')+'><span class="count">'+String(position).padStart(2,'0')+' <i>/ '+String(visible.length).padStart(2,'0')+'</i></span>'+iconButton('Previous spotlight','left','data-feature="-1"')+iconButton('Next spotlight','right','data-feature="1"')+'</div>';
}
function selectSpotlight(id){
 featuredId=id;
 $('.hero').innerHTML=hero(byId(id));
 $$('[data-spotlight]').forEach(card=>card.setAttribute('aria-pressed',card.dataset.spotlight===id));
 announce('In the spotlight, '+byId(id).name);
}
function homeList(){
 const visible=lineup();
 const ongoing=visible.filter(t=>account().progress[t.id]>0);
 return grid(visible,lineupView,true)+(ongoing.length?'<div class="section-head"><h2>Continue watching</h2></div>'+grid(ongoing,lineupView,true):'')+footer;
}
function home(){
 return '<section class="hero" aria-label="Featured program">'+hero(byId(featuredId))+'</section><section class="home-shelf"><div class="shelf-top"><h2>The lineup</h2><div class="lineup-tools"><div class="chips" aria-label="Filter by genre">'+homeGenres.map(g=>chip(g,'genre',genre)).join('')+'</div>'+viewControl()+'</div></div><div class="catalog-scroll">'+homeList()+'</div></section>';
}
function empty(iconName,heading,body,actions=''){return '<div class="empty"><span class="empty-icon">'+icon(iconName)+'</span><h2>'+heading+'</h2><p>'+body+'</p>'+actions+'</div>'}
function searchResults(){
 const term=query.trim().toLowerCase();
 const matches=titles.filter(t=>{
  if(filter==='Live'||(filter==='Music Videos'&&t.genre!=='Music video'))return false;
  return (t.name+' '+t.genre).toLowerCase().includes(term);
 });
 return matches.length?'<p class="result-count">'+matches.length+' program'+(matches.length===1?'':'s')+'</p>'+grid(matches,'rows'):empty('search','No matching programs',filter==='Live'?'No channels are on air in this preview.':'Try a different title or genre.',button('Reset search','replay','data-action="reset-search"'));
}
function pageHtml(){
 if(route.page==='home')return home();
 let s='';
 if(route.page==='search')s='<h1>Search</h1><label class="search-box">'+icon('search')+'<input type="search" id="search-input" placeholder="Search titles or genres" aria-label="Search titles or genres" value="'+esc(query)+'"></label><div class="chips" aria-label="Programming type">'+filters.map(x=>chip(x,'filter',filter)).join('')+'</div><section id="results" aria-live="polite">'+searchResults()+'</section>';
 if(route.page==='list'){const saved=titles.filter(t=>account().saved.includes(t.id));s='<h1>My List</h1><p class="intro-text">Saved programming'+(profile==='Guest'?'':' for '+profile)+'.</p>'+(saved.length?grid(saved):profile==='Guest'?empty('list','Keep your favorites together','Choose a demo profile to save programs on this device.',button('Choose profile','user','data-dialog="profiles"','primary')):empty('list','Your list is empty','Open a program’s details and select Save to My List.',button('Browse the lineup','home','data-page="home"')))}
 if(route.page==='live')s='<h1>Live TV</h1><p class="intro-text">Flowtainment channel guide</p><div class="empty"><span class="flag">Off air</span><h2>No live broadcast</h2><p>Browse the on-demand lineup below.</p></div><div class="section-head"><h2>On demand</h2></div>'+grid(titles);
 return '<section class="page-scroll">'+s+footer+'</section>';
}
function renderPage(){header();$('#page').innerHTML=pageHtml();const el=$('.catalog-scroll,.page-scroll');if(el){const page=route.page;el.scrollTop=scrolled[page]||0;el.addEventListener('scroll',()=>{scrolled[page]=el.scrollTop},{passive:true})}}
function sheetHeader(title){return '<div class="sheet-head"><h2 id="panel-title">'+title+'</h2>'+iconButton('Close','close','data-back')+'</div>'}
function row(text,sub,content,attrs,end='right'){return '<button class="row-button" '+attrs+'>'+content+'<span><strong>'+text+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</span>'+icon(end)+'</button>'}
function selectPref(label,key,value,options){return '<label class="preference"><span>'+label+'</span><select aria-label="'+label+'" data-pref="'+key+'">'+options.map(([v,n])=>'<option value="'+v+'" '+(String(value)===String(v)?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'}
let pendingSave=null;
function panelHtml(){
 const t=byId(route.item),name=route.sheet;
 if(name==='details'&&t){
 const saved=account().saved.includes(t.id);
 return '<div class="detail-cover"><img class="detail-photo" src="'+art(t)+'" alt="">'+iconButton('Close details','close','data-back')+'</div><div class="sheet"><h2 class="detail-title" id="panel-title">'+t.name+'</h2><div class="meta">'+meta(t)+'</div><p>'+t.blurb+'</p><div class="actions">'+button(account().progress[t.id]?'Resume sample':'Play sample','play','data-play="'+t.id+'"','primary')+button(saved?'Saved to My List':'Save to My List',saved?'check':'plus','data-save="'+t.id+'" aria-pressed="'+saved+'"')+'</div><h3>'+(t.genre==='Music video'?'Video sample':'Season 1')+'</h3><button class="episode" data-play="'+t.id+'"><img src="'+art(t)+'" alt=""><span><strong>'+(t.clipId?t.clip.name+' sample':'1. Program sample')+'</strong><small>'+t.seconds+' seconds</small></span>'+icon('play')+'</button></div>';
 }
 if(name==='profiles')return '<div class="sheet">'+sheetHeader('Profiles')+'<p>'+(pendingSave?'Choose a local profile to save this program.':'Choose who’s watching on this device.')+'</p><div>'+['Kia','Jerm','Guest'].map(x=>row(x,x==='Guest'?'Watch without signing in':'Local demo profile','<span class="avatar large">'+(x==='Guest'?icon('user'):x[0])+'</span>','data-profile="'+x+'"',x===profile?'check':'right')).join('')+'</div>'+row('Settings','Playback and account preview',icon('settings'),'data-dialog="settings"')+'</div>';
 if(name==='settings')return '<div class="sheet">'+sheetHeader('Settings')+'<div class="setting-group">'+selectPref('Large-screen layout','display',prefs.display,[['auto','Automatic'],['tv','TV distance']])+selectPref('Play Flowtainment intro','intro',prefs.intro,[['true','On'],['false','Off']])+selectPref('English captions','cc',prefs.cc,[['false','Off'],['true','On when available']])+selectPref('Playback speed','rate',prefs.rate,[[.75,'0.75×'],[1,'Normal'],[1.25,'1.25×'],[1.5,'1.5×'],[2,'2×']])+'</div>'+row('Welcome screen','Preview the entry experience',icon('home'),'data-dialog="welcome"')+row('Membership plans',prefs.plan+' · preview only',icon('star'),'data-dialog="plans"')+'</div>';
 if(name==='welcome')return '<div class="wall"><div>'+titles.map(x=>'<img src="'+art(x)+'" alt="">').join('')+'</div></div><div class="sheet">'+sheetHeader('Welcome to Flowtainment')+'<p>Browse ’90s-inspired television and play the collection.</p>'+button('Continue as guest','play','data-profile="Guest"','primary')+button('Sign in · demo profiles','user','data-dialog="profiles"')+button('Sign up · preview plans','list','data-dialog="plans"')+'</div>';
 if(name==='plans')return '<div class="sheet">'+sheetHeader('Membership plans')+'<p>Preview a plan on this device. Guests can play every sample.</p><div>'+['Free','Supporter','VIP'].map(x=>row(x,'Preview selection',icon('star'),'data-plan="'+x+'"',x===prefs.plan?'check':'right')).join('')+'</div></div>';
 if(name==='play-settings'||name==='captions')return playbackPanel(name);
 return '';
}
function renderSheet(){
 const d=$('#panel');
 if(!route.sheet){if(d.open)d.close();return}
 d.scrollTop=0;$('#panel-body').innerHTML=panelHtml();if(!d.open)d.showModal();
 const auto=route.sheet==='profiles'?$('#panel [data-profile="Kia"]'):null;
 (auto||$('#panel [data-back]')||$('#panel button'))?.focus({preventScroll:true});
}
function applyRoute(next){
 const previous=route;
 if(initialized&&previous.page!==next.page){const old=$('.catalog-scroll,.page-scroll');if(old)scrolled[previous.page]=old.scrollTop}
 route=next;
 if(previous.watch!==route.watch&&previous.watch)stopWatch();
 if(route.sheet!=='profiles')pendingSave=null;
 if(!initialized||previous.page!==route.page||previous.watch!==route.watch){renderPage();if(previous.page!==route.page)$('#nav [aria-current="page"]')?.focus({preventScroll:true})}
 if(previous.watch!==route.watch&&route.watch)startWatch(byId(route.watch));
 if(!initialized||route.sheet!==previous.sheet||route.item!==previous.item||route.watch!==previous.watch)renderSheet();
 $('#shell').inert=Boolean(route.watch);document.title=(route.watch?byId(route.watch).name:navItems.find(x=>x[0]===route.page)[1])+' · Flowtainment';initialized=true;
}
function saveTitle(id){
 if(profile==='Guest'){pendingSave=id;go({sheet:'profiles',item:null});return}
 const ids=account().saved;account().saved=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];saveAccount();renderPage();renderSheet();$('#panel [data-save]')?.focus({preventScroll:true});announce(account().saved.includes(id)?'Program saved':'Program removed');
}
function selectProfile(value){
 profile=value;storage.set('profile',value);
 if(pendingSave&&value!=='Guest'&&!account().saved.includes(pendingSave)){account().saved.push(pendingSave);saveAccount();announce('Program saved for '+value)}
 pendingSave=null;renderPage();back();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 const d=b.dataset;
 if(d.page)openPage(d.page);
 else if(d.spotlight)selectSpotlight(d.spotlight);
 else if(d.feature){
  const visible=lineup();
  const index=visible.findIndex(t=>t.id===featuredId);
  selectSpotlight(visible[(index+Number(d.feature)+visible.length)%visible.length].id);
  $('.hero [data-feature="'+d.feature+'"]').focus({preventScroll:true});
 }
 else if(d.genre){
  genre=d.genre;
  const visible=lineup();
  if(!visible.some(t=>t.id===featuredId))featuredId=visible[0].id;
  $$('[data-genre]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.genre===genre));
  $('.catalog-scroll').innerHTML=homeList();
  $('.catalog-scroll').scrollTop=0;
  selectSpotlight(featuredId);
 }
 else if('switchView' in d){
  lineupView=lineupView==='rows'?'grid':'rows';
  storage.set('lineupView',lineupView);
  $('.catalog-scroll').innerHTML=homeList();
  $('.catalog-scroll').scrollTop=0;
  b.outerHTML=viewControl();
  $('[data-switch-view]').focus({preventScroll:true});
  announce(lineupView==='rows'?'Compact list':'Poster grid');
 }
 else if(d.details)openSheet('details',d.details);
 else if(d.play)go({sheet:null,item:null,watch:d.play});
 else if('back' in d)back();
 else if(d.dialog)openSheet(d.dialog);
 else if(d.profile)selectProfile(d.profile);
 else if(d.save)saveTitle(d.save);
 else if(d.filter){filter=d.filter;$$('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.filter===filter));$('#results').innerHTML=searchResults()}
 else if(d.action==='reset-search'){query='';filter='All';renderPage();$('#search-input').focus()}
 else if(d.plan){prefs.plan=d.plan;savePrefs();renderSheet();$('#panel [data-plan="'+d.plan+'"]').focus();announce(d.plan+' selected for preview')}
});
document.addEventListener('input',e=>{if(e.target.id==='search-input'){query=e.target.value;$('#results').innerHTML=searchResults()}});
document.addEventListener('change',e=>{
 const key=e.target.dataset.pref;if(!key)return;
 const val=e.target.value;
 prefs[key]=['intro','cc'].includes(key)?val==='true':key==='rate'?Number(val):val;savePrefs();
 if(key==='display')document.documentElement.dataset.display=val;
 if(route.watch)changePlaybackPref(key);
});
$('#panel').addEventListener('cancel',e=>{e.preventDefault();back()});
$('#panel').addEventListener('click',e=>{if(e.target!==$('#panel'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)back()});
document.addEventListener('error',e=>{if(e.target.matches?.('.poster-art,.hero-photo,.detail-photo'))e.target.hidden=true},true);
function moveFocus(key){
 const scope=route.sheet?$('#panel'):route.watch?$('.cinema'):$('#shell');
 const elements=$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',scope).filter(el=>el.getClientRects().length);
 const current=document.activeElement;
 if(!elements.includes(current)){elements[0]?.focus();return}
 const rect=current.getBoundingClientRect(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
 const horizontal=['ArrowLeft','ArrowRight'].includes(key),sign=['ArrowLeft','ArrowUp'].includes(key)?-1:1;
 const candidates=elements.filter(el=>el!==current).map(el=>{const r=el.getBoundingClientRect(),dx=r.x+r.width/2-cx,dy=r.y+r.height/2-cy;
 const axis=sign*(horizontal?dx:dy),cross=Math.abs(horizontal?dy:dx);
 const overlap=horizontal?Math.min(rect.bottom,r.bottom)-Math.max(rect.top,r.top):Math.min(rect.right,r.right)-Math.max(rect.left,r.left);
 return {el,axis,score:axis+cross*3+(overlap<=0?110:0)};
 }).filter(c=>c.axis>2).sort((a,b)=>a.score-b.score);
 if(candidates[0]){candidates[0].el.focus({preventScroll:true});candidates[0].el.scrollIntoView({block:'nearest',inline:'nearest'})}
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&route.sheet)return;
 if((e.key==='Escape'||e.key==='BrowserBack'||e.key==='GoBack'||e.key==='Backspace')&&!e.target.matches('input,textarea')&&(route.watch||route.sheet||route.page!=='home')){e.preventDefault();back();return}
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
 const target=e.target;
 if(target.matches('select')||(target.matches('input')&&['ArrowLeft','ArrowRight'].includes(e.key)))return;
 e.preventDefault();if(route.watch)wakeControls();moveFocus(e.key);
});
applyRoute(route);
