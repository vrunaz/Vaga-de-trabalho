import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname,resolve } from 'node:path';
const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
let html=await read('index.html');
const css=await read('styles.css');
let javascript='';
for(const file of ['model.js','daily-discovery.js','discovery-model.js','public-sources.js','discovery-api.js','discovery-ui.js','app.js']){
  const source=(await read(file)).replace(/^import .*?;\n/gm,'').replace(/^export /gm,'');
  javascript+='\n'+source;
}
html=html.replace('<link rel="stylesheet" href="/styles.css"><script type="module" src="/app.js"></script>',()=>'<style>\n'+css+'\n</style>');
html=html.replace('class="brand" href="/"','class="brand" href="#oportunidades"');
html=html.replace('somente neste navegador e neste endereço','somente neste navegador e neste arquivo');
html=html.replace('Elas permanecem ao fechar a página, mas podem ser perdidas','Abra sempre este mesmo arquivo, na mesma pasta e no mesmo navegador. Exporte um backup antes de mover ou renomear o arquivo. Elas permanecem ao fechar a página, mas podem ser perdidas');
html=html.replace('Transfira o arquivo para o novo aparelho. Abra o Minhas Vagas lá,','Transfira o backup JSON e este HTML para o novo aparelho. Abra o HTML do Minhas Vagas lá,');
let snapshotScript='';
const snapshotFlag=process.argv.indexOf('--snapshot');
if(snapshotFlag!==-1){
  const snapshot=JSON.parse(await readFile(resolve(process.argv[snapshotFlag+1]),'utf8'));
  if(snapshot.version!==1||!Array.isArray(snapshot.jobs)||!Array.isArray(snapshot.sources))throw new Error('Cópia de vagas públicas inválida.');
  const publicData={version:1,fetchedAt:snapshot.fetchedAt,sources:snapshot.sources.filter(s=>s.name.startsWith('Gupy')),jobs:snapshot.jobs.filter(j=>j.source==='Gupy')};
  snapshotScript='globalThis.MINHAS_VAGAS_GUPY_SNAPSHOT='+JSON.stringify(publicData).replace(/</g,'\\u003c')+';\n';
}
html=html.replace('</body>',()=>'<script>\n"use strict";\n'+snapshotScript+'(()=>{\n'+javascript.replace(/<\/script/gi,'<\\/script')+'\n})();\n</script>\n</body>');
const output=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('dist/minhas-vagas.html',root));
await mkdir(dirname(output),{recursive:true});await writeFile(output,html);console.log('HTML único gerado: '+output);
