import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unseenCandidates,createDailyHistory} from '../dist/daily-selection.js';
import {buildIndex,createCandidateSelector,nyTime} from '../dist/core.js';
const photo=(pageid,minute)=>({pageid,minute});
const state={date:'2026-10-24',minute:16*60+17};
const choose=photos=>photos;
function memoryStorage(){const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};}

test('missing minutes use the closest earlier unused photo, exhausting each bucket first',()=>{
  const index=buildIndex([photo(1,976),photo(2,976),photo(3,975),photo(4,970)]);
  const seen=new Set(['1']);
  assert.equal(unseenCandidates(index,state,seen,choose).next().value.pageid,2);
  seen.add('2');
  assert.equal(unseenCandidates(index,state,seen,choose).next().value.pageid,3);
  seen.add('3');
  assert.equal(unseenCandidates(index,state,seen,choose).next().value.pageid,4);
});
test('exact unseen matches take priority and exhausted exact matches fall back',()=>{
  const index=buildIndex([photo(1,976),photo(2,977),photo(3,978)]);
  assert.deepEqual([...unseenCandidates(index,state,new Set(),choose)].map(p=>p.pageid),[2,1,3]);
  assert.equal(unseenCandidates(index,state,new Set(['2']),choose).next().value.pageid,1);
  assert.equal(unseenCandidates(index,state,new Set(['1','2','3']),choose).next().done,true);
});
test('backward search wraps midnight and ignores duplicate file IDs',()=>{
  const index=buildIndex([photo(1,1439),photo(1,1438),photo(2,1438),photo(3,30)]),dates=[];
  const result=[...unseenCandidates(index,{date:'2026-01-01',minute:0},new Set(),(photos,date)=>{dates.push(date);return photos;})];
  assert.deepEqual(result.map(p=>p.pageid),[1,2,3]);
  assert.ok(dates.every(date=>date==='2025-12-31'));
});
test('history survives reload, merges other tabs, and resets at New York midnight',()=>{
  const storage=memoryStorage(),a=createDailyHistory(storage),b=createDailyHistory(storage);
  a.mark('2026-10-24',10);b.mark('2026-10-24',20);
  assert.deepEqual([...a.read('2026-10-24')],['10','20']);
  assert.deepEqual([...createDailyHistory(storage).read('2026-10-24')],['10','20']);
  const before=nyTime(new Date('2026-10-25T03:59:59Z')),after=nyTime(new Date('2026-10-25T04:00:00Z'));
  assert.equal(a.read(before.date).size,2);
  assert.equal(a.read(after.date).size,0);
  a.mark(after.date,10);assert.deepEqual([...a.read(after.date)],['10']);
});
test('failed loads do not consume candidates and unavailable storage retains in-memory history',()=>{
  const broken={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const history=createDailyHistory(broken),index=buildIndex([photo(1,976),photo(2,975)]);
  assert.equal(unseenCandidates(index,state,history.read(state.date),choose).next().value.pageid,1);
  // Merely choosing or failing to load a candidate must not mark it shown.
  assert.equal(history.read(state.date).size,0);
  history.mark(state.date,2);
  assert.deepEqual([...history.read(state.date)],['2']);
  const corrupted=createDailyHistory({getItem:()=>'{broken',setItem(){}});
  assert.equal(corrupted.read(state.date).size,0);
});
test('a full day uses every distinct collection photo at most once and stops when exhausted',()=>{
  const {photos}=JSON.parse(readFileSync(new URL('../dist/photos.json',import.meta.url)));
  const index=buildIndex(photos),seen=new Set(),select=createCandidateSelector(()=>.5);
  for(let minute=0;minute<1440;minute++){
    const next=unseenCandidates(index,{...state,minute},seen,select).next();
    if(next.done)continue;
    const id=String(next.value.pageid);assert.ok(!seen.has(id));seen.add(id);
  }
  assert.equal(seen.size,new Set(photos.map(p=>String(p.pageid))).size);
  assert.equal(unseenCandidates(index,state,seen,select).next().done,true);
});
