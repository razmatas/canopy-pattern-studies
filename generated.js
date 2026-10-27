(function(root){'use strict';
const source=root.CanopySource||(typeof require!=='undefined'?require('./source-data.js'):null);
const growth=root.CanopyGraphGrowth||(typeof require!=='undefined'?require('./graph-growth.js'):null);
const C=280,n=source.n,pixel=560/n;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const mix=(a,b,t)=>a+(b-a)*t;const fmt=n=>n.toFixed(2);
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function random(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}}
const cases={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
function path(points, closed = false, detail = 50) {
    if (points.length < 3) return '';
    const lengths=[0];
    for(let i=0;i<points.length;i++) lengths.push(lengths[i]+Math.hypot(points[(i+1)%points.length].x-points[i].x, points[(i+1)%points.length].y-points[i].y));
    const total=lengths.at(-1), n=Math.max(12,Math.ceil(total/mix(3,1.2,clamp(detail/100))));
    let j=0;const pts=[];
    for(let k=0;k<n;k++){
      const d=k*total/n;while(j<points.length-1&&lengths[j+1]<d)j++;
      const t=(d-lengths[j])/(lengths[j+1]-lengths[j]||1),a=points[j],b=points[(j+1)%points.length];pts.push({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});
    }
    // Binomial smoothing (~1.5 artboard units), excluding the square core.
    const filtered=pts.map((p,i)=>{
      const a=pts[(i+n-2)%n],b=pts[(i+n-1)%n],d=pts[(i+1)%n],e=pts[(i+2)%n];
      const m=smooth((Math.max(Math.abs(p.x),Math.abs(p.y))-27)/16);
      return {x:mix(p.x,(a.x+4*b.x+6*p.x+4*d.x+e.x)/16,m),y:mix(p.y,(a.y+4*b.y+6*p.y+4*d.y+e.y)/16,m)};
    });
    const knot=i=>{const a=filtered[(i+n-1)%n],b=filtered[i%n],c=filtered[(i+1)%n];return {x:(a.x+4*b.x+c.x)/6,y:(a.y+4*b.y+c.y)/6};};
    const start=knot(0);let d=`M${fmt(start.x)},${fmt(start.y)}`;
    for(let i=0;i<n;i++){
      const a=filtered[i],b=filtered[(i+1)%n],end=knot(i+1);
      d+=`C${fmt((2*a.x+b.x)/3)},${fmt((2*a.y+b.y)/3)} ${fmt((a.x+2*b.x)/3)},${fmt((a.y+2*b.y)/3)} ${fmt(end.x)},${fmt(end.y)}`;
    }
    return d+'Z';
  }
function build(seed,sourceField){
 const rng=random(seed+19462),sectorCount=6,axes=[];
 for(let i=0;i<sectorCount;i++)axes.push({rotation:Math.floor(rng()*4),mirror:rng()>.5?-1:1});
 function sample(x,y,o){x*=o.mirror;for(let k=0;k<o.rotation;k++)[x,y]=[-y,x];let xx=(x+C)/pixel-.5,yy=(y+C)/pixel-.5;if(xx<0||yy<0||xx>=n-1||yy>=n-1)return -50;let ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy,i=iy*n+ix;return (sourceField[i]*(1-fx)+sourceField[i+1]*fx)*(1-fy)+(sourceField[i+n]*(1-fx)+sourceField[i+n+1]*fx)*fy;}
 let field=new Float32Array(n*n), angleOffset=rng()*6.283;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const px=(x+.5)*pixel-C,py=(y+.5)*pixel-C,r=Math.hypot(px,py),ang=(Math.atan2(py,px)-angleOffset+Math.PI*6)%(Math.PI*2),a=ang/(Math.PI*2)*sectorCount,base=Math.floor(a),frac=a-base;
  // Smoothly interpolate the two source fields near each sector boundary.
  const edge=.24, t=frac<edge?smooth((frac+edge)/(2*edge)):frac>1-edge?smooth((frac-(1-edge))/(2*edge)):0;
  let v=sample(px,py,axes[base]);
  if(frac<edge){const old=sample(px,py,axes[(base+sectorCount-1)%sectorCount]);v=old+(v-old)*t;}
  if(frac>1-edge){const next=sample(px,py,axes[(base+1)%sectorCount]);v=v+(next-v)*t;}
  field[y*n+x]=v;
 }

 // Round the joins between independently assembled source-grown sections.
 for(let pass=0;pass<4;pass++){
   const tmp=field.slice(),out=field.slice();
   for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;tmp[i]=(field[i-1]+2*field[i]+field[i+1])/4;}
   for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;out[i]=(tmp[i-n]+2*tmp[i]+tmp[i+n])/4;}
   field=out;
 }
 // Only connected branch material can grow. Propagate outward through it.
 const dist=new Uint16Array(n*n);dist.fill(65535);
 const heap=[];function push(d,i){let j=heap.length;heap.push([d,i]);while(j){const p=(j-1)>>1;if(heap[p][0]<=d)break;heap[j]=heap[p];j=p;}heap[j]=[d,i];}
 function pop(){const first=heap[0],last=heap.pop();if(heap.length){let j=0;while(j*2+1<heap.length){let c=j*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[j]=heap[c];j=c;}heap[j]=last;}return first;}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const px=(x+.5)*pixel-C,py=(y+.5)*pixel-C,i=y*n+x;if(Math.abs(px)<=12&&Math.abs(py)<=12&&field[i]>0){dist[i]=1;push(1,i);}}
 const moves=[[-1,0,10],[1,0,10],[0,-1,10],[0,1,10],[-1,-1,14],[1,-1,14],[-1,1,14],[1,1,14]];
 while(heap.length){const [d,i]=pop();if(d!==dist[i])continue;const x=i%n,y=Math.floor(i/n);for(const [dx,dy,w]of moves){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const j=yy*n+xx;if(field[j]<=0)continue;const nd=d+w;if(nd<dist[j]){dist[j]=nd;push(nd,j);}}}
 let max=0,inside=0,reached=0;for(let i=0;i<dist.length;i++){if(field[i]>0){inside++;if(dist[i]<65535){reached++;max=Math.max(max,dist[i]);}else field[i]=-50;}}
 // Extend arrival to neighbouring antialiased boundary pixels.
 const extended=dist.slice();for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;if(dist[i]<65535)continue;let best=65535;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)best=Math.min(best,dist[(y+dy)*n+x+dx]);extended[i]=best;}
 return {field,seed,axes,arrival:extended,max,inside,reached};
}
function make(seed,config={}){
 const grown=growth.create(seed,config);
 let best=null;for(let attempt=0;attempt<6;attempt++){const m=build(seed+attempt*104729,grown.signed);if(!best||m.reached/m.inside>best.reached/best.inside)best=m;if(m.reached/m.inside>=.975&&m.max<9500){best=m;break;}}
 best.seed=seed;best.grownCount=grown.added;best.prunedCount=grown.pruned;return best;
}
function warp(x,y,model,shrink,p){
 let r=Math.max(Math.abs(x),Math.abs(y));let coreScale=16/12.4*(1-shrink*smooth(p));let scale=1+(coreScale-1)*(1-smooth((r-12.4)/120)); return {x:x*scale,y:y*scale};
}
function contours(model,p,options={},preview=false){
 const stride=preview?2:1,N=(n-1)/stride+1,step=pixel*stride,reach=model.max*p,field=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const src=y*stride*n+x*stride;field[y*N+x]=Math.min(model.field[src], p>=1?100:(reach-model.arrival[src])*pixel/10);}
 const segments=[],lookup=new Map();
 for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){
 const i=y*N+x,v=[field[i],field[i+1],field[i+N+1],field[i+N]],code=(v[0]>0?1:0)+(v[1]>0?2:0)+(v[2]>0?4:0)+(v[3]>0?8:0);if(!cases[code])continue;
 const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],keys=[i*2,(i+1)*2+1,(i+N)*2,i*2+1];const edge=e=>{let a=corners[e],b=corners[(e+1)%4],f=v[e]/(v[e]-v[(e+1)%4]||1);return {x:(a[0]+(b[0]-a[0])*f)*step+pixel*.5-C,y:(a[1]+(b[1]-a[1])*f)*step+pixel*.5-C,key:keys[e]};};for(const [a,b] of cases[code])segments.push([edge(a),edge(b)]);
 }
 segments.forEach((s,i)=>s.forEach((p,j)=>{if(!lookup.has(p.key))lookup.set(p.key,[]);lookup.get(p.key).push([i,j]);}));const used=new Set(),loops=[];
 for(let i=0;i<segments.length;i++){
 if(used.has(i))continue;used.add(i);const pts=[segments[i][0],segments[i][1]];let cur=pts.at(-1).key,start=pts[0].key;
 while(cur!==start){const next=(lookup.get(cur)||[]).find(([j])=>!used.has(j));if(!next)break;const[j,k]=next;used.add(j);pts.push(segments[j][1-k]);cur=pts.at(-1).key;}
 if(pts.length>8&&cur===start){pts.pop();let smoothed=pts.map((p,j)=>({x:(pts[(j+pts.length-1)%pts.length].x+p.x*2+pts[(j+1)%pts.length].x)/4,y:(pts[(j+pts.length-1)%pts.length].y+p.y*2+pts[(j+1)%pts.length].y)/4}));let outline=smoothed.map(v=>warp(v.x,v.y,model,(options.squareShrink??45)/100,p));if(outline.length>2)loops.push(path(outline,true,options.detail??50));}
 }return loops;
}
root.CanopyGenerated={create:make,contours};if(typeof module!=='undefined')module.exports=root.CanopyGenerated;
})(typeof window!=='undefined'?window:globalThis);
