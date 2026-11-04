import { fold } from './model.js';
export const PROFILE = 'Farmácia, atendimento, recepção, vendas, apoio administrativo e ensino médio. Graduanda em Farmácia, com experiência em atendimento, vendas e farmácia. Flexibilidade e carga reduzida têm prioridade.';
export const GUPY_TERMS = ['farmácia','atendimento','recepcionista','vendas','administrativo','ensino médio'];
export function plainText(value='') {
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim().slice(0,16000);
}
export function safeJobUrl(value) {
  try { const u=new URL(String(value)); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function canonicalJobUrl(value) {
  const safe=safeJobUrl(value); if(!safe)return '';
  const u=new URL(safe);u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|ref$|source$)/i.test(key))u.searchParams.delete(key);
  return u.href.replace(/\/$/,'');
}
export function isSavedResult(result,jobs) {
  const url=canonicalJobUrl(result.url);
  return jobs.find(j=>(url && canonicalJobUrl(j.url)===url) || (!j.url && fold(j.company)===fold(result.company) && fold(j.role)===fold(result.role)));
}
function dateString(value) { const d=new Date(value); return value && !Number.isNaN(d.getTime())?d.toISOString():''; }
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
  if(job.mode==='Presencial'||job.mode==='Híbrida')return localBelem(job)?'eligible':'exclude';
  if(job.mode!=='Remota')return 'exclude';
  const loc=fold(job.eligibilityLocation||'').trim();
  const description=fold(job.description||'');
  // Geographic constraints override a broad location label. Never treat remote as worldwide by itself.
  if(/\b(?:us|usa|united states|europe|eu|canada|uk|emea)[ -]only\b|\bonly (?:in )?(?:the )?(?:us|usa|united states|europe|canada|uk)\b/.test(loc+' '+description))return 'exclude';
  if(/(?:residir|residencia|residentes|morar|residency|required to live|must (?:be|live))/.test(description) && !/(?:residir|residencia|residentes|morar).{0,35}(?:belem|brasil|brazil)/.test(description))return 'review';
  if(/(?:except|excluding|excludes|exceto|menos|nao (?:aceita|inclui)).{0,15}(?:brazil|brasil)|(?:brazil|brasil).{0,10}(?:excluded|not eligible|nao elegivel)/.test(loc+' '+description))return 'exclude';
  if(/(?:must|need to|required to).{0,15}(?:reside|live|be based).{0,20}(?:united states|usa|us\b|europe|canada|uk)/.test(description))return 'exclude';
  if(loc) {
    const broad=/^(?:worldwide|anywhere|global|anywhere in the world|anywhere in brazil|anywhere in brasil|remote[ -]worldwide)$/;
    if(/only|somente|apenas/.test(loc) && !/^(?:brazil|brasil|latam|latin america|south america|americas)(?: only)?$/.test(loc))return 'review';
    if(/\b(brasil|brazil|latam|latin america|south america|americas)\b/.test(loc) || broad.test(loc))return 'eligible';
    if(/\b(us|usa|united states|canada|europe|uk|emea|germany|portugal|india|north america)\b/.test(loc))return 'exclude';
    return 'review';
  }
  if(localBelem(job))return 'eligible';
  if(/(?:todo o? ?brasil|qualquer (?:lugar|regiao).{0,15}brasil|anywhere in brazil|100% remoto.{0,40}(?:nacional|brasil))/.test(description))return 'eligible';
  return 'review';
}
const GROUPS=[
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
  const group=GROUPS.find(([name,pattern])=>pattern.test(title) && (name!=='Outras oportunidades'||job.mode==='Remota'))?.[0];
  if(!group && !/ensino medio|high school/.test(text))return null;
  const flexible=/horarios? flexiv|jornada (?:flexiv|reduzida)|meio periodo|part[ -]time|flexible (?:hours|schedule)|\b(?:20|24|25|30)\s*(?:h\b|horas|hours)/.test(text+' '+fold(job.contract+' '+job.hours));
  return {group:group||'Ensino médio',flexible};
}
export function prepareResults(entries, now=new Date()) {
  const seen=new Set();const output=[];
  for(const job of entries) {
    if(!job.company||!job.role||!job.url)continue;
    if(job.deadline && job.deadline < new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now))continue;
    const verdict=locationVerdict(job),match=profileMatch(job);
    if(verdict==='exclude'||!match)continue;
    const key=canonicalJobUrl(job.url);if(seen.has(key))continue;seen.add(key);
    output.push({...job,...match,verdict,id:job.source+':'+job.sourceId+':'+key});
  }
  return output.sort((a,b)=>Number(b.flexible)-Number(a.flexible)||b.publishedAt.localeCompare(a.publishedAt));
}
export function filterDiscovered(entries,{search='',mode='',flexible=false,review=false}={}) {
  const query=fold(search.trim());
  return entries.filter(j=>(j.verdict==='eligible'||review) && (!mode||j.mode===mode) && (!flexible||j.flexible) && (!query||fold(j.company+' '+j.role+' '+j.description).includes(query)));
}
export function resultToJob(job) {
  const c=fold(job.contract);
  const type=/freelance|contract|pessoa juridica|\bpj\b/.test(c)?'Freelance':/estagio|intern/.test(c)?'Estágio':/temporar/.test(c)?'Temporário':/\bclt\b/.test(c)?'CLT':'';
  return {company:job.company,role:job.role,city:job.mode==='Remota'?job.city:'Belém (PA)',mode:job.mode,type,salary:job.salary,hours:job.hours||(/part[ -]time/.test(c)?'Carga reduzida (confira no anúncio)':''),url:job.url,deadline:job.deadline,status:'Salvei',notes:`Fonte: ${job.source}\n${job.url}\nLocalização informada: ${job.city}${job.state?', '+job.state:''}\n${job.verdict==='review'?'Localização conferida manualmente: atuação de Belém permitida.\n':''}${job.flexible?'Há indicação de flexibilidade ou carga reduzida; confirme as condições no anúncio.\n':''}\nResumo do anúncio:\n${job.description.slice(0,8500)}`};
}
