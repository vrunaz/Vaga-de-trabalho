import http from 'node:http';
import { discover, startDailyUpdates } from './discovery-server.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const files = { '/public-sources.js':['public-sources.js','text/javascript'], '/daily-discovery.js':['daily-discovery.js','text/javascript'], '/discovery-model.js':['discovery-model.js','text/javascript'], '/discovery-api.js':['discovery-api.js','text/javascript'], '/discovery-ui.js':['discovery-ui.js','text/javascript'], '/': ['index.html','text/html'], '/index.html': ['index.html','text/html'], '/styles.css': ['styles.css','text/css'], '/app.js': ['app.js','text/javascript'], '/model.js': ['model.js','text/javascript'] };
const server = http.createServer(async (req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/discover') {
    if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end();return;}
    try { const data=await discover();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data)); }
    catch {res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Não foi possível consultar as fontes agora.'}));}
    return;
  }
  const file = files[pathname];
  if (!file) { res.writeHead(404); res.end('Não encontrado'); return; }
  try { const data = await readFile(fileURLToPath(new URL(file[0],root))); res.writeHead(200,{'Content-Type':`${file[1]}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}); res.end(data); }
  catch { res.writeHead(500); res.end('Não foi possível abrir o aplicativo.'); }
});
let stopDaily;
server.on('close',()=>stopDaily?.());
server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>{console.log(`Minhas Vagas disponível na porta ${server.address().port} · atualização diária às 08:00 de Belém`);stopDaily=startDailyUpdates();});
