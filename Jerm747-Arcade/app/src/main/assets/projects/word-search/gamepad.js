(() => {
 const pad=window.Jerm747Pad;
 const keys={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',accept:'Enter',back:'Escape'};
 pad.listen(action=>{
   const dialog=document.querySelector('dialog[open]');
   if(dialog){if(action==='back')dialog.close();else pad.menu(pad.controls(dialog),action);return}
   const key=keys[action];
   if(!key){const id={alternate:'hint',tools:'pause-game',previous:'help-button',next:'zoom'}[action];if(id)document.getElementById(id)?.click();return}
   const cell=(document.activeElement?.closest('#grid .cell'))||document.querySelector('#grid .cell[tabindex="0"],#grid .cell');
   if(!cell||document.body.classList.contains('word-paused'))return;
   const selected=document.activeElement?.closest('#grid .cell')||document.querySelector('#grid .cell[tabindex="0"]')||cell;
   selected.focus({preventScroll:true});
   for(const type of ['keydown','keyup']){const event=new KeyboardEvent(type,{key,code:key,bubbles:true,cancelable:true});if(key==='Escape')event.preventDefault();selected.dispatchEvent(event)}
 });
})();