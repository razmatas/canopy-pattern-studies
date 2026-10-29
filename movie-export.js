/* Deterministic local MP4 export. Every selected frame is rendered and encoded. */
(() => {
  'use strict';
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  const sizes={
    1080:{bitrate:24_000_000,avc:'avc1.64002a',hevc:'hvc1.1.6.L150.B0'},
    2048:{bitrate:48_000_000,avc:'avc1.640034',hevc:'hvc1.1.6.L150.B0'},
    4096:{bitrate:80_000_000,avc:'avc1.64003c',hevc:'hvc1.1.6.L180.B0'}
  };
  const checkAbort=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
  async function flush(encoder,signal){
    checkAbort(signal);
    const abort=()=>{if(encoder.state!=='closed')encoder.close();};
    signal?.addEventListener('abort',abort,{once:true});
    try{await encoder.flush();checkAbort(signal);}catch(error){checkAbort(signal);throw error;}
    finally{signal?.removeEventListener('abort',abort);}
  }
  const matchingDimensions=(meta,width,height)=>{const d=meta?.decoderConfig;return !d||((d.codedWidth===undefined||d.codedWidth===width)&&(d.codedHeight===undefined||d.codedHeight===height));};
  async function selectEncoder(canvas,size,signal){
    const preset=sizes[size];
    // AVC levels reflect square macroblock counts at 60 fps. HEVC is an MP4
    // fallback for hardware that cannot encode the requested AVC level/size.
    for(const [codec,muxerCodec,name] of [[preset.avc,'avc','H.264'],[preset.hevc,'hevc','HEVC']]){
      for(const hardwareAcceleration of ['prefer-hardware','prefer-software']){
        checkAbort(signal);
        const candidate={codec,width:size,height:size,framerate:60,bitrate:preset.bitrate,hardwareAcceleration};
        if(muxerCodec==='avc')candidate.avc={format:'avc'};else candidate.hevc={format:'hevc'};
        let trial,timer;
        try{
          const support=await VideoEncoder.isConfigSupported(candidate);checkAbort(signal);
          if(!support.supported)continue;
          // Some encoders accept configuration but fail on the first frame.
          // Require actual output at the exact requested dimensions before rendering.
          let count=0,failure=null;
          trial=new VideoEncoder({output(chunk,meta){if(!matchingDimensions(meta,size,size))failure=Error('Encoder changed output dimensions.');count++;},error:error=>{failure=error;}});
          trial.configure(candidate);
          timer=setTimeout(()=>{if(trial.state!=='closed')trial.close();},15000);
          const frame=new VideoFrame(canvas,{timestamp:0,duration:16667});
          try{trial.encode(frame,{keyFrame:true});}finally{frame.close();}
          await flush(trial,signal);
          if(failure||!count)continue;
          return {config:candidate,muxerCodec,name};
        }catch(error){checkAbort(signal);}
        finally{clearTimeout(timer);if(trial&&trial.state!=='closed')trial.close();}
      }
    }
    throw Error(`${size} × ${size} at 60 fps is unavailable with this browser’s MP4 encoders. Try a smaller MP4 size or a compatible browser/computer.`);
  }
  async function render({model,study,options,signal,onProgress=()=>{}}){
    checkAbort(signal);
    if(!window.VideoEncoder||!window.VideoFrame||!window.Mp4Muxer)throw Error('This browser cannot encode MP4. Open the app in a current Chrome, Edge or Safari over localhost or HTTPS.');
    const width=Number(options.size??1080),height=width,fps=60,frames=Math.round(options.duration*fps);
    if(!Object.hasOwn(sizes,width))throw Error('Choose 1080, 2048 or 4096 square pixels for MP4 export.');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    // Supersample smaller exports; cap the drawing surface at 4096. A 4K
    // export renders vector paths directly at full resolution, without an 8K buffer.
    const highSize=Math.min(4096,width*2),high=highSize===width?canvas:document.createElement('canvas');high.width=high.height=highSize;
    const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    const queueLimit=Math.max(2,Math.min(8,Math.floor(64*1024*1024/(width*height*4))));
    let encoder=null;
    try{
      onProgress(0,`Checking ${width} × ${height} / 60 fps encoder…`);
      CanopyEngine.draw(canvas,model,study,0,options);
      const selected=await selectEncoder(canvas,width,signal);checkAbort(signal);
      const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:selected.muxerCodec,width,height,frameRate:fps},fastStart:'in-memory',firstTimestampBehavior:'strict'});
      let failure=null;
      encoder=new VideoEncoder({output(chunk,metadata){try{if(!matchingDimensions(metadata,width,height))throw Error('Encoder changed output dimensions.');muxer.addVideoChunk(chunk,metadata);}catch(error){failure=error;}},error(error){failure=error;}});
      encoder.configure(selected.config);
      for(let i=0;i<frames;i++){
        checkAbort(signal);if(failure)throw failure;
        CanopyEngine.draw(high,model,study,i/(frames-1),options);
        if(high!==canvas){
          // This is a pixel-space resize, never an artwork-space transform.
          // Clear the probe/previous frame completely before copying the image.
          context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';
          context.clearRect(0,0,width,height);context.drawImage(high,0,0,width,height);
        }
        const timestamp=Math.round(i*1e6/fps),duration=Math.round((i+1)*1e6/fps)-timestamp;
        const frame=new VideoFrame(canvas,{timestamp,duration});
        try{encoder.encode(frame,{keyFrame:i%120===0});}finally{frame.close();}
        if(encoder.encodeQueueSize>=queueLimit)await flush(encoder,signal);
        if(i%Math.max(1,Math.floor(4*1080/width))===0){onProgress(Math.round((i+1)/frames*98),`${width} × ${height} · ${selected.name} · ${i+1} / ${frames} frames · ${Math.round((i+1)/frames*100)}%`);await pause();}
      }
      onProgress(99,'Finishing MP4…');await flush(encoder,signal);checkAbort(signal);if(failure)throw failure;
      muxer.finalize();onProgress(100,`${width} × ${height} / 60 fps MP4 ready`);
      return new Blob([target.buffer],{type:'video/mp4'});
    }catch(error){checkAbort(signal);throw error;}
    finally{if(encoder&&encoder.state!=='closed')encoder.close();canvas.width=canvas.height=high.width=high.height=1;}
  }
  window.CanopyMovie={render};
})();
