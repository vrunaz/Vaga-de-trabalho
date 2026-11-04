# Minhas Vagas

Aplicativo web em português para organizar oportunidades de emprego, sem login. Começa vazio, mantém os dados no navegador com `localStorage` e não precisa instalar pacotes externos. O organizador funciona sem internet; a busca automática consulta serviços públicos e precisa de conexão.

## Abrir

Com **Node.js 24 ou superior**, execute na pasta do projeto:

```sh
cd /workspace/Meu-primeiro-projeto
npm start
```

No computador que executa o servidor, abra `http://localhost:3000`. No ambiente de desenvolvimento na nuvem, use o acesso à porta **3000** oferecido pela plataforma. O servidor escuta em `0.0.0.0`; em rede local, o celular pode acessar o endereço do computador na porta 3000 se a rede e o firewall permitirem. Para acesso por qualquer aparelho, veja a opção GitHub Pages abaixo; ela publica os arquivos do aplicativo e uma lista pública diária no mesmo endereço HTTPS. Esta implementação não publica o site automaticamente.

Para escolher outra porta: `PORT=3001 npm start`.

## Usar

- Clique em **Cadastrar vaga**. Só **empresa** e **cargo** são obrigatórios.
- Presencial e híbrida fixam a cidade em **Belém (PA)**, inclusive freelance. Para remotas, a cidade pode ser a da empresa; confira no anúncio se ela permite trabalhar de Belém antes de cadastrar.
- Use o seletor no cartão para mudar o status. **Editar** abre todos os campos, incluindo currículo, entrevista e observações. **Excluir** pede confirmação.
- Busque por empresa/cargo e combine filtros de modalidade, contratação e status. A busca ignora diferenças entre maiúsculas/minúsculas e acentos.
- O resumo conta todos os registros, candidaturas com data de envio ou status de candidatura (enviada, entrevista, aguardando, aprovada ou não selecionada) e registros com status “Entrevista marcada”. Não é necessário preencher uma data para mudar o status.
- O radar mostra prazos de hoje até os próximos 7 dias e entrevistas futuras, sem processos aprovados, não selecionados ou encerrados. Datas e horários usam **America/Belem (UTC−3)**, mesmo que o aparelho esteja em outro fuso. O horário digitado no campo de entrevista é o horário de Belém.

## Busca automática para seu perfil

A aba **Buscar vagas para mim** consulta Gupy e Remotive ao ser aberta. Ela procura farmácia, atendimento, recepção, vendas, apoio administrativo e ensino médio. Cargos de farmacêutico que pressupõem formação concluída e cargos seniores são excluídos das recomendações. As recomendações usam palavras-chave; confira requisitos, formação e idiomas no anúncio.

