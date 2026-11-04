import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDailyDiscovery } from './daily-discovery.js';
import { collectDiscovery, SOURCES } from './discovery-api.js';
const exec=promisify(execFile),cache=new Map(),pending=new Map(),failures=new Map();
// Fixed destinations only. curl preserves the environment's proxy and TLS trust.
export async function sourceJSON(url,ttl) {
  if(!SOURCES.some(s=>s.url===url))throw new Error('Fonte desconhecida.');
  if(Date.now()-(failures.get(url)||0)<30000)throw new Error('A fonte falhou recentemente.');
  const old=cache.get(url);if(old && Date.now()-old.time<ttl)return old.data;
  if(pending.has(url))return pending.get(url);
  const task=(async()=>{
    try {
      const {stdout}=await exec('curl',['--fail','--silent','--show-error','--max-time','18','--max-filesize','15000000','--proto','=https',url],{maxBuffer:16*1024*1024,timeout:20000});
      const data=JSON.parse(stdout);cache.set(url,{time:Date.now(),data});return data;
    } catch(error){failures.set(url,Date.now());const http=String(error.stderr||'').match(/(?:error:|returned error:)\s*(\d{3})/);if(http)throw new Error('HTTP '+http[1]);throw error;} finally {pending.delete(url);}
  })();pending.set(url,task);return task;
}
const cacheDirectory=process.env.MINHAS_VAGAS_CACHE_DIR?pathToFileURL(resolve(process.env.MINHAS_VAGAS_CACHE_DIR)+'/'):new URL('./.cache/',import.meta.url);
const cacheFile=new URL('public-discovery.json',cacheDirectory);
const daily=createDailyDiscovery({
  collect:()=>collectDiscovery(sourceJSON),
  readCache:async()=>{try{return JSON.parse(await readFile(cacheFile,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},
  writeCache:async state=>{
    await mkdir(cacheDirectory,{recursive:true});
    const temporary=new URL('public-discovery.'+process.pid+'.tmp',cacheDirectory);
    await writeFile(temporary,JSON.stringify(state));await rename(temporary,cacheFile);
  }
});
export const discover=()=>daily.ensure();
export const startDailyUpdates=()=>daily.start();
