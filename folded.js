/* The original square-core folded study, restored unchanged from revision 09. */
(function(root){'use strict';
  const TAU=Math.PI*2;
  function random(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const fmt=n=>n.toFixed(2);
  // Fair the outline over a fixed physical distance, so small numerical kinks
  // disappear without washing out the larger organic folds. A periodic cubic
  // B-spline gives continuously changing curvature and avoids tip overshoot.
  function foldPath(points,core) {
    const n=points.length;
    let perimeter=0;
    for(let i=0;i<n;i++)perimeter+=Math.hypot(points[i].x-points[(i+1)%n].x,points[i].y-points[(i+1)%n].y);
    const sigma=2/(perimeter/n),radius=Math.min(24,Math.ceil(sigma*2.5));
    const weights=Array.from({length:radius*2+1},(_,i)=>Math.exp(-.5*((i-radius)/sigma)**2));
    const sum=weights.reduce((a,b)=>a+b,0);
    const pts=points.map((p,i)=>{
      // Keep the original square's corners crisp while they remain anchored.
      if(Math.abs(p.x)<=core+.01&&Math.abs(p.y)<=core+.01)return p;
      let x=0,y=0;
      for(let j=-radius;j<=radius;j++){const q=points[(i+j+n)%n],w=weights[j+radius];x+=q.x*w;y+=q.y*w;}
      return {x:x/sum,y:y/sum};
    });
    const knot=i=>{const a=pts[(i+n-1)%n],b=pts[i%n],c=pts[(i+1)%n];return {x:(a.x+4*b.x+c.x)/6,y:(a.y+4*b.y+c.y)/6};};
    const start=knot(0);let d=`M${fmt(start.x)},${fmt(start.y)}`;
    for(let i=0;i<n;i++){
      const a=pts[i],b=pts[(i+1)%n],end=knot(i+1);
      d+=`C${fmt((2*a.x+b.x)/3)},${fmt((2*a.y+b.y)/3)} ${fmt((a.x+2*b.x)/3)},${fmt((a.y+2*b.y)/3)} ${fmt(end.x)},${fmt(end.y)}`;
    }
    return d+'Z';
  }
  function makeFolds(seed,config) {
    const rng=random(seed+9123), points=[];
    // Equally spaced points on an exact square; no circular origin.
    for(let side=0;side<4;side++) for(let i=0;i<10;i++) {
      const t=i/10, corners=[[-23,-23],[23,-23],[23,23],[-23,23]],a=corners[side],b=corners[(side+1)%4];
      points.push({x:mix(a[0],b[0],t),y:mix(a[1],b[1],t),p:rng()*TAU,u:side+t});
    }
    // Spatially coherent variation gives neighbouring folds different scales.
    // It fades in after the first growth, preserving the established square start.
    const phase=(seed%997)*.017;
    function localScale(x,y){return 12+2.8*Math.sin(x*.024+y*.013+phase)*Math.cos(y*.029-phase)+1.2*Math.sin(x*.064-y*.041+phase*.7);}
    let pts=points;const frames=[pts.map(p=>({...p}))];
    const steps=Math.round(600*config.density/100/3)*3;
    const fineGap=config.detail<=50?mix(6.1,4.5,config.detail/50):mix(4.5,3.8,(config.detail-50)/50);
    const pointLimit=2000+24*config.detail;
    for(let tick=0;tick<steps;tick++) {
      const age=tick*600/steps;
      // Keep the square anchored during simulation; a continuous contraction
      // in geometry() shrinks the core without pulling vertices across folds.
      const core=23;
      const grid=new Map(), cell=16, n=pts.length;
      const scales=pts.map(p=>mix(14,localScale(p.x,p.y),smooth((age-300)/180)*smooth((Math.hypot(p.x,p.y)-45)/45)));
      pts.forEach((p,i)=>{const key=`${Math.floor(p.x/cell)},${Math.floor(p.y/cell)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);});
      const next=pts.map((p,i)=>{
        const prev=pts[(i+n-1)%n],after=pts[(i+1)%n];let rx=0,ry=0;
        const gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of grid.get(`${gx+dx},${gy+dy}`)||[]) {
          if(j===i)continue;const q=pts[j],x=p.x-q.x,y=p.y-q.y,d=Math.hypot(x,y);
          const spacing=(scales[i]+scales[j])*.5;
          if(d>0.01&&d<spacing){const force=(spacing-d)/spacing;rx+=x/d*force;ry+=y/d*force;}
        }
        const r=Math.hypot(p.x,p.y),a=Math.atan2(p.y,p.x);
        // Expansion feeds new perimeter; repulsion keeps folds separated.
        let vx=rx*1.55+((prev.x+after.x)*.5-p.x)*.26+p.x/r*.11;
        let vy=ry*1.55+((prev.y+after.y)*.5-p.y)*.26+p.y/r*.11;
        const envelope=40+age*.34, limit=Math.min(227,envelope)*(1+.035*Math.sin(a*5+seed));
        if(r>limit) {vx-=(r-limit)*p.x/r*.16;vy-=(r-limit)*p.y/r*.16;}
        const tx=after.x-prev.x,ty=after.y-prev.y,tl=Math.hypot(tx,ty)||1;
        const stir=.075*Math.sin(p.p+age*.018);
        let x=p.x+vx+ty/tl*stir,y=p.y+vy-tx/tl*stir;
        // Keep the original corners and portions of each side in place while
        // the open middle sections grow outward. These are vertices of the
        // growing outline itself, not a square drawn over a different shape.
        const side=Math.floor(p.u)%4,f=p.u%1,distance=Math.min(f,1-f);
        const cornerWeight=1-smooth((distance-.20)/.12);
        const pin=cornerWeight;
        const corners=[[-core,-core],[core,-core],[core,core],[-core,core]],a0=corners[side],a1=corners[(side+1)%4];
        x=mix(x,mix(a0[0],a1[0],f),pin);y=mix(y,mix(a0[1],a1[1],f),pin);
        // Keep the shrinking centre clear throughout growth.
        if(Math.abs(x)<core&&Math.abs(y)<core){if(Math.abs(x)>Math.abs(y))x=(x<0?-1:1)*core;else y=(y<0?-1:1)*core;}
        return {x,y,p:p.p,u:p.u};
      });
      pts=[];
      for(let i=0;i<next.length;i++){
        const p=next[i],q=next[(i+1)%next.length];pts.push(p);
        const gap=Math.hypot(p.x-q.x,p.y-q.y);
        if(gap>9||(gap>(age<440?6.1:fineGap)&&next.length<(age<440?2000:pointLimit)))pts.push({x:(p.x+q.x)/2,y:(p.y+q.y)/2,p:(p.p+q.p)/2,u:((p.u+(q.u<p.u?q.u+4:q.u))/2)%4});
      }
      if(tick%3===2)frames.push(pts.map(p=>({x:p.x,y:p.y,u:p.u})));
    }
    // Sample each arm between its original square corners. This preserves
    // correspondence even when persistent anchors compress material coordinates.
    return frames.map(ps=>{
      const corners=[0,1,2,3].map(u=>ps.findIndex(p=>p.u===u)),out=[];
      for(let side=0;side<4;side++){
        const start=corners[side],end=side===3?ps.length:corners[side+1];
        const arm=ps.slice(start,end).concat(ps[end%ps.length]),lengths=[0];
        for(let i=1;i<arm.length;i++)lengths.push(lengths[i-1]+Math.hypot(arm[i].x-arm[i-1].x,arm[i].y-arm[i-1].y));
        let j=0;for(let k=0;k<900;k++){
          const target=k/900*lengths.at(-1);
          while(j<arm.length-2&&lengths[j+1]<target)j++;
          const t=(target-lengths[j])/(lengths[j+1]-lengths[j]||1);
          out.push({x:mix(arm[j].x,arm[j+1].x,t),y:mix(arm[j].y,arm[j+1].y,t)});
        }
      }
      return out;
    });
  }
  function contour(frames,p,config){
    const pos=p*(frames.length-1),a=Math.floor(pos),b=Math.min(a+1,frames.length-1),f=pos-a;
    const pts=frames[a].map((v,i)=>({x:mix(v.x,frames[b][i].x,f),y:mix(v.y,frames[b][i].y,f)}));
    const shrink=config.squareShrink/100*smooth(p);
    const contracted=pts.map(v=>{const r=Math.max(Math.abs(v.x),Math.abs(v.y));const scale=1-shrink*(1-smooth((r-23)/85));return {x:v.x*scale,y:v.y*scale};});
    return foldPath(contracted,23*(1-shrink));
  }
  root.CanopyFolded={create:makeFolds,contour};
  if(typeof module!=='undefined')module.exports=root.CanopyFolded;
})(typeof window!=='undefined'?window:globalThis);
