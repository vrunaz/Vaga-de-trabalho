import { fold } from './model.js';
import { plainText,safeJobUrl,dateString } from './discovery-model.js';
export function decodeEntities(text='') {
  return String(text).replace(/&#x([0-9a-f]+);/gi,(_,v)=>{const n=parseInt(v,16);return n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&#(\d+);/g,(_,v)=>Number(v)<=0x10ffff?String.fromCodePoint(Number(v)):'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
const text=html=>plainText(decodeEntities(html));
function fail(message,code='FORMAT_CHANGED'){throw Object.assign(new Error(message),{code});}
function htmlOf(data){if(typeof data?.html!=='string')fail('A fonte não retornou HTML reconhecível.');return data.html;}
function classText(html,name,tag='[a-z0-9]+') {
  const m=html.match(new RegExp('<('+tag+')[^>]*class=["\'][^"\']*\\b'+name+'\\b[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/\\1>','i'));return m?text(m[2]):'';
}
function place(location='') {
  const s=text(location),belem=/\bbelem\b/i.test(fold(s)),pa=/\b(pa|para)\b/i.test(fold(s));
  return {city:belem?'Belém':s,state:belem&&pa?'PA':'',country:/brasil|brazil/i.test(s)?'Brazil':''};
}
function modeIn(value='') {const s=fold(text(value));return /hibrid|hybrid/.test(s)?'Híbrida':/remot|home office|anywhere/.test(s)?'Remota':/presencial|on.?site/.test(s)?'Presencial':'';}
function base(source,input) {
  const url=safeJobUrl(input.url),applicationUrl=safeJobUrl(input.applicationUrl||url);
  return {source:source.family||source.name,sourceId:'',company:'',role:'',mode:'',city:'',state:'',country:'',eligibilityLocation:'',description:'',salary:'',contract:'',publishedAt:'',deadline:'',hours:'',applicationMethod:applicationUrl?'Candidatura pelo anúncio original; confira as instruções e eventual necessidade de cadastro.':'Forma de candidatura não informada',...input,url,applicationUrl,sourceUrl:source.url};
}
export function normalizeLinkedIn(data,source) {
  const html=htmlOf(data);
  if(/authwall|captcha|security verification|sign in to see all/i.test(html) && !html.includes('base-search-card__title'))fail('Acesso público limitado pelo LinkedIn.','RESTRICTED');
  const blocks=html.split(/<li\b[^>]*>/i).filter(s=>s.includes('base-search-card__title'));
  if(!blocks.length && html.trim() && !/no matching jobs|no jobs found|nenhuma vaga/i.test(html))fail('O LinkedIn não expôs uma lista pública reconhecível.','RESTRICTED');
  return blocks.map(b=>{
    const url=decodeEntities(b.match(/class="base-card__full-link[^>]*href="([^"]+)"/i)?.[1]||'');
    const location=classText(b,'job-search-card__location'),title=classText(b,'base-search-card__title','h3');
    const remote=source.scope==='remote';
    // Search filters alone do not confirm nationwide candidate eligibility or in-person work mode.
    return base(source,{sourceId:b.match(/urn:li:jobPosting:(\d+)/)?.[1]||'',company:classText(b,'base-search-card__subtitle','h4'),role:title,url,...place(location),mode:remote?'Remota':modeIn(title+' '+location),description:'',eligibilityLocation:'',publishedAt:dateString(b.match(/<time[^>]*datetime="([^"]+)"/i)?.[1]),requiresDetails:true,listingLocation:location});
  });
}
export function normalizeInfoJobs(data,source) {
  const html=htmlOf(data),blocks=html.split(/<div\b[^>]*id="vacancy(\d+)"/i);
  if(blocks.length<3){if(/nenhuma vaga|não encontramos|0 vagas/i.test(text(html)))return [];fail('InfoJobs não expôs cartões de vaga reconhecíveis.','RESTRICTED');}
  const jobs=[];
  for(let i=1;i<blocks.length;i+=2){
    const id=blocks[i],b=blocks[i+1],raw=text(b),urlPart=decodeEntities(b.match(/data-href="([^"]+)"/)?.[1]||'');
    const company=b.match(/<a[^>]*class="text-body text-decoration-none"[^>]*>([\s\S]*?)<\/a>/i)?.[1]||'';
    const location=b.match(/<div class="mb-8">\s*([^<]+)/)?.[1]||'';
    const published=b.match(/class="js_date"\s+data-value="([^"]+)"/)?.[1]||'';
    jobs.push(base(source,{sourceId:id,role:classText(b,'js_vacancyTitle','h2'),company:text(company.split(/<span\b/i)[0]).replace(/\s*\(Matriz\)\s*/g,' ').trim(),url:urlPart?new URL(urlPart,'https://www.infojobs.com.br').href:'',...place(location),mode:modeIn(raw),description:raw.slice(0,8000),publishedAt:dateString(published?published.replace(/\//g,'-').replace(' ','T')+'-03:00':''),contract:'',salary:raw.match(/R\$\s*[\d.,]+(?:\s*(?:a|-|até)\s*R\$?\s*[\d.,]+)?/)?.[0]||'',requiresDetails:true}));
  }return jobs;
}
export function jsonAfter(html,marker) {
  const index=html.indexOf(marker);if(index<0)fail('Dados públicos da página não encontrados.');
  let start=index+marker.length;while(/\s/.test(html[start]||'x'))start++;
  if(html[start]!=='{'&&html[start]!=='[')fail('Objeto JSON da página não reconhecido.');
  let depth=0,quoted=false,escape=false;
  for(let i=start;i<html.length;i++){
    const c=html[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){depth--;if(depth===0)return JSON.parse(html.slice(start,i+1));}
  }fail('JSON incompleto na página.');
}
export function normalizeIndeed(data,source) {
  const html=htmlOf(data);
  if(/captcha|verify you are human|just a moment/i.test(html) && !html.includes('mosaicProviderJobCardsModel'))fail('Indeed restringiu a consulta pública.','RESTRICTED');
  const parsed=jsonAfter(html,'window.mosaic.providerData["mosaic-provider-jobcards"]=');
  const rows=parsed?.metaData?.mosaicProviderJobCardsModel?.results;
  if(!Array.isArray(rows))fail('Formato público do Indeed mudou.');
  return rows.filter(j=>!j.expired).map(j=>{
    const location=j.formattedLocation||'',description=text(j.snippet||'');
    const remote=Boolean(j.remoteLocation)||/remoto|remote|home office/i.test(location);
    return base(source,{sourceId:j.jobkey,role:text(j.title||j.displayTitle),company:text(j.company),url:'https://br.indeed.com/viewjob?jk='+encodeURIComponent(j.jobkey),city:j.jobLocationCity||place(location).city,state:j.jobLocationState||place(location).state,country:j.country||'',mode:remote?'Remota':modeIn(location+' '+description),eligibilityLocation:'',description,contract:(j.jobTypes||[]).join(' · '),publishedAt:dateString(j.pubDate),salary:text(j.salarySnippet?.text||''),requiresDetails:true});
  });
}
export function normalizeLever(data,source) {
  if(!Array.isArray(data))fail('A empresa não retornou uma lista pública de oportunidades.');
  return data.map(j=>{
    const c=j.categories||{},parts=[j.descriptionPlain||j.description,j.openingPlain||j.opening,j.descriptionBodyPlain||j.descriptionBody,...(j.lists||[]).map(l=>l.text+'\n'+l.content),j.additionalPlain||j.additional].filter(Boolean);
    const description=text(parts.join('\n')),mode=modeIn(j.workplaceType+' '+c.commitment),all=c.allLocations||[c.location];
    return base(source,{sourceId:j.id,company:source.company,role:j.text,url:j.hostedUrl,applicationUrl:j.applyUrl,applicationMethod:'Formulário de candidatura da empresa (Lever).',city:c.location||'',country:j.country||'',mode,eligibilityLocation:all.filter(Boolean).join(', '),locationRestrictionsExplicit:!!j.country,description,contract:c.commitment||'',publishedAt:dateString(j.createdAt),dateLabel:'Criação informada pela empresa'});
  });
}
export function normalizeJobicy(data,source) {
  if(!Array.isArray(data?.jobs))fail('Jobicy não retornou uma lista reconhecível.');
  return data.jobs.map(j=>base(source,{sourceId:String(j.id),company:j.companyName||'',role:j.jobTitle||'',url:j.url,mode:'Remota',city:j.jobGeo||'',eligibilityLocation:j.jobGeo||'',locationRestrictionsExplicit:true,description:text(j.jobDescription||j.jobExcerpt),contract:(j.jobType||[]).join(' · '),publishedAt:dateString(j.pubDate),salary:j.salaryMin&&j.salaryCurrency?`${j.salaryCurrency} ${j.salaryMin}${j.salaryMax?'–'+j.salaryMax:''}${j.salaryPeriod?' / '+j.salaryPeriod:''}`:''}));
}
export function normalizeHimalayas(data,source) {
  if(!Array.isArray(data?.jobs))fail('Himalayas não retornou uma lista reconhecível.');
  return data.jobs.map(j=>base(source,{sourceId:j.guid,company:j.companyName||'',role:j.title||'',url:j.guid,applicationUrl:j.applicationLink,mode:'Remota',city:(j.locationRestrictions||[]).join(', '),eligibilityLocation:(j.locationRestrictions||[]).join(', '),locationRestrictionsExplicit:true,timezoneRestrictions:j.timezoneRestrictions||[],description:text(j.description||j.excerpt),contract:j.employmentType||'',publishedAt:dateString(j.pubDate),deadline:dateString(j.expiryDate).slice(0,10),salary:j.minSalary&&j.currency?`${j.currency} ${j.minSalary}${j.maxSalary?'–'+j.maxSalary:''}${j.salaryPeriod?' / '+j.salaryPeriod:''}`:''}));
}
export function normalizeSocial(data,source) {
  const html=htmlOf(data);
  const structured=normalizeJobPosting(data,source,true);
  if(structured.length)return structured;
  if(/\/(?:p|posts)\/|\/groups\/[^/]+\/posts\//.test(new URL(source.url).pathname)){
    const metas={};for(const m of html.matchAll(/<meta\b([^>]+)>/gi)){const attrs={};for(const a of m[1].matchAll(/([a-z_:]+)=["']([^"']*)["']/gi))attrs[a[1].toLowerCase()]=decodeEntities(a[2]);const key=attrs.property||attrs.name;if(key)metas[key]=attrs.content||'';}
    const description=text(metas['og:description']||metas.description||'');
    const role=description.match(/(?:auxiliar (?:de )?farm[aá]cia|atendente (?:de )?farm[aá]cia|recepcionista|atendente|auxiliar administrativ[oa]|assistente administrativ[oa]|vendedor(?:a)?|suporte ao cliente|avaliador de (?:ia|buscas)|anotador de dados)/i)?.[0];
    const email=description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],whatsapp=description.match(/https:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^\s<>]+/i)?.[0];
    if(role&&(email||whatsapp)){
      const location=/bel[eé]m\s*(?:[-–/,]\s*)?(?:pa|par[aá])/i.test(description)?{city:'Belém',state:'PA',country:'Brazil'}:{city:'',state:'',country:''};
      const remote=modeIn(description)==='Remota',allows=/todo o brasil|residentes no brasil|candidatos residentes no brasil/i.test(description);
      return [base(source,{sourceId:source.url,role,company:source.announcer||'Anunciante do perfil público',url:source.url,description,...location,mode:modeIn(description),eligibilityLocation:remote&&allows?'Brazil':'',contract:(description.match(/(?:freelance|di[aá]ria|meio per[ií]odo|por tarefa|tempor[aá]ri[oa])/gi)||[]).join(' · '),applicationUrl:whatsapp||source.url,applicationMethod:email?'Envio de currículo para o e-mail publicado: '+email:'Candidatura pelo WhatsApp publicado no anúncio.',publishedAt:dateString(metas['article:published_time'])})];
    }
  }
  if(/instagram|facebook/i.test(html+' '+source.url))fail('Perfil público localizado, mas os anúncios não foram expostos com conteúdo e candidatura verificáveis. Login ou acesso autorizado pode ser necessário. Grupos privados não foram consultados.','RESTRICTED');
  fail('Não foi possível reconhecer anúncios públicos deste perfil.');
}
export function normalizeJobPosting(data,source,allowEmpty=false) {
  const html=htmlOf(data),objects=[];
  for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{const parsed=JSON.parse(m[1]);const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if([v['@type']].flat().includes('JobPosting'))objects.push(v);if(v['@graph'])walk(v['@graph']);}};walk(parsed);}catch{}
  }
  if(!objects.length&&!allowEmpty)fail('A página foi acessada, mas esta integração ainda não interpreta seus anúncios. Fonte não contabilizada como pesquisada.','UNSUPPORTED');
  return objects.map((j,i)=>{
    const a=[j.jobLocation].flat()[0]?.address||{},requirements=[j.applicantLocationRequirements].flat().filter(Boolean),desc=text(j.description||'');
    const remote=/TELECOMMUTE/i.test(j.jobLocationType||'');
    return base(source,{sourceId:String(j.identifier?.value||j.identifier||i),role:j.title||'',company:j.hiringOrganization?.name||source.company||'',url:j.url||source.url,city:a.addressLocality||'',state:a.addressRegion||'',country:typeof a.addressCountry==='string'?a.addressCountry:a.addressCountry?.name||'',mode:remote?'Remota':modeIn(desc),eligibilityLocation:requirements.map(x=>x.name||x.addressCountry||'').filter(x=>typeof x==='string').join(', '),description:desc,contract:[j.employmentType].flat().filter(Boolean).join(' · '),publishedAt:dateString(j.datePosted),deadline:dateString(j.validThrough).slice(0,10),applicationMethod:j.applicationContact?.email?'E-mail informado no anúncio: '+j.applicationContact.email:undefined});
  });
}
const htmlSource=(name,family,url,normalize,options={})=>({name,family,url,format:'html',ttl:6*60*60*1000,normalize,...options});
export const PUBLIC_SOURCES=[
  ...['atendimento','recepção','vendas','farmácia','administrativo','suporte'].map(term=>htmlSource('LinkedIn · '+term+' · Belém','LinkedIn','https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?'+new URLSearchParams({keywords:term,location:'Belém, Pará, Brazil',start:'0'}),normalizeLinkedIn,{scope:'local',sampleLimit:10})),
  ...['customer support','virtual assistant','AI trainer','data annotation','search evaluator','content reviewer'].map(term=>htmlSource('LinkedIn · '+term+' · Remotas','LinkedIn','https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?'+new URLSearchParams({keywords:term,location:'Brazil',f_WT:'2',start:'0'}),normalizeLinkedIn,{scope:'remote',sampleLimit:10})),
  htmlSource('InfoJobs · Belém','InfoJobs','https://www.infojobs.com.br/empregos-em-belem,-pa.aspx',normalizeInfoJobs,{sampleLimit:20}),
  htmlSource('InfoJobs · Remotas','InfoJobs','https://www.infojobs.com.br/vagas-de-emprego-home-office.aspx',normalizeInfoJobs,{scope:'remote',sampleLimit:20}),
  ...['atendimento','recepção','vendas','farmácia','administrativo'].map(term=>htmlSource('Indeed · '+term+' · Belém','Indeed','https://br.indeed.com/jobs?'+new URLSearchParams({q:term,l:'Belém, PA',sort:'date'}),normalizeIndeed,{scope:'local',sampleLimit:15})),
  ...['customer support','AI trainer','anotação de dados','assistente virtual'].map(term=>htmlSource('Indeed · '+term+' · Remotas','Indeed','https://br.indeed.com/jobs?'+new URLSearchParams({q:term,l:'Remoto',sort:'date'}),normalizeIndeed,{scope:'remote',sampleLimit:15})),
  {name:'Welo Data / Welocalize · Site da empresa',family:'Sites de empresas · Welo Data',company:'Welo Data / Welocalize',url:'https://api.lever.co/v0/postings/weloglobal?mode=json',ttl:6*60*60*1000,normalize:normalizeLever},
  {name:'Jobicy · Remotas',family:'Plataformas especializadas · Jobicy',url:'https://jobicy.com/api/v2/remote-jobs?count=100',ttl:6*60*60*1000,normalize:normalizeJobicy,sampleLimit:100},
  {name:'Himalayas · Remotas',family:'Plataformas especializadas · Himalayas',url:'https://himalayas.app/jobs/api?limit=20',ttl:6*60*60*1000,normalize:normalizeHimalayas,sampleLimit:20},
  htmlSource('Instagram · Empregos Belém','Instagram','https://www.instagram.com/empregosbelem/',normalizeSocial),
  htmlSource('Facebook · Empregos Belém','Facebook','https://www.facebook.com/empregosbelem/',normalizeSocial),
  htmlSource('Facebook · Grupos públicos Empregos Belém','Facebook · Grupos','https://www.facebook.com/search/groups/?q=Empregos%20Bel%C3%A9m',normalizeSocial),
  htmlSource('Sites de empresas · OneForma','Sites de empresas · OneForma','https://www.oneforma.com/jobs/',normalizeJobPosting),
  htmlSource('Sites de empresas · TELUS Digital AI Community','Sites de empresas · TELUS Digital','https://jobs.telusdigital.com/search/jobs?cfm5=AI+Community&ns_category=ai-community',normalizeJobPosting)
];
