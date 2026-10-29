(function(root){'use strict';
const source=root.CanopySource||(typeof require!=='undefined'?require('./source-data.js'):null);
const graph=root.CanopyGraph||(typeof require!=='undefined'?require('./graph-data.js'):null);
const curves=root.CanopyCurves||(typeof require!=='undefined'?require('./contour-curves.js'):null);
const C=280,n=source.n,pixel=560/n;
const bytes=s=>typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(s,'base64')):Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const originalAlpha=bytes(source.alpha),runsRaw=bytes(graph.ownerRunsBase64),runs=new DataView(runsRaw.buffer,runsRaw.byteOffset,runsRaw.byteLength);
const owners=new Uint16Array(n*n);
for(let i=0;i<runs.byteLength;i+=8){let start=runs.getUint32(i,true),length=runs.getUint16(i+4,true),id=runs.getUint16(i+6,true);owners.fill(id,start,start+length);}
function random(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
function distanceTo(alpha,inside){
 const d=new Float32Array(n*n);for(let i=0;i<d.length;i++)d[i]=((alpha[i]>127)===inside)?0:1e6;const diag=Math.SQRT2;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y){v=Math.min(v,d[i-n]+1);if(x)v=Math.min(v,d[i-n-1]+diag);if(x<n-1)v=Math.min(v,d[i-n+1]+diag);}d[i]=v;}
 for(let y=n-1;y>=0;y--)for(let x=n-1;x>=0;x--){const i=y*n+x;let v=d[i];if(x<n-1)v=Math.min(v,d[i+1]+1);if(y<n-1){v=Math.min(v,d[i+n]+1);if(x)v=Math.min(v,d[i+n-1]+diag);if(x<n-1)v=Math.min(v,d[i+n+1]+diag);}d[i]=v;}return d;
}
class Heap{constructor(){this.a=[];}push(d,i){const a=this.a;let j=a.length;a.push([d,i]);while(j){let p=(j-1)>>1;if(a[p][0]<=d)break;a[j]=a[p];j=p;}a[j]=[d,i];}pop(){const a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=v[0])break;a[i]=a[c];i=c;}a[i]=v;}return r;}}
function arrivalMap(alpha){
 const arr=new Uint16Array(n*n),heap=new Heap();arr.fill(65535);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let px=(x+.5)*pixel-C,py=(y+.5)*pixel-C,i=y*n+x;if(Math.abs(px)<=12.4&&Math.abs(py)<=12.4&&alpha[i]>127){arr[i]=1;heap.push(1,i);}}
 const ds=[[-1,0,10],[1,0,10],[0,-1,10],[0,1,10],[-1,-1,14],[-1,1,14],[1,-1,14],[1,1,14]];
 while(heap.a.length){const [d,i]=heap.pop();if(d!==arr[i])continue;let x=i%n,y=(i/n)|0;for(const[dx,dy,w]of ds){let xx=x+dx,yy=y+dy;if(xx<0||xx>=n||yy<0||yy>=n)continue;const j=yy*n+xx;if(alpha[j]<40)continue;const nd=d+w;if(nd<arr[j]){arr[j]=nd;heap.push(nd,j);}}}
 let max=0,discarded=0;for(let i=0;i<arr.length;i++){if(alpha[i]>=40){if(arr[i]===65535){alpha[i]=0;arr[i]=0;discarded++;}else max=Math.max(max,arr[i]);}else arr[i]=0;}
 return {arr,max,discarded};
}
function make(seed,config={}){
 const rng=random(seed+712398),alpha=originalAlpha.slice(),selected=new Uint8Array(graph.twigCount+1);
 const density=clamp(Number(config.density??100),70,130),detail=clamp(Number(config.detail??50),0,100);
 const prune=.50-(density-70)/60*.30;
 for(let i=1;i<selected.length;i++)selected[i]=rng()<prune?1:0;
 for(let i=0;i<alpha.length;i++)if(selected[owners[i]])alpha[i]=0;
 let target=Math.round(45+(density-70)/60*45+detail/100*30),added=0;
 const templates=graph.templates.filter(t=>t.length>=12&&t.length<=Math.round(45-detail/100*16));
 const nearby=(x,y)=>{for(let yy=y-4;yy<=y+4;yy++)for(let xx=x-4;xx<=x+4;xx++)if(alpha[yy*n+xx]>=40)return true;return false;};
 function disc(x,y,r){const ix=Math.round(x),iy=Math.round(y),r2=r*r;for(let dy=-Math.ceil(r);dy<=Math.ceil(r);dy++)for(let dx=-Math.ceil(r);dx<=Math.ceil(r);dx++)if(dx*dx+dy*dy<=r2){const xx=ix+dx,yy=iy+dy;if(xx>=0&&xx<n&&yy>=0&&yy<n)alpha[yy*n+xx]=255;}}
 for(let attempt=0;attempt<target*120&&added<target;attempt++){
  const [ax,ay,byte,owner]=graph.candidates[Math.floor(rng()*graph.candidates.length)];if(selected[owner]||alpha[ay*n+ax]<128)continue;
  const tr=templates[Math.floor(rng()*templates.length)];if(!tr||tr.length<10)continue;const tangent=byte*Math.PI/127,ix=Math.min(6,tr.length-1),sourceang=Math.atan2(tr[ix][1],tr[ix][0]),dest=tangent+(rng()<.5?-1:1)*(.8+rng()*1.4),mirror=rng()<.5?-1:1,scale=.85+rng()*.3;
  const ca=Math.cos(-sourceang),sa=Math.sin(-sourceang),cb=Math.cos(dest),sb=Math.sin(dest),pts=[];let valid=true;
  for(let i=0;i<tr.length;i++){let x=tr[i][0],y=tr[i][1],u=(x*ca-y*sa)*scale,v=(x*sa+y*ca)*mirror*scale,xx=Math.round(ax+u*cb-v*sb),yy=Math.round(ay+u*sb+v*cb);if(xx<8||yy<8||xx>=n-8||yy>=n-8||(xx-n/2)**2+(yy-n/2)**2>340**2){valid=false;break;}if(i>=9&&i%2===0&&nearby(xx,yy)){valid=false;break;}pts.push([xx,yy]);}
  if(!valid)continue;for(let i=0;i<pts.length;i++){if(i){let [x0,y0]=pts[i-1],[x1,y1]=pts[i],steps=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)));for(let j=0;j<=steps;j++)disc(x0+(x1-x0)*j/steps,y0+(y1-y0)*j/steps,3.2);}else disc(pts[i][0],pts[i][1],3.2);}added++;
 }
 // Smooth hard cut and new joins in the raster before extracting vector curves.
 const temp=new Uint8Array(alpha.length),filtered=new Uint8Array(alpha.length);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let i=y*n+x;temp[i]=(alpha[i]*2+alpha[y*n+Math.max(0,x-1)]+alpha[y*n+Math.min(n-1,x+1)]+2)>>2;}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){let i=y*n+x;filtered[i]=(temp[i]*2+temp[Math.max(0,y-1)*n+x]+temp[Math.min(n-1,y+1)*n+x]+2)>>2;}
 const {arr,max,discarded}=arrivalMap(filtered);
 const inner=distanceTo(filtered,true),outer=distanceTo(filtered,false),signed=new Float32Array(n*n);for(let i=0;i<signed.length;i++)signed[i]=((filtered[i]>127)?outer[i]-.5:-(inner[i]-.5))*pixel;
 const extended=arr.slice();for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x;if(arr[i]!==0)continue;let best=65535;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let t=arr[(y+dy)*n+x+dx];if(t>0&&t<best)best=t;}if(best<65535)extended[i]=best;}
 return {a:8+rng()*5,b:8+rng()*5,k:.022+rng()*.008,l:.021+rng()*.01,p:rng()*Math.PI*2,q:rng()*Math.PI*2,rotation:Math.floor(rng()*4),mirror:rng()>.5?-1:1,signed,extended,max,added,pruned:selected.reduce((s,v)=>s+v,0),discarded};
}
const cases={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
function warp(x,y,model,shrink,p){
 x*=model.mirror;for(let i=0;i<model.rotation;i++){[x,y]=[-y,x];}
 let r=Math.max(Math.abs(x),Math.abs(y));let coreScale=16/12.4*(1-shrink*smooth(p));let scale=1+(coreScale-1)*(1-smooth((r-12.4)/120)); x*=scale;y*=scale;
 let fade=smooth((r-35)/80);
 x+=fade*model.a*Math.sin(y*model.k+model.p);
 y+=fade*model.b*Math.sin(x*model.l+model.q);
 return {x,y};
}
function contours(model,p,options={},preview=false){
 const stride=preview?2:1,N=(n-1)/stride+1,step=pixel*stride,reach=model.max*p,field=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const src=y*stride*n+x*stride;field[y*N+x]=Math.min(model.signed[src],(reach-(model.extended[src]||65535))*pixel/10);}
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
root.CanopyGraphGrowth={create:make,contours};if(typeof module!=='undefined')module.exports=root.CanopyGraphGrowth;
})(typeof window!=='undefined'?window:globalThis);
