import {priorDate} from './core.js';

export function* unseenCandidates(index,state,seen,choose){
  const yielded=new Set();
  for(let lag=0;lag<1440;lag++){
    const minute=(state.minute-lag+1440)%1440,bucket=index.get(minute);
    if(!bucket)continue;
    const date=state.minute-lag<0?priorDate(state.date):state.date;
    for(const photo of choose(bucket,date,minute)){
      const id=String(photo.pageid);
      if(seen.has(id)||yielded.has(id))continue;
      yielded.add(id);yield photo;
    }
  }
}

export function createDailyHistory(storage,key='nyc-photo-clock-shown-v1'){
  let day='',ids=new Set();
  function read(date){
    if(day!==date){day=date;ids=new Set();}
    try{
      const saved=JSON.parse(storage?.getItem(key)||'null');
      if(saved?.date===date&&Array.isArray(saved.ids)){
        for(const id of saved.ids)if(typeof id==='string'||typeof id==='number')ids.add(String(id));
      }
    }catch{/* Private storage restrictions or damaged data do not stop the clock. */}
    return new Set(ids);
  }
  return {
    read,
    mark(date,id){
      read(date);ids.add(String(id));
      try{storage?.setItem(key,JSON.stringify({date,ids:[...ids]}));}catch{/* Keep the history in memory if storage is unavailable. */}
    }
  };
}
