import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nyTime,priorDate,displayTime,displayCaptureDate,photoMetadataRows,buildIndex,findMoment,shuffleCandidates,createCandidateSelector} from '../dist/core.js';
const photo=(pageid,minute,artist='A')=>({pageid,minute,artist,capture_date:'2020-01-01',camera_model:'Camera',relevance:'camera_gps_in_nyc',timezone_status:'assumed_local'});
test('exact match and held minute select the same moment',()=>{const i=buildIndex([photo(1,121),photo(2,124)]);assert.equal(findMoment(i,121,'2026-10-23').minute,121);assert.equal(findMoment(i,123,'2026-10-23').minute,121);assert.equal(findMoment(i,123,'2026-10-23').lag,2);assert.equal(findMoment(i,124,'2026-10-23').minute,124);});
test('initial visit across midnight chooses previous calendar day',()=>{const m=findMoment(buildIndex([photo(1,1438),photo(2,30)]),2,'2026-01-01');assert.equal(m.minute,1438);assert.equal(m.date,'2025-12-31');assert.equal(m.lag,4);});
test('empty index and invalid minute records do not produce a photo',()=>{assert.equal(findMoment(new Map(),30,'2026-10-23'),null);assert.equal(buildIndex([photo(1,-1),photo(2,1440)]).size,0);});
test('NYC clock accounts for spring-forward and fall-back',()=>{assert.equal(nyTime(new Date('2026-03-08T06:59:00Z')).minute,119);assert.equal(nyTime(new Date('2026-03-08T07:00:00Z')).minute,180);assert.equal(nyTime(new Date('2026-11-01T05:30:00Z')).minute,90);assert.equal(nyTime(new Date('2026-11-01T06:30:00Z')).minute,90);});
test('midnight, noon, and leap-day dates are represented correctly',()=>{assert.deepEqual(displayTime(0),{clock:'12:00',period:'AM'});assert.deepEqual(displayTime(720),{clock:'12:00',period:'PM'});assert.equal(priorDate('2024-03-01'),'2024-02-29');assert.equal(nyTime(new Date('2026-10-23T04:00:00Z')).minute,0);});
test('every photo has the same chance across all three-photo shuffle outcomes',()=>{
  const photos=[photo(1,30,'A'),photo(2,30,'A'),{...photo(3,30,'B'),timezone_status:'explicit_offset'}];
  const orders=new Set(),counts=new Map();
  for(const first of [0,1/3,2/3])for(const second of [0,.5]){
    const values=[first,second];
    const result=shuffleCandidates(photos,()=>values.shift());
    orders.add(result.map(p=>p.pageid).join(','));
    counts.set(result[0].pageid,(counts.get(result[0].pageid)||0)+1);
  }
  assert.equal(orders.size,6);
  assert.deepEqual([...counts.values()],[2,2,2]);
  assert.deepEqual(photos.map(p=>p.pageid),[1,2,3]);
});
test('duplicate results do not give a photo extra chances',()=>{
  const a=photo(1,30),b=photo(2,30);
  assert.deepEqual(shuffleCandidates([a,a,b],()=>0).map(p=>p.pageid),[2,1]);
  assert.deepEqual(shuffleCandidates([],()=>0),[]);
  assert.deepEqual(shuffleCandidates([a],()=>0),[a]);
});
test('a minute keeps its random order during retries and draws again for a new minute or session',()=>{
  const photos=[photo(1,30),photo(2,30),photo(3,30)];
  let calls=0;
  const choose=createCandidateSelector(()=>{calls++;return calls<=2?0:.99;});
  const first=choose(photos,'2026-10-23',30);
  first.push(photo(4,29));
  assert.deepEqual(choose([...photos].reverse(),'2026-10-23',30).map(p=>p.pageid),[2,3,1]);
  assert.equal(calls,2);
  assert.deepEqual(choose(photos,'2026-10-23',31).map(p=>p.pageid),[1,2,3]);
  assert.deepEqual(createCandidateSelector(()=>.99)(photos,'2026-10-23',30).map(p=>p.pageid),[1,2,3]);
});
test('real collection can resolve every minute without inventing capture times',()=>{const {photos}=JSON.parse(readFileSync(new URL('../dist/photos.json',import.meta.url)));assert.equal(photos.length,482);const i=buildIndex(photos);assert.equal(i.size,298);for(let minute=0;minute<1440;minute++){const m=findMoment(i,minute,'2026-10-23');assert.ok(m);assert.equal(m.photos[0].minute,m.minute);assert.ok(m.lag<=86);}for(const p of photos){assert.ok(p.source_url.startsWith('https://commons.wikimedia.org/'));assert.ok(p.thumbnail_url.startsWith('https://'));assert.ok(p.artist||p.attribution||p.credit);assert.ok(p.license);}});

test('capture dates match the card format without time-zone shifts',()=>{
  assert.equal(displayCaptureDate('2026-10-12'),'Oct/12/2026');
  assert.equal(displayCaptureDate('2009-01-01'),'Jan/01/2009');
  assert.equal(displayCaptureDate('2024-02-29'),'Feb/29/2024');
  assert.equal(displayCaptureDate(''), '');
});

test('back metadata uses labeled rows, recorded fields and license last',()=>{
  const rows=photoMetadataRows({minute:1035,capture_date:'2015-05-30',description:'A city panorama.',borough:'Queens',credit:'Own work',artist:'King of Hearts',license:'CC BY-SA 4.0'});
  assert.deepEqual(rows,[['Description','A city panorama.'],['Time','5:15 PM'],['Date','30 May 2015'],['Location','Queens'],['Source','Own work'],['Author','King of Hearts'],['License','CC BY-SA 4.0']]);
});
test('missing metadata rows are omitted without losing midnight',()=>{
  assert.deepEqual(photoMetadataRows({}),[]);
  assert.deepEqual(photoMetadataRows({minute:0,description:'  ',credit:null,artist:'',license:'CC0'}),[['Time','12:00 AM'],['License','CC0']]);
  assert.deepEqual(photoMetadataRows({attribution:'Photographer credit'}),[['Author','Photographer credit']]);
});
