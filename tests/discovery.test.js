import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRemotive,normalizeGupy,locationVerdict,prepareResults,filterDiscovered,resultToJob,isSavedResult,plainText,safeJobUrl } from '../discovery-model.js';
import { collectDiscovery,SOURCES } from '../discovery-api.js';
import { normalizeJob,makeBackup,parseBackup } from '../model.js';
const rem=(overrides={})=>normalizeRemotive({jobs:[{id:1,title:'Customer Support',company_name:'Empresa de teste',candidate_required_location:'Brazil',url:'https://remotive.com/remote-jobs/test/1',description:'Flexible hours',publication_date:'2026-11-04T10:00:00',...overrides}]} )[0];
const local=(overrides={})=>normalizeGupy({data:[{id:2,name:'Atendente de farmácia',companyName:'Farmácia de teste',jobUrl:'https://empresa.gupy.io/jobs/2',city:'Belém',state:'PA',country:'Brasil',workplaceType:'on-site',isRemote:false,...overrides}]} )[0];
test('Presencial e híbrida somente em Belém do Pará, nunca Belém de outro estado',()=>{
  for(const workplaceType of ['on-site','hybrid']){
    assert.equal(locationVerdict(local({workplaceType})),'eligible');
    assert.equal(locationVerdict(local({workplaceType,state:'PB'})),'exclude');
    assert.equal(locationVerdict(local({workplaceType,city:'Ananindeua'})),'exclude');
  }
  assert.equal(locationVerdict(local({state:''})),'exclude');
});
test('Remotas: Brasil, mundial e América Latina; Estados Unidos e Europa exclusivos são rejeitados',()=>{
  for(const loc of ['Brazil','Brasil','Worldwide','Anywhere','LATAM','Latin America','South America'])assert.equal(locationVerdict(rem({candidate_required_location:loc})),'eligible');
  for(const loc of ['USA','Europe','United States only','North America','Anywhere in the United States','Latin America excluding Brazil'])assert.equal(locationVerdict(rem({candidate_required_location:loc})),'exclude');
  assert.equal(locationVerdict(rem({description:'Worldwide, but US-only for this role'})),'exclude');
  assert.equal(locationVerdict(rem({candidate_required_location:''})),'review');
  assert.equal(locationVerdict(rem({candidate_required_location:'Brazil, São Paulo only'})),'review');
  assert.equal(locationVerdict(rem({description:'Must reside in the United States'})),'exclude');
});
test('Gupy remota com cidade de outra região exige confirmação geográfica; toda Brasil pode entrar',()=>{
  const r=local({isRemote:true,workplaceType:'remote',city:'São Paulo',state:'SP'});
  assert.equal(locationVerdict(r),'review');
  assert.equal(locationVerdict({...r,description:'Trabalhe de qualquer lugar do Brasil'}),'eligible');
  assert.equal(locationVerdict({...r,description:'Necessário residir em São Paulo'}),'review');
});
test('Filtra perfil de graduanda, prioriza flexibilidade, não apaga demais vagas',()=>{
  const jobs=prepareResults([local(),rem(),rem({id:3,title:'Senior Sales Director',url:'https://remotive.com/3'}),local({id:4,name:'Farmacêutico',jobUrl:'https://empresa.gupy.io/jobs/4'}),local({id:5,name:'Estagiária de Farmácia',jobUrl:'https://empresa.gupy.io/jobs/5'}),local({id:6,name:'Engenheiro de software',jobUrl:'https://empresa.gupy.io/jobs/6'})]);
  assert.equal(jobs.length,3);assert.equal(jobs[0].flexible,true);assert.ok(jobs.some(j=>!j.flexible));
  assert.equal(filterDiscovered(jobs,{flexible:true}).length,1);
  assert.equal(filterDiscovered(jobs,{search:'FARMACIA',mode:'Presencial'}).length,2);
});
test('Localização incerta fica oculta por padrão e só entra com opção explícita',()=>{
  const jobs=prepareResults([rem({candidate_required_location:''}),local()]);
  assert.equal(filterDiscovered(jobs).length,1);assert.equal(filterDiscovered(jobs,{review:true}).length,2);
});
test('Não repete anúncios, não presume candidatura e mantém detalhes no backup',()=>{
  const result=prepareResults([rem(),rem({url:'https://remotive.com/remote-jobs/test/1?utm_source=other'})]);assert.equal(result.length,1);
  const saved=normalizeJob(resultToJob(result[0]));assert.equal(saved.status,'Salvei');assert.equal(saved.type,'');assert.ok(saved.notes.includes('Fonte: Remotive'));
  assert.equal(isSavedResult(result[0],[saved]).id,saved.id);assert.deepEqual(parseBackup(JSON.stringify(makeBackup([saved]))),[saved]);
});
test('Rejeita formatos inesperados, links inseguros, vagas sem link e prazos encerrados',()=>{
  assert.throws(()=>normalizeRemotive({}));assert.throws(()=>normalizeGupy({data:{}}));
  assert.equal(safeJobUrl('javascript:alert(1)'),'');assert.equal(safeJobUrl('https://user:pass@host.com'),'');
  assert.equal(prepareResults([rem({url:'javascript:alert(1)'})]).length,0);
  assert.equal(prepareResults([{...local(),deadline:'2020-01-01'}]).length,0);
  assert.ok(!plainText('<script>alert(1)</script><p>Vaga &amp; texto</p>').includes('alert'));
});
test('Falhas das fontes são explícitas; uma fonte funcionando gera resultado parcial sem simular vagas',async()=>{
  const failed=await collectDiscovery(async()=>{throw new Error('Network blocked');});
  assert.equal(failed.jobs.length,0);assert.ok(failed.sources.every(s=>s.state==='error'));
  const partial=await collectDiscovery(async url=>{if(url===SOURCES[0].url)return {jobs:[{id:1,title:'Customer Support',company_name:'Teste',candidate_required_location:'Brazil',url:'https://remotive.com/1'}]};throw new Error('Blocked');});
  assert.equal(partial.jobs.length,1);assert.equal(partial.sources.filter(s=>s.state==='ok').length,1);
});
test('Gupy atual: careerPageName e estado por extenso produzem vaga salvável em Belém',()=>{
  const current={data:[{id:12701331,name:'Assistente de Atendimento I',careerPageName:'Empresa de teste',city:'Belém',state:'Pará',workplaceType:'on-site',type:'vacancy_type_effective',jobUrl:'https://empresa.gupy.io/job/teste?jobBoardSource=gupy_portal',publishedDate:'2026-11-04T20:47:08.350Z',applicationDeadline:'2099-01-03T00:00:00.000Z',description:'Ensino médio completo.'}],pagination:{total:1,limit:50,offset:0}};
  const jobs=prepareResults(normalizeGupy(current));assert.equal(jobs.length,1);assert.equal(jobs[0].company,'Empresa de teste');assert.equal(jobs[0].verdict,'eligible');assert.equal(normalizeJob(resultToJob(jobs[0])).company,'Empresa de teste');
});
test('Consultas Gupy usam a rota pública atual e separam Belém de remotas',()=>{
  const gupy=SOURCES.filter(s=>s.name.startsWith('Gupy'));
  assert.equal(gupy.length,12);
  for(const source of gupy){const u=new URL(source.url);assert.equal(u.origin,'https://portal.gupy.io');assert.equal(u.pathname,'/api/job-search/jobs');assert.equal(u.searchParams.get('sortBy'),'publishedDate');assert.equal(u.searchParams.get('sortOrder'),'desc');if(source.name.endsWith('Belém')){assert.equal(u.searchParams.get('city'),'Belém');assert.equal(u.searchParams.get('state'),'Pará');}else{assert.equal(u.searchParams.get('workplaceType'),'remote');assert.equal(u.searchParams.has('city'),false);}}
});
test('Paginação real da Gupy indica consulta parcial e falhas HTTP são distinguíveis',async()=>{
  const partial=await collectDiscovery(async url=>{if(new URL(url).hostname==='portal.gupy.io')return {data:[],pagination:{total:100,limit:50,offset:0}};return {jobs:[]};});
  assert.ok(partial.sources.filter(s=>s.name.startsWith('Gupy')).every(s=>s.limited));
  const missing=await collectDiscovery(async()=>{throw new Error('HTTP 404');});assert.ok(missing.sources.every(s=>s.message.includes('HTTP 404')));
  const cors=await collectDiscovery(async()=>{throw new Error('GUPY_SERVER_REQUIRED');});assert.ok(cors.sources.every(s=>s.message.includes('servidor')));
});
test('HTML usa cópia real datada sem chamar de consulta atual e recusa cópia com mais de 7 dias',async()=>{
  const {withGupySnapshot}=await import('../discovery-api.js');
  const fetchedAt='2026-11-04T12:00:00Z',source='Gupy · farmácia · Belém';
  const data={version:1,fetchedAt,sources:[{name:source,state:'error'}],jobs:[]};
  const snapshot={version:1,fetchedAt,sources:[{name:source,state:'ok',count:1}],jobs:prepareResults([local()],new Date(fetchedAt))};
  const result=withGupySnapshot(data,snapshot,new Date('2026-11-04T13:00:00Z'));
  assert.equal(result.jobs.length,1);assert.equal(result.sources[0].state,'snapshot');assert.equal(result.snapshotAt,fetchedAt);
  assert.equal(withGupySnapshot(data,snapshot,new Date('2026-11-12T13:00:00Z')).jobs.length,0);
  const live={...data,sources:[{name:source,state:'ok'}]};assert.deepEqual(withGupySnapshot(live,snapshot,new Date('2026-11-04T13:00:00Z')),live);
});
