
import {createReward} from '../shared/rewards.js';
const reward=createReward();
const title=document.createElement('dialog');
title.className='game-title-dialog';
title.setAttribute('aria-labelledby','plugin-title-heading');
title.innerHTML='<img src="./cover.png" alt=""><h2 id="plugin-title-heading">Plugin Twist</h2><p>Make room for your next session.</p><button type="button">Play</button>';
document.body.append(title);
const play=()=>{title.close();document.getElementById('again').click();};
title.querySelector('button').onclick=play;
title.addEventListener('cancel',e=>{e.preventDefault();play();});
function showTitle(){
 document.getElementById('overlay').close();
 title.showModal();title.querySelector('button').focus();
}
const back=document.createElement('button');
back.type='button';back.className='secondary';back.textContent='Back to title';back.onclick=showTitle;
document.getElementById('resultContent').append(back);
window.addEventListener('plugin-twist:round-end',({detail})=>{
 if(!detail.completed)return;
 document.getElementById('overlay').close();
 reward.show({
   style:'plugins',game:'Plugin Twist · Level '+detail.puzzle,title:'Session ready!',
   message:'You made room for the music. Your next session is ready to load.',
   stats:detail.score.toLocaleString()+' this level · '+detail.seriesTotal.toLocaleString()+' total',
   nextLabel:'Play level '+(detail.puzzle+1),
   onNext:()=>document.getElementById('again').click(),onTitle:showTitle
 });
});
