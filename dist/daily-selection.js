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

// Each page load owns its history; refreshing or opening another tab starts fresh.
export function createSessionHistory(){
  const ids=new Set();
  return {
    read(){return new Set(ids);},
    mark(id){ids.add(String(id));}
  };
}
