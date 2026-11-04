import { initDiscovery } from './discovery-ui.js';
import { STORAGE_KEY, STATUSES, MODES, TYPES, FIELDS, normalizeJob, filterJobs, summary, upcoming, belemToday, makeBackup, parseBackup } from './model.js';
const $ = (s, root=document) => root.querySelector(s);
let jobs = [], editingId = null, toastTimer, confirmAction, storageBlocked = false;
function warnStorage(message) { $('#storage-warning').textContent = message; $('#storage-warning').hidden = false; }
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) jobs = parseBackup(raw);
} catch {
  storageBlocked = true;
  warnStorage('Não foi possível ler os dados salvos. Os dados existentes foram preservados. Exporte uma cópia dos dados do navegador antes de restaurar um backup, ou tente abrir no navegador original.');
}
function persist(next) {
  if (storageBlocked) { notify('O armazenamento está indisponível. Seus dados existentes não foram alterados.'); return false; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(makeBackup(next))); jobs = next; return true; }
  catch { warnStorage('Não foi possível salvar: armazenamento cheio ou bloqueado. Exporte um backup e verifique as permissões do navegador.'); return false; }
}
function notify(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4500); }
function fillSelect(select, values) { values.forEach(value=>select.add(new Option(value,value))); }
fillSelect($('#filter-mode'),MODES); fillSelect($('#filter-type'),TYPES); fillSelect($('#filter-status'),STATUSES);
const form = $('#job-form');
fillSelect(form.elements.mode,MODES); fillSelect(form.elements.type,TYPES); fillSelect(form.elements.status,STATUSES);
function escapeHTML(text) { return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDate(value) { if (!value) return ''; return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Belem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value+'T12:00:00-03:00')); }
function formatInterview(value) { return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Belem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value+':00-03:00')); }
function setMode() {
  const local = ['Presencial','Híbrida'].includes(form.elements.mode.value);
  form.elements.city.readOnly = local;
  if (local) form.elements.city.value='Belém (PA)';
  $('#city-hint').textContent = local ? 'Localização fixa para vagas que exigem deslocamento.' : form.elements.mode.value === 'Remota' ? 'A empresa pode estar em outra cidade; o trabalho deve permitir atuação de Belém.' : 'Informe a localização, se souber.';
  $('#location-notice').textContent = form.elements.mode.value === 'Remota' ? 'Cadastre como remota apenas se a empresa permitir trabalhar de Belém (PA). Confira essa condição no anúncio ou com o contato da vaga. Isso também vale para freelance.' : 'Presencial e híbrido: somente Belém (PA), inclusive para freelance. Para vagas remotas, confira se a empresa permite trabalhar de Belém.';
}
form.elements.mode.addEventListener('change',setMode);
function openJob(id=null) {
  editingId=id; form.reset(); $('#form-error').hidden=true;
  const job = jobs.find(j=>j.id===id);
  if (job) for (const key of FIELDS) form.elements[key].value = job[key] || '';
  $('#job-dialog-title').textContent=job?'Editar oportunidade':'Cadastrar oportunidade';
  setMode(); $('#job-dialog').showModal(); form.elements.company.focus();
}
function confirm(title,message,label,action) {
  $('#confirm-title').textContent=title; $('#confirm-message').textContent=message; $('#confirm-ok').textContent=label;
  confirmAction=action; $('#confirm-dialog').showModal(); $('#confirm-cancel').focus();
}
$('#confirm-cancel').onclick=()=>$('#confirm-dialog').close();
$('#confirm-ok').onclick=()=>{ $('#confirm-dialog').close(); const action=confirmAction; confirmAction=null; action?.(); };
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click',()=>button.closest('dialog').close());
$('#add-job').onclick=()=>openJob();
$('#help-button').onclick=()=>$('#help-dialog').showModal();
function openBackup() { $('#backup-error').hidden=true; $('#backup-dialog').showModal(); }
$('#backup-button').onclick=openBackup; $('#backup-nav').onclick=openBackup;
form.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const job = normalizeJob({...Object.fromEntries(new FormData(form)),id:editingId || crypto.randomUUID()});
    const next = editingId ? jobs.map(j=>j.id===editingId?job:j) : [job,...jobs];
    if (persist(next)) { $('#job-dialog').close(); render(); notify(editingId?'Vaga atualizada.':'Nova oportunidade salva. Boa sorte!'); }
    else { $('#form-error').textContent='Não foi possível salvar a vaga no navegador. Verifique o aviso de armazenamento.'; $('#form-error').hidden=false; }
  } catch(error) { $('#form-error').textContent=error.message; $('#form-error').hidden=false; }
});
const emptyIllustration = '<div class="empty-illustration" aria-hidden="true"><div class="illustration-orbit"></div><span class="spark">✧</span><div class="illustration-paper"><i></i><i></i><i></i></div><span class="illustration-plus">+</span></div>';
function card(job) {
  const e=escapeHTML;
  const tags=[job.mode,job.type,job.city].filter(Boolean).map(t=>`<span class="tag">${e(t)}</span>`).join('');
  const detailPairs=[['Contato',job.contact],['Currículo enviado',job.sentDate?formatDate(job.sentDate):''],['Versão do currículo',job.resume],['Entrevista',job.interview?formatInterview(job.interview)+' · Belém':''],['Observações',job.notes]];
  const details=detailPairs.filter(([,v])=>v).map(([k,v])=>`<dt>${k}</dt><dd>${e(v)}</dd>`).join('');
  return `<article class="job-card" data-id="${e(job.id)}"><div class="job-top"><div class="company-avatar" aria-hidden="true">${e(job.company.charAt(0).toUpperCase())}</div><div class="job-title"><h3>${e(job.role)}</h3><p>${e(job.company)}</p></div><div class="job-actions"><button class="small-button" data-action="edit" aria-label="Editar ${e(job.role)} em ${e(job.company)}">Editar</button><button class="small-button delete" data-action="delete" aria-label="Excluir ${e(job.role)} em ${e(job.company)}">Excluir</button></div></div>${tags?`<div class="job-tags">${tags}</div>`:''}<div class="job-facts">${job.salary?`<span>${e(job.salary)}</span>`:''}${job.hours?`<span>${e(job.hours)}</span>`:''}${job.deadline?`<span>Prazo: ${formatDate(job.deadline)}</span>`:''}</div>${details?`<details class="job-details"><summary>Ver detalhes e observações</summary><dl>${details}</dl></details>`:''}<div class="job-bottom"><select class="status-select" aria-label="Status de ${e(job.role)} em ${e(job.company)}">${STATUSES.map(s=>`<option${s===job.status?' selected':''}>${s}</option>`).join('')}</select>${job.url?`<a class="job-link" href="${e(job.url)}" target="_blank" rel="noopener noreferrer">Ver anúncio ↗</a>`:''}</div></article>`;
}
function renderAgenda() {
  const events=upcoming(jobs);
  const list=[...events.interviews.map(j=>({job:j,kind:'interview',label:'Entrevista',date:formatInterview(j.interview)})),...events.deadlines.map(j=>({job:j,kind:'deadline',label:j.deadline===belemToday()?'Prazo hoje':'Prazo próximo',date:formatDate(j.deadline)}))];
  $('#agenda-content').innerHTML = list.length ? `<div class="agenda-list">${list.map(({job,kind,label,date})=>`<button class="agenda-event" data-id="${escapeHTML(job.id)}"><span class="event-label ${kind}">${label} · ${date}</span><strong>${escapeHTML(job.role)}</strong><small>${escapeHTML(job.company)}</small></button>`).join('')}</div>` : '<p class="agenda-empty">Tudo tranquilo por aqui. Seus próximos prazos e entrevistas aparecerão neste espaço.</p>';
}
function render() {
  const counts=summary(jobs);
  $('#stat-saved').textContent=counts.saved; $('#stat-sent').textContent=counts.sent; $('#stat-interviews').textContent=counts.interviews;
  $('#nav-count').textContent=jobs.length; $('#list-count').textContent=jobs.length;
  const filters={search:$('#search').value,mode:$('#filter-mode').value,type:$('#filter-type').value,status:$('#filter-status').value};
  const filtered=filterJobs(jobs,filters), active=Object.values(filters).some(Boolean);
  $('#results-meta').hidden=!active;
  $('#result-text').textContent=`${filtered.length} de ${jobs.length} oportunidade${jobs.length===1?'':'s'}`;
  if (!jobs.length) $('#jobs-list').innerHTML=`<div class="empty-state"><div class="empty-inner">${emptyIllustration}<h3>Seu próximo passo está por vir.</h3><p>Encontrou uma oportunidade interessante?<br>Salve aqui e acompanhe tudo em um só lugar.</p><button class="button primary" id="first-job"><span aria-hidden="true">＋</span> Cadastrar minha primeira vaga</button><small class="empty-footnote">Cada oportunidade é um novo começo.</small></div></div>`;
  else if (!filtered.length) $('#jobs-list').innerHTML='<div class="empty-state"><div class="empty-inner"><h3>Nenhuma vaga por aqui.</h3><p>Tente outro termo ou limpe os filtros para ver suas oportunidades.</p><button class="button secondary" id="empty-clear">Limpar filtros</button></div></div>';
  else $('#jobs-list').innerHTML=filtered.map(card).join('');
  $('#first-job')?.addEventListener('click',()=>openJob()); $('#empty-clear')?.addEventListener('click',clearFilters);
  renderAgenda();
  document.dispatchEvent(new Event('minhasvagas:changed'));
}
function clearFilters() { for (const id of ['search','filter-mode','filter-type','filter-status']) $('#'+id).value=''; render(); }
$('#clear-filters').onclick=clearFilters;
$('#search').addEventListener('input',render);
for (const id of ['filter-mode','filter-type','filter-status']) $('#'+id).addEventListener('change',render);
$('#jobs-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-action]'); if (!button) return;
  const job=jobs.find(j=>j.id===button.closest('.job-card').dataset.id); if (!job) return;
  if(button.dataset.action==='edit') openJob(job.id);
  else confirm('Excluir oportunidade?',`Você vai excluir “${job.role}” em ${job.company}. Esta ação não pode ser desfeita.`, 'Excluir vaga',()=>{if(persist(jobs.filter(j=>j.id!==job.id))){render();notify('Vaga excluída.');}});
});
$('#jobs-list').addEventListener('change',event=>{
  if (!event.target.matches('.status-select')) return;
  const id=event.target.closest('.job-card').dataset.id;
  if(persist(jobs.map(j=>j.id===id?{...j,status:event.target.value}:j))) notify('Status atualizado.');
  render();
});
$('#agenda-content').addEventListener('click',event=>{ const eventButton=event.target.closest('[data-id]'); if(eventButton) openJob(eventButton.dataset.id); });
$('#export-button').onclick=()=>{
  const blob=new Blob([JSON.stringify(makeBackup(jobs),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url; a.download=`minhas-vagas-${belemToday()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); notify('Backup exportado. Guarde o arquivo em um local seguro.');
};
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0]; if(!file) return;
  $('#backup-error').hidden=true;
  try {
    if(file.size>10*1024*1024) throw new Error('Escolha um backup de até 10 MB.');
    const imported=parseBackup(await file.text());
    confirm('Restaurar backup?',`O arquivo contém ${imported.length} vaga(s). A importação substituirá suas ${jobs.length} vaga(s) atuais. Exporte um backup da lista atual antes de continuar, se quiser preservá-la.`, 'Substituir e importar',()=>{
      if (persist(imported)) { render(); $('#backup-dialog').close(); notify(`${imported.length} vaga(s) importada(s) com sucesso.`); }
      else { $('#backup-error').textContent='Não foi possível gravar o backup no navegador. Os registros atuais foram preservados.'; $('#backup-error').hidden=false; }
    });
  } catch(error) { $('#backup-error').textContent=error.message; $('#backup-error').hidden=false; }
  finally { event.target.value=''; }
});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY && event.key!==null) return;
  try { jobs=event.newValue?parseBackup(event.newValue):[]; render(); notify('Lista atualizada em outra aba.'); }
  catch { warnStorage('Outra aba gravou dados inválidos. Recarregue após verificar o armazenamento.'); }
});
render();
setInterval(renderAgenda,60000);

initDiscovery({
  getJobs:()=>jobs,
  saveJob:input=>{try{const job=normalizeJob(input);if(!persist([job,...jobs]))return false;render();return true;}catch(error){notify(error.message);return false;}},
  notify,escapeHTML,
  confirmLocation:(job,save)=>confirm('Esta vaga permite trabalhar de Belém?',`O anúncio de “${job.role}” não informa claramente essa condição. Abra o anúncio e confira. Confirme apenas se a empresa permite atuar de Belém (PA).`, 'Conferi: permite Belém',save)
});
