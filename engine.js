/* Canopy growth studies. Deterministic geometry shared by preview and export. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2, SIZE = 560, C = 280;
  function random(seed) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const fmt = n => n.toFixed(2);
  function path(points, closed = false) {
    if (points.length < 2) return '';
    if (points.length === 2) return `M${fmt(points[0].x)},${fmt(points[0].y)}L${fmt(points[1].x)},${fmt(points[1].y)}`;
    let d = `M${fmt(points[0].x)},${fmt(points[0].y)}`;
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
      const p0 = points[(i - 1 + points.length) % points.length], p1 = points[i], p2 = points[(i + 1) % points.length], p3 = points[(i + 2) % points.length];
      const a = !closed && i === 0 ? p1 : p0, b = !closed && i === points.length - 2 ? p2 : p3;
      d += `C${fmt(p1.x + (p2.x-a.x)/6)},${fmt(p1.y+(p2.y-a.y)/6)} ${fmt(p2.x-(b.x-p1.x)/6)},${fmt(p2.y-(b.y-p1.y)/6)} ${fmt(p2.x)},${fmt(p2.y)}`;
    }
    return d + (closed ? 'Z' : '');
  }
  const defaults={density:100,detail:50,lineWeight:1,squareShrink:45};
  function settings(options={}){return {density:clamp(Number(options.density??100),70,130),detail:clamp(Number(options.detail??50),0,100),lineWeight:clamp(Number(options.lineWeight??1),.5,3),squareShrink:clamp(Number(options.squareShrink??45),0,75)};}
  const source=root.CanopySource||(typeof require!=='undefined'?require('./source-data.js'):null);
  if(!source)throw Error('The supplied artwork data must be loaded before the engine.');
  function bytes(s){if(typeof Buffer!=='undefined')return Uint8Array.from(Buffer.from(s,'base64'));return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
  const sourceAlpha=bytes(source.alpha),arrivalBytes=bytes(source.arrival),arrival=new Uint16Array(arrivalBytes.buffer);
  const baseField=new Float32Array(source.n*source.n);
  for(let i=0;i<baseField.length;i++)baseField[i]=(sourceAlpha[i]/255-.5)*560/source.n;
  const contourCases={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
  function revealContours(progress,preview=false){
    const stride=preview?2:1,N=(source.n-1)/stride+1,pixel=560/source.n,step=pixel*stride,reach=source.max*progress,field=new Float32Array(N*N);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const src=y*stride*source.n+x*stride;field[y*N+x]=Math.min(baseField[src],(reach-arrival[src])*pixel/10);}
    const segments=[],lookup=new Map();
    // Edge IDs connect neighbouring cells without rounding floating coordinates.
    for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){
      const i=y*N+x,v=[field[i],field[i+1],field[i+N+1],field[i+N]],code=(v[0]>0?1:0)+(v[1]>0?2:0)+(v[2]>0?4:0)+(v[3]>0?8:0);if(!contourCases[code])continue;
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],keys=[i*2,(i+1)*2+1,(i+N)*2,i*2+1];
      const edge=e=>{const a=corners[e],b=corners[(e+1)%4],f=v[e]/(v[e]-v[(e+1)%4]||1);return {x:(a[0]+(b[0]-a[0])*f)*step+pixel*.5-C,y:(a[1]+(b[1]-a[1])*f)*step+pixel*.5-C,key:keys[e]};};
      for(const [a,b]of contourCases[code])segments.push([edge(a),edge(b)]);
    }
    segments.forEach((s,i)=>s.forEach((p,j)=>{if(!lookup.has(p.key))lookup.set(p.key,[]);lookup.get(p.key).push([i,j]);}));
    const used=new Set(),loops=[];
    for(let i=0;i<segments.length;i++){
      if(used.has(i))continue;used.add(i);const pts=[segments[i][0],segments[i][1]];let cur=pts.at(-1).key,start=pts[0].key;
      while(cur!==start){const next=(lookup.get(cur)||[]).find(([j])=>!used.has(j));if(!next)break;const[j,k]=next;used.add(j);pts.push(segments[j][1-k]);cur=pts.at(-1).key;}
      if(pts.length>8&&cur===start){pts.pop();const smoothed=pts.map((p,j)=>({x:(pts[(j+pts.length-1)%pts.length].x+p.x*2+pts[(j+1)%pts.length].x)/4,y:(pts[(j+pts.length-1)%pts.length].y+p.y*2+pts[(j+1)%pts.length].y)/4}));loops.push(path(smoothed.filter((_,j)=>j%3===0),true));}
    }
    return loops;
  }
  function timing(t,options={}){
    const duration=Math.max(4,options.duration||12),hold=0,seconds=clamp(t)*duration;
    return {seconds,hold,duration,progress:Math.pow(clamp((seconds-hold)/(duration-hold-1)),1.15)};
  }
  const coral=root.CanopyCoral||(typeof require!=='undefined'?require('./coral.js'):null);
  const folded=root.CanopyFolded||(typeof require!=='undefined'?require('./folded.js'):null);
  const generated=root.CanopyGenerated||(typeof require!=='undefined'?require('./generated.js'):null);
  function create(seed=271026,options={}){const config=settings(options);return {seed,settings:config,coral:coral.create(seed,config),classic:folded.create(seed,config),generated:generated.create(seed,config)};}
  function geometry(model,study,t,options={}){
    if(study!=='channel'&&study!=='folds'&&study!=='classic'&&study!=='generated')throw Error('Unknown growth study.');
    const {progress:p}=timing(t,options);
    if(study==='channel'){
      if(p===0)return [{d:`M-${source.half},-${source.half}H${source.half}V${source.half}H-${source.half}Z`,w:source.scale}];
      if(p>=1)return [{type:'source',opacity:1}];
      const blend=smooth((p-.985)/.015),paths=revealContours(p,options.preview).map(d=>({d,w:source.scale,opacity:1-blend}));
      if(blend>0)paths.push({type:'source',opacity:blend});return paths;
    }
    const config=settings({...model.settings,...options});
    if(p===0)return [{d:study==='classic'?'M-23,-23H23V23H-23Z':'M-16,-16H16V16H-16Z',w:study==='classic'?config.lineWeight:config.lineWeight*source.scale}];
    if(study==='classic')return [{d:folded.contour(model.classic,p,config),w:config.lineWeight}];
    if(study==='generated')return generated.contours(model.generated,p,config,options.preview).map(d=>({d,w:config.lineWeight*source.scale}));
    return coral.contours(model.coral,p,config,options.preview).map(d=>({d,w:config.lineWeight*source.scale}));
  }
  function sourceMarkup(ink,opacity=1){return `<g opacity="${opacity}" transform="scale(${source.scale}) translate(-314.5 -312.5)"><defs><mask id="supplied-mask" maskUnits="userSpaceOnUse" x="-1" y="-1" width="631" height="627"><path fill="white" stroke="none" d="${source.mask}"/></mask></defs><path fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" d="${source.path}" mask="url(#supplied-mask)"/></g>`;}
  let sourcePath=null,sourceMask=null;
  function paint(ctx,parts){for(const p of parts){ctx.save();ctx.globalAlpha=p.opacity??1;if(p.type==='source'){sourcePath=sourcePath||new Path2D(source.path);sourceMask=sourceMask||new Path2D(source.mask);ctx.scale(source.scale,source.scale);ctx.translate(-314.5,-312.5);ctx.clip(sourceMask);ctx.lineWidth=2;ctx.lineCap='butt';ctx.lineJoin='miter';ctx.stroke(sourcePath);}else{ctx.lineWidth=p.w;ctx.stroke(new Path2D(p.d));}ctx.restore();}}
  function framing(options={}){const f=options.framing||{};return {zoom:clamp(Number(f.zoom)||1,.25,4),x:clamp(Number(f.x)||0,-560,560),y:clamp(Number(f.y)||0,-560,560)};}
  function draw(canvas,model,study,t,options={}){
    const ctx=canvas.getContext('2d'),f=framing(options),scale=canvas.width/SIZE;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=options.paper||'#235355';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(scale,0,0,scale,0,0);ctx.translate(C+f.x,C+f.y);ctx.scale(f.zoom,f.zoom);
    ctx.strokeStyle=options.ink||'#E3F3AA';ctx.lineCap='round';ctx.lineJoin='round';paint(ctx,geometry(model,study,t,options));
  }
  function svg(model,study,t,options={}){
    const ink=options.ink||'#ffffff',paper=options.paper===undefined?'#000000':options.paper,parts=geometry(model,study,t,options);
    const f=framing(options);
    const label=study==='channel'?'supplied SVG':study==='classic'?'folded contours':study==='generated'?'generated coral':'coral growth';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size||SIZE}" height="${options.size||SIZE}" viewBox="0 0 560 560" overflow="hidden"><title>Canopy ${label} — growth ${Math.round(t*100)}%</title>${paper?`<rect width="560" height="560" fill="${paper}"/>`:''}<g transform="translate(${C+f.x} ${C+f.y}) scale(${f.zoom})" fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">${parts.map(p=>p.type==='source'?sourceMarkup(ink,p.opacity):`<path opacity="${p.opacity??1}" stroke-width="${p.w}" d="${p.d}"/>`).join('')}</g></svg>`;
  }
  root.CanopyEngine={create,geometry,paint,draw,svg,timing,SIZE,defaults,settings};
  if(typeof module!=='undefined')module.exports=root.CanopyEngine;
})(typeof window!=='undefined'?window:globalThis);
