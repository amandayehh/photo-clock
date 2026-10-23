const nyFormatter = new Intl.DateTimeFormat('en-GB', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function nyTime(now=new Date()) {
  const p=Object.fromEntries(nyFormatter.formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute),second:Number(p.second)};
}
export function priorDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
export function displayTime(minute){const h=Math.floor(minute/60);return {clock:`${h%12||12}:${String(minute%60).padStart(2,'0')}`,period:h<12?'AM':'PM'};}
export function buildIndex(photos){const index=new Map();for(const p of photos){if(!Number.isInteger(p.minute)||p.minute<0||p.minute>1439)continue;const rows=index.get(p.minute)||[];rows.push(p);index.set(p.minute,rows);}return index;}
export function findMoment(index,minute,date){for(let lag=0;lag<1440;lag++){const m=(minute-lag+1440)%1440;if(index.has(m))return {minute:m,date:minute-lag<0?priorDate(date):date,lag,photos:index.get(m)};}return null;}
export function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function rankCandidates(photos,date,minute){
  // Choose photographer groups first so a burst does not receive extra lottery entries.
  const authors=new Map();for(const p of photos){const key=p.artist||String(p.pageid);if(!authors.has(key))authors.set(key,[]);authors.get(key).push(p);}
  const seed=`nyc|${date}|${minute}`;
  const ordered=[...authors].sort((a,b)=>hash(seed+'|author|'+a[0])-hash(seed+'|author|'+b[0])||a[0].localeCompare(b[0]));
  return ordered.flatMap(([author,items])=>{
    const bursts=new Map();for(const p of items){const key=`${p.capture_date}|${p.camera_model||''}`;if(!bursts.has(key))bursts.set(key,[]);bursts.get(key).push(p);}
    return [...bursts].sort((a,b)=>hash(seed+'|'+author+'|'+a[0])-hash(seed+'|'+author+'|'+b[0])||a[0].localeCompare(b[0])).flatMap(([,group])=>group.sort((a,b)=>{
      const confidence=p=>Number(p.timezone_status==='explicit_offset')*2+Number(p.relevance==='camera_gps_in_nyc');
      return confidence(b)-confidence(a)||hash(seed+'|'+a.pageid)-hash(seed+'|'+b.pageid)||a.pageid-b.pageid;
    }));
  });
}
