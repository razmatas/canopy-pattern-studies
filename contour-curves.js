/* Fair grid-derived outlines in artboard units, independent of zoom and output size. */
(function(root){
  'use strict';
  const mix=(a,b,t)=>a+(b-a)*t;
  function path(points,detail=50,core=16){
    const weight=p=>{const t=Math.max(0,Math.min(1,(Math.max(Math.abs(p.x),Math.abs(p.y))-core-1)/5));return t*t*(3-2*t);};
    if(points.length<3)return '';
    const lengths=[0],count=points.length;
    for(let i=0;i<count;i++)lengths.push(lengths[i]+Math.hypot(points[(i+1)%count].x-points[i].x,points[(i+1)%count].y-points[i].y));
    const total=lengths[count];if(total<.01)return '';
    // Uniform arc-length samples avoid the clusters and long gaps caused by
    // taking every second/third marching-square vertex. Retain core vertices.
    const steps=Math.max(12,Math.ceil(total/.65)),samples=[];let j=0;
    for(let k=0;k<steps;k++){
      const distance=k*total/steps;while(j<count-1&&lengths[j+1]<distance)j++;
      const a=points[j],b=points[(j+1)%count],t=(distance-lengths[j])/(lengths[j+1]-lengths[j]||1),p={x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)};
      if(weight(p)>0)samples.push({...p,distance});
    }
    for(let i=0;i<count;i++)if(weight(points[i])===0)samples.push({...points[i],distance:lengths[i]});
    samples.sort((a,b)=>a.distance-b.distance);
    const n=samples.length;if(n<3)return '';
    const sigma=mix(1.3,.95,Math.max(0,Math.min(1,detail/100))),reach=sigma*3;
    // Gaussian fairing uses physical distance, so detail settings, uneven core
    // samples, output resolution and pan/zoom cannot alter the smoothing scale.
    const filtered=samples.map((p,i)=>{
      const blend=weight(p);if(!blend)return p;
      let x=p.x,y=p.y,sum=1;
      for(const direction of [-1,1])for(let k=1;k<n;k++){
        const q=samples[(i+direction*k+n)%n];let d=direction*(q.distance-p.distance);if(d<0)d+=total;if(d>reach)break;
        const w=Math.exp(-.5*(d/sigma)**2);x+=q.x*w;y+=q.y*w;sum+=w;
      }
      return {x:mix(p.x,x/sum,blend),y:mix(p.y,y/sum,blend)};
    });
    // Periodic cubic B-spline outside the core: no overshoot and continuous
    // tangent/curvature. Blend to the original interpolating curve at the square.
    const knot=i=>{const a=filtered[(i+n-1)%n],b=filtered[i%n],c=filtered[(i+1)%n],w=weight(samples[i%n]);return {x:mix(b.x,(a.x+4*b.x+c.x)/6,w),y:mix(b.y,(a.y+4*b.y+c.y)/6,w)};};
    const fmt=v=>v.toFixed(3),start=knot(0);let d=`M${fmt(start.x)},${fmt(start.y)}`;
    for(let i=0;i<n;i++){
      const a=filtered[(i+n-1)%n],b=filtered[i],c=filtered[(i+1)%n],e=filtered[(i+2)%n],from=knot(i),to=knot(i+1);
      d+=`C${fmt(from.x+(c.x-a.x)/6)},${fmt(from.y+(c.y-a.y)/6)} ${fmt(to.x-(e.x-b.x)/6)},${fmt(to.y-(e.y-b.y)/6)} ${fmt(to.x)},${fmt(to.y)}`;
    }
    return d+'Z';
  }
  root.CanopyCurves={path};if(typeof module!=='undefined')module.exports=root.CanopyCurves;
})(typeof window!=='undefined'?window:globalThis);
