/* Deterministic, offline H.264 export. No real-time capture or dropped frames. */
(() => {
  'use strict';
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function render({model,study,options,signal,onProgress=()=>{}}){
    if(!window.VideoEncoder||!window.VideoFrame||!window.Mp4Muxer)throw Error('This browser cannot encode MP4. Open the app in a current Chrome, Edge or Safari over localhost or HTTPS.');
    const width=1080,height=1080,fps=60,frames=Math.round(options.duration*fps);
    let config;
    for(const hardwareAcceleration of ['prefer-hardware','prefer-software']){
      const candidate={codec:'avc1.64002a',width,height,framerate:fps,bitrate:24_000_000,hardwareAcceleration,avc:{format:'avc'}};
      try{const support=await VideoEncoder.isConfigSupported(candidate);if(support.supported){config=support.config;break;}}catch{}
    }
    if(!config)throw Error('H.264 encoding at 1080 × 1080 / 60 fps is unavailable. Try Chrome or Edge on this computer.');
    const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height,frameRate:fps},fastStart:'in-memory',firstTimestampBehavior:'strict'});
    let failure=null;
    const encoder=new VideoEncoder({output(chunk,metadata){try{muxer.addVideoChunk(chunk,metadata);}catch(error){failure=error;}},error(error){failure=error;}});
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const high=document.createElement('canvas');high.width=width*2;high.height=height*2;
    const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    const check=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(failure)throw failure;};
    try{
      encoder.configure(config);
      for(let i=0;i<frames;i++){
        check();
        CanopyEngine.draw(high,model,study,i/(frames-1),options);
        context.drawImage(high,0,0,width,height);
        const timestamp=Math.round(i*1e6/fps),duration=Math.round((i+1)*1e6/fps)-timestamp;
        const frame=new VideoFrame(canvas,{timestamp,duration});
        try{encoder.encode(frame,{keyFrame:i%120===0});}finally{frame.close();}
        // Bound encoder memory and return control for progress, cancellation and UI.
        if(encoder.encodeQueueSize>=8)await encoder.flush();
        if(i%4===0){onProgress(Math.round((i+1)/frames*98),`Rendering ${i+1} / ${frames} frames · ${Math.round((i+1)/frames*100)}%`);await pause();}
      }
      onProgress(99,'Finishing MP4…');await encoder.flush();check();muxer.finalize();onProgress(100,'MP4 ready');
      return new Blob([target.buffer],{type:'video/mp4'});
    }finally{if(encoder.state!=='closed')encoder.close();canvas.width=canvas.height=high.width=high.height=1;}
  }
  window.CanopyMovie={render};
})();
