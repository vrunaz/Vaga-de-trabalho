import { normalizeRemotive,normalizeGupy,prepareResults } from '../discovery-model.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const temp=await mkdtemp(path.join(tmpdir(),'minhas-vagas-test-'));
const cacheDir=path.join(temp,'cache');await mkdir(cacheDir);await writeFile(path.join(cacheDir,'public-discovery.json'),JSON.stringify({version:1,lastAttemptAt:new Date().toISOString(),data:{version:1,fetchedAt:new Date().toISOString(),sources:[{name:'Test-only cache',state:'ok'}],jobs:[]}}));
const port=Number(process.env.TEST_PORT || 3100), debugPort=Number(process.env.DEBUG_PORT || 9223);
const staticRoot=process.argv.includes('--static')?path.resolve('site'):null;
const singleHtml=process.argv.includes('--single')?path.resolve('dist/minhas-vagas.html'):null;
const serverArgs=staticRoot?['-e',`const fs=require('fs'),path=require('path');require('http').createServer((req,res)=>{let name=new URL(req.url,'http://localhost').pathname;if(name.startsWith('/minhas-vagas/'))name=name.slice('/minhas-vagas/'.length);if(!name)name='index.html';if(!['index.html','app.js','model.js','daily-discovery.js','discovery-api.js','discovery-model.js','discovery-ui.js','styles.css','data/vagas.json'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(path.join(${JSON.stringify(staticRoot)},name)));}).listen(Number(process.env.PORT),'127.0.0.1')`]:singleHtml?['-e',`require('http').createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(require('fs').readFileSync(${JSON.stringify(singleHtml)}));}).listen(Number(process.env.PORT),'127.0.0.1')`]:['server.mjs'];
const server=spawn(process.execPath,serverArgs,{env:{...process.env,PORT:String(port),MINHAS_VAGAS_CACHE_DIR:cacheDir},stdio:'ignore'});
const appUrl=`http://127.0.0.1:${port}${staticRoot?'/minhas-vagas/':''}`;
const browser=spawn(process.env.CHROMIUM || 'chromium',['--headless','--no-sandbox','--disable-dev-shm-usage',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${path.join(temp,'profile')}`,'about:blank'],{stdio:'ignore'});
let ws; const pending=new Map(); const runtimeErrors=[]; let nextId=0;
async function poll(fn) { for(let i=0;i<100;i++){try {const value=await fn(); if(value)return value;}catch{} await delay(100);}throw new Error('Tempo limite aguardando inicialização.'); }
async function cdp(method,params={}) { const id=++nextId; return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},10000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject});ws.send(JSON.stringify({id,method,params}));}); }
async function run(expression) { const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value; }
async function check(expression,label) { assert.equal(await run(expression),true,label);console.log('✓ '+label); }
async function ready() { await poll(()=>run("document.readyState==='complete' && !!document.querySelector('#first-job, .job-card')")); }
try {
  const targets=await poll(async()=>{const r=await fetch(`http://127.0.0.1:${debugPort}/json`);const t=await r.json();return t.length?t:null;});
  ws=new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
  ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id); data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result);}}if(data.method==='Runtime.exceptionThrown')runtimeErrors.push(data.params);});
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Emulation.setTimezoneOverride',{timezoneId:'Asia/Tokyo'});
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await poll(async()=>{const r=await fetch(appUrl);return r.ok;});
  await cdp('Page.navigate',{url:appUrl});await ready();
  await check("document.querySelector('#stat-saved').textContent==='0' && !!document.querySelector('#first-job')",'Lista inicial vazia e cadastro visível');
  let screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('/tmp/minhas-vagas-desktop.png',Buffer.from(screenshot.data,'base64'));
  await run("document.querySelector('#first-job').click();document.querySelector('#job-form').requestSubmit()");
  await check("document.querySelector('#job-dialog').open && !document.querySelector('#job-form').checkValidity()",'Empresa e cargo obrigatórios');
  await run(`(()=>{const f=document.querySelector('#job-form');f.elements.company.value='Empresa Pará';f.elements.role.value='Assistente administrativo';f.requestSubmit();})()`);
  await check("document.querySelectorAll('.job-card').length===1 && !document.querySelector('#job-dialog').open",'Cadastro apenas com os dois campos obrigatórios');
  await cdp('Page.reload');await ready();
  await check("document.querySelectorAll('.job-card').length===1",'Persistência depois de recarregar');
  await run(`(()=>{document.querySelector('[data-action=edit]').click();const f=document.querySelector('#job-form');f.elements.mode.value='Híbrida';f.elements.mode.dispatchEvent(new Event('change'));})()`);
  await check("document.querySelector('[name=city]').value==='Belém (PA)' && document.querySelector('[name=city]').readOnly",'Híbrida preenche e fixa Belém');
  await run(`(()=>{const f=document.querySelector('#job-form');f.elements.mode.value='Presencial';f.elements.mode.dispatchEvent(new Event('change'));})()`);
  await check("document.querySelector('[name=city]').value==='Belém (PA)' && document.querySelector('[name=city]').readOnly",'Presencial preenche e fixa Belém');
  await run(`(()=>{const f=document.querySelector('#job-form');for(const [k,v] of Object.entries({type:'Freelance',salary:'R$ 2.500',hours:'30h semanais',url:'https://example.com/vaga',contact:'contato@example.com',deadline:'2099-11-30',sentDate:'2026-11-04',resume:'Currículo v2',interview:'2099-11-05T10:30',notes:'Detalhes importantes <img src=x onerror=alert(1)>',status:'Entrevista marcada'})) f.elements[k].value=v;f.requestSubmit();})()`);
  await check("document.querySelector('#stat-sent').textContent==='1' && document.querySelector('#stat-interviews').textContent==='1' && document.querySelector('.agenda-event').textContent.includes('10:30')",'Edição dos detalhes, resumo e entrevista no horário de Belém mesmo com navegador em Tóquio');
  await check("!document.querySelector('.job-card img') && document.querySelector('.job-card').textContent.includes('<img')",'Observações são texto seguro');
  for(const status of ['Salvei','Currículo enviado','Entrevista marcada','Aguardando retorno','Aprovada','Não selecionada','Vaga encerrada']) {
    await run(`(()=>{const s=document.querySelector('.status-select');s.value=${JSON.stringify(status)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await check(`JSON.parse(localStorage.getItem('minhas-vagas:v1')).jobs[0].status===${JSON.stringify(status)}`,'Status: '+status);
  }
  await run(`(()=>{document.querySelector('#add-job').click();const f=document.querySelector('#job-form');for(const [k,v] of Object.entries({company:'Estúdio Norte',role:'Designer',mode:'Remota',type:'CLT',city:'São Paulo',status:'Salvei'}))f.elements[k].value=v;f.elements.mode.dispatchEvent(new Event('change'));f.requestSubmit();})()`);
  await check("document.querySelectorAll('.job-card').length===2",'Segunda vaga remota em outra cidade');
  await run("document.querySelector('#search').value='PARA';document.querySelector('#search').dispatchEvent(new Event('input'))");
  await check("document.querySelectorAll('.job-card').length===1 && document.querySelector('.job-card').textContent.includes('Empresa Pará')",'Busca por empresa sem distinção de acentos');
  await run("document.querySelector('#search').value='Designer';document.querySelector('#search').dispatchEvent(new Event('input'))");
  await check("document.querySelectorAll('.job-card').length===1 && document.querySelector('.job-card').textContent.includes('Estúdio Norte')",'Busca por cargo');
  await run("document.querySelector('#clear-filters').click();document.querySelector('#filter-mode').value='Remota';document.querySelector('#filter-type').value='CLT';document.querySelector('#filter-status').value='Salvei';document.querySelector('#filter-mode').dispatchEvent(new Event('change'))");
  await check("document.querySelectorAll('.job-card').length===1 && document.querySelector('.job-card').textContent.includes('Designer')",'Filtros combinados por modalidade, contratação e status');
  await run("document.querySelector('#filter-type').value='Freelance';document.querySelector('#filter-type').dispatchEvent(new Event('change'))");
  await check("document.querySelectorAll('.job-card').length===0 && document.querySelector('#empty-clear')!==null",'Filtros sem resultados');
  await run("document.querySelector('#empty-clear').click();document.querySelector('[data-action=delete]').click();document.querySelector('#confirm-cancel').click()");
  await check("document.querySelectorAll('.job-card').length===2",'Cancelar exclusão preserva os registros');
  await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
  await run("document.querySelector('#backup-button').click();document.querySelector('#export-button').click()");
  const backupPath=await poll(async()=>{const files=await readdir(temp);const file=files.find(f=>f.endsWith('.json'));return file?path.join(temp,file):null;});
  const backup=JSON.parse(await readFile(backupPath,'utf8'));assert.equal(backup.jobs.length,2);assert.equal(backup.jobs[1].resume,'Currículo v2');console.log('✓ Download real do backup com todos os detalhes');
  await run("document.querySelector('#backup-dialog .close-dialog').click();document.querySelector('[data-action=delete]').click();document.querySelector('#confirm-ok').click()");
  await check("document.querySelectorAll('.job-card').length===1",'Exclusão confirmada');
  await run("document.querySelector('#backup-button').click()");
  const dom=await cdp('DOM.getDocument');const fileInput=await cdp('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#import-file'});
  await cdp('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[backupPath]});
  await poll(()=>run("document.querySelector('#confirm-dialog').open"));
  await check("document.querySelectorAll('.job-card').length===1",'Importação aguarda confirmação antes de substituir');
  await run("document.querySelector('#confirm-cancel').click()");
  await check("document.querySelectorAll('.job-card').length===1",'Cancelar importação preserva dados');
  await cdp('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[backupPath]});await poll(()=>run("document.querySelector('#confirm-dialog').open"));
  await run("document.querySelector('#confirm-ok').click()");
  await check("document.querySelectorAll('.job-card').length===2 && JSON.parse(localStorage.getItem('minhas-vagas:v1')).jobs[1].resume==='Currículo v2'",'Importação restaura todos os dados');
  const invalid=path.join(temp,'invalid.json');await writeFile(invalid,'{"jobs":[]}');
  await run("document.querySelector('#backup-button').click()");await cdp('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[invalid]});await poll(()=>run("!document.querySelector('#backup-error').hidden"));
  await check("document.querySelectorAll('.job-card').length===2 && !document.querySelector('#confirm-dialog').open",'Backup inválido rejeitado sem alterar registros');
  await run("document.querySelector('#backup-dialog .close-dialog').click()");
  for (const width of [390,320,768,1440]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await check("document.documentElement.scrollWidth<=window.innerWidth",'Layout sem rolagem horizontal em '+width+'px');
    await run("document.querySelector('#add-job').click()");
    await check("document.querySelector('#job-dialog').scrollWidth<=document.querySelector('#job-dialog').clientWidth",'Formulário responsivo em '+width+'px');
    await run("document.querySelector('#job-dialog .close-dialog').click()");
  }
  // Test-only source responses. No fixture is served by the production application.
  let discoveryReply={version:1,fetchedAt:new Date().toISOString(),sources:[{name:'Remotive',state:'ok'},{name:'Gupy · atendimento',state:'error'}],jobs:prepareResults([
    ...normalizeRemotive({jobs:[
      {id:'fixture-1',title:'Customer Support',company_name:'Remota de teste',candidate_required_location:'Brazil',url:'https://remotive.com/fixture/1',description:'Flexible hours, part-time',job_type:'part_time'},
      {id:'fixture-2',title:'Assistente administrativo',company_name:'Empresa Pará',candidate_required_location:'Brazil',url:'https://example.com/vaga'},
      {id:'fixture-3',title:'Atendente remoto',company_name:'Local a confirmar',candidate_required_location:'',url:'https://remotive.com/fixture/3'}
    ]}),
    ...normalizeGupy({data:[{id:'fixture-4',name:'Atendente de farmácia',careerPageName:'Farmácia de teste',city:'Belém',state:'PA',country:'Brasil',isRemote:false,workplaceType:'on-site',jobUrl:'https://example.gupy.io/jobs/fixture-4'}]})
  ])};
  ws.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.method==='Fetch.requestPaused')cdp('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(discoveryReply)).toString('base64')});});
  await cdp('Fetch.enable',{patterns:[{urlPattern:staticRoot?'*/data/vagas.json':'*/api/discover'}]});
  await run("document.querySelector('#discover-tab').click()");await poll(()=>run("document.querySelectorAll('.discovery-card').length===3"));
  await check("document.querySelector('#saved-workspace').hidden && document.querySelector('#discovery-status').textContent.includes('Busca parcial')",'Busca abre automaticamente e indica fontes parciais (respostas simuladas)');
  await check("[...document.querySelectorAll('[data-discovery-save]')].filter(b=>b.disabled).length===1",'Anúncio já salvo é identificado sem presumir candidatura');
  await run("document.querySelector('#discovery-flexible').checked=true;document.querySelector('#discovery-flexible').dispatchEvent(new Event('change'))");
  await check("document.querySelectorAll('.discovery-card').length===1 && document.querySelector('.discovery-card').textContent.includes('Customer Support')",'Filtro de flexibilidade na busca');
  await run("document.querySelector('#discovery-flexible').checked=false;document.querySelector('#discovery-flexible').dispatchEvent(new Event('change'));document.querySelector('#discovery-search').value='farmacia';document.querySelector('#discovery-search').dispatchEvent(new Event('input'))");
  await check("document.querySelectorAll('.discovery-card').length===1",'Refinar oportunidades pelo cargo');
  await run("document.querySelector('[data-discovery-save]').click()");
  await check("JSON.parse(localStorage.getItem('minhas-vagas:v1')).jobs.length===3 && JSON.parse(localStorage.getItem('minhas-vagas:v1')).jobs[0].city==='Belém (PA)' && document.querySelector('[data-discovery-save]').disabled",'Salvar resultado inclui vaga no organizador e impede duplicação');
  await run("document.querySelector('#discovery-search').value='';document.querySelector('#discovery-search').dispatchEvent(new Event('input'));document.querySelector('#discovery-review').checked=true;document.querySelector('#discovery-review').dispatchEvent(new Event('change'))");
  await check("document.querySelectorAll('.discovery-card').length===4",'Vagas com localização incerta só aparecem com opção explícita');
  await run("[...document.querySelectorAll('.discovery-card')].find(c=>c.textContent.includes('Local a confirmar')).querySelector('[data-discovery-save]').click()");
  await check("document.querySelector('#confirm-dialog').open && document.querySelector('#confirm-title').textContent.includes('Belém')",'Salvar localização incerta exige conferência de Belém');
  await run("document.querySelector('#confirm-cancel').click()");
  await check("JSON.parse(localStorage.getItem('minhas-vagas:v1')).jobs.length===3",'Cancelar confirmação de localização preserva lista');
  await run("[...document.querySelectorAll('.discovery-card')].find(c=>c.textContent.includes('Local a confirmar')).querySelector('[data-discovery-save]').click();document.querySelector('#confirm-ok').click()");
  await check("JSON.parse(localStorage.getItem('minhas-vagas:v1')).jobs.length===4",'Confirmação de elegibilidade salva a oportunidade remota');
  for(const width of [320,390,1440]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await check("document.documentElement.scrollWidth<=innerWidth",'Busca responsiva em '+width+'px');}
  discoveryReply={version:1,fetchedAt:new Date().toISOString(),sources:[{name:'Remotive',state:'error'},{name:'Gupy',state:'error'}],jobs:[]};
  await run("localStorage.removeItem('minhas-vagas:busca:v2')");await cdp('Page.reload');await ready();
  await run("document.querySelector('#discover-tab').click()");await poll(()=>run("document.querySelector('#discovery-status').textContent.includes('Não foi possível consultar as fontes')"));
  await check("document.querySelectorAll('.discovery-card').length===0 && document.querySelector('#discovery-results').textContent.includes('indisponível')",'Falha total não é exibida como ausência de vagas');
  await run("document.querySelector('#saved-tab').click()");
  await check("document.querySelectorAll('.job-card').length===4 && !document.querySelector('#saved-workspace').hidden",'Organizador continua acessível quando a busca falha');
  await cdp('Fetch.disable');
  await run("localStorage.removeItem('minhas-vagas:v1')");await cdp('Page.reload');await ready();
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('/tmp/minhas-vagas-mobile.png',Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(runtimeErrors,[],'Sem erros de execução no navegador'); console.log('✓ Sem erros de execução no navegador\nVerificações de navegador concluídas.');
} finally {
  ws?.close();browser.kill();server.kill();await delay(400);await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
