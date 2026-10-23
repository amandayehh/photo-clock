import {nyTime,displayTime,buildIndex,findMoment,rankCandidates,priorDate} from './core.js';
import {cleanTitle,stackLayout,imageDimensions,landingPose,entranceFrames,entranceTiming,settledTransform} from './stack.js';
const $=id=>document.getElementById(id);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let index=new Map(),photos=[],cards=[],current=null,activeKey='',busy=false,generation=0,retryAt=0,lastClock='';
const failed=new Set();
function viewport(){return {width:window.innerWidth,height:window.innerHeight};}
function updateClock(){const state=nyTime(),t=displayTime(state.minute),text=`${t.clock} ${t.period}`;if(lastClock!==text){$('clock').textContent=text;$('clock').setAttribute('aria-label',`${text}, New York time`);lastClock=text;}return state;}
function href(element,url){if(/^https:\/\//.test(url||''))element.href=url;else element.removeAttribute('href');}
function showCredits(photo){$('credit-title').textContent=cleanTitle(photo.title);$('credit-author').textContent=[photo.attribution,photo.artist&&(!photo.attribution||!photo.attribution.includes(photo.artist))?photo.artist:'',photo.credit&&photo.credit!=='Own work'&&photo.credit!==photo.artist?photo.credit:''].filter(Boolean).join(' · ');const t=displayTime(photo.minute);$('credit-capture').textContent=`Recorded at ${t.clock} ${t.period} · ${photo.capture_date}`;$('credit-evidence').textContent=photo.timezone_status==='explicit_offset'?'Capture time includes a recorded time-zone offset.':'Camera time is assumed local to New York; the camera clock has not been independently verified.';$('credit-license').textContent=photo.license;href($('credit-license'),photo.license_url||photo.source_url);href($('credit-source'),photo.source_url);$('credits').showModal();}
function layoutCards(){const v=viewport(),layout=stackLayout(v.width,v.height,photos.map(p=>p.width/p.height));for(const entry of cards){entry.animation?.cancel();entry.animation=null;entry.element.classList.remove('arriving');const size=imageDimensions(layout.area,entry.ratio);const pose=landingPose(entry.photo.pageid,entry.sequence,Math.min(v.width,v.height));entry.pose=pose;const el=entry.element;el.style.width=`${size.width+layout.pad*2}px`;el.style.setProperty('--image-height',`${size.height}px`);el.style.setProperty('--pad',`${layout.pad}px`);el.style.setProperty('--gap',`${layout.gap}px`);el.style.setProperty('--radius',`${layout.radius}px`);
  // Long filenames stay on one line; the complete cleaned name is accessible in credits.
  const titleSize=Math.min(layout.titleSize,Math.max(10,size.width/(Math.max(1,entry.title.length)*.53)));
  el.style.setProperty('--title-size',`${titleSize}px`);el.style.transform=settledTransform(pose);
}}
// Shared by automatic arrivals and the temporary, explicitly requested replay.
function animateCard(entry){
  if(!entry)return;
  entry.animation?.cancel();
  const card=entry.element;
  card.classList.add('arriving');
  const animation=card.animate(entranceFrames(entry.pose,window.innerHeight,card.offsetHeight),entranceTiming);
  entry.animation=animation;
  animation.onfinish=()=>{if(entry.animation===animation){entry.animation=null;card.classList.remove('arriving');}};
}
function printPhoto(photo,img){if(current?.pageid===photo.pageid)return;for(const old of cards){old.element.tabIndex=-1;old.element.setAttribute('aria-hidden','true');old.element.style.pointerEvents='none';}
  const card=document.createElement('button');card.type='button';card.className='card';const title=cleanTitle(photo.title);card.setAttribute('aria-label',`${title}. View photographer and license details.`);card.title='View photograph credits';const label=document.createElement('span');label.className='card-title';label.textContent=title;img.className='card-image';img.alt='';img.draggable=false;card.append(label,img);card.addEventListener('click',()=>showCredits(photo));$('pile').append(card);const entry={element:card,photo,title,ratio:photo.width/photo.height,sequence:cards.length,pose:null,animation:null};cards.push(entry);current=photo;layoutCards();$('status').hidden=true;$('retry').hidden=true;
  $('replay').hidden=false;
  if(!reducedMotion.matches)animateCard(entry);
}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();const timeout=setTimeout(()=>{img.onload=img.onerror=null;reject(new Error('Image timeout'));},10000);img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=()=>{clearTimeout(timeout);reject(new Error('Image unavailable'));};img.referrerPolicy='no-referrer';img.src=url;});}
function alternatives(moment){let choices=rankCandidates(moment.photos,moment.date,moment.minute),cursor=moment.minute-1,day=moment.date;const seen=new Set(choices.map(p=>p.pageid));while(choices.length<8){if(cursor<0){day=priorDate(day);cursor=1439;}const previous=findMoment(index,cursor,day);if(!previous)break;const add=rankCandidates(previous.photos,previous.date,previous.minute).filter(p=>!seen.has(p.pageid));if(!add.length)break;choices.push(...add);add.forEach(p=>seen.add(p.pageid));cursor=previous.minute-1;day=previous.date;}return choices;}
async function refresh(force=false){if(!index.size||busy&&!force)return;const state=updateClock(),moment=findMoment(index,state.minute,state.date);if(!moment)return;const key=`${moment.date}|${moment.minute}`;if(!force&&key===activeKey)return;activeKey=key;const token=++generation;busy=true;let attempts=0;
  for(const photo of alternatives(moment)){if(token!==generation)return;if(failed.has(photo.pageid))continue;if(++attempts>5)break;
    // A missed minute or retry never prints the already visible card again.
    if(current?.pageid===photo.pageid){busy=false;retryAt=Date.now()+60000;return;}
    try{const img=await loadImage(photo.thumbnail_url);if(token!==generation)return;const latest=nyTime(),target=findMoment(index,latest.minute,latest.date);if(target&&`${target.date}|${target.minute}`!==key){busy=false;activeKey='';refresh();return;}printPhoto(photo,img);busy=false;retryAt=photo.minute===moment.minute?0:Date.now()+60000;return;}catch{failed.add(photo.pageid);}
  }
  if(token!==generation)return;busy=false;retryAt=Date.now()+60000;if(!current){$('status').textContent='Photographs are temporarily unavailable.';$('retry').hidden=false;}
}
async function init(){updateClock();try{const response=await fetch('./photos.json');if(!response.ok)throw new Error('Collection unavailable');const data=await response.json();photos=data.photos;index=buildIndex(photos);if(!index.size)throw new Error('Empty collection');await refresh();}catch{$('status').textContent='The collection could not load.';$('retry').hidden=false;}}
setInterval(()=>{updateClock();if(retryAt&&Date.now()>=retryAt&&!busy){retryAt=0;failed.clear();refresh(true);}else refresh();},1000);
window.addEventListener('resize',layoutCards);
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)layoutCards();});
window.addEventListener('online',()=>{failed.clear();refresh(true);});
// Refresh time on resume, but don't replace or reprint an unchanged held moment.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateClock();refresh();}});
$('retry').addEventListener('click',()=>{if(!index.size)init();else{failed.clear();refresh(true);}});
$('replay').addEventListener('click',()=>animateCard(cards.at(-1)));
$('close-credits').addEventListener('click',()=>$('credits').close());
$('credits').addEventListener('click',event=>{if(event.target===$('credits')){const r=$('credits').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('credits').close();}});
init();
