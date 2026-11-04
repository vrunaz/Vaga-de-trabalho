# Minhas Vagas

Organizador pessoal em português com descoberta diária de oportunidades, sem login. Site: **https://vrunaz.github.io/Vaga-de-trabalho/**. As candidaturas pessoais ficam no navegador; somente anúncios públicos são publicados no site.

## Usar

- **Buscar vagas para mim** mostra oportunidades públicas por atualidade e compatibilidade, sem prioridade por plataforma. Use os filtros de área (incluindo inteligência artificial), fonte, modalidade, contratação e flexibilidade.
- **Salvar vaga** leva o anúncio para **Minhas vagas** com status **Salvei**, sem fazer candidatura. Fontes, links, requisitos e instruções de candidatura vão para as observações.
- No organizador, só empresa e cargo são obrigatórios. Edite os detalhes, mude status e registre entrevistas e currículo. Excluir exige confirmação.
- Fixos/CLT/efetivos, temporários, estágio, freelance, diárias, meio período, tempo integral, por tarefa e contratos/PJ são suportados. Jornada e regime não são confundidos: tempo integral não é convertido automaticamente em CLT.

## Perfil e localização

Atendimento, recepção, vendas, auxiliar/atendente de farmácia, administração, suporte e assistência virtual. Inclui atividades de IA compatíveis: treinamento e avaliação, anotação/rotulagem de dados, respostas de chatbots, avaliação de buscas e produção/revisão de conteúdo. Considera português e inglês; requisitos de idioma e experiência são trechos do anúncio, sem inventar fluência ou experiência.

- Presencial e híbrido: somente **Belém–PA**. Quando a modalidade não aparece, ela continua “não informada” e a localização ainda precisa ser Belém–PA. Localizações conflitantes são filtradas conservadoramente.
- Remoto não significa atuação mundial. Países/regiões explicitamente permitidos precisam incluir o Brasil. Vagas restritas a outro país são excluídas. Ambiguidades ficam marcadas **“Residência no Brasil: a confirmar”**, ocultas por padrão e exigem conferência antes de salvar.
- Anúncios de farmacêutico formado, engenharia/desenvolvimento de IA e cargos seniores não são recomendados automaticamente para este perfil. Essa triagem por palavras-chave não substitui a leitura dos requisitos.
- Cargo, empresa/anunciante, modalidade, localização, contratação, data, fontes/links, candidatura, idiomas e experiência aparecem nos resultados. Ausências são sinalizadas. Datas sem hora não ganham horário artificial; criação da vaga é identificada como criação.

## Fontes e transparência

A configuração está em `discovery-api.js` e `public-sources.js`. Cada atualização guarda URL da consulta, horário, status, limite e erro. O painel agrupa por plataforma: 12 consultas à Gupy continuam sendo **uma plataforma**. Só consultas com resposta e anúncios interpretáveis recebem estado **Consultada**; restrições, erros e integrações indisponíveis são distintos.

| Fonte | Consulta | Limite/condição |
|---|---|---|
| LinkedIn | Pesquisa pública de atendimento, farmácia, recepção, vendas, administração, suporte e remotas de IA/assistência | Primeira amostra por termo; sem login. Dados completos e candidatura podem exigir cadastro no anúncio. |
| InfoJobs | Página pública de Belém e página de home office | Amostra inicial de cartões; campos não expostos ficam sem informação. |
| Indeed | Buscas públicas por termos em Belém e remotas | Primeira amostra de cada busca; apenas JSON público da página, sem executar scripts. |
| Gupy | Termos em Belém/Pará e remotas | Até 50 por termo/escopo; sem prioridade na classificação. |
| Remotive | Feed público remoto | Atraso de 24h informado pela fonte; cache de 6h e atribuição com link original. |
| Welo Data / Welocalize | Oportunidades públicas diretamente no portal de carreira da empresa (Lever) | Inclui serviços de IA; respeita locais permitidos e requisitos publicados. |
| Jobicy e Himalayas | Feeds remotos públicos | Amostras; filtros geográficos aplicados no aplicativo, sem presumir que a API pesquisou todo o Brasil. |
| Instagram e Facebook — Empregos Belém | Perfis públicos identificados e busca pública de grupos | Nas verificações desta mudança, conteúdo insuficiente/restrito ou falha. Não são apresentados como fontes pesquisadas com sucesso. Grupos privados não são consultados. |
| OneForma e TELUS Digital | Páginas públicas cadastradas | Integrações ainda não interpretam os anúncios dessas páginas; aparecem como **Integração indisponível**, não como consultadas. |

