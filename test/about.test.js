import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionUpdate} from '../dist/about.js';

test('the panel uses the latest collection check with the New York time zone',()=>{
  const result=collectionUpdate({updated:'2026-10-26',commons_expansion:{checked_at:'2026-10-26T20:31:43Z'},monthly_check:{checked_at:'2026-11-01T14:17:00Z'}});
  assert.equal(result.datetime,'2026-11-01T14:17:00Z');
  assert.equal(result.text,'Nov 1, 2026, 9:17 AM EST');
  assert.equal(collectionUpdate({commons_expansion:{checked_at:'2026-10-26T20:31:43Z'}}).text,'Oct 26, 2026, 4:31 PM EDT');
});
test('date-only collection updates keep their day and do not invent a time',()=>{
  assert.deepEqual(collectionUpdate({updated:'2026-10-26'}),{datetime:'2026-10-26',text:'Oct 26, 2026'});
});
test('missing or invalid timestamps are skipped rather than showing an invalid date',()=>{
  assert.equal(collectionUpdate({}),null);
  assert.equal(collectionUpdate({updated:'unknown'}),null);
  assert.equal(collectionUpdate({monthly_check:{checked_at:'invalid'},updated:'2026-10-26'}).text,'Oct 26, 2026');
});
