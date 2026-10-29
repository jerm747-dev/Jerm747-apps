export function adjacent(e,t){return Math.abs(Math.floor(e/6)-Math.floor(t/6))+Math.abs(e%6-t%6)===1}export function matches(e){let t=new Set;for(let a=0;a<6;a++)for(let r=0;r<6;r++){let i=a*6+r;if(e[i]!=null){if(r<4&&e[i]===e[i+1]&&e[i]===e[i+2]){let o=r;for(;o<6&&e[a*6+o]===e[i];)t.add(a*6+o++)}if(a<4&&e[i]===e[i+6]&&e[i]===e[i+12]){let o=a;for(;o<6&&e[o*6+r]===e[i];)t.add(o++*6+r)}}}return[...t]}export function swapped(e,t,a){let r=[...e];return[r[t],r[a]]=[r[a],r[t]],r}export function validSwap(e,t,a){if(!adjacent(t,a))return!1;let r=matches(swapped(e,t,a));return r.includes(t)||r.includes(a)}export function hasMove(e){return e.some((t,a)=>a%6<5&&validSwap(e,a,a+1)||a<30&&validSwap(e,a,a+6))}export function refill(e,t,a=Math.random){let r=[...e],i=new Set(t);for(let o=0;o<6;o++){let l=[];for(let n=5;n>=0;n--)i.has(n*6+o)||l.push(e[n*6+o]);for(let n=5;n>=0;n--)r[n*6+o]=l.length?l.shift():Math.floor(a()*6)}return r}export function newBoard(e=Math.random){for(let a=0;a<100;a++){let r=[];for(let i=0;i<36;i++){let o=Array.from({length:6},(l,n)=>n).filter(l=>!(i%6>=2&&r[i-1]===l&&r[i-2]===l)&&!(i>=12&&r[i-6]===l&&r[i-12]===l));r.push(o[Math.floor(e()*o.length)])}if(hasMove(r))return r}let t=Array.from({length:36},(a,r)=>(Math.floor(r/6)+r%6)%6);return t[0]=0,t[1]=1,t[2]=0,t[7]=0,t}export function neighbor(e,t){return t==="left"?e%6?e-1:null:t==="right"?e%6<5?e+1:null:t==="up"?e>=6?e-6:null:e<30?e+6:null}
export const START_MOVES=20;
export function outcome(score,moves){return moves===0?"won":"play";}

// Match the existing refill order, while retaining each surviving tile's origin.
export function refillWithMotion(board, removed, random = Math.random) {
 const gone=new Set(removed),next=[...board],drops=Array(36).fill(null);
 for(let col=0;col<6;col++){
  const kept=[];for(let row=5;row>=0;row--)if(!gone.has(row*6+col))kept.push({type:board[row*6+col],row});
  const holes=6-kept.length;
  for(let row=5;row>=0;row--){
   const tile=kept.shift();const from=tile?tile.row:row-holes;
   next[row*6+col]=tile?tile.type:Math.floor(random()*6);
   drops[row*6+col]={distance:row-from,fresh:!tile};
  }
 }
 return {board:next,drops};
}
