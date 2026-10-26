const nyFormatter = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',timeZoneName:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function nyTime(now=new Date()) {
  const p=Object.fromEntries(nyFormatter.formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute),second:Number(p.second),timeZone:p.timeZoneName};
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

export function displayCaptureDate(date){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date||''));
  if(!match)return date||'';
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(match[2])-1];
  return month?`${month}/${match[3]}/${match[1]}`:date;
}

export function displayLocation(photo){
  const camera=photo.camera_location,address=photo.location_address;
  if(!camera||!Number.isFinite(camera.latitude)||!Number.isFinite(camera.longitude)||!address)return '';
  const text=value=>typeof value==='string'?value.trim():'';
  const street=text(address.street),city=text(address.city),zip=text(address.postal_code),region=text(address.region);
  if(!street||!city||!/^\d{5}(?:-\d{4})?$/.test(zip))return '';
  const titleCase=value=>value.toLowerCase().replace(/(^|[\s-])([a-z])/g,(_,space,letter)=>space+letter.toUpperCase());
  return `${titleCase(street)}\n${titleCase(city)}${region?', '+region.toUpperCase():''} ${zip}`;
}

export function photoMetadataRows(photo){
  const present=value=>typeof value==='string'&&value.trim()?value.trim():'';
  const time=Number.isInteger(photo.minute)&&photo.minute>=0&&photo.minute<1440?displayTime(photo.minute):null;
  const date=present(photo.capture_date);
  const parsedDate=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(date+'T12:00:00Z'):null;
  const formattedDate=parsedDate&&!Number.isNaN(parsedDate.valueOf())?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(parsedDate):date;
  const artist=present(photo.artist),attribution=present(photo.attribution);
  const author=attribution&&attribution!==artist?(attribution.includes(artist)?attribution:[artist,attribution].filter(Boolean).join(' · ')):artist;
  return [
    ['Description',present(photo.description)],
    ['Time',time?`${time.clock} ${time.period}`:''],
    ['Date',formattedDate],
    ['Location',displayLocation(photo)],
    ['Source',present(photo.credit)],
    ['Author',author],
    ['License',present(photo.license)]
  ].filter(([,value])=>value);
}
