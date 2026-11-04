import { PUBLIC_SOURCES } from './public-sources.js';
import { GUPY_TERMS, normalizeGupy, normalizeRemotive, prepareResults } from './discovery-model.js';
export const DISCOVERY_CACHE_KEY='minhas-vagas:busca:v3';
export const DISCOVERY_REVISION=3;
export const SOURCES=[
  {name:'Remotive',family:'Remotive',ttl:6*60*60*1000,url:'https://remotive.com/api/remote-jobs',normalize:normalizeRemotive},
  ...GUPY_TERMS.flatMap(term=>[
    {label:'Belém',params:{city:'Belém',state:'Pará'}},
    {label:'Remotas',params:{workplaceType:'remote'}}
  ].map(scope=>({name:'Gupy · '+term+' · '+scope.label,family:'Gupy',ttl:60*60*1000,url:'https://portal.gupy.io/api/job-search/jobs?'+new URLSearchParams({jobName:term,offset:'0',limit:'50',sortBy:'publishedDate',sortOrder:'desc',...scope.params}),normalize:normalizeGupy}))),
  ...PUBLIC_SOURCES
];
async function limitedMap(items,fn,concurrency=4) {
  const result=new Array(items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(cursor<items.length){const i=cursor++;result[i]=await fn(items[i]);}}));return result;
}
export async function collectDiscovery(getJSON) {
  const sources=await limitedMap(SOURCES,async source=>{
    const checkedAt=new Date().toISOString(),metadata={name:source.name,family:source.family||source.name,url:source.url,checkedAt,scope:source.scope||''};
    try {
      const data=await getJSON(source.url,source.ttl),jobs=source.normalize(data,source);
      const total=Number(data.pagination?.total??data.total??data.totalCount??jobs.length);
      return {...metadata,state:'ok',count:jobs.length,limited:source.sampleLimit?jobs.length>=source.sampleLimit:source.name.startsWith('Gupy')&&total>jobs.length,jobs};
    }catch(error){
      const http=String(error.message||'').match(/HTTP (\d{3})/),restricted=error.code==='RESTRICTED'||error.message==='GUPY_SERVER_REQUIRED'||http&&['401','403','429','451','999'].includes(http[1]);
      const message=error.message==='GUPY_SERVER_REQUIRED'?'A Gupy exige atualização pelo servidor ou site hospedado.':error.code==='RESTRICTED'?error.message:http?'A fonte respondeu HTTP '+http[1]+'.':['FORMAT_CHANGED','UNSUPPORTED'].includes(error.code)?error.message:'Não foi possível consultar ou interpretar anúncios desta fonte.';
      return {...metadata,state:restricted?'restricted':error.code==='UNSUPPORTED'?'unsupported':'error',message,jobs:[]};
    }
  });
  return {version:1,discoveryRevision:DISCOVERY_REVISION,fetchedAt:new Date().toISOString(),sources:sources.map(({jobs,...s})=>s),jobs:prepareResults(sources.flatMap(s=>s.jobs.map(j=>({...j,sourceQuery:s.name}))))};
}
export function sourceGroups(sources=[]) {
  const groups=new Map();for(const source of sources){const name=source.family||source.name.split(' · ')[0];if(!groups.has(name))groups.set(name,[]);groups.get(name).push(source);}
  return [...groups].map(([name,queries])=>{const successes=queries.filter(q=>q.state==='ok').length,snapshots=queries.filter(q=>q.state==='snapshot').length;return {name,queries,successes,state:successes===queries.length?'ok':successes?'partial':snapshots?'snapshot':queries.some(q=>q.state==='restricted')?'restricted':queries.some(q=>q.state==='unsupported')?'unsupported':'error'};}).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}

// A dated copy lets a downloaded HTML show real public listings without claiming a live CORS request.
export function withGupySnapshot(data,snapshot,now=new Date()) {
  if(snapshot?.version!==1 || !Array.isArray(snapshot.jobs) || !Array.isArray(snapshot.sources) || !Number.isFinite(Date.parse(snapshot.fetchedAt)))return data;
  const age=now.getTime()-Date.parse(snapshot.fetchedAt);
  if(age<0 || age>7*24*60*60*1000)return data;
  const byName=new Map(snapshot.sources.filter(s=>s.name?.startsWith('Gupy') && s.state==='ok').map(s=>[s.name,s]));
  const replaced=new Set();
  const sources=data.sources.map(source=>{
    const old=byName.get(source.name);
    if(!['error','restricted'].includes(source.state)||!old)return source;
    replaced.add(source.name);
    return {...old,state:'snapshot',fetchedAt:snapshot.fetchedAt,message:'Cópia datada incluída no HTML. Atualização automática da Gupy exige o aplicativo com servidor.'};
  });
  if(!replaced.size)return data;
  const copied=snapshot.jobs.filter(j=>j.source==='Gupy');
  return {...data,sources,jobs:prepareResults([...data.jobs,...copied],now),snapshotAt:snapshot.fetchedAt};
}
