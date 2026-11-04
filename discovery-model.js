import { fold } from './model.js';
export const PROFILE = 'Farmácia, atendimento, recepção, vendas, apoio administrativo, suporte ao cliente e trabalho remoto com IA: treinamento, avaliação, anotação de dados, buscas e conteúdo. Português e inglês. Graduanda em Farmácia. Vagas fixas, temporárias, freelance, diárias, meio período e por tarefa.';
export const GUPY_TERMS = ['farmácia','atendimento','recepcionista','vendas','administrativo','ensino médio'];
export function plainText(value='') {
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim().slice(0,16000);
}
export function safeJobUrl(value) {
  try { const u=new URL(String(value)); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function canonicalJobUrl(value) {
  const safe=safeJobUrl(value);if(!safe)return '';
  const u=new URL(safe);u.hash='';
  if(/(^|\.)linkedin\.com$/.test(u.hostname)){const id=u.pathname.match(/(?:-|\/)(\d{7,})(?:\/)?$/)?.[1];if(id)return 'https://www.linkedin.com/jobs/view/'+id;}
  if(/(^|\.)gupy\.io$/.test(u.hostname)){
    let id=u.pathname.match(/\/jobs\/(\d+)/)?.[1];
    if(!id){try{const token=u.pathname.match(/\/job\/([^/]+)/)?.[1];if(token)id=JSON.parse(atob(decodeURIComponent(token))).jobId;}catch{}}
    if(id)return 'https://gupy.io/jobs/'+id;
  }
  if(u.hostname.endsWith('infojobs.com.br')){const id=u.pathname.match(/__(\d+)\.aspx/)?.[1];if(id)return 'https://www.infojobs.com.br/vaga__'+id+'.aspx';}
  if(u.hostname.endsWith('indeed.com')){const key=u.searchParams.get('jk');if(key)return 'https://br.indeed.com/viewjob?jk='+key;}
  for(const key of [...u.searchParams.keys()])if(/^(utm_|ref$|source$|trk$|trackingId$|refId$|position$|pageNum$|jobBoardSource$|from$|fromjk$)/i.test(key))u.searchParams.delete(key);
  return u.href.replace(/\/$/,'');
}
export function isSavedResult(result,jobs) {
  const urls=new Set([result.url,result.applicationUrl,...(result.appearances||[]).map(a=>a.url)].map(canonicalJobUrl).filter(Boolean));
  return jobs.find(j=>urls.has(canonicalJobUrl(j.url)) || (!j.url&&fold(j.company)===fold(result.company)&&fold(j.role)===fold(result.role)));
}
export function dateString(value) {
  if(!value)return '';
  if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}(?:$|[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$)/.test(value)){
    const day=value.slice(0,10),d=new Date(day+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===day?day:'';
  }
  const d=new Date(typeof value==='number'&&value>0&&value<1e12?value*1000:value);return Number.isNaN(d.getTime())?'':d.toISOString();
}
export function normalizeRemotive(data) {
  if(!data || !Array.isArray(data.jobs))throw new Error('A Remotive retornou um formato inesperado.');
  return data.jobs.map(j=>({source:'Remotive',sourceId:String(j.id??''),company:String(j.company_name||''),role:String(j.title||''),url:safeJobUrl(j.url),mode:'Remota',city:String(j.candidate_required_location||''),country:'',eligibilityLocation:String(j.candidate_required_location||''),description:plainText(j.description),salary:String(j.salary||''),contract:String(j.job_type||''),publishedAt:dateString(j.publication_date),deadline:'',hours:''}));
}
export function normalizeGupy(data) {
  const entries=Array.isArray(data?.data)?data.data:Array.isArray(data?.jobs)?data.jobs:null;
  if(!entries)throw new Error('A Gupy retornou um formato inesperado.');
  return entries.map(j=>{
    const workplace=fold(String(j.workplaceType||''));
    const mode=/hybrid|hibrid/.test(workplace)?'Híbrida':/remote|remot/.test(workplace)||j.isRemote===true?'Remota':/on.?site|presencial/.test(workplace)||j.isRemote===false?'Presencial':'';
    return {source:'Gupy',sourceId:String(j.id??''),company:String(j.companyName||j.company?.name||j.careerPageName||''),role:String(j.name||j.title||''),url:safeJobUrl(j.jobUrl||j.url),mode,city:String(j.city||''),state:String(j.state||''),country:String(j.country||''),eligibilityLocation:String(j.remoteLocation||j.candidateLocation||''),description:plainText(j.description||''),salary:String(j.salary||''),contract:String(j.type||''),publishedAt:dateString(j.publishedDate||j.publicationDate),deadline:dateString(j.applicationDeadline).slice(0,10),hours:String(j.workload||'')};
  });
}
function localBelem(job) {
  return fold(job.city).trim()==='belem' && ['pa','para'].includes(fold(job.state||'').trim()) && (!job.country || /^(br|bra|brasil|brazil)$/i.test(job.country.trim()));
}
export function locationVerdict(job) {
  if(job.mode==='Presencial'||job.mode==='Híbrida'||!job.mode){
    const title=fold(job.role||'');
    if(/\b(xinguara|castanhal|ananindeua|marituba|santarem|altamira|paragominas|tucurui|maraba|sao paulo|manaus)\b/.test(title))return 'exclude';
    return localBelem(job)?'eligible':'exclude';
  }
  if(job.mode!=='Remota')return 'exclude';
  const loc=fold(job.eligibilityLocation||'').trim(),description=fold(job.description||''),all=loc+' '+description;
  const broad=/^(?:worldwide|anywhere|global|anywhere in the world|anywhere in brazil|anywhere in brasil|remote[ -]worldwide)$/;
  const allowsBrazil=/\b(brasil|brazil|br|latam|latin america|south america|americas)\b/.test(loc)||broad.test(loc);
  if(/(?:except|excluding|excludes|exceto|menos|nao (?:aceita|inclui)).{0,15}(?:brazil|brasil)|(?:brazil|brasil).{0,10}(?:excluded|not eligible|nao elegivel)/.test(all))return 'exclude';
  if(/\b(?:us|usa|united states|europe|eu|canada|uk|emea)[ -]only\b|\bonly (?:in )?(?:the )?(?:us|usa|united states|europe|canada|uk)\b/.test(all))return 'exclude';
  if(!allowsBrazil && loc && (job.locationRestrictionsExplicit||/\b(us|usa|united states|canada|europe|uk|emea|germany|portugal|india|north america|france|egypt|singapore)\b/.test(loc)))return 'exclude';
  if(/(?:must|need to|required to|currently).{0,20}(?:reside|live|be based|be located).{0,25}(?:united states|usa|us\b|europe|canada|uk)/.test(description))return 'exclude';
  if(Array.isArray(job.timezoneRestrictions)&&job.timezoneRestrictions.length&&!job.timezoneRestrictions.includes(-3))return 'review';
  if(/(?:residir|residencia|residentes|morar|residency|required to live|must (?:be (?:based|located|a resident)|live|reside))/.test(description) && !/(?:residir|residencia|residentes|morar|reside|must (?:be (?:based|located|a resident)|live|reside)|residency).{0,60}(?:belem|brasil|brazil)/.test(description))return 'review';
  if(loc){
    if(/only|somente|apenas/.test(loc)&&!/^(?:brazil|brasil|latam|latin america|south america|americas)(?: only)?$/.test(loc))return 'review';
    return allowsBrazil?'eligible':'review';
  }
  if(localBelem(job))return 'eligible';
  if(/(?:todo o? ?brasil|qualquer (?:lugar|regiao).{0,15}brasil|anywhere in brazil|100% remoto.{0,40}(?:nacional|brasil))/.test(description))return 'eligible';
  return 'review';
}
const GROUPS=[
  ['Inteligência artificial',/(?:\b(?:ai|ia|llm)\b.*(?:train|evaluat|assess|annotat|label|review|rat|content|writ)|(?:train|evaluat|annotat|review|rat|content|writ).*\b(?:ai|ia|llm)\b)|chatbot|(?:video|image|audio|text) annotat|data annotat|anotacao de dados|data label|rotulagem|\brater\b|search (?:quality|evaluat)|avaliacao de busca|quality (?:rater|coordinator)|response evaluat|treinamento de (?:ia|modelos)|avaliador de (?:ia|respostas)|prompt (?:writ|evaluat)/],
  ['Conteúdo e revisão',/content (?:review|moderat|writ)|revisao de conteudo|producao de conteudo|revisor|redator|\bwriter\b|\beditor\b/],
  ['Farmácia',/farmac|pharmac|drogaria|balconista/],
  ['Atendimento',/atend|customer (?:support|service|success)|suporte|call center|telemarketing/],
  ['Recepção',/recepc|reception|front desk/],
  ['Vendas',/vend|comercial|\bsales\b|\bsdr\b|\bbdr\b/],
  ['Administrativo',/administrativ|back office|office support|assistente|auxiliar|assistant|data entry/],
  ['Outras oportunidades',/transcri|transcription|modera|annotation|anotacao|avaliador|social media|conteudo|content|pesquisa|digitad/]
];
export function profileMatch(job) {
  const title=fold(job.role), text=fold(job.role+' '+job.description);
  // A pharmacy student is not yet a registered pharmacist. Keep internships and support roles.
  if(/farmaceutic[oa]|\bpharmacist\b/.test(title) && !/estagi|intern|auxiliar|assistente|atendente|balconista/.test(title))return null;
  if(/senior|\bsr\b|diretor|director|head of|gerente|manager|lead engineer/.test(title))return null;
  if(/\b(engineer|engineering|engenheiro|engenheira|developer|desenvolvedor|architect|arquiteto|data scientist|cientista de dados|coding|coder)\b/.test(title))return null;
  if(/\b(italian|italiano|german|alemao|french|frances|arabic|arabe|spanish|espanhol|japanese|japones|korean|coreano|maltese|lao|turkish|dutch|hindi|ukrainian)\b/.test(title))return null;
  const group=GROUPS.find(([name,pattern])=>pattern.test(title) && (name!=='Outras oportunidades'||job.mode==='Remota'))?.[0];
  if(!group && !/ensino medio|high school/.test(text))return null;
  const flexible=/horarios? flexiv|jornada (?:flexiv|reduzida)|meio periodo|part[ -]time|flexible (?:hours|schedule)|\b(?:20|24|25|30)\s*(?:h\b|horas|hours)/.test(text+' '+fold(job.contract+' '+job.hours));
  return {group:group||'Ensino médio',flexible,matchScore:group==='Inteligência artificial'?100:group?95:70};
}
export function contractTypes(job) {
  const raw=fold(job.contract||''),tags=[];
  if(/clt/.test(raw))tags.push('CLT');
  if(/effective|efetiv|permanent/.test(raw))tags.push('Efetivo');
  if(/tempor|temporary|fixed.term/.test(raw))tags.push('Temporário');
  if(/intern|estagio/.test(raw))tags.push('Estágio');
  if(/freelanc|independent|autonom/.test(raw))tags.push('Freelance');
  if(/diaria|daily|day.rate/.test(raw))tags.push('Diária');
  if(/part[ _-]?time|meio periodo/.test(raw))tags.push('Meio período');
  if(/full[ _-]?time|tempo integral/.test(raw))tags.push('Tempo integral');
  if(/por tarefa|per.task|microtask|task.based/.test(raw))tags.push('Por tarefa');
  if(/\bpj\b|contract|prestacao de servico/.test(raw) && !tags.includes('Freelance'))tags.push('Contrato/PJ');
  return tags;
}
function requirementExcerpt(description,pattern) {
  const match=pattern.exec(description);if(!match)return '';
  const start=Math.max(0,description.lastIndexOf('.',match.index)+1,match.index-70),end=Math.min(description.length,match.index+300);
  return description.slice(start,end).trim();
}
export function enrichRequirements(job) {
  const d=job.description||'';
  const evidence=d.match(/(?:employment type|contract type|tipo de contratacao|regime de contratacao)\s*:?\s*([^.!?]{1,140})/i)?.[1]||'';
  const contract=[job.contract||'',evidence].filter(Boolean).join(' · ');
  return {...job,contract,languages:job.languages||requirementExcerpt(d+' '+job.role,/(?:english|ingl[eê]s|portuguese|portugu[eê]s)(?:\s*\(brazil\))?/i),experience:job.experience||requirementExcerpt(d,/no (?:prior )?experience|sem experi[eê]ncia|experi[eê]ncia|experience|\d+\+? (?:years|anos) (?:of|de)/i),contractTypes:contractTypes({...job,contract}),applicationUrl:safeJobUrl(job.applicationUrl||job.url),applicationMethod:job.applicationMethod||'Candidatura pelo anúncio original; confira as instruções e eventual necessidade de cadastro.'};
}
function identity(job) {
  const clean=s=>fold(s||'').replace(/\b(?:ltda|inc|llc|sa|s a|de|da|do|para|belem|pa)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  if(!job.company)return '';
  return [clean(job.company),clean(job.role),clean(job.city).replace(/\bbrasil\b/g,'brazil').replace(/^(?:anywhere|worldwide)$/,'worldwide'),clean(job.state)].join('|');
}
function equivalent(a,b) {
  if(canonicalJobUrl(a.url)===canonicalJobUrl(b.url))return true;
  if(a.source===b.source)return false;
  if(a.applicationUrl && b.applicationUrl && canonicalJobUrl(a.applicationUrl)===canonicalJobUrl(b.applicationUrl))return true;
  if(a.mode&&b.mode&&a.mode!==b.mode)return false;
  const key=identity(a);if(!key||key!==identity(b)||!a.publishedAt||!b.publishedAt)return false;
  if(Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))>14*86400000)return false;
  return !a.contractTypes.length||!b.contractTypes.length||a.contractTypes.some(t=>b.contractTypes.includes(t));
}
function richness(j){return ['company','description','applicationUrl','contract','languages','experience','publishedAt'].filter(k=>j[k]).length+Math.min((j.description||'').length,2000)/2000;}
function mergeResult(a,b) {
  const [best,other]=richness(a)>richness(b)?[a,b]:richness(a)<richness(b)?[b,a]:a.url.localeCompare(b.url)<0?[a,b]:[b,a];
  const merged={...best};for(const key of ['company','description','contract','languages','experience','publishedAt','applicationMethod','applicationUrl'])if(!merged[key])merged[key]=other[key];
  merged.appearances=[...a.appearances,...b.appearances].filter((x,i,all)=>all.findIndex(y=>y.source===x.source&&y.url===x.url)===i);
  merged.appearances.sort((x,y)=>x.source.localeCompare(y.source)||x.url.localeCompare(y.url));
  merged.contractTypes=[...new Set([...a.contractTypes,...b.contractTypes])];
  merged.verdict=a.verdict==='eligible'||b.verdict==='eligible'?'eligible':'review';return merged;
}
export function prepareResults(entries,now=new Date()) {
  const candidates=[],output=[],today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  for(const raw of entries){
    const job=enrichRequirements(raw);
    if(!job.role||!safeJobUrl(job.url)||!job.applicationUrl)continue;
    if(job.deadline&&job.deadline<today)continue;
    const verdict=locationVerdict(job),match=profileMatch(job);if(verdict==='exclude'||!match)continue;
    const candidate={...job,...match,verdict,id:canonicalJobUrl(job.url),appearances:job.appearances||[{source:job.source,url:job.url}]};
    candidates.push(candidate);
  }
  for(const candidate of candidates.sort((a,b)=>richness(b)-richness(a)||a.url.localeCompare(b.url))){const duplicate=output.findIndex(j=>equivalent(j,candidate));if(duplicate<0)output.push(candidate);else output[duplicate]=mergeResult(output[duplicate],candidate);}
  return output.sort((a,b)=>(b.publishedAt||'').slice(0,10).localeCompare((a.publishedAt||'').slice(0,10))||b.matchScore-a.matchScore||Number(b.flexible)-Number(a.flexible)||(b.publishedAt||'').localeCompare(a.publishedAt||'')||identity(a).localeCompare(identity(b))||a.url.localeCompare(b.url));
}
export function filterDiscovered(entries,{search='',mode='',flexible=false,review=false,contract='',source='',group=''}={}) {
  const query=fold(search.trim());
  return entries.filter(j=>(j.verdict==='eligible'||review) && (!mode||j.mode===mode) && (!contract||(j.contractTypes||[]).includes(contract)) && (!source||(j.appearances||[{source:j.source}]).some(a=>a.source===source)) && (!group||j.group===group) && (!flexible||j.flexible) && (!query||fold(j.company+' '+j.role+' '+j.description).includes(query)));
}
export function resultToJob(job) {
  const c=fold(job.contract);
  const type=contractTypes(job)[0]||'';
  return {company:job.company||'Não informado no anúncio',role:job.role,city:job.mode==='Remota'?job.city:'Belém (PA)',mode:job.mode,type,salary:job.salary,hours:job.hours||(/part[ -]time/.test(c)?'Carga reduzida (confira no anúncio)':''),url:job.url,deadline:job.deadline,status:'Salvei',notes:`Fontes: ${(job.appearances||[{source:job.source,url:job.url}]).map(a=>a.source+': '+a.url).join(' | ')}\nCandidatura: ${job.applicationMethod||'Veja o anúncio'}\n${job.applicationUrl||job.url}\nIdiomas: ${job.languages||'Não informado'}\nExperiência: ${job.experience||'Não informado'}\nFormatos: ${contractTypes(job).join(', ')||'Não informado'}\nLocalização informada: ${job.city}${job.state?', '+job.state:''}\n${job.verdict==='review'?'Localização conferida manualmente: atuação de Belém permitida.\n':''}${job.flexible?'Há indicação de flexibilidade ou carga reduzida; confirme as condições no anúncio.\n':''}\nResumo do anúncio:\n${job.description.slice(0,6500)}`};
}
