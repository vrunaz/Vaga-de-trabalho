import { GUPY_TERMS, normalizeGupy, normalizeRemotive, prepareResults } from './discovery-model.js';
export const DISCOVERY_CACHE_KEY='minhas-vagas:busca:v2';
export const SOURCES=[
  {name:'Remotive',ttl:6*60*60*1000,url:'https://remotive.com/api/remote-jobs',normalize:normalizeRemotive},
  ...GUPY_TERMS.flatMap(term=>[
    {label:'Belém',params:{city:'Belém',state:'Pará'}},
    {label:'Remotas',params:{workplaceType:'remote'}}
  ].map(scope=>({name:'Gupy · '+term+' · '+scope.label,ttl:60*60*1000,url:'https://portal.gupy.io/api/job-search/jobs?'+new URLSearchParams({jobName:term,offset:'0',limit:'50',sortBy:'publishedDate',sortOrder:'desc',...scope.params}),normalize:normalizeGupy})))
];
export async function collectDiscovery(getJSON) {
  const sources=await Promise.all(SOURCES.map(async source=>{
    try {
      const data=await getJSON(source.url,source.ttl);
      const jobs=source.normalize(data);
      const total=Number(data.pagination?.total??data.total??data.totalCount??jobs.length);
      return {name:source.name,state:'ok',count:jobs.length,limited:source.name.startsWith('Gupy')&&total>jobs.length,jobs};
    } catch(error) {
      const http=String(error.message||'').match(/HTTP (\d{3})/);
      const message=error.message==='GUPY_SERVER_REQUIRED'?'A Gupy exige o aplicativo com servidor para atualizar; não permite consulta direta pelo HTML baixado.':http?'A fonte respondeu HTTP '+http[1]+'. Tente novamente mais tarde.':'Fonte indisponível: conexão, limite de acesso ou formato não reconhecido.';
      return {name:source.name,state:'error',message,jobs:[]};
    }
  }));
  return {version:1,fetchedAt:new Date().toISOString(),sources:sources.map(({jobs,...s})=>s),jobs:prepareResults(sources.flatMap(s=>s.jobs))};
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
    if(source.state!=='error'||!old)return source;
    replaced.add(source.name);
    return {...old,state:'snapshot',fetchedAt:snapshot.fetchedAt,message:'Cópia datada incluída no HTML. Atualização automática da Gupy exige o aplicativo com servidor.'};
  });
  if(!replaced.size)return data;
  const copied=snapshot.jobs.filter(j=>j.source==='Gupy');
  return {...data,sources,jobs:prepareResults([...data.jobs,...copied],now),snapshotAt:snapshot.fetchedAt};
}
