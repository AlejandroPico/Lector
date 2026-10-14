import {createWorker} from 'tesseract.js'
// This dedicated coordinator owns every child worker. Cancel also terminates
// initialization/downloads before createWorker has returned its public handle.
const NativeWorker=self.Worker,children=new Set()
self.Worker=class extends NativeWorker{constructor(...args){super(...args);children.add(this)}}
let engine
self.onmessage=async({data})=>{
  if(data.cancel){for(const child of children)child.terminate();self.close();return}
  try{
    if(!engine)engine=await createWorker(data.language,1,{workerPath:data.workerPath,corePath:data.corePath,langPath:data.corePath,workerBlobURL:false,logger:event=>self.postMessage({progress:event.progress,status:event.status}),errorHandler:()=>{}})
    await engine.setParameters({tessedit_pageseg_mode:3})
    const {data:result}=await engine.recognize(data.image)
    self.postMessage({text:result.text,confidence:result.confidence})
  }catch(error){self.postMessage({error:String(error?.message??error)})}
}
