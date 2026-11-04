import { isDailyFresh } from './daily-discovery.js';
import { PROFILE, filterDiscovered, isSavedResult, resultToJob } from './discovery-model.js';
import { collectDiscovery, DISCOVERY_CACHE_KEY, SOURCES, withGupySnapshot } from './discovery-api.js';
export function initDiscovery({getJobs,saveJob,notify,escapeHTML,confirmLocation}) {
  const q=s=>document.querySelector(s),e=escapeHTML;
  const hostedDaily=document.body.dataset.discoverySource==='daily-file';
  let data=null,busy=false,lastAttempt=0,cacheProblem=false,loadFailed=false;
  try {
    const cached=JSON.parse(localStorage.getItem(DISCOVERY_CACHE_KEY)||'null');
    if(cached?.version===1 && Array.isArray(cached.sources) && Array.isArray(cached.jobs) && Number.isFinite(Date.parse(cached.fetchedAt)))data=cached;
  } catch {cacheProblem=true;}
  if(data?.snapshotAt && Date.now()-Date.parse(data.snapshotAt)>7*24*60*60*1000)data=null;
  const embedded=location.protocol==='file:'?globalThis.MINHAS_VAGAS_GUPY_SNAPSHOT:null;
  if(!data && embedded)data=withGupySnapshot({version:1,fetchedAt:embedded.fetchedAt,sources:SOURCES.filter(s=>s.name.startsWith('Gupy')).map(s=>({name:s.name,state:'error'})),jobs:[]},embedded);
  function sourceDate(value) {const d=new Date(value);return Number.isNaN(d.getTime())?'não informada':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Belem',dateStyle:'short',timeStyle:'short'}).format(d);}
  function validResult(j) {return j && typeof j.company==='string' && typeof j.role==='string' && typeof j.description==='string' && typeof j.url==='string' && /^https:\/\//.test(j.url) && ['eligible','review'].includes(j.verdict);}
  function paint() {
    const jobs=(data?.jobs||[]).filter(validResult);
    const filters={search:q('#discovery-search').value,mode:q('#discovery-mode').value,flexible:q('#discovery-flexible').checked,review:q('#discovery-review').checked};
    const entries=filterDiscovered(jobs,filters),saved=getJobs();
    q('#discovery-results').innerHTML=entries.map((job)=>{
      const already=isSavedResult(job,saved);
      return `<article class="discovery-card"><div class="job-top"><div class="company-avatar" aria-hidden="true">${e(job.company.charAt(0).toUpperCase())}</div><div class="job-title"><h3>${e(job.role)}</h3><p>${e(job.company)}</p></div>${job.flexible?'<span class="flexible-badge">Flexível / carga reduzida</span>':''}</div><div class="job-tags"><span class="tag">${e(job.group||'Perfil compatível')}</span><span class="tag">${e(job.mode)}</span><span class="tag">${e(job.city||'Localização não informada')}${job.state?', '+e(job.state):''}</span>${job.contract?`<span class="tag">${e(job.contract)}</span>`:''}</div>${job.verdict==='review'?'<p class="location-review">Localização a confirmar: o anúncio não garante atuação de Belém. Confira antes de salvar.</p>':''}<p class="discovery-description">${e(job.description.slice(0,300))}${job.description.length>300?'…':''}</p>${job.salary?`<p class="discovery-salary">${e(job.salary)}</p>`:''}<div class="discovery-card-footer"><span>Fonte: <a href="${e(job.url)}" target="_blank" rel="noopener noreferrer">${e(job.source)}</a><small>Publicada em ${sourceDate(job.publishedAt)} · Belém</small></span><div class="discovery-card-actions"><a class="button secondary" href="${e(job.url)}" target="_blank" rel="noopener noreferrer">Ver anúncio ↗</a><button class="button ${already?'secondary':'primary'}" data-discovery-save="${e(job.id)}" ${already?'disabled':''}>${already?'Já salva · '+e(already.status):'＋ Salvar vaga'}</button></div></div></article>`;
    }).join('');
    q('#discovery-source-status').innerHTML=(data?.sources||[]).map(source=>`<span title="${e(source.message||'Consulta concluída')}" class="source-pill ${source.state==='ok'?'source-ok':source.state==='snapshot'?'source-snapshot':'source-error'}">${source.state==='ok'?'✓':source.state==='snapshot'?'◷':'!'} ${e(source.name)} · ${source.state==='ok'?'consultada':source.state==='snapshot'?'cópia de '+sourceDate(source.fetchedAt):'indisponível'}</span>`).join('');
    if(data) q('#discovery-updated').textContent=`Última consulta: ${sourceDate(data.fetchedAt)} (horário de Belém). ${jobs.filter(j=>j.verdict==='review').length} remota(s) com localização a confirmar. ${cacheProblem?'Não foi possível guardar o cache desta busca.':''}${data.cacheWarning?' '+data.cacheWarning:''}`;
    q('#daily-update-status').textContent=location.protocol==='file:'?'Você está usando o HTML baixado. A Gupy não atualiza automaticamente neste arquivo. Para receber vagas novas todos os dias, use o aplicativo com servidor hospedado.':data?.schedule?.mode==='static-daily' && !isDailyFresh(data.fetchedAt)?'A atualização diária ainda não está disponível. Exibindo a consulta de '+sourceDate(data.fetchedAt)+'. O agendador pode estar atrasado; confira novamente mais tarde.':data?.schedule?.mode==='static-daily'?'Atualização diária prevista para 08:00 de Belém, pelo agendador do site. Próxima prevista: '+sourceDate(data.schedule.nextUpdateAt)+'. Pode haver atraso na execução; confira a data da última consulta. Não depende do seu notebook ligado.':data?.schedule?'Atualização automática: todos os dias às 08:00 de Belém. Próxima prevista: '+sourceDate(data.schedule.nextUpdateAt)+'. O servidor precisa permanecer em execução.':'Atualização diária às 08:00 de Belém, enquanto o servidor estiver em execução. Ao abrir a busca, a página confere a atualização disponível.';
    const successes=(data?.sources||[]).filter(s=>s.state==='ok'||s.state==='snapshot').length;
    if(!busy && data){
      const anyError=data.sources.some(s=>s.state==='error');
      q('#discovery-status').classList.toggle('has-error',anyError||loadFailed);
      q('#discovery-status').textContent=data.stale?'As fontes não responderam à atualização diária. Exibindo a última consulta disponível de '+sourceDate(data.fetchedAt)+'. Uma nova tentativa será feita em cerca de uma hora, com o servidor ativo.':loadFailed?'A atualização falhou. Exibindo a consulta anterior de '+sourceDate(data.fetchedAt)+'. Confira os anúncios antes de se candidatar.':successes===0?'Não foi possível consultar as fontes. Verifique a internet e o acesso às fontes; nenhum resultado novo pôde ser confirmado. Suas vagas salvas continuam disponíveis.':`${entries.length} oportunidade(s) exibida(s). ${anyError?'Busca parcial: algumas fontes estão indisponíveis. ':''}${data.sources.some(s=>s.limited)?'Há mais anúncios na fonte do que nesta consulta. ':''}Resultados são sugestões; confira requisitos e localização no anúncio.${data.snapshotAt?' Gupy: cópia consultada em '+sourceDate(data.snapshotAt)+'. Para atualizar esses anúncios, use a versão com servidor.':location.protocol==='file:' && data.sources.some(s=>s.name.startsWith('Gupy')&&s.state==='error')?' A Gupy precisa do aplicativo com servidor para atualizar; o HTML baixado não permite consulta direta.':''}`;
      if(!entries.length)q('#discovery-results').innerHTML=`<div class="empty-state discovery-empty"><div><h3>${successes?'Nenhuma oportunidade com estes critérios.':'A busca está indisponível agora.'}</h3><p>${successes?'Tente outra palavra ou veja as remotas com localização a confirmar. A ausência de resultados aqui não significa que não existam vagas.':'Não recebemos dados das fontes. Tente novamente quando a conexão estiver disponível.'}</p></div></div>`;
    }
  }
  async function getBrowserJSON(url,ttl) {
    if(new URL(url).hostname==='portal.gupy.io')throw new Error('GUPY_SERVER_REQUIRED');
    // Reuse successful responses independently, respecting Remotive's low request frequency.
    const key=DISCOVERY_CACHE_KEY+':source:'+url;let old;
    try {old=JSON.parse(localStorage.getItem(key)||'null');}catch{}
    if(old && Date.now()-old.time<ttl)return old.data;
    const response=await fetch(url,{signal:AbortSignal.timeout(20000),credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const value=await response.json();
    try{localStorage.setItem(key,JSON.stringify({time:Date.now(),data:value}));}catch{cacheProblem=true;}
    return value;
  }
  async function refresh(auto=false) {
    if(busy)return;
    const allOK=data?.sources.every(s=>s.state==='ok');
    if(auto && data && isDailyFresh(data.fetchedAt) && allOK){paint();return;}
    if(auto && !allOK && Date.now()-lastAttempt<60*60*1000)return;
    if(Date.now()-lastAttempt<60000){if(!auto)notify('Aguarde um minuto antes de tentar novamente.');return;}
    lastAttempt=Date.now();busy=true;q('#refresh-discovery').disabled=true;q('#refresh-discovery').textContent='Buscando…';q('#discover-panel').setAttribute('aria-busy','true');
    q('#discovery-status').classList.remove('has-error');q('#discovery-status').textContent='Consultando Gupy e Remotive. Isso pode levar alguns segundos…';
    try {
      loadFailed=false;
      if(location.protocol==='file:')data=withGupySnapshot(await collectDiscovery(getBrowserJSON),embedded);
      else {
        const response=await fetch(hostedDaily?'./data/vagas.json':'/api/discover',{signal:AbortSignal.timeout(30000),cache:'no-store'});
        if(!response.ok)throw new Error('Busca indisponível');
        const value=await response.json();
        if(value.version!==1 || !Array.isArray(value.jobs)||!Array.isArray(value.sources))throw new Error('Resposta inválida');
        data=value;
      }
      try{localStorage.setItem(DISCOVERY_CACHE_KEY,JSON.stringify(data));}catch{cacheProblem=true;}
    }catch{
      loadFailed=true;
      q('#discovery-status').classList.add('has-error');q('#discovery-status').textContent='Não foi possível atualizar a busca. Verifique sua conexão. '+(data?'Os resultados anteriores continuam abaixo; confira a data da consulta.':'Nenhuma vaga nova foi carregada.');
      if(!data)q('#discovery-results').innerHTML='<div class="empty-state discovery-empty"><p>A consulta às fontes não respondeu. Suas vagas salvas continuam disponíveis na aba Minhas vagas.</p></div>';
    }finally{busy=false;q('#refresh-discovery').disabled=false;q('#refresh-discovery').textContent='Atualizar busca';q('#discover-panel').removeAttribute('aria-busy');}
    if(data)paint();
  }
  function setTab(discovery,focus=false) {
    q('#discover-panel').hidden=!discovery;q('#saved-workspace').hidden=discovery;
    q('#discover-tab').setAttribute('aria-selected',String(discovery));q('#saved-tab').setAttribute('aria-selected',String(!discovery));
    q('#discover-tab').classList.toggle('selected',discovery);q('#saved-tab').classList.toggle('selected',!discovery);
    q('#discover-tab').tabIndex=discovery?0:-1;q('#saved-tab').tabIndex=discovery?-1:0;
    q('#discover-nav').classList.toggle('active',discovery);document.querySelector('a.nav-item').classList.toggle('active',!discovery);
    if(focus)q(discovery?'#discover-tab':'#saved-tab').focus();
    if(discovery){paint();refresh(true);}
  }
  q('#discover-tab').onclick=()=>setTab(true);q('#saved-tab').onclick=()=>setTab(false);q('#discover-nav').onclick=()=>setTab(true);
  document.querySelector('a.nav-item').addEventListener('click',()=>setTab(false));
  q('.workspace-tabs').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setTab(event.key==='End'||(event.key!=='Home' && q('#discover-tab').getAttribute('aria-selected')!=='true'),true);}});
  q('#refresh-discovery').onclick=()=>refresh();
  for(const id of ['discovery-search','discovery-mode','discovery-flexible','discovery-review'])q('#'+id).addEventListener(id==='discovery-search'?'input':'change',paint);
  q('#discovery-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-discovery-save]');if(!button)return;
    const job=(data?.jobs||[]).find(j=>j.id===button.dataset.discoverySave);if(!job||!validResult(job))return;
    if(isSavedResult(job,getJobs())){notify('Esta vaga já está na sua lista.');paint();return;}
    const save=()=>{if(saveJob(resultToJob(job))){paint();notify('Vaga salva. Acompanhe na aba Minhas vagas.');}};
    if(job.verdict==='review')confirmLocation(job,save);else save();
  });
  document.addEventListener('minhasvagas:changed',paint);
  const checkDaily=()=>{if(!q('#discover-panel').hidden && document.visibilityState==='visible')refresh(true);};
  setInterval(checkDaily,60000);
  window.addEventListener('focus',checkDaily);
  document.addEventListener('visibilitychange',checkDaily);
  if(location.hash==='#buscar')setTab(true);
  return {profile:PROFILE};
}
