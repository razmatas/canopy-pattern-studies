importScripts('source-data.js','coral.js?v=13','folded.js?v=11','graph-data.js?v=14','graph-growth.js?v=14','generated.js?v=14','engine.js?v=14');
onmessage=({data})=>{try{postMessage({model:CanopyEngine.create(data.seed,data.settings)});}catch(error){postMessage({error:error.message});}};
