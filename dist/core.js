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
export function shuffleCandidates(photos,random=Math.random){
  // Each distinct photograph has an equal chance, regardless of author or metadata rank.
  const shuffled=[...new Map(photos.map(photo=>[photo.pageid,photo])).values()];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  return shuffled;
}
export function createCandidateSelector(random=Math.random){
  const orders=new Map();
  return (photos,date,minute)=>{
    const key=`${date}|${minute}`;
    if(!orders.has(key)){
      orders.set(key,shuffleCandidates(photos,random));
      if(orders.size>1440)orders.delete(orders.keys().next().value);
    }
    // Retries and gap minutes reuse the draw; callers may append fallbacks safely.
    return [...orders.get(key)];
  };
}
