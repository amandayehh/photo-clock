import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unseenCandidates,createSessionHistory} from '../dist/daily-selection.js';
import {buildIndex,createCandidateSelector,nyTime} from '../dist/core.js';
const photo=(pageid,minute)=>({pageid,minute});
const state={date:'2026-10-24',minute:16*60+17};
const choose=photos=>photos;

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
test('a refresh or separate tab starts with empty history',()=>{
  const first=createSessionHistory();first.mark(10);first.mark('10');
  assert.deepEqual([...first.read()],['10']);
  const fresh=createSessionHistory();
  assert.equal(fresh.read().size,0);
  const index=buildIndex([photo(10,state.minute)]);
  assert.equal(unseenCandidates(index,state,first.read(),choose).next().done,true);
  assert.equal(unseenCandidates(index,state,fresh.read(),choose).next().value.pageid,10);
  fresh.mark(20);assert.deepEqual([...first.read()],['10']);
});
test('the same page session keeps its history across New York midnight',()=>{
  const history=createSessionHistory(),index=buildIndex([photo(1,1439),photo(2,1438)]);
  const before=nyTime(new Date('2026-10-25T03:59:59Z')),after=nyTime(new Date('2026-10-25T04:00:00Z'));
  assert.notEqual(before.date,after.date);
  const first=unseenCandidates(index,before,history.read(),choose).next().value;
  assert.equal(first.pageid,1);history.mark(first.pageid);
  assert.equal(unseenCandidates(index,after,history.read(),choose).next().value.pageid,2);
});
test('history snapshots cannot mutate the session history',()=>{
  const history=createSessionHistory();history.mark(1);
  const snapshot=history.read();snapshot.clear();snapshot.add('2');
  assert.deepEqual([...history.read()],['1']);
});
test('choosing or failing to load a candidate does not consume it',()=>{
  const history=createSessionHistory(),index=buildIndex([photo(1,976),photo(2,975)]);
  assert.equal(unseenCandidates(index,state,history.read(),choose).next().value.pageid,1);
  assert.equal(history.read().size,0);
  history.mark(2);
  assert.deepEqual([...history.read()],['2']);
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
