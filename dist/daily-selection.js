import {priorDate} from './core.js';

// Resolve the time-of-day bucket onto the clock's day, not the photo's historical date.
export function photoMoment(photo,state){
  return {date:photo.minute>state.minute?priorDate(state.date):state.date,minute:photo.minute};
}

export function* unseenCandidates(index,state,seen,choose,earliest=null){
  const yielded=new Set();
  for(let lag=0;lag<1440;lag++){
    const minute=(state.minute-lag+1440)%1440,bucket=index.get(minute);
    const date=state.minute-lag<0?priorDate(state.date):state.date;
    if(earliest&&(date<earliest.date||date===earliest.date&&minute<earliest.minute))break;
    if(!bucket)continue;
    for(const photo of choose(bucket,date,minute)){
      const id=String(photo.pageid);
      if(seen.has(id)||yielded.has(id))continue;
      yielded.add(id);yield photo;
    }
  }
}

// History belongs to this page load and resets when the New York calendar date changes.
export function createSessionHistory(){
  const ids=new Set();
  let date=null;
  return {
    startDay(nextDate){
      if(nextDate===date)return false;
      const changed=date!==null;
      date=nextDate;
      if(changed)ids.clear();
      return changed;
    },
    read(){return new Set(ids);},
    mark(id){ids.add(String(id));}
  };
}
