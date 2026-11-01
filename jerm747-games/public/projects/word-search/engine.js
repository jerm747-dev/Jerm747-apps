export const normalizeWord = word => word.toUpperCase().replace(/[^A-Z]/g,'');
const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

// Grid shapes. Square on wide screens; tall on phones held upright so the letters can be bigger.
// The generator starts at these sizes and grows a row/column at a time until every word fits.
export const SHAPES = {
  square: {15:[10,10],30:[14,14],60:[18,18]},
  tall:   {15:[9,11],30:[11,14],60:[13,20]},
};

// generate(words, random?, shape?) → {n (columns), rows, cells, placements, found, elapsed}
export function generate(words, random = Math.random, shape = null){
 const LETTERS=words.map(normalizeWord), longest=Math.max(...LETTERS.map(w=>w.length));
 let [c0,r0]=shape||SHAPES.square[words.length<=15?15:words.length<=30?30:60]||[18,18];
 if(Math.max(c0,r0)<longest) r0=longest; // the longest word must fit at least one way
 for(let step=0;step<=20;step++){
  const cols=c0+Math.floor(step/2), rows=r0+Math.ceil(step/2);
  for(let attempt=0;attempt<10;attempt++){
   const cells=Array(cols*rows).fill(''),placements=Array(words.length);let ok=true;
   const order=LETTERS.map((w,i)=>({w,i,rand:random()})).sort((a,b)=>b.w.length-a.w.length||a.rand-b.rand);
   for(const {w,i} of order){let best=null,bestScore=-Infinity;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)for(const [dr,dc] of DIRS){
     const er=r+dr*(w.length-1),ec=c+dc*(w.length-1);if(er<0||er>=rows||ec<0||ec>=cols)continue;
     const path=[];let overlap=0,valid=true;
     for(let k=0;k<w.length;k++){const p=(r+dr*k)*cols+c+dc*k;if(cells[p]&&cells[p]!==w[k]){valid=false;break;}if(cells[p])overlap++;path.push(p);}
     if(!valid||overlap===w.length)continue;
     const score=overlap*1.8+random()*4;if(score>bestScore){bestScore=score;best=path;}
    }
    if(!best){ok=false;break;}placements[i]=best;best.forEach((p,k)=>cells[p]=w[k]);
   }
   if(ok){for(let p=0;p<cells.length;p++)if(!cells[p])cells[p]='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(random()*26)];return {n:cols,rows,cells,placements,found:[],elapsed:0};}
  }
 }
 throw Error('Could not arrange the words. Please try again.');
}
// n = number of columns. Returns the straight path from a to b, or [] if a and b don't line up.
export function pathBetween(a,b,n){const ar=Math.floor(a/n),ac=a%n,br=Math.floor(b/n),bc=b%n;const rr=br-ar,cc=bc-ac;if(rr&&cc&&Math.abs(rr)!==Math.abs(cc))return [];const length=Math.max(Math.abs(rr),Math.abs(cc));return Array.from({length:length+1},(_,k)=>(ar+Math.sign(rr)*k)*n+ac+Math.sign(cc)*k);}

export function validPuzzle(s) {
 if(!s||!Array.isArray(s.words)||![15,30,60].includes(s.words.length)||!s.words.every(w=>typeof w==='string'&&normalizeWord(w).length>=2&&normalizeWord(w).length<=24))return false;
 const letters=s.words.map(normalizeWord), rows=s.rows??s.n;
 return new Set(letters).size===letters.length&&Number.isInteger(s.n)&&s.n>=6&&s.n<=44&&Number.isInteger(rows)&&rows>=6&&rows<=60&&Array.isArray(s.cells)&&s.cells.length===s.n*rows&&s.cells.every(c=>/^[A-Z]$/.test(c))&&Array.isArray(s.placements)&&s.placements.length===letters.length&&s.placements.every((p,i)=>Array.isArray(p)&&p.length===letters[i].length&&p.every((v,k)=>Number.isInteger(v)&&v>=0&&v<s.cells.length&&s.cells[v]===letters[i][k])&&JSON.stringify(pathBetween(p[0],p.at(-1),s.n))===JSON.stringify(p))&&Array.isArray(s.found)&&new Set(s.found).size===s.found.length&&s.found.every(i=>Number.isInteger(i)&&i>=0&&i<letters.length)&&Number.isFinite(s.elapsed)&&s.elapsed>=0;
}
