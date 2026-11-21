# Allike — museu pessoal de gostos

Aplicativo full-stack em português: perfil, filmes/reviews, música, jogos, conquistas, mural, busca de perfis e personalização. Esta atualização inclui o perfil demonstrativo Alli, feed cronológico e relações de seguir. Recomendações por likes/dislikes continuam fora do escopo.

## Hospedagem independente

O Allike já tem configuração separada para Cloudflare Workers + D1 na sua própria conta, com migrações versionadas. Veja [o guia de publicação no GitHub e Cloudflare](PUBLICAR-GITHUB-CLOUDFLARE.md). Use `npm run db:migrate:local` e `npm run dev:independent` para testar em banco separado na porta 5174. O modo independente aceita somente autenticação própria e remove cabeçalhos de identidade externos.

## Executar no ambiente Sites original

Requer Node.js 22.13+ e npm. Na pasta do projeto:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_square_loa.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wakeful_jazinda.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_giant_zaladane.sql
npm run dev
```

Acesse o endereço exibido pelo servidor (normalmente http://127.0.0.1:5173). Entre pelo botão da página. O login local do starter utiliza uma identidade de desenvolvimento e NÃO é incluído na publicação. A migração deve ser aplicada apenas uma vez por banco local. O comando de desenvolvimento também pode ser executado sem npm: `node scripts/run-framework.mjs dev --hostname 127.0.0.1`.

Em Windows com falha `uv_os_get_passwd` ao gerar novas migrações, a limitação vem da consulta ao usuário do sistema feita pelo Drizzle/tsx em ambiente restrito. As migrações SQL já geradas estão incluídas.

## Serviços externos

Copie os NOMES de `.env.example` para `.dev.vars` no desenvolvimento e preencha localmente. Não envie segredos para o Git. Em produção, configure as variáveis de ambiente do Site e publique uma versão para aplicar a configuração.

- **Letterboxd:** não exige chave para RSS público. Informe somente o usuário. Importa entradas disponíveis no feed e guarda novas entradas ao sincronizar. RSS não fornece todo o histórico; registros antigos fora do feed não podem ser recuperados por esta integração. A API oficial tem aprovação separada.
- **Steam:** configure `STEAM_API_KEY` obtida em https://steamcommunity.com/dev/apikey. A vinculação verifica a identidade com Steam OpenID. Os detalhes de jogos devem estar públicos. Biblioteca e horas são importadas; conquistas são consultadas em lotes de oito jogos para respeitar o tempo das requisições. A importação continua nas sincronizações seguintes. O jogo mais jogado pode ser ordenado por horas; favorito é uma escolha do usuário via fixação.
- **Last.fm:** configure `LASTFM_API_KEY` de https://www.last.fm/api/account/create. Informe o usuário do perfil público. Novas reproduções e artistas do mês são importados; o histórico anterior é percorrido em lotes de 200 registros. A documentação solicita contato prévio para uso acadêmico/comercial. Sem scrobbles registrados no Last.fm, não há histórico a importar.

Steam e Last.fm precisam de chaves do aplicativo no servidor para consultar as APIs. O visitante não fornece API keys. A Steam pode ser vinculada via OpenID antes da ativação da sincronização. Letterboxd usa RSS público sem chave.

## Como sincroniza

Ao abrir o próprio museu, conexões com mais de cinco minutos são atualizadas. Com a página visível, uma verificação acontece a cada 65 segundos; históricos em importação continuam em lotes e conexões atualizadas são respeitadas. O botão Atualizar permite solicitar uma nova consulta com intervalo mínimo de um minuto por serviço.

**Esta entrega não executa um agendador quando o site está fechado.** Uma rotina de servidor autenticada e agendada deve ser instalada para essa modalidade. Dados antigos fora das janelas dos serviços podem deixar de ser capturados enquanto não houver consultas.

Itens usam identificadores estáveis por usuário/serviço, preservando a fixação nas atualizações. Falhas não apagam a coleção existente. Desconectar remove a conexão e seus itens importados, mediante confirmação na interface.

## Dados e acesso

- Banco D1 persistente com perfis, conexões, itens, comentários e estados de autorização.
- Identidade própria no destino independente; identidade Sites apenas no destino original. Edição vinculada ao usuário autenticado.
- Destino independente publicado com acesso administrativo; cadastro multiusuário ainda exige configuração.
- Busca de perfis por nome/endereço, sem algoritmo de afinidade.
- Comentários de até 1.500 caracteres, com intervalo de postagem e remoção pelo autor ou dono do museu.
- CSS avançado em iframe sem scripts e com política de conteúdo restritiva. A área externa do aplicativo continua acessível.
- O mural exibe até 100 comentários recentes. A consulta inicial inclui até 2.000 itens recentes/fixados; os contadores usam toda a base. A tela exibe 12 itens na visão geral e até 120 por categoria.

## Estrutura

- `app/museum.tsx`: interface e interações.
- `app/globals.css`: visual e responsividade.
- `app/api/[...path]/route.ts`: autenticação, CRUD e autorização das conexões.
- `lib/sync.ts`: conectores reais dos três serviços.
- `lib/catalog.ts`: RSS, tipos e validação de URLs.
- `lib/server.ts`: banco, proteção de escrita e criptografia.
- `db/schema.ts` e `drizzle/`: schema e migrações.

## Verificação

```sh
npm test
node node_modules/typescript/bin/tsc --noEmit
npm run test:api
node tests/social-smoke.mjs
```

O teste de API usa exclusivamente localhost e o usuário de desenvolvimento. Com `TEST_LIVE_RSS=1`, também importa temporariamente o RSS público do perfil jack para verificar a integração e remove os dados ao terminar. Não usa dados de teste em produção.

Verificações realizadas: testes de RSS/URLs, autenticação, validação, bloqueio de origem, persistência de perfil e comentários, importação de RSS real, intervalo de sincronização, fixação e desconexão. Steam e Last.fm não foram testados com credenciais reais.

## Referências

- https://partner.steamgames.com/doc/webapi/IPlayerService
- https://partner.steamgames.com/doc/webapi/ISteamUserStats
- https://letterboxd.com/api-beta/
- https://www.last.fm/api/show/user.getRecentTracks

## Alli e recursos sociais

Abra `/?profile=alli` para visitar o mascote chibi e `/?view=feed` para o feed. O perfil é criado automaticamente no primeiro acesso autenticado: 15 itens de obras e artistas reais, três conexões simuladas, conquistas reais com desbloqueios simulados e opiniões escritas para o mascote. Não são contas de serviços externos nem chamadas às APIs.

Siga o Alli para suas atividades aparecerem na aba Seguindo. O botão Simular atividade cria uma nova entrada demonstrativa, com intervalo mínimo de cinco segundos. O feed é cronológico, paginado e atualiza a cada 30 segundos enquanto visível. Seguidores, seguindo e comentários persistem no banco; nenhum seguidor é inventado.

Em Sala livre, use Ver e copiar CSS para inspecionar o tema Arquivo noturno e aplicá-lo ao próprio perfil. O CSS exportado está em [examples/themes/alli-sala-livre.css](../examples/themes/alli-sala-livre.css). A personalização é isolada em iframe sem scripts.

Testes sociais cobrem idempotência do perfil, seguir/deixar de seguir, feed filtrado, atividade simulada, validação e proteção contra edição do museu alheio.

## Contas, chat e comentários

Acesse /?view=account para cadastro/login e /?view=chat para mensagens. O cadastro por e-mail está preparado, mas depende de um projeto Supabase: veja [cadastro por e-mail](CONFIGURAR-CONTA-GRATUITA.md). O modo administrativo permite login e logout locais e no destino independente publicado. O login ChatGPT pertence somente ao destino Sites. A audiência do Site permanece privada.

Chat entre pessoas reais com persistência D1, indicador de leitura, histórico paginado, prevenção de envio duplicado e consulta a cada cinco segundos. Mural também busca novos comentários a cada cinco segundos quando aberto. Nenhum perfil de QA é publicado.

Testes adicionais: node --test tests/account.test.mjs (provedor simulado, sem e-mail real) e node tests/chat-smoke.mjs (somente localhost, dados temporários removidos ao finalizar).

## Curadoria real do Alli

Os cartazes, capas de álbuns, foto da banda, jogos e ícones de conquistas são reais, com fontes em docs/alli-fontes.json e /alli/creditos.html. Notas, opiniões e atividade do mascote são ficção explícita. A atualização substitui somente a coleção anterior de demo:alli, preservando seguidores e comentários de visitantes.

Spotify foi removido da interface, dos conectores e das consultas de coleção/feed. Registros antigos de outras pessoas não são apagados automaticamente; permanecem fora das consultas. Chaves Steam/Last.fm ainda não foram fornecidas, portanto a sincronização real desses serviços continua dependente da ativação pelo mantenedor. Nenhum usuário precisa fornecer uma chave.
