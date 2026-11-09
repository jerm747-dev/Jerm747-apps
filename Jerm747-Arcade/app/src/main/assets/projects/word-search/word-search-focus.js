(()=>{if(document.body.dataset.puzzleFocusInstalled)return;
const $=id=>document.getElementById(id);
if(!document.querySelector('.app')||!$('help')||!$('zoom'))return;
document.body.dataset.puzzleFocusInstalled='1';
const helpContent=$('help').querySelector('div');
if(!document.querySelector('.help-regular-copy')){const regular=document.createElement('span');regular.className='help-regular-copy';for(const node of [...helpContent.childNodes])if(!(node.nodeType===1&&node.classList.contains("help-heading")))regular.append(node);helpContent.append(regular);const focus=document.createElement('span');focus.className='help-focus-copy';focus.hidden=true;focus.textContent='Drag in a straight line across a word, or tap its first and last letters. Words run horizontally, vertically or diagonally, forward or backward. Arrow keys move; Enter or Space selects. Escape or ✕ returns to the regular view.';helpContent.append(focus);}
// Focus only changes layout. The board, found words and timer remain live.
let puzzleFocus = false, focusHelpWasHidden = false, focusPanWas = false;
const focusApp = document.querySelector('.app'), focusHelp = $('help');
const focusHelpParent = focusHelp.parentNode, focusHelpNext = focusHelp.nextSibling;
const focusBar = document.createElement('div');
focusBar.className = 'focus-bar'; focusBar.hidden = true;
focusBar.innerHTML = '<button type="button" id="focus-how" aria-controls="help" aria-expanded="false">How to play</button><button type="button" id="exit-focus" aria-label="Exit expanded puzzle">✕</button>';
focusApp.prepend(focusBar);
function setPuzzleFocus(expanded) {
 if (expanded === puzzleFocus) return;
 puzzleFocus = expanded;
 document.body.classList.toggle('puzzle-focus', expanded);
 focusBar.hidden = !expanded;
 $('zoom').setAttribute('aria-pressed', String(expanded));
 if (expanded) {
  focusHelpWasHidden = focusHelp.hidden;
  focusPanWas = pan; pan = false; grid.style.touchAction = "none";
  document.querySelector(".help-regular-copy").hidden = true;
  document.querySelector(".help-focus-copy").hidden = false;
  focusApp.insertBefore(focusHelp, document.querySelector('.content'));
  focusHelp.hidden = true;
  $('focus-how').setAttribute('aria-expanded','false');
  $('exit-focus').focus();
 } else {
  focusHelpParent.insertBefore(focusHelp, focusHelpNext);
  focusHelp.hidden = focusHelpWasHidden;
  pan = focusPanWas; grid.style.touchAction = pan ? "pan-x pan-y" : "none";
  document.querySelector(".help-regular-copy").hidden = false;
  document.querySelector(".help-focus-copy").hidden = true;
  $('zoom').focus();
 }
 if (window.parent !== window) window.parent.postMessage({type:'jerm747-word-search-focus',expanded},location.origin);
}
$('zoom').textContent = 'Expand puzzle';
$('zoom').onclick = () => setPuzzleFocus(true);
$('exit-focus').onclick = () => setPuzzleFocus(false);
$('focus-how').onclick = () => { focusHelp.hidden = !focusHelp.hidden; $('focus-how').setAttribute('aria-expanded',String(!focusHelp.hidden)); };
$('hide-help').onclick = () => {
 focusHelp.hidden = true;
 if (puzzleFocus) { $('focus-how').setAttribute('aria-expanded','false'); $('focus-how').focus(); }
 else $('hint').focus();
};
window.addEventListener('message',event=>{
 if(event.origin===location.origin && event.source===window.parent && event.data?.type==='jerm747-word-search-focus-request') setPuzzleFocus(event.data.expanded === true);
});
window.addEventListener('keydown',event=>{
 if(event.key==='Escape' && puzzleFocus){event.preventDefault();event.stopImmediatePropagation();setPuzzleFocus(false);}
},true);

})();
