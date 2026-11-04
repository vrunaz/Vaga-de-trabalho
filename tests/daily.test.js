import test from 'node:test';
import assert from 'node:assert/strict';
import { latestDailySlot,nextDailyUpdate,isDailyFresh,createDailyDiscovery } from '../daily-discovery.js';
const clockAt=iso=>()=>new Date(iso);
const good=(iso,count=1)=>({version:1,fetchedAt:iso,jobs:Array.from({length:count},(_,i)=>({id:String(i)})),sources:[{name:'Gupy',state:'ok'}]});
test('Atualização diária às 08:00 de Belém respeita virada de dia e UTC',()=>{
  assert.equal(latestDailySlot(new Date('2026-11-05T10:59:59Z')).toISOString(),'2026-11-04T11:00:00.000Z');
  assert.equal(nextDailyUpdate(new Date('2026-11-05T10:59:59Z')),'2026-11-05T11:00:00.000Z');
  assert.equal(nextDailyUpdate(new Date('2026-11-05T11:00:00Z')),'2026-11-06T11:00:00.000Z');
  assert.equal(isDailyFresh('2026-11-04T12:00:00Z',new Date('2026-11-05T10:00:00Z')),true);
  assert.equal(isDailyFresh('2026-11-04T12:00:00Z',new Date('2026-11-05T11:00:00Z')),false);
  assert.equal(isDailyFresh('2026-11-06T12:00:00Z',new Date('2026-11-05T11:00:00Z')),false);
});
test('Servidor atualiza no novo período diário e reutiliza o resultado entre consultas',async()=>{
  let now=new Date('2026-11-04T12:00:00Z'),calls=0,saved;
  const daily=createDailyDiscovery({clock:()=>now,collect:async()=>{calls++;return good(now.toISOString());},writeCache:async s=>saved=structuredClone(s)});
  await daily.ensure();await daily.ensure();assert.equal(calls,1);assert.ok(saved.data);
  now=new Date('2026-11-05T10:59:00Z');await daily.ensure();assert.equal(calls,1);
  now=new Date('2026-11-05T11:00:00Z');const result=await daily.ensure();assert.equal(calls,2);assert.equal(result.schedule.time,'08:00');assert.equal(result.fetchedAt,now.toISOString());
});
test('Cache persistido sobrevive ao reinício sem consulta duplicada às fontes',async()=>{
  let saved,calls=0;const now='2026-11-04T12:00:00Z';
  const first=createDailyDiscovery({clock:clockAt(now),collect:async()=>{calls++;return good(now);},writeCache:async s=>saved=structuredClone(s)});await first.ensure();
  const restarted=createDailyDiscovery({clock:clockAt(now),readCache:async()=>saved,collect:async()=>{calls++;return good(now);}});await restarted.ensure();assert.equal(calls,1);
});
test('Falha diária preserva última lista, data antiga e tenta novamente após uma hora',async()=>{
  let now=new Date('2026-11-04T12:00:00Z'),fail=false,calls=0;
  const daily=createDailyDiscovery({clock:()=>now,collect:async()=>{calls++;if(fail)return {version:1,fetchedAt:now.toISOString(),sources:[{name:'Gupy',state:'error'}],jobs:[]};return good(now.toISOString(),2);}});
  await daily.ensure();fail=true;now=new Date('2026-11-05T11:00:00Z');const failed=await daily.ensure();
  assert.equal(failed.jobs.length,2);assert.equal(failed.stale,true);assert.equal(failed.fetchedAt,'2026-11-04T12:00:00.000Z');assert.equal(calls,2);
  now=new Date('2026-11-05T11:30:00Z');await daily.ensure();assert.equal(calls,2);
  fail=false;now=new Date('2026-11-05T12:00:00Z');const recovered=await daily.ensure();assert.equal(calls,3);assert.equal(recovered.stale,undefined);
});
test('Consultas simultâneas compartilham atualização e o agendador dispara sem página aberta',async()=>{
  let calls=0,trigger,stop=false,now=new Date('2026-11-04T12:00:00Z');
  const daily=createDailyDiscovery({clock:()=>now,collect:async()=>{calls++;await Promise.resolve();return good(now.toISOString());}});
  await Promise.all([daily.ensure(),daily.ensure(),daily.ensure()]);assert.equal(calls,1);
  const cancel=daily.start({setIntervalFn:fn=>{trigger=fn;return 1;},clearIntervalFn:()=>stop=true});
  now=new Date('2026-11-05T12:00:00Z');await trigger();assert.equal(calls,2);cancel();assert.equal(stop,true);
});
