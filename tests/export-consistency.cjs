/* Real browser → downloaded MP4 → decoded pixels, compared with the visible
   preview and downloaded SVG/PNG at the same animation frames. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const sharp=require('sharp');
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return i<0?[a.slice(2),true]:[a.slice(2,i),a.slice(i+1)];}));
const frameIndices=[0,90,315,719],duration=12,frames=720;
const settings={seed:209158903,density:125,detail:75,lineWeight:1,squareShrink:20,zoom:Number(args.zoom??240),x:Number(args.x??-35),y:Number(args.y??-30),ink:'#E3F3AA',paper:'#235355'};
async function rgb(file){return sharp(file).resize(1080,1080,{fit:'fill'}).removeAlpha().raw().toBuffer();}
function mask(data){const pixels=new Uint8Array(1080*1080),bg=[35,83,85],vector=[192,160,85],norm=vector.reduce((s,v)=>s+v*v,0);let mass=0;for(let i=0;i<pixels.length;i++){const ink=((data[i*3]-bg[0])*vector[0]+(data[i*3+1]-bg[1])*vector[1]+(data[i*3+2]-bg[2])*vector[2])/norm;pixels[i]=ink>.5?1:0;if(ink>.1)mass+=Math.min(1,ink);}return {pixels,mass};}
function dilate(a){const out=new Uint8Array(a.length);for(let i=0;i<a.length;i++)if(a[i]){const x=i%1080,y=Math.floor(i/1080);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<1080&&y+dy>=0&&y+dy<1080)out[(y+dy)*1080+x+dx]=1;}return out;}
// Measure antialiased ink area continuously: thresholded pixel counts can
// jump by a third on a thin square simply because its edge lands between pixels.
async function compare(reference,actual){
  const [a,b]=await Promise.all([rgb(reference),rgb(actual)]),ar=mask(a),br=mask(b),am=ar.pixels,bm=br.pixels,ad=dilate(am),bd=dilate(bm);
  let totalA=0,totalB=0,hitA=0,hitB=0,error=0;
  for(let i=0;i<am.length;i++){if(am[i]){totalA++;if(bd[i])hitA++;}if(bm[i]){totalB++;if(ad[i])hitB++;}}
  for(let i=0;i<a.length;i++)error+=Math.abs(a[i]-b[i]);
  return {precision:hitB/(totalB||1),recall:hitA/(totalA||1),coverageRatio:br.mass/(ar.mass||1),meanAbsoluteError:error/a.length};
}
const agrees=m=>m.precision>.995&&m.recall>.995&&m.coverageRatio>.85&&m.coverageRatio<1.15&&m.meanAbsoluteError<5;
async function run(){
  const out=args.out?path.resolve(args.out):await fs.mkdtemp(path.join(os.tmpdir(),'canopy-export-consistency-'));await fs.mkdir(out,{recursive:true});
  const sizes=(args.sizes||'1080,2048,4096').split(',').map(Number),results={settings,duration,frameIndices,output:out,exports:[],pageErrors:[]};
  const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});page.on('pageerror',e=>results.pageErrors.push(e.message));
    await page.goto(process.env.BASE_URL||'http://127.0.0.1:4186/');await page.waitForFunction(()=>window.studyApp?.getState().ready,null,{timeout:120000});
    const isolated=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1080;const ctx=c.getContext('2d');ctx.setTransform(2,0,0,3,17,29);ctx.strokeStyle='#123456';const before=[...ctx.getTransform().toFloat64Array(),ctx.strokeStyle];CanopyEngine.draw(c,null,'channel',0,{framing:{zoom:2.4,x:-196,y:-168}});return JSON.stringify(before)===JSON.stringify([...ctx.getTransform().toFloat64Array(),ctx.strokeStyle]);});
    assert.equal(isolated,true,'The artwork renderer leaked canvas transform/style state');
    const state=await page.evaluate(()=>studyApp.getState());assert.equal(state.study,'folds');assert.equal(state.seed,settings.seed);assert.deepEqual(state.settings,{density:125,detail:75,lineWeight:1,squareShrink:20});
    await page.selectOption('#duration',String(duration));
    for(const [id,value]of [['zoom',settings.zoom],['position-x',settings.x],['position-y',settings.y]])await page.locator('#'+id).fill(String(value));
    await page.getByRole('radio',{name:'Pale lime #E3F3AA',exact:true}).first().check();await page.getByRole('radio',{name:'Forest #235355',exact:true}).last().check();await page.uncheck('#transparent');
    async function save(ext,file){const event=page.waitForEvent('download',{timeout:120000});await page.click('#save-'+ext);await(await event).saveAs(file);}
    // Reference images come from actual UI exports and the visible canvas,
    // independently of the movie's supersampling and compositing implementation.
    for(const index of frameIndices){
      await page.evaluate(t=>studyApp.setProgress(t),index/(frames-1));
      const data=await page.locator('#canvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]);await fs.writeFile(path.join(out,`preview-${index}.png`),Buffer.from(data,'base64'));
      await save('svg',path.join(out,`still-${index}.svg`));await save('png',path.join(out,`still-${index}.png`));
      await sharp(Buffer.from(await fs.readFile(path.join(out,`still-${index}.svg`)))).resize(1080,1080).png().toFile(path.join(out,`svg-${index}.png`));
    }
    for(const size of sizes){
      const file=path.join(out,`${size}.mp4`),entry={size,file,comparisons:[]};results.exports.push(entry);
      if(args.existing){assert.equal(sizes.length,1);await fs.copyFile(path.resolve(args.existing),file);}
      else{await page.selectOption('#movie-size',String(size));console.log('Rendering',size);const downloaded=page.waitForEvent('download',{timeout:300000});await page.click('#save-mp4');const outcome=await Promise.race([downloaded,page.waitForFunction(()=>!studyApp.getState().exporting&&document.querySelector('#status').textContent.startsWith('MP4 export failed'),null,{timeout:300000}).then(async()=>{throw Error(await page.locator('#status').textContent());})]);await outcome.saveAs(file);}
      const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,duration','-of','json',file],{encoding:'utf8'})).streams[0];entry.metadata=probe;
      assert.equal(probe.width,size);assert.equal(probe.height,size);assert.equal(probe.r_frame_rate,'60/1');assert.equal(probe.avg_frame_rate,'60/1');assert.equal(Number(probe.nb_frames),frames);assert.equal(Number(probe.duration),duration);
      const decoded=path.join(out,`decoded-${size}`);await fs.mkdir(decoded,{recursive:true});
      execFileSync('ffmpeg',['-v','error','-i',file,'-vf','select='+frameIndices.map(n=>`eq(n\\,${n})`).join('+'),'-fps_mode','vfr','-y',path.join(decoded,'%02d.png')],{stdio:['ignore','ignore','pipe']});
      for(let i=0;i<frameIndices.length;i++)for(const [kind,reference]of [['preview',`preview-${frameIndices[i]}.png`],['SVG',`svg-${frameIndices[i]}.png`],['PNG',`still-${frameIndices[i]}.png`]]){
        const metrics=await compare(path.join(out,reference),path.join(decoded,String(i+1).padStart(2,'0')+'.png'));const comparison={frame:frameIndices[i],reference:kind,...metrics,pass:agrees(metrics)};entry.comparisons.push(comparison);console.log(size,comparison.frame,kind,JSON.stringify(metrics),comparison.pass?'PASS':'FAIL');
      }
    }
    assert.equal(results.pageErrors.length,0,results.pageErrors.join('\n'));
    const all=results.exports.flatMap(e=>e.comparisons),passed=all.every(c=>c.pass);results.pass=passed;
    await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
    if(args['expect-mismatch'])assert.equal(passed,false,'Expected to detect the supplied broken movie');else assert.equal(passed,true,'Decoded video does not match preview/still exports; see results.json');
    console.log(args['expect-mismatch']?'Confirmed visual mismatch':'All decoded frames match',out);
  }finally{await browser.close();}
}
module.exports={compare,agrees};
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
