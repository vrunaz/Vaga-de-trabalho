export const STORAGE_KEY = 'minhas-vagas:v1';
export const STATUSES = ['Salvei', 'Currículo enviado', 'Entrevista marcada', 'Aguardando retorno', 'Aprovada', 'Não selecionada', 'Vaga encerrada'];
export const MODES = ['Presencial', 'Híbrida', 'Remota'];
export const TYPES = ['CLT', 'Temporário', 'Estágio', 'Freelance'];
export const FIELDS = ['company','role','city','mode','type','salary','hours','url','contact','deadline','status','sentDate','resume','interview','notes'];
export function normalizeJob(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Registro de vaga inválido.');
  const job = Object.fromEntries(FIELDS.map(key => [key, typeof input[key] === 'string' ? input[key].trim() : '']));
  if (!job.company || !job.role) throw new Error('Preencha a empresa e o cargo.');
  if (FIELDS.some(key => job[key].length > (key === 'notes' ? 10000 : 2000))) throw new Error('Um dos campos excede o tamanho permitido.');
  if (job.mode && !MODES.includes(job.mode)) throw new Error('Modalidade inválida.');
  if (job.type && !TYPES.includes(job.type)) throw new Error('Tipo de contratação inválido.');
  job.status ||= 'Salvei';
  if (!STATUSES.includes(job.status)) throw new Error('Status inválido.');
  if (['Presencial','Híbrida'].includes(job.mode)) job.city = 'Belém (PA)';
  if (job.url) {
    let url;
    try { url = new URL(job.url); } catch { throw new Error('Informe um link completo, começando com https:// ou http://.'); }
    if (!['https:','http:'].includes(url.protocol)) throw new Error('Use um link http:// ou https://.');
  }
  for (const key of ['deadline','sentDate']) {
    if (job[key] && !validDate(job[key])) throw new Error('Informe uma data válida.');
  }
  if (job.interview && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(job.interview) || !validDate(job.interview.slice(0,10)) || Number(job.interview.slice(11,13)) > 23 || Number(job.interview.slice(14,16)) > 59)) throw new Error('Informe uma data e um horário válidos para a entrevista.');
  return { ...job, id: typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID() };
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
}
export function fold(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
export function filterJobs(jobs, {search='',mode='',type='',status=''} = {}) {
  const query = fold(search.trim());
  return jobs.filter(j => (!query || fold(`${j.company} ${j.role}`).includes(query)) && (!mode || j.mode === mode) && (!type || j.type === type) && (!status || j.status === status));
}
export function summary(jobs) {
  return { saved: jobs.length, sent: jobs.filter(j=>j.sentDate || ['Currículo enviado','Entrevista marcada','Aguardando retorno','Aprovada','Não selecionada'].includes(j.status)).length, interviews: jobs.filter(j=>j.status === 'Entrevista marcada').length };
}
export function belemToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function upcoming(jobs, now = new Date()) {
  const today = belemToday(now);
  const end = new Date(today+'T12:00:00Z'); end.setUTCDate(end.getUTCDate()+7);
  const limit = end.toISOString().slice(0,10);
  const active = jobs.filter(j=>!['Aprovada','Não selecionada','Vaga encerrada'].includes(j.status));
  return {
    deadlines: active.filter(j=>j.deadline && j.deadline >= today && j.deadline <= limit).sort((a,b)=>a.deadline.localeCompare(b.deadline)),
    interviews: active.filter(j=>j.interview && new Date(j.interview+':00-03:00') >= now).sort((a,b)=>a.interview.localeCompare(b.interview))
  };
}
export function makeBackup(jobs) { return { app:'Minhas Vagas', version:1, exportedAt:new Date().toISOString(), jobs }; }
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Este arquivo não é um JSON válido.'); }
  if (!data || data.app !== 'Minhas Vagas' || data.version !== 1 || !Array.isArray(data.jobs)) throw new Error('Selecione um backup válido do Minhas Vagas (versão 1).');
  if (data.jobs.length > 10000) throw new Error('O backup excede o limite de 10.000 vagas.');
  const jobs = data.jobs.map(normalizeJob);
  if (new Set(jobs.map(j=>j.id)).size !== jobs.length) throw new Error('O backup contém identificadores duplicados.');
  return jobs;
}
