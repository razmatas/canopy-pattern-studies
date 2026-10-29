/* Small standalone study interface; follows the existing Shape Lab's no-build setup. */
(() => {
  'use strict';
  const E=window.CanopyEngine, $=id=>document.getElementById(id);
  const meta={channel:{label:'01 / THE SUPPLIED ARTWORK',note:'01 / YOUR ORIGINAL SVG',title:'The original, growing.',body:'Your supplied artwork, revealed through its connected branches. The animation starts at its central square and finishes on the original vector paths.',watch:'The growth travels along the artwork’s branches. The final design stays fixed.'},folds:{label:'03 / SOURCE-BASED CORAL',note:'03 / A BRANCHING FORM',title:'A smaller square. Still the origin.',body:'Variations grow from the supplied artwork’s branch structure. Each seed gently reshapes and turns it, keeping the rounded details and shrinking square.',watch:'The original branching remains recognisable as each variation grows outward.'},classic:{label:'04 / FOLDED CONTOURS',note:'04 / THE EARLIER STUDY',title:'A square at the heart of growth.',body:'The earlier folded contour returns: organic lines unfold from a central square that gradually becomes smaller.',watch:'Broad folds, tighter channels, and curled details develop from the same square.'},generated:{label:'05 / GENERATED CORAL',note:'05 / NEW BRANCHING',title:'New growth. The same origin.',body:'New branches grow from source-inspired shapes, which are rearranged and joined into a fresh network around the square.',watch:'Look for new forks and connections in each variation.'}};
  const palette=['#E3F3AA','#235355','#B0C2C2','#D5DDDD','#FFFFFF','#EFF872','#1E1F20'];
  for(const id of ['foreground','background'])for(const colour of palette){const option=new Option(colour,colour);$(id).add(option);}
  $('foreground').value='#E3F3AA';$('background').value='#235355';
  const colourNames=['Pale lime','Forest','Blue grey','Mist','White','Bright lime','Charcoal'];
  for(const id of ['foreground','background']){
    palette.forEach((colour,i)=>{
      const label=document.createElement('label');label.className='swatch';label.title=colourNames[i]+' '+colour;
      const input=document.createElement('input');input.type='radio';input.name=id+'-colour';input.value=colour;input.setAttribute('aria-label',colourNames[i]+' '+colour);
      const chip=document.createElement('span');chip.className='swatch-chip';chip.style.background=colour;
      const code=document.createElement('span');code.className='swatch-code';code.textContent=colour;
      input.onchange=()=>{$(id).value=colour;$(id).dispatchEvent(new Event('change'));};
      label.append(input,chip,code);$(id+'-swatches').append(label);
    });
  }
  function syncColours(){for(const id of ['foreground','background']){$(id+'-value').textContent=$(id).value;document.querySelectorAll(`input[name="${id}-colour"]`).forEach(input=>input.checked=input.value===$(id).value);}}
  syncColours();
  const colours=()=>({ink:$('foreground').value,paper:$('background').value});
  const framing=()=>({zoom:Number($('zoom').value)/100,x:Number($('position-x').value)*5.6,y:Number($('position-y').value)*5.6});
  let exporting=false,exportAbort=null;
  function syncFraming(){
    for(const id of ['zoom','position-x','position-y'])$(id+'-value').textContent=$(id).value+'%';
    const x=Number($('position-x').value),y=Number($('position-y').value),sign=n=>(n>0?'+':'')+n+'%';
    $('position-readout').textContent=`X ${sign(x)}  /  Y ${sign(y)}`;
    $('position-ui').classList.toggle('aligned-x',x===0);$('position-ui').classList.toggle('aligned-y',y===0);
    const origin=$('position-ui').querySelector('.position-origin');origin.style.left=(50+x)+'%';origin.style.top=(50+y)+'%';
  }

  // Keep a model and editable controls per direction. The saved source look is
  // a named preset so it can always be restored after exploring new patterns.
  const sourcePreset={seed:209158903,settings:{density:125,detail:75,lineWeight:1,squareShrink:20},time:.876};
  const states=Object.fromEntries(['folds','classic','generated'].map(s=>[s,{seed:sourcePreset.seed,settings:{...sourcePreset.settings},time:s==='folds'?sourcePreset.time:0}]));
  const models={};let model=null,study='folds',t=sourcePreset.time,playing=false,comparing=false,last=0,hold=0,version=0,generating=false;
  function modelFor(s){return models[s]||model;}
  function applySettings(c){for(const [id,value] of [['density',c.density],['detail',c.detail],['line-weight',c.lineWeight],['square-shrink',c.squareShrink]])$(id).value=value;syncControlLabels();}
  function remember(){if(states[study]){states[study].settings=controlSettings();states[study].time=t;states[study].seed=modelFor(study)?.seed||states[study].seed;}}
  function settingsFor(s){return s===study&&states[s]?controlSettings():states[s]?.settings||controlSettings();}
  function say(s){$('status').textContent=s;}
  function controlSettings(){return {density:Number($('density').value),detail:Number($('detail').value),lineWeight:Number($('line-weight').value),squareShrink:Number($('square-shrink').value)};}
  function syncControlLabels(){const c=controlSettings();for(const [id,value]of [['density',c.density+'%'],['detail',c.detail+'%'],['line-weight',c.lineWeight.toFixed(1)],['square-shrink',c.squareShrink+'%']]){$(id+'-value').textContent=value;$(id).setAttribute('aria-valuetext',value);}$('shrink-description').textContent=c.squareShrink===0?'Keeps its original width. Always visible.':`Ends at ${100-c.squareShrink}% of its starting width. Always visible.`;}
  function motionOptions(s=study){const c=settingsFor(s);return {duration:Number($('duration').value),lineWeight:c.lineWeight,squareShrink:c.squareShrink,framing:framing()};}
  function draw(canvas,s,time){const size=Math.min(2240,Math.max(1120,Math.round(canvas.getBoundingClientRect().width*(window.devicePixelRatio||1))));if(canvas.width!==size)canvas.width=canvas.height=size;E.draw(canvas,modelFor(s),s,time,{...motionOptions(s),...colours()});}
  function render(){if(!model)return;if(comparing){document.querySelectorAll('[data-study]').forEach(c=>draw(c,c.dataset.study,t));}else draw($('canvas'),study,t);const timing=E.timing(t,motionOptions());$('export-context').textContent='Exporting: '+({channel:'Supplied artwork',folds:'Source-based coral',classic:'Folded contours',generated:'Generated coral'}[study])+' · current frame';$('progress').value=Math.round(t*1000);$('percent').textContent=String(Math.round(t*100)).padStart(2,'0')+'%';$('stage-phase').textContent=timing.progress===0?'SQUARE ORIGIN':timing.progress===1?'FULL FORM':study!=='channel'?'GROWING / SHRINKING SQUARE':'GROWING OUTWARD';$('stage').style.background=colours().paper;$('comparison').style.background=colours().paper;}
  function syncStudyControls(){const fixed=study==='channel';$('randomise').disabled=fixed||generating;$('fold-controls').hidden=fixed;$('density-label').textContent=study==='folds'?'Branch width':'Density';$('detail-label').textContent=study==='folds'?'Curve detail':'Detail';$('density-description').textContent=study==='folds'?'Narrower → fuller branches':study==='generated'?'Open growth → fuller branching':'Open, spacious folds → a fuller pattern';$('detail-description').textContent=study==='folds'?'Softer curves → more of the source detail':study==='generated'?'Fewer branches → finer forks':'Broad curves → smaller curls and bends';$('saved-look').hidden=study!=='folds';$('fold-controls').setAttribute('aria-busy',String(generating));for(const id of ['density','detail','reset-controls','play','restart','progress'])$(id).disabled=generating;for(const id of ['save-svg','save-png','save-mp4'])$(id).disabled=generating||!model||exporting;$('randomise').textContent=fixed?'Original artwork · fixed':'New variation ↗';$('seed').disabled=fixed||generating;$('restore').disabled=fixed||generating;$('saved-look').disabled=generating;$('seed-row').hidden=fixed;$('stage-seed').textContent=fixed?'SUPPLIED SVG':'SEED '+(modelFor(study)?.seed||sourcePreset.seed);document.querySelectorAll('[data-select]').forEach(b=>b.disabled=generating);}
  function syncPlay(){ $('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation'); }
  function buildModel(seed,settings){
    const fallback=()=>new Promise((resolve,reject)=>setTimeout(()=>{try{resolve(E.create(seed,settings));}catch(error){reject(error);}},30));
    // A sandboxed HTTPS page can have an opaque window origin while its URL
    // still reports the host origin. Use the actual origin before making a worker.
    if(location.protocol==='file:'||window.origin==='null'||location.origin==='null'||!window.Worker)return fallback();
    return new Promise((resolve,reject)=>{
      let worker;
      try{worker=new Worker('generator-worker.js?v=17');}
      catch{fallback().then(resolve,reject);return;}
      worker.onmessage=({data})=>{worker.terminate();data.error?reject(new Error(data.error)):resolve(data.model);};
      worker.onerror=()=>{worker.terminate();fallback().then(resolve,reject);};
      worker.postMessage({seed,settings});
    });
  }
  async function generate(seed,preserveTime=false){
    if(generating)return;
    const target=study, id=++version,oldPlaying=playing,oldTime=t,inputs=controlSettings();
    generating=true;playing=false;syncPlay();syncStudyControls();say('Growing your pattern…');
    try{
      const next=await buildModel(seed,inputs);if(id!==version)return;
      if(!model){model=next;for(const s of ['folds','classic','generated'])models[s]=next;}
      else if(states[target])models[target]=next;
      if(states[target]){states[target].seed=seed;states[target].settings=controlSettings();}
      $('seed').value=seed;t=preserveTime?oldTime:oldPlaying?0:oldTime;hold=0;playing=oldPlaying;last=performance.now();render();say('Ready. Your settings apply to the preview, SVG, PNG and MP4 exports.');
    }catch(e){const previous=modelFor(target);if(previous){$('density').value=previous.settings.density;$('detail').value=previous.settings.detail;syncControlLabels();}playing=oldPlaying;say('The variation could not be generated. '+e.message);}
    finally{generating=false;syncStudyControls();syncPlay();}
  }
  for(const id of ['density','detail']){$(id).oninput=syncControlLabels;$(id).onchange=()=>generate(modelFor(study)?.seed||sourcePreset.seed,true);}
  for(const id of ['line-weight','square-shrink'])$(id).oninput=()=>{syncControlLabels();if(states[study])states[study].settings=controlSettings();render();};
  $('reset-controls').onclick=()=>{const previous=controlSettings();for(const [id,value]of [['density',100],['detail',50],['line-weight',1],['square-shrink',45]])$(id).value=value;syncControlLabels();if(previous.density!==100||previous.detail!==50)generate(modelFor(study)?.seed||sourcePreset.seed,true);else{render();say('Controls reset to the default look. Your seed is unchanged.');}};

  function displayStudy(next){
    study=next;
    document.querySelectorAll('[data-select]').forEach(n=>{const active=n.dataset.select===study;n.classList.toggle('active',active);n.setAttribute('aria-pressed',String(active));});
    const m=meta[study];$('active-label').textContent=m.label;$('note-label').textContent=m.note;$('note-title').textContent=m.title;$('note-body').textContent=m.body;$('watch').textContent=m.watch;$('canvas').setAttribute('aria-label',m.label+' animation');
    syncStudyControls();render();
  }
  document.querySelectorAll('[data-select]').forEach(b=>b.addEventListener('click',()=>{
    if(generating||b.dataset.select===study)return;remember();
    const next=b.dataset.select;if(states[next]){applySettings(states[next].settings);$('seed').value=states[next].seed;t=states[next].time;}
    displayStudy(next);syncPlay();
  }));
  function view(compare){comparing=compare;$('stage').hidden=compare;$('comparison').hidden=!compare;document.querySelector('.workspace').classList.toggle('comparing',compare);$('focus').classList.toggle('selected',!compare);$('compare').classList.toggle('selected',compare);$('focus').setAttribute('aria-pressed',String(!compare));$('compare').setAttribute('aria-pressed',String(compare));$('active-label').textContent=compare?'FOUR STUDIES / A SQUARE AT THE ORIGIN':meta[study].label;render();}
  $('focus').onclick=()=>view(false);$('compare').onclick=()=>view(true);
  $('play').onclick=()=>{if(t>=1&&!playing)t=0;playing=!playing;last=performance.now();syncPlay();render();};
  $('restart').onclick=()=>{t=0;hold=0;playing=true;last=performance.now();syncPlay();render();};
  $('progress').oninput=()=>{playing=false;t=Number($('progress').value)/1000;syncPlay();render();};
  for(const id of ['foreground','background'])$(id).onchange=()=>{syncColours();const p=colours();$('colour-note').textContent=p.ink===p.paper?'Matching colours: the pattern blends into the background.':'Two colours across preview and exports.';render();};
  for(const id of ['zoom','position-x','position-y'])$(id).oninput=()=>{syncFraming();showPosition();render();};
  for(const [id,step] of [['zoom-out',-10],['zoom-in',10]])$(id).onclick=()=>{$('zoom').value=Number($('zoom').value)+step;$('zoom').dispatchEvent(new Event('input'));};
  $('reset-framing').onclick=()=>{$('zoom').value=100;$('position-x').value=$('position-y').value=0;syncFraming();showPosition();render();};
  let drag=null,positionTimer;
  function showPosition(){clearTimeout(positionTimer);$('position-ui').classList.add('visible');$('canvas-hint').classList.add('dismissed');if(!drag)positionTimer=setTimeout(()=>$('position-ui').classList.remove('visible'),1400);}
  $('canvas').onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,fx:Number($('position-x').value),fy:Number($('position-y').value)};$('canvas').setPointerCapture(e.pointerId);$('stage').classList.add('dragging');syncFraming();showPosition();};
  $('canvas').onpointermove=e=>{if(!drag)return;const r=$('canvas').getBoundingClientRect();const snap=v=>Math.abs(v)<1?0:v;$('position-x').value=snap(drag.fx+(e.clientX-drag.x)/r.width*100);$('position-y').value=snap(drag.fy+(e.clientY-drag.y)/r.height*100);syncFraming();showPosition();render();};
  function endDrag(){drag=null;$('stage').classList.remove('dragging');showPosition();}
  $('canvas').onpointerup=$('canvas').onpointercancel=$('canvas').onlostpointercapture=endDrag;
  $('canvas').addEventListener('wheel',e=>{e.preventDefault();$('zoom').value=Number($('zoom').value)+(e.deltaY<0?5:-5);syncFraming();showPosition();render();},{passive:false});
  new ResizeObserver(()=>render()).observe($('canvas'));
  $('duration').onchange=()=>{last=performance.now();render();};
  $('randomise').onclick=()=>generate(1+crypto.getRandomValues(new Uint32Array(1))[0]%999999999);
  $('restore').onclick=()=>generate(271026);
  $('saved-look').onclick=()=>{applySettings(sourcePreset.settings);t=sourcePreset.time;playing=false;syncPlay();generate(sourcePreset.seed,true);};
  $('seed').onchange=()=>{const n=Number($('seed').value);if(Number.isInteger(n)&&n>=1&&n<=999999999)generate(n);else{$('seed').value=modelFor(study)?.seed||sourcePreset.seed;say('Enter a whole-number seed between 1 and 999999999.');}};
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function filename(ext){const c=controlSettings();return study==='channel'?`canopy-supplied-artwork-${Math.round(t*100)}pct.${ext}`:`canopy-${study==='classic'?'folded':study==='generated'?'generated-coral':'source-coral'}-${modelFor(study).seed}-d${c.density}-detail${c.detail}-w${c.lineWeight}-shrink${c.squareShrink}-${Math.round(t*100)}pct.${ext}`;}
  $('save-svg').onclick=()=>{if(!model||generating)return;const p=colours();download(new Blob([E.svg(modelFor(study),study,t,{...motionOptions(),ink:p.ink,paper:$('transparent').checked?'':p.paper,size:1600})],{type:'image/svg+xml'}),filename('svg'));say(`Saved ${meta[study].label.toLowerCase()} at ${Math.round(t*100)}% growth.`);};
  $('save-png').onclick=async()=>{if(!model||generating)return;const btn=$('save-png');btn.disabled=true;try{const p=colours(),blob=new Blob([E.svg(modelFor(study),study,t,{...motionOptions(),ink:p.ink,paper:$('transparent').checked?'':p.paper,size:3200})],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),img=new Image();const loaded=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});img.src=url;await loaded;const canvas=document.createElement('canvas');canvas.width=canvas.height=1600;const high=document.createElement('canvas');high.width=high.height=3200;high.getContext('2d').drawImage(img,0,0,3200,3200);const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(high,0,0,1600,1600);URL.revokeObjectURL(url);const png=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!png)throw Error('No PNG data');download(png,filename('png'));say('Saved a 1600 × 1600 PNG of the current frame.');}catch(e){say('PNG export failed. Try SVG instead.');}finally{btn.disabled=false;}};
  $('movie-size').onchange=()=>{const size=$('movie-size').value;$('export-hint').textContent=`SVG / PNG: current frame · MP4: full growth, ${size} × ${size}, 60 fps, selected background`;};
  $('cancel-mp4').onclick=()=>exportAbort?.abort();
  $('save-mp4').onclick=async()=>{
    if(!model||generating||exporting)return;
    const size=Number($('movie-size').value),dimensions=`${size} × ${size}`;
    const snapshot={model:modelFor(study),study,options:{...motionOptions(),...colours(),size},name:filename('mp4').replace(/-\d+pct\.mp4$/, `-${size}x${size}-60fps.mp4`)};
    exporting=true;exportAbort=new AbortController();syncStudyControls();$('movie-progress').hidden=false;$('cancel-mp4').hidden=false;$('movie-meter').value=0;
    $('movie-message').textContent=`Preparing ${dimensions} / 60 fps…`;
    try{const blob=await CanopyMovie.render({...snapshot,signal:exportAbort.signal,onProgress:(value,message)=>{$('movie-meter').value=value;$('movie-message').textContent=message;}});download(blob,snapshot.name);say(`Saved your current pattern as a ${dimensions}, 60 fps MP4.`);$('movie-message').textContent=`MP4 saved · ${dimensions} · 60 fps`;}
    catch(error){say(error.name==='AbortError'?'MP4 export cancelled.':'MP4 export failed. '+error.message);$('movie-message').textContent=$('status').textContent;}
    finally{exporting=false;exportAbort=null;$('cancel-mp4').hidden=true;syncStudyControls();}
  };
  // Exposed only for reproducible local rendering and verification.
  window.studyApp={setProgress(value){playing=false;t=Math.max(0,Math.min(1,value));syncPlay();render();},getState(){return {seed:modelFor(study)?.seed,study,t,playing,comparing,ready:!!model&&!generating,settings:controlSettings(),colours:colours(),framing:framing(),exporting};}};
  function animate(now){const dt=Math.max(0,Math.min((now-last)/1000,.1));last=Math.max(last,now);if(model&&playing){if(t<1){t=Math.min(1,t+dt/Number($('duration').value));render();}else if($('repeat').checked){hold+=dt;if(hold>2){t=0;hold=0;render();}}else{playing=false;syncPlay();}}requestAnimationFrame(animate);}
  applySettings(sourcePreset.settings);$('seed').value=sourcePreset.seed;$('repeat').checked=true;displayStudy('folds');syncPlay();generate(sourcePreset.seed,true).then(()=>setTimeout(()=>$('canvas-hint').classList.add('dismissed'),6000));requestAnimationFrame(animate);
})();
