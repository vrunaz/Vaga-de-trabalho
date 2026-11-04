import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLinkedIn,normalizeInfoJobs,normalizeIndeed,normalizeLever,normalizeSocial,normalizeJobPosting,jsonAfter,PUBLIC_SOURCES } from '../public-sources.js';
import { prepareResults,locationVerdict,profileMatch,contractTypes,filterDiscovered,resultToJob,isSavedResult,dateString } from '../discovery-model.js';
import { sourceGroups,collectDiscovery } from '../discovery-api.js';
import { normalizeJob,makeBackup,parseBackup } from '../model.js';
const source={family:'LinkedIn',url:'https://www.linkedin.com/jobs-guest/jobs/api/test',scope:'local'};
const listing=(overrides={})=>({source:'LinkedIn',sourceId:'1111111',role:'Atendente de Farmácia',company:'Empresa Exemplo',mode:'Presencial',city:'Belém',state:'PA',country:'Brazil',eligibilityLocation:'',url:'https://www.linkedin.com/jobs/view/atendente-1111111',description:'Atendimento e vendas. Ensino médio completo.',contract:'CLT',publishedAt:'2026-11-04T10:00:00Z',deadline:'',hours:'',salary:'',...overrides});
test('LinkedIn público preserva data e não inventa modalidade, contratação ou idioma',()=>{
  const html='<li><div data-entity-urn="urn:li:jobPosting:1111111"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/atendente-1111111?trackingId=x"></a><h3 class="base-search-card__title">Atendente de Farmácia</h3><h4 class="base-search-card__subtitle"><a>Empresa &amp; Exemplo</a></h4><span class="job-search-card__location">Belém, Pará, Brazil</span><time datetime="2026-11-04"></time></div></li>';
  const jobs=prepareResults(normalizeLinkedIn({html},source));assert.equal(jobs.length,1);assert.equal(jobs[0].mode,'');assert.equal(jobs[0].company,'Empresa & Exemplo');assert.equal(jobs[0].languages,'');assert.deepEqual(jobs[0].contractTypes,[]);assert.ok(jobs[0].applicationUrl.startsWith('https://www.linkedin.com/'));assert.ok(jobs[0].publishedAt.startsWith('2026-11-04'));
});
test('InfoJobs extrai empresa, anúncio, cidade e modalidade da página pública',()=>{
  const html='<div id="vacancy123" data-href="/vaga-de-atendente__123.aspx"><div class="js_date" data-value="2026/11/04 05:52:00"></div><h2 class="js_vacancyTitle">Atendente De Farm&#xE1;cia</h2><a class="text-body text-decoration-none" href="/empresa">Farmácia Exemplo<span>LTDA</span></a><div class="mb-8">Bel&#xE9;m - PA<span>0 km</span></div><div>Presencial R$ 1.874,00</div></div>';
  const jobs=prepareResults(normalizeInfoJobs({html},{family:'InfoJobs',url:'https://www.infojobs.com.br/empregos-em-belem,-pa.aspx'}));assert.equal(jobs.length,1);assert.equal(jobs[0].company,'Farmácia Exemplo');assert.equal(jobs[0].city,'Belém');assert.equal(jobs[0].mode,'Presencial');assert.equal(jobs[0].salary,'R$ 1.874,00');assert.equal(jobs[0].experience,'');
});
test('Indeed lê somente JSON público, sem executar scripts ou presumir remoto pelo filtro',()=>{
  const row={jobkey:'abc',title:'Recepcionista',company:'Empresa',jobLocationCity:'Belém',jobLocationState:'PA',country:'BR',formattedLocation:'Belém, PA',remoteLocation:false,jobTypes:['Efetivo/CLT'],pubDate:Date.parse('2026-11-04T10:00:00Z'),snippet:'Experiência com atendimento. Inglês intermediário.'};
  const data={metaData:{mosaicProviderJobCardsModel:{results:[row]}}};
  const html='window.mosaic.providerData["mosaic-provider-jobcards"]='+JSON.stringify(data)+';throw new Error("not executed")';
  const jobs=prepareResults(normalizeIndeed({html},{family:'Indeed',url:'https://br.indeed.com/jobs',scope:'remote'}));assert.equal(jobs.length,1);assert.equal(jobs[0].mode,'');assert.ok(jobs[0].languages.includes('Inglês'));assert.ok(jobs[0].experience.includes('Experiência'));assert.ok(jobs[0].contractTypes.includes('CLT'));
  assert.deepEqual(jsonAfter('x={"text":"} [ \\\"", "list":[1]} trailing','x='),{text:'} [ "',list:[1]});
});
test('Plataforma de IA mantém elegibilidade Brasil, inglês, experiência e freelance por tarefa',()=>{
  const data=[{id:'ai1',text:'AI Response Evaluator - Portuguese',country:'BR',workplaceType:'remote',categories:{location:'Brazil',allLocations:['Brazil'],commitment:'Freelance'},createdAt:Date.parse('2026-11-04T10:00:00Z'),descriptionPlain:'Must be located in Brazil. Fluent Portuguese and English. No prior experience is required. Employment Type: Freelance, part-time, per-task.',hostedUrl:'https://jobs.lever.co/weloglobal/ai1',applyUrl:'https://jobs.lever.co/weloglobal/ai1/apply'}];
  const jobs=prepareResults(normalizeLever(data,{company:'Welo Data',family:'Welo Data',url:'https://api.lever.co/v0/postings/weloglobal?mode=json'}));assert.equal(jobs.length,1);assert.equal(jobs[0].verdict,'eligible');assert.equal(jobs[0].group,'Inteligência artificial');assert.ok(jobs[0].languages.includes('Portuguese'));assert.ok(jobs[0].experience.includes('No prior experience'));assert.ok(jobs[0].contractTypes.includes('Por tarefa'));assert.ok(jobs[0].contractTypes.includes('Meio período'));assert.ok(jobs[0].applicationUrl.endsWith('/apply'));
});
test('Residência fora do Brasil não vira a confirmar; engenharia e idiomas fora do perfil não são recomendados',()=>{
  const remote=listing({mode:'Remota',city:'Poland',eligibilityLocation:'Poland',locationRestrictionsExplicit:true,description:'Must reside in Poland',role:'AI trainer'});
  assert.equal(locationVerdict(remote),'exclude');assert.equal(locationVerdict({...remote,eligibilityLocation:'',locationRestrictionsExplicit:false,description:''}),'review');
  assert.equal(profileMatch(listing({role:'LLM Fine-Tuning Engineer'})),null);assert.equal(profileMatch(listing({role:'Engenheiro(a) de Inteligência Artificial | Chatbot'})),null);assert.equal(profileMatch(listing({role:'Ads Quality Rater - Italian (Brazil)'})),null);
  assert.equal(locationVerdict(listing({role:'Atendente de Farmácia - Xinguara'})),'exclude');
});
test('Duplicata entre plataformas reúne fontes e preserva campos mais completos sem favorecer ordem de entrada',()=>{
  const a=listing({mode:'',contract:''}),b=listing({source:'InfoJobs',url:'https://www.infojobs.com.br/vaga-de-atendente__123.aspx',company:'Empresa Exemplo LTDA',role:'Atendente Farmácia - Belém',description:'Experiência no atendimento. Português fluente. Descrição detalhada.',contract:'CLT'});
  const merged=prepareResults([a,b]);assert.equal(merged.length,1);assert.equal(merged[0].appearances.length,2);assert.ok(merged[0].languages.includes('Português'));
  const reverse=prepareResults([b,a]);assert.equal(reverse[0].url,merged[0].url);assert.deepEqual(reverse[0].appearances,merged[0].appearances);
  assert.equal(prepareResults([a,{...b,contract:'Freelance'},{...b,source:'Indeed',contract:'CLT',url:'https://br.indeed.com/viewjob?jk=a'}]).length,2); // known CLT and freelance formats remain distinct despite a third ad with unknown type
  const fixed=listing(),freelance={...b,contract:'Freelance'};assert.equal(prepareResults([fixed,freelance]).length,2);
});
test('Atualidade vem antes da preferência de fonte; filtros de IA, fonte e contratação funcionam',()=>{
  const newer=listing({source:'InfoJobs',url:'https://www.infojobs.com.br/vaga__2.aspx',publishedAt:'2026-11-04T12:00:00Z',company:'Nova'}),older=listing({source:'Gupy',url:'https://empresa.gupy.io/jobs/1',publishedAt:'2026-11-03T12:00:00Z',company:'Antiga'});
  const jobs=prepareResults([older,newer]);assert.equal(jobs[0].source,'InfoJobs');assert.deepEqual(prepareResults([newer,older]).map(j=>j.url),jobs.map(j=>j.url));assert.equal(filterDiscovered(jobs,{source:'InfoJobs',contract:'CLT'}).length,1);
  assert.ok(contractTypes(listing({contract:'full_time'})).includes('Tempo integral'));assert.ok(!contractTypes(listing({contract:'full_time'})).includes('Efetivo'));
});
test('Rede social com dados verificáveis pode entrar; página de login não é apresentada como pesquisada',async()=>{
  const post={html:'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Atendente',hiringOrganization:{name:'Anunciante'},jobLocation:{address:{addressLocality:'Belém',addressRegion:'PA',addressCountry:'Brasil'}},description:'Trabalho presencial. Diária. Candidate-se pelo anúncio.',employmentType:'Diária',url:'https://www.instagram.com/p/verified/',datePosted:'2026-11-04'})+'</script>'};
  const jobs=prepareResults(normalizeSocial(post,{family:'Instagram',url:'https://www.instagram.com/empregosbelem/'}));assert.equal(jobs.length,1);assert.equal(jobs[0].source,'Instagram');assert.ok(jobs[0].contractTypes.includes('Diária'));
  assert.throws(()=>normalizeSocial({html:'<title>Facebook</title>Login required'}, {family:'Facebook',url:'https://www.facebook.com/empregosbelem/'}),e=>e.code==='RESTRICTED');
  const result=await collectDiscovery(async()=>{throw Object.assign(new Error('Acesso limitado'),{code:'RESTRICTED'});});assert.ok(result.sources.every(s=>s.state==='restricted'));assert.equal(result.jobs.length,0);
});
test('Painel agrupa consultas por plataforma sem chamar restrição de consulta bem-sucedida',()=>{
  const groups=sourceGroups([{name:'Gupy · A',family:'Gupy',state:'ok'},{name:'Gupy · B',family:'Gupy',state:'ok'},{name:'LinkedIn · A',family:'LinkedIn',state:'ok'},{name:'LinkedIn · B',family:'LinkedIn',state:'restricted'},{name:'Instagram',state:'restricted'}]);assert.equal(groups.length,3);assert.equal(groups.find(g=>g.name==='LinkedIn').state,'partial');assert.equal(groups.find(g=>g.name==='Instagram').successes,0);
});
test('Novas contratações continuam exportáveis e importáveis sem alterar registros anteriores',()=>{
  for(const type of ['Efetivo','Diária','Meio período','Tempo integral','Por tarefa','Contrato/PJ']){const job=normalizeJob({company:'Empresa',role:'Atendente',type});assert.deepEqual(parseBackup(JSON.stringify(makeBackup([job]))),[job]);}
});

