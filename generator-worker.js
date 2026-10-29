importScripts('source-data.js','contour-curves.js?v=17','coral.js?v=17','folded.js?v=11','graph-data.js?v=14','graph-growth.js?v=17','generated.js?v=14','engine.js?v=17');
onmessage=({data})=>{try{postMessage({model:CanopyEngine.create(data.seed,data.settings)});}catch(error){postMessage({error:error.message});}};
