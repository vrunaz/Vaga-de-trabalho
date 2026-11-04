import { belemToday } from './model.js';
export const DAILY_TIME='08:00';
export const RETRY_MS=60*60*1000;
export function latestDailySlot(now=new Date()) {
  const slot=new Date(belemToday(now)+'T08:00:00-03:00');
  if(slot>now)slot.setUTCDate(slot.getUTCDate()-1);
  return slot;
}
export function nextDailyUpdate(now=new Date()) {
  const next=latestDailySlot(now);next.setUTCDate(next.getUTCDate()+1);return next.toISOString();
}
export function isDailyFresh(fetchedAt,now=new Date()) {
  const time=Date.parse(fetchedAt);
  return Number.isFinite(time) && time>=latestDailySlot(now).getTime() && time<=now.getTime();
}
function validData(value) {
  return value?.version===1 && Array.isArray(value.jobs) && Array.isArray(value.sources) && Number.isFinite(Date.parse(value.fetchedAt));
}
export function createDailyDiscovery({collect,readCache=async()=>null,writeCache=async()=>{},clock=()=>new Date()}) {
  let state=null,loadPromise,flight,cacheWarning='';
  async function load() {
    if(!loadPromise)loadPromise=(async()=>{
      try {const saved=await readCache();if(saved?.version===1 && validData(saved.data))state=saved;}
      catch {cacheWarning='Não foi possível ler o cache público; a busca será refeita.';}
    })();
    await loadPromise;
  }
  function response(now) {
    const errors=state.data.sources.some(s=>s.state==='error');
    return {...state.data,attemptedAt:state.lastAttemptAt,cacheWarning,schedule:{mode:'daily',time:DAILY_TIME,timeZone:'America/Belem',nextUpdateAt:nextDailyUpdate(now),nextRetryAt:errors?new Date(Date.parse(state.lastAttemptAt)+RETRY_MS).toISOString():null}};
  }
  async function ensure() {
    await load();
    if(flight)return flight;
    const now=clock();
    if(state){
      const errors=state.data.sources.some(s=>s.state==='error');
      if(isDailyFresh(state.data.fetchedAt,now) && !errors)return response(now);
      const sinceAttempt=now.getTime()-Date.parse(state.lastAttemptAt);
      if(errors && sinceAttempt>=0 && sinceAttempt<RETRY_MS)return response(now);
    }
    flight=(async()=>{
      let fresh;
      try {
        fresh=await collect();if(!validData(fresh))throw new Error('Resposta inválida');
      }catch {
        fresh={version:1,fetchedAt:now.toISOString(),jobs:[],sources:[{name:'Busca de vagas',state:'error',message:'Não foi possível atualizar as fontes.'}]};
      }
      const allFailed=fresh.sources.length>0 && fresh.sources.every(s=>s.state==='error');
      const data=allFailed && state?.data.jobs.length?{...fresh,jobs:state.data.jobs,fetchedAt:state.data.fetchedAt,stale:true}:fresh;
      state={version:1,lastAttemptAt:now.toISOString(),data};
      try{await writeCache(state);cacheWarning='';}catch{cacheWarning='A consulta foi feita, mas não foi possível guardar o cache para o próximo reinício.';}
      return response(clock());
    })();
    try{return await flight;}finally{flight=undefined;}
  }
  function start({setIntervalFn=setInterval,clearIntervalFn=clearInterval}={}) {
    const check=()=>ensure().catch(()=>{});
    check();const timer=setIntervalFn(check,60000);timer?.unref?.();return ()=>clearIntervalFn(timer);
  }
  return {ensure,start};
}
