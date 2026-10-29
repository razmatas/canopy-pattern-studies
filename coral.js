(function(root){'use strict';
const source=root.CanopySource||(typeof require!=='undefined'?require('./source-data.js'):null);
const curves=root.CanopyCurves||(typeof require!=='undefined'?require('./contour-curves.js'):null);
const C=280,n=source.n,pixel=560/n;
const bytes=s=>typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(s,'base64')):Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const alpha=bytes(source.alpha);
const arrbytes=bytes(source.arrival);
const arrival=new Uint16Array(arrbytes.buffer);
// Signed chamfer distance in source grid pixels. The alpha mask has real
// antialiasing at its edge; distance supplies a stable small morphology range.
function distanceTo(inside){
 const d=new Float32Array(n*n);for(let i=0;i<d.length;i++)d[i]=((alpha[i]>127)===inside)?0:1e6;
 const diag=Math.SQRT2;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y){v=Math.min(v,d[i-n]+1);if(x)v=Math.min(v,d[i-n-1]+diag);if(x<n-1)v=Math.min(v,d[i-n+1]+diag);}d[i]=v;}
 for(let y=n-1;y>=0;y--)for(let x=n-1;x>=0;x--){const i=y*n+x;let v=d[i];if(x<n-1)v=Math.min(v,d[i+1]+1);if(y<n-1){v=Math.min(v,d[i+n]+1);if(x)v=Math.min(v,d[i+n-1]+diag);if(x<n-1)v=Math.min(v,d[i+n+1]+diag);}d[i]=v;}return d;
}
const innerDist=distanceTo(true),outerDist=distanceTo(false),signed=new Float32Array(n*n);for(let i=0;i<signed.length;i++)signed[i]=((alpha[i]>127)?outerDist[i]-.5:-(innerDist[i]-.5))*pixel;
// Extend reveal times one pixel outside the mask, so widened branches only
// appear when the neighbouring original branch has actually grown.
const extendedArrival=arrival.slice();
for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;if(arrival[i]!==0)continue;let best=65535;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let t=arrival[(y+dy)*n+x+dx];if(t>0&&t<best)best=t;}if(best<65535)extendedArrival[i]=best;}
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function random(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}}
const cases={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
function make(seed){const rng=random(seed+19462);return {a:8+rng()*5,b:8+rng()*5,k:0.022+rng()*.008,l:.021+rng()*.01,p:rng()*Math.PI*2,q:rng()*Math.PI*2,r:rng()*Math.PI*2,rotation:Math.floor(rng()*4),mirror:rng()>.5?-1:1};}
function warp(x,y,model,shrink,p){
 x*=model.mirror;for(let i=0;i<model.rotation;i++){[x,y]=[-y,x];}
 let r=Math.max(Math.abs(x),Math.abs(y));let coreScale=16/12.4*(1-shrink*smooth(p));let scale=1+(coreScale-1)*(1-smooth((r-12.4)/120)); x*=scale;y*=scale;
 let fade=smooth((r-35)/80);
 x+=fade*model.a*Math.sin(y*model.k+model.p);
 y+=fade*model.b*Math.sin(x*model.l+model.q);
 return {x,y};
}
function contours(model,p,options={},preview=false){
 const stride=preview?2:1,N=(n-1)/stride+1,step=pixel*stride,reach=source.max*p,field=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const src=y*stride*n+x*stride;field[y*N+x]=Math.min(signed[src]+((options.density??100)-100)/30*.4,(reach-(extendedArrival[src]||65535))*pixel/10);}
 const segments=[],lookup=new Map();
 for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){
 const i=y*N+x,v=[field[i],field[i+1],field[i+N+1],field[i+N]],code=(v[0]>0?1:0)+(v[1]>0?2:0)+(v[2]>0?4:0)+(v[3]>0?8:0);if(!cases[code])continue;
 const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],keys=[i*2,(i+1)*2+1,(i+N)*2,i*2+1];const edge=e=>{let a=corners[e],b=corners[(e+1)%4],f=v[e]/(v[e]-v[(e+1)%4]||1);return {x:(a[0]+(b[0]-a[0])*f)*step+pixel*.5-C,y:(a[1]+(b[1]-a[1])*f)*step+pixel*.5-C,key:keys[e]};};for(const [a,b] of cases[code])segments.push([edge(a),edge(b)]);
 }
 segments.forEach((s,i)=>s.forEach((p,j)=>{if(!lookup.has(p.key))lookup.set(p.key,[]);lookup.get(p.key).push([i,j]);}));const used=new Set(),loops=[];
 for(let i=0;i<segments.length;i++){
 if(used.has(i))continue;used.add(i);const pts=[segments[i][0],segments[i][1]];let cur=pts.at(-1).key,start=pts[0].key;
 while(cur!==start){const next=(lookup.get(cur)||[]).find(([j])=>!used.has(j));if(!next)break;const[j,k]=next;used.add(j);pts.push(segments[j][1-k]);cur=pts.at(-1).key;}
 if(pts.length>8&&cur===start){pts.pop();let smoothed=pts.map((p,j)=>({x:(pts[(j+pts.length-1)%pts.length].x+p.x*2+pts[(j+1)%pts.length].x)/4,y:(pts[(j+pts.length-1)%pts.length].y+p.y*2+pts[(j+1)%pts.length].y)/4}));let outline=smoothed.map(v=>warp(v.x,v.y,model,(options.squareShrink??45)/100,p));if(outline.length>2)loops.push(curves.path(outline,options.detail??50,16*(1-(options.squareShrink??45)/100*smooth(p))));}
 }return loops;
}
root.CanopyCoral={create:make,contours};if(typeof module!=='undefined')module.exports=root.CanopyCoral;
})(typeof window!=='undefined'?window:globalThis);