Redes sociais não precisam ser uma recrutadora: um anúncio público estruturado ou um post com cargo/localização e contato verificável pode ser aceito. O parser aceita JobPosting e metadados de posts com contato explícito; isso **não significa** que os perfis ou grupos atuais estejam integralmente acessíveis. Não contornamos autenticação, CAPTCHA ou bloqueios. Fontes e cobertura são delimitadas, não uma busca em toda a internet.

Duplicatas por identificador/link são reunidas. Entre fontes, também comparamos empresa, cargo, local, data próxima e contratação compatível. Mantemos todos os links originais; formatos distintos conhecidos permanecem separados. A escolha do anúncio mais completo e a ordenação não usam prioridade de plataforma. Requisições têm concorrência limitada e cache, preservando proxy e TLS.

## Atualização diária e hospedagem

`.github/workflows/vagas-diarias.yml` publica pelo GitHub Actions/Pages às **11:00 UTC = 08:00 de Belém**. O GitHub pode atrasar ou suspender agendamentos por inatividade. O site mostra data da última consulta e atraso; não depende do notebook ligado. A página recebe `data/vagas.json` do próprio site, evitando o bloqueio CORS das plataformas.

O servidor local também atualiza diariamente às 08:00 de Belém enquanto estiver em execução. Cache público em `.cache/public-discovery.json` (ou `MINHAS_VAGAS_CACHE_DIR`) sobrevive ao reinício. Quando todas as fontes falham, a lista anterior permanece com aviso e data antiga. Restrições permanentes não são chamadas de consultas bem-sucedidas.

```sh
npm start                 # Node.js 24+ e curl, sem pacotes npm externos
npm run build:site        # Consulta real e geração em site/
```

Na máquina do servidor, abra a porta 3000. `PORT` permite outra porta. O servidor não recebe candidaturas pessoais. Deploy do site é feito pelo workflow `Minhas Vagas — atualização diária`; o proprietário já habilitou Pages com GitHub Actions. Nenhum segredo é necessário para as fontes públicas integradas.

## Backup e HTML único

Em **Backup e dados**, exporte o JSON regularmente. Para transferir registros ao outro aparelho/endereço, importe o backup e confirme a substituição da lista. Limpar dados do navegador ou usar janela anônima pode apagar registros. Não há sincronização entre aparelhos.

```sh
npm run build
```

Gera `dist/minhas-vagas.html`, com estilos e scripts incluídos. O organizador funciona offline; a descoberta de várias fontes não atualiza diretamente por esse arquivo. Use o site para a lista diária. É possível incluir uma cópia datada de anúncios públicos Gupy com `node scripts/build-single.mjs /workspace/exports/minhas-vagas.html --snapshot /caminho/consulta-publica.json`; a cópia é identificada como tal e deixa de ser usada após 7 dias. Não use backups pessoais como entrada desse gerador. Antes de mover, renomear ou substituir HTML local, exporte seus registros; associação de localStorage a arquivos depende do navegador.

## Validação

```sh
npm test
npm run test:browser
npm run test:bundle
npm run test:site         # após gerar site/
```

Testes cobrem critérios geográficos, fontes sem acesso, campos ausentes, formatos, IA, idioma/experiência, JSON sem execução de scripts, duplicatas, ordem neutra, candidatura verificável em post público, backup e passagem de um dia. Testes de navegador usam Chromium e perfil temporário, com respostas simuladas nos fluxos de descoberta. Consultas reais são verificadas separadamente; testes simulados não estabelecem que uma fonte funciona. `TEST_PORT` e `DEBUG_PORT` alteram portas de teste; `CHROMIUM` seleciona o executável. O site é testado também num subcaminho de projeto.

Arquivos principais: `model.js` (organizador), `discovery-model.js` (elegibilidade/classificação/deduplicação), `public-sources.js` (adapters públicos), `discovery-api.js` (consultas/status), `discovery-server.mjs` (rede/cache), `daily-discovery.js` (agendamento), `discovery-ui.js` (interface) e geradores em `scripts/`.