- Presenciais e híbridas entram somente com cidade **Belém** e estado **PA/Pará**. Ananindeua e Belém de outros estados não entram.
- Remotas precisam informar Brasil, atuação mundial ou região que inclua o Brasil. Localizações desconhecidas ficam ocultas por padrão, na opção **Incluir remotas com localização a confirmar**. Ao salvar uma dessas vagas, o aplicativo exige confirmar que a empresa permite trabalhar de Belém. Essa conferência depende da leitura do anúncio.
- Vagas com indicação de flexibilidade ou carga reduzida aparecem primeiro. As demais continuam visíveis; existe um filtro opcional para mostrar só flexíveis.
- **Salvar vaga** adiciona o anúncio ao organizador com status **Salvei** e preserva fonte, link e resumo nas observações. Anúncios já salvos são identificados pelo link, sem presumir que você se candidatou.
- Gupy: até 50 resultados por termo em Belém e mais 50 remotos, com cache de 1 hora por consulta bem-sucedida. Remotive: dados públicos com atraso de 24 horas e cache de 6 horas, seguindo [a documentação da fonte](https://github.com/remotive-com/remote-jobs-api). A origem é atribuída e o link original é preservado. Não é uma busca em todos os sites, nem uma garantia de que a vaga continue aberta.
- A página não faz candidaturas. A busca não acessa contas e **não recupera o histórico pessoal de candidaturas**. Isso exige definir as plataformas/e-mail usados e uma forma autorizada de consultar os registros.
- **Atualização diária às 08:00 de Belém.** Na versão com servidor, um agendador confere o horário a cada minuto e consulta as fontes mesmo sem a página aberta, desde que o processo permaneça ativo. Se o servidor estava desligado, atualiza ao iniciar. O cache público em `.cache/public-discovery.json` evita repetir a mesma consulta ao reiniciar. Se todas as fontes falharem, mantém a lista anterior com aviso e tenta novamente após uma hora. A página confere a atualização ao abrir a busca, ao voltar para ela e enquanto estiver visível. Um arquivo HTML local não recebe atualizações diárias da Gupy.

O servidor usa `curl` (com TLS e proxy do ambiente) para consultar destinos fixos: `remotive.com` e `portal.gupy.io`. Nenhum dado das vagas pessoais é enviado às fontes. Sem acesso de rede, mostra falha por fonte e mantém o organizador acessível. A integração Gupy usa a rota pública `https://portal.gupy.io/api/job-search/jobs`, atualmente usada pelo próprio portal. O endereço antigo `portal.api.gupy.io/api/v1/jobs` retorna 404. A resposta atual identifica a empresa em `careerPageName` e o total em `pagination.total`. As consultas separam cidade Belém/estado Pará de vagas remotas e ordenam por publicação. A consulta real de 04/11/2026 retornou 115 sugestões da Gupy após filtragem e deduplicação: 66 para exibição padrão e 49 remotas com localização a confirmar. Todas as 12 consultas Gupy responderam corretamente; o navegador também carregou as vagas reais e salvou uma vaga de farmácia no perfil de teste. Esses números podem mudar conforme os anúncios forem publicados ou encerrados.

## Hospedagem com atualização diária pelo GitHub Pages

Site publicado: **https://vrunaz.github.io/Vaga-de-trabalho/**. O proprietário habilitou GitHub Pages com origem GitHub Actions. A [publicação 41931845323](https://github.com/vrunaz/Vaga-de-trabalho/actions/runs/41931845323) foi concluída com sucesso em 04/11/2026. O HTML e `data/vagas.json` responderam HTTP 200, com 119 sugestões e nenhuma fonte em erro naquela consulta. O workflow está **active** com cron `0 11 * * *` (08:00 de Belém). O horário é agendado pelo GitHub e pode atrasar; a primeira execução diária futura ainda não aconteceu nesta verificação. O fluxo usa GitHub Actions para consultar as fontes uma vez por dia e publicar um site estático: o navegador recebe `data/vagas.json` do próprio site, portanto não precisa consultar a Gupy diretamente e não enfrenta o bloqueio CORS dela. Os dados pessoais continuam somente no navegador e não são enviados ao GitHub.

Para ativar, com autorização do proprietário:

1. O projeto e o workflow já estão enviados à branch `main`. A publicação foi autorizada pelo proprietário nesta conversa.
2. No repositório, abra **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Em **Actions → Minhas Vagas — atualização diária → Run workflow**, execute a primeira publicação.
4. Abra o endereço fornecido pelo deploy do GitHub Pages. O horário agendado é `0 11 * * *` (11:00 UTC = 08:00 de Belém). O GitHub pode atrasar execuções e, em repositórios públicos sem atividade, pode desativar agendamentos após 60 dias. Confira a data da última consulta; o aplicativo avisa quando a atualização esperada não está disponível.

GitHub Pages costuma ser gratuito para repositórios públicos; a disponibilidade para privados depende do plano da conta. O site e os anúncios publicados são públicos. Seus registros de candidatura não são incluídos no site. Importar um backup permite levar sua lista do HTML antigo ao endereço novo.

Se nenhuma fonte responder, a geração falha e a versão anteriormente publicada permanece disponível; a data antiga não é trocada por uma consulta fictícia. Se apenas algumas fontes falharem, o site mostra a consulta parcial. O primeiro deploy foi concluído e o site foi verificado por HTTP. O workflow diário está ativo; monitore a data da consulta mostrada no aplicativo e o histórico em Actions para confirmar cada execução agendada.

Para validar localmente a geração sem publicar:

```sh
npm run build:site
npm run test:site
```

`build:site` faz uma consulta real e grava os arquivos em `site/`. Para validar uma resposta pública já obtida sem consultar novamente as fontes, use `node scripts/build-static.mjs --input /caminho/consulta-publica.json`. Nunca use um backup de candidaturas pessoais como entrada. O teste do site usa perfil isolado, respostas simuladas para as interações e um caminho `/minhas-vagas/` para verificar compatibilidade com páginas de projeto.

## HTML único para usar no notebook

```sh
npm run build
```

O arquivo `dist/minhas-vagas.html` contém a interface e todos os scripts e estilos. Abra no navegador sem precisar iniciar servidor. O organizador continua funcionando sem internet. A Gupy não permite consulta direta de outro endereço pelo navegador (não retorna permissão CORS), então sua atualização automática exige a versão com servidor (`npm start`). Sem essa permissão, o HTML não tenta contornar a restrição. As outras fontes também dependem de conexão e permissão de consulta. Uma falha é informada sem preencher a lista com resultados fictícios. A política deste ambiente bloqueia endereços `file://`, por isso o HTML foi validado por um servidor local isolado.

É possível incluir no HTML uma cópia datada de resultados públicos reais da Gupy, sem inserir vagas na lista pessoal. Ela aparece como **cópia**, com a data em horário de Belém, não como uma consulta nova, e deixa de ser usada após 7 dias. Para gerá-la, obtenha primeiro uma resposta real da integração e passe o arquivo JSON da resposta de `/api/discover` ao gerador:

```sh
node scripts/build-single.mjs /workspace/exports/minhas-vagas.html --snapshot /caminho/consulta-publica.json
```

A cópia fornecida nesta tarefa contém os resultados públicos consultados em 04/11/2026. Use **Salvar vaga** nos anúncios que deseja acompanhar. Esse arquivo não contém suas candidaturas ou dados pessoais.

Mantenha o mesmo arquivo na mesma pasta e navegador para reencontrar os dados. O comportamento de armazenamento de arquivos locais varia entre navegadores: exporte backups antes de mover, renomear ou atualizar o HTML.

## Backup e outro aparelho

Em **Backup e dados → Exportar backup**, baixe o JSON e guarde-o em um local seguro. Ele contém todos os campos, incluindo observações e contatos. Transfira esse arquivo para o outro aparelho, abra o aplicativo e use **Backup e dados → Importar backup**. Confira a quantidade e confirme a substituição da lista. A importação **substitui**, não mescla: exporte antes qualquer lista que deseje preservar. Arquivos inválidos são rejeitados sem apagar as vagas atuais.

As vagas ficam somente no navegador, vinculadas ao endereço, porta e perfil usado. Fechar a página não apaga os registros. Limpar dados do site, usar janela anônima ou mudar de endereço/aparelho não preserva a lista automaticamente. Não há sincronização, login ou cópia no servidor. Faça backups regularmente. O aplicativo informa quando o armazenamento não permite salvar.

## Verificação

```sh
npm test
npm run test:browser
npm run test:bundle
```

Os 24 testes de unidade cobrem localização, perfil, graduação em andamento, filtros, status/resumo, fuso de Belém, backup, deduplicação e falhas das fontes. A verificação de navegador requer Chromium instalado (ou `CHROMIUM=/caminho/do/chromium`) e usa perfil temporário isolado, servidor na porta 3100 e depuração na porta 9223. As portas podem ser alteradas com `TEST_PORT` e `DEBUG_PORT`.

Ela verifica cadastro mínimo, edição, persistência após recarregar, todas as opções de status, filtros, exclusão com confirmação/cancelamento, download e importação reais de backup, rejeição de arquivo inválido e layout em 320, 390, 768 e 1440 pixels. As capturas para inspeção ficam em `/tmp/minhas-vagas-desktop.png` e `/tmp/minhas-vagas-mobile.png`. Os fluxos de busca usam respostas simuladas interceptadas somente no teste, incluindo resultados parciais, confirmação geográfica e falha total. Nenhum dado de demonstração é inserido no navegador do usuário. `test:bundle` repete a verificação com o HTML único.

## Estrutura

- `index.html`, `styles.css`: interface responsiva e diálogos acessíveis.
- `app.js`: interação, persistência local, importação e exportação.
- `model.js`: validação, filtros, resumo e agenda.
- `server.mjs`: servidor estático sem dependências externas; não recebe os registros.

- `discovery-model.js`: compatibilidade do perfil, localização e deduplicação.
- `discovery-api.js`, `discovery-server.mjs`: consulta das fontes públicas e cache.
- `discovery-ui.js`: busca, filtros e transferência de resultados para o organizador.
- `scripts/build-single.mjs`: geração reproduzível do HTML único.

- `daily-discovery.js`: regra de atualização diária, recuperação e cache entre reinícios.
- `scripts/build-static.mjs`: site com anúncios públicos no mesmo domínio.
- `.github/workflows/vagas-diarias.yml`: rotina diária enviada e ativa; publicação bloqueada até habilitar Pages.
