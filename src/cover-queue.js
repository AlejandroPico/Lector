export class VisibleCoverQueue{
  constructor({load,done,onState=()=>{},Observer=globalThis.IntersectionObserver}){
    this.load=load;this.done=done;this.onState=onState;this.Observer=Observer;this.failed=new Set();this.enabled=false;this.pending=new Map();this.running=false;this.completed=0
  }
  observe(targets,enabled){
    this.observer?.disconnect();this.pending.clear()
    if(!enabled){this.cancel();return}
    this.enabled=true
    if(!this.Observer)return
    this.observer=new this.Observer(entries=>{
      for(const entry of entries){const item=targets.get(entry.target);if(!item)continue
        if(entry.isIntersecting&&!this.failed.has(item.id))this.pending.set(item.id,item);else this.pending.delete(item.id)
      }
      this.pump()
    },{threshold:0.01})
    for(const target of targets.keys())this.observer.observe(target)
  }
  async pump(){
    if(this.running||!this.enabled)return
    this.running=true
    while(this.enabled&&this.pending.size){
      const [id,item]=this.pending.entries().next().value;this.pending.delete(id)
      if(this.failed.has(id))continue
      const controller=this.controller=new AbortController();this.onState({active:true,completed:this.completed})
      try{await this.load(item,controller.signal);if(!controller.signal.aborted){this.completed++;await this.done(item)}}catch(error){if(!controller.signal.aborted)this.failed.add(id)}
      this.controller=null
    }
    this.running=false;this.onState({active:false,completed:this.completed})
  }
  cancel(){this.enabled=false;this.pending.clear();this.observer?.disconnect();this.controller?.abort();this.onState({active:false,completed:this.completed})}
  retry(){this.failed.clear()}
}
