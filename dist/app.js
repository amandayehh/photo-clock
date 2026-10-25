import {applySmoothing} from './smoothing.js';
import {bindCardInteraction,releaseHeldCard} from './interaction.js';
import {createLinkDropTarget} from './drag-target.js';
import {gridColumns,gridLayout,cardTransform} from './grid.js';
import {captureCards,createViewMotion} from './view-motion.js';
import {unseenCandidates,createDailyHistory} from './daily-selection.js';
import {nyTime,displayTime,displayCaptureDate,displayLocation,photoMetadataRows,buildIndex,createCandidateSelector} from './core.js';
import {cleanTitle,stackLayout,imageDimensions,landingPose,entranceFrames,entranceTiming} from './stack.js';
const $=id=>document.getElementById(id);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const viewMotion=createViewMotion();
const linkDropTarget=createLinkDropTarget($('link-drop-target'),url=>window.open(url,'_blank','noopener,noreferrer'));
let index=new Map(),photos=[],cards=[],current=null,activeKey='',busy=false,generation=0,retryAt=0,lastClock='';
let gridMode=false;
const failed=new Set();
const chooseCandidates=createCandidateSelector();
let storage;try{storage=window.localStorage;}catch{}
const shownToday=createDailyHistory(storage);
let displayedKey='';
function updateCardLayers(){
  for(const entry of cards)entry.element.style.zIndex=String(entry.flipped?cards.length+1:entry.sequence+1);
}
function viewport(){return {width:window.innerWidth,height:window.innerHeight};}
function updateClock(){const state=nyTime(),t=displayTime(state.minute),text=`${t.clock} ${t.period}`;if(lastClock!==text){$('clock').textContent=text;$('clock').setAttribute('aria-label',`${text}, New York time`);lastClock=text;}return state;}
function href(element,url){if(/^https:\/\//.test(url||''))element.href=url;else element.removeAttribute('href');}
function showCredits(photo){const location=displayLocation(photo);$('credit-location').hidden=!location;$('credit-address').textContent=location.replace('\n',', ');$('credit-title').textContent=cleanTitle(photo.title);$('credit-author').textContent=[photo.attribution,photo.artist&&(!photo.attribution||!photo.attribution.includes(photo.artist))?photo.artist:'',photo.credit&&photo.credit!=='Own work'&&photo.credit!==photo.artist?photo.credit:''].filter(Boolean).join(' · ');const t=displayTime(photo.minute);$('credit-capture').textContent=`Recorded at ${t.clock} ${t.period} · ${photo.capture_date}`;$('credit-evidence').textContent=photo.timezone_status==='explicit_offset'?'Capture time includes a recorded time-zone offset.':'Camera time is assumed local to New York; the camera clock has not been independently verified.';$('credit-license').textContent=photo.license;href($('credit-license'),photo.license_url||photo.source_url);href($('credit-source'),photo.source_url);$('credits').showModal();}
function homePose(entry){const v=viewport();return gridMode?{x:0,y:0,angle:0}:landingPose(entry.photo.pageid,entry.sequence,Math.min(v.width,v.height));}
function layoutCards(){
  viewMotion.finish();
  const v=viewport(),stack=stackLayout(v.width,v.height,photos.map(p=>p.width/p.height));
  $('pile').style.setProperty('--grid-columns',gridColumns(v.width));
  const widths=gridMode?cards.map(entry=>entry.slot.getBoundingClientRect().width):[];
  const layout=gridMode?gridLayout(widths.length?Math.min(...widths):1,cards.map(entry=>entry.ratio)):stack;
  for(const entry of cards){
    entry.animation?.cancel();entry.animation=null;entry.element.classList.remove('arriving');
    const size=imageDimensions(layout.area,entry.ratio);
    const pose=entry.position||homePose(entry);
    if(entry.position&&!gridMode){pose.x=Math.max(-v.width/2+32,Math.min(v.width/2-32,pose.x));pose.y=Math.max(-v.height/2+32,Math.min(v.height/2-32,pose.y));}
    entry.pose=pose;
    const el=entry.element;el.style.width=`${size.width+layout.pad*2}px`;el.style.setProperty('--image-height',`${size.height}px`);el.style.setProperty('--pad',`${layout.pad}px`);el.style.setProperty('--gap',`${layout.gap}px`);el.style.setProperty('--radius',`${layout.radius}px`);
  // Titles keep the same size and truncate to one line on the front.
  el.style.setProperty('--title-size',`${layout.titleSize}px`);el.style.setProperty('--stamp-size',`${layout.stampSize}px`);el.style.transform=cardTransform(pose,gridMode);applySmoothing(entry,size,layout);
}}
function toggleView(){
  releaseHeldCard();
  const before=reducedMotion.matches?null:captureCards(cards);
  viewMotion.finish();
  gridMode=!gridMode;
  document.body.classList.toggle('grid-mode',gridMode);
  $('view-toggle').setAttribute('aria-pressed',String(gridMode));
  for(const label of $('view-toggle').querySelectorAll('[data-view]'))label.classList.toggle('selected',label.dataset.view===(gridMode?'grid':'stacked'));
  for(const entry of cards)entry.position=null;
  $('pile').scrollTop=0;
  layoutCards();
  if(before)viewMotion.play(cards,before);
}
// Shared by automatic arrivals and the temporary, explicitly requested replay.
function animateCard(entry){
  if(!entry)return;
  entry.animation?.cancel();
  const card=entry.element;
  card.classList.add('arriving');
  const frames=gridMode?[
    {transform:cardTransform({...entry.pose,y:entry.pose.y-24},true),opacity:1},
    {transform:cardTransform(entry.pose,true),opacity:1}
  ]:entranceFrames(entry.pose,window.innerHeight,card.offsetHeight);
  const animation=card.animate(frames,entranceTiming);
  entry.animation=animation;
  animation.onfinish=()=>{if(entry.animation===animation){entry.animation=null;card.classList.remove('arriving');}};
}
function returnCard(entry){
  if(!entry.position)return;
  const from=cardTransform(entry.pose,gridMode);
  entry.position=null;
  entry.pose=homePose(entry);
  const to=cardTransform(entry.pose,gridMode);
  entry.animation?.cancel();entry.animation=null;
  entry.element.style.transform=to;
  if(!reducedMotion.matches){
    const animation=entry.element.animate([{transform:from},{transform:to}],{duration:450,easing:entranceTiming.easing});
    entry.animation=animation;
    animation.onfinish=()=>{if(entry.animation===animation)entry.animation=null;};
  }
}
function printPhoto(photo,img){
  if(current?.pageid===photo.pageid)return;
  const card=document.createElement('button');card.type='button';card.className='card';
  const title=cleanTitle(photo.title);
  card.setAttribute('aria-label',`${title}. Hold still for 0.6 seconds to flip. Drag to the right edge and release to open Wikimedia in a new tab; release elsewhere to return. Keyboard: hold Space for details, arrow keys to move, Enter for full credits and source link.`);
  card.setAttribute('aria-pressed','false');
  const flipper=document.createElement('span');flipper.className='card-flipper';
  const front=document.createElement('span');front.className='card-front';
  const label=document.createElement('span');label.className='card-title';label.textContent=title;
  img.className='card-image';img.alt='';img.draggable=false;
  const header=document.createElement('span');header.className='card-header';
  const stamp=document.createElement('span');stamp.className='card-stamp';
  const time=displayTime(photo.minute);
  const captureTime=document.createElement('span');captureTime.textContent=`${time.clock} ${time.period}`;
  const captureDate=document.createElement('time');captureDate.dateTime=photo.capture_date;captureDate.textContent=displayCaptureDate(photo.capture_date);
  stamp.setAttribute('aria-label',`Photographed at ${time.clock} ${time.period} on ${photo.capture_date}`);
  stamp.append(captureTime,captureDate);header.append(label);front.append(header,img,stamp);
  const back=document.createElement('span');back.className='card-back';back.setAttribute('aria-hidden','true');
  const backContent=document.createElement('span');backContent.className='back-content';back.append(backContent);
  const backHeader=document.createElement('span');backHeader.className='card-header';
  const backTitle=label.cloneNode(true);backTitle.classList.add('back-title');
  backHeader.append(backTitle);backContent.append(backHeader);
  const metadata=document.createElement('span');metadata.className='card-metadata';
  for(const [name,value] of photoMetadataRows(photo)){
    const term=document.createElement('span');term.className='metadata-label';term.textContent=name;
    const detail=document.createElement('span');detail.className='metadata-value';detail.textContent=value;
    if(name==='Description')detail.classList.add('metadata-description');
    if(name==='Location')detail.title='Approximate nearby address from the recorded camera coordinates. Address data: NYC Planning GeoSearch.';
    metadata.append(term,detail);
  }
  if(metadata.childElementCount)backContent.append(metadata);
  const slot=document.createElement('div');slot.className='photo-slot';
  flipper.append(front,back);card.append(flipper);slot.append(card);$('pile').append(slot);
  const entry={element:card,slot,front,image:img,photo,title,ratio:photo.width/photo.height,sequence:cards.length,flipped:false,pose:null,position:null,animation:null};
  bindCardInteraction(card,{
    onPress:pressed=>document.body.classList.toggle('card-pressed',pressed),
    onLift:()=>{entry.animation?.cancel();entry.animation=null;card.classList.remove('arriving');},
    onMove:(dx,dy)=>{
      const v=viewport();
      // Keep the card's center within the window while dragging.
      entry.position=gridMode?{...entry.pose,x:entry.pose.x+dx,y:entry.pose.y+dy}:{...entry.pose,x:Math.max(-v.width/2+32,Math.min(v.width/2-32,entry.pose.x+dx)),y:Math.max(-v.height/2+32,Math.min(v.height/2-32,entry.pose.y+dy))};
      entry.pose=entry.position;card.style.transform=cardTransform(entry.pose,gridMode);
    },
    onDrag:point=>linkDropTarget.show(point),
    onRelease:gesture=>{returnCard(entry);linkDropTarget.release(photo.source_url,gesture);},
    onFlip:held=>{entry.flipped=held;updateCardLayers();card.classList.toggle('held',held);card.setAttribute('aria-pressed',String(held));front.setAttribute('aria-hidden',String(held));back.setAttribute('aria-hidden',String(!held));},
    onDetails:()=>showCredits(photo)
  });
  cards.push(entry);updateCardLayers();current=photo;layoutCards();$('status').hidden=true;$('retry').hidden=true;
  $('replay').hidden=false;
  if(!reducedMotion.matches)animateCard(entry);
}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();const timeout=setTimeout(()=>{img.onload=img.onerror=null;reject(new Error('Image timeout'));},10000);img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=()=>{clearTimeout(timeout);reject(new Error('Image unavailable'));};img.referrerPolicy='no-referrer';img.src=url;});}
async function refresh(force=false){
  if(!index.size||busy&&!force)return;
  const state=updateClock(),key=`${state.date}|${state.minute}`;
  if(key===displayedKey||!force&&key===activeKey)return;
  activeKey=key;
  const token=++generation;busy=true;let attempts=0,eligible=0;
  const seen=shownToday.read(state.date);
  if(current)seen.add(String(current.pageid));
  for(const photo of unseenCandidates(index,state,seen,chooseCandidates)){
    if(token!==generation)return;
    eligible++;
    if(failed.has(photo.pageid))continue;
    if(++attempts>5)break;
    try{
      const img=await loadImage(photo.thumbnail_url);
      if(token!==generation)return;
      const latest=nyTime();
      if(`${latest.date}|${latest.minute}`!==key){busy=false;activeKey='';refresh();return;}
      // Another tab may have displayed this photo while its image was loading.
      if(shownToday.read(state.date).has(String(photo.pageid)))continue;
      printPhoto(photo,img);
      shownToday.mark(state.date,photo.pageid);
      displayedKey=key;busy=false;retryAt=0;return;
    }catch{failed.add(photo.pageid);}
  }
  if(token!==generation)return;
  busy=false;retryAt=eligible?Date.now()+60000:0;
  if(!current){
    $('status').textContent=eligible?'Photographs are temporarily unavailable.':'All photographs have been shown today. New photographs resume at midnight in New York.';
    $('status').hidden=false;$('retry').hidden=!eligible;
  }
}
async function init(){updateClock();try{const response=await fetch('./photos.json');if(!response.ok)throw new Error('Collection unavailable');const data=await response.json();photos=data.photos;index=buildIndex(photos);if(!index.size)throw new Error('Empty collection');await refresh();}catch{$('status').textContent='The collection could not load.';$('status').hidden=false;$('retry').hidden=false;}}
setInterval(()=>{updateClock();if(retryAt&&Date.now()>=retryAt&&!busy){retryAt=0;failed.clear();refresh(true);}else refresh();},1000);
window.addEventListener('resize',()=>{releaseHeldCard();layoutCards();});
window.addEventListener('blur',releaseHeldCard);
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)layoutCards();});
window.addEventListener('online',()=>{failed.clear();refresh(true);});
// Refresh time on resume, but don't replace or reprint an unchanged held moment.
 document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseHeldCard();else{updateClock();refresh();}});
$('retry').addEventListener('click',()=>{if(!index.size)init();else{failed.clear();refresh(true);}});
$('replay').addEventListener('click',()=>{releaseHeldCard();viewMotion.finish();animateCard(cards.at(-1));});
$('view-toggle').addEventListener('click',toggleView);
$('close-credits').addEventListener('click',()=>$('credits').close());
$('credits').addEventListener('click',event=>{if(event.target===$('credits')){const r=$('credits').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('credits').close();}});
init();