test('Data sem horário não ganha hora inventada e duplicata já salva é reconhecida por qualquer link original',()=>{
  assert.equal(dateString('2026-11-04'),'2026-11-04');assert.equal(dateString('2026-11-04T10:00:00'),'2026-11-04');assert.equal(dateString('2026-02-30'),'');
  const result=listing({appearances:[{source:'InfoJobs',url:'https://www.infojobs.com.br/vaga-de-atendente__123.aspx'}]});const saved=normalizeJob({company:'Empresa Exemplo',role:'Atendente',url:'https://www.infojobs.com.br/outra-url__123.aspx'});assert.equal(isSavedResult(result,[saved]).id,saved.id);
});

test('Anúncio público social com cargo, Belém e contato verificável não precisa estar em recrutadora',()=>{
  const source={family:'Instagram',announcer:'Empregos Belém',url:'https://www.instagram.com/p/PublicJob/'};
  const html='<meta property="og:description" content="Vaga: recepcionista presencial em Belém–PA. Trabalho por diária. Envie o currículo para vagas@empresa.example.">';
  const jobs=prepareResults(normalizeSocial({html},source));assert.equal(jobs.length,1);assert.equal(jobs[0].company,'Empregos Belém');assert.ok(jobs[0].applicationMethod.includes('vagas@empresa.example'));assert.equal(jobs[0].publishedAt,'');assert.equal(jobs[0].verdict,'eligible');
  assert.throws(()=>normalizeSocial({html:'<meta property="og:description" content="Vaga de recepcionista em Belém–PA. Saiba mais.">'},source),e=>e.code==='RESTRICTED');
});
