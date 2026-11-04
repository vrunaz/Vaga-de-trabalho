import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJob,filterJobs,summary,upcoming,belemToday,makeBackup,parseBackup,STATUSES } from '../model.js';
const job = (overrides={}) => normalizeJob({company:'Empresa Pará',role:'Assistente',...overrides});
test('Somente empresa e cargo obrigatórios, status inicial Salvei',()=>{
  const j=job(); assert.equal(j.status,'Salvei'); assert.equal(j.mode,''); assert.ok(j.id);
  assert.throws(()=>job({company:' '}),/empresa/); assert.throws(()=>job({role:''}),/cargo/);
});
test('Presencial e híbrido fixam Belém para todas as contratações, inclusive freelance',()=>{
  for(const mode of ['Presencial','Híbrida']) for(const type of ['CLT','Temporário','Estágio','Freelance','']) assert.equal(job({mode,type,city:'São Paulo'}).city,'Belém (PA)');
  assert.equal(job({mode:'Remota',city:'São Paulo'}).city,'São Paulo');
});
test('Pesquisa ignora acentos e caixa; filtros combinam modalidade, contratação e status',()=>{
  const jobs=[job({mode:'Remota',type:'CLT',status:'Entrevista marcada'}),job({role:'Design',company:'Outra',type:'Freelance'})];
  assert.equal(filterJobs(jobs,{search:'PARA',mode:'Remota',type:'CLT',status:'Entrevista marcada'}).length,1);
  assert.equal(filterJobs(jobs,{search:'DESIGN'}).length,1);
  assert.equal(filterJobs(jobs,{search:'Assistente',type:'Freelance'}).length,0);
});
test('Todos os status são aceitos e resumo reflete a evolução da candidatura',()=>{
  const jobs=STATUSES.map(status=>job({status}));
  assert.deepEqual(summary(jobs),{saved:7,sent:5,interviews:1});
  assert.equal(summary([job({status:'Vaga encerrada',sentDate:'2026-11-01'})]).sent,1);
});
test('Agenda respeita Belém independentemente do fuso do aparelho e ignora processos finalizados',()=>{
  const now=new Date('2026-11-05T01:30:00Z'); assert.equal(belemToday(now),'2026-11-04');
  const jobs=[job({deadline:'2026-11-04'}),job({deadline:'2026-11-11'}),job({deadline:'2026-11-12'}),job({deadline:'2026-11-03'}),job({interview:'2026-11-04T23:00'}),job({interview:'2026-11-04T22:00'}),job({interview:'2026-11-05T10:00',status:'Não selecionada'})];
  const result=upcoming(jobs,now); assert.equal(result.deadlines.length,2); assert.equal(result.interviews.length,1); assert.equal(result.interviews[0].interview,'2026-11-04T23:00');
});
test('Backup exporta e restaura todos os detalhes sem perda',()=>{
  const j=job({mode:'Híbrida',type:'Freelance',salary:'R$ 3.000',hours:'20 horas',url:'https://example.com/vaga',contact:'pessoa@exemplo.com',deadline:'2026-11-30',status:'Entrevista marcada',sentDate:'2026-11-04',resume:'v2',interview:'2026-11-06T10:30',notes:'Primeira linha\nSegunda linha'});
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup([j]))),[j]);
});
test('Backup rejeita dados inválidos e links executáveis',()=>{
  for(const text of ['oops','{}','null','{"app":"Minhas Vagas","version":9,"jobs":[]}']) assert.throws(()=>parseBackup(text));
  assert.throws(()=>job({url:'javascript:alert(1)'}),/http/);
  assert.throws(()=>job({deadline:'2026-02-30'}),/data/);
  assert.throws(()=>job({interview:'2026-11-01T28:00'}),/horário/);
  const j=job(); assert.throws(()=>parseBackup(JSON.stringify(makeBackup([j,j]))),/duplicados/);
});
