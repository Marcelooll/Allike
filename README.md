# Allike — museu pessoal de gostos

Aplicativo full-stack em português: perfil, filmes/reviews, música, jogos, conquistas, mural, busca de perfis e personalização. Feed e recomendação por likes/dislikes ficam fora da versão 1 conforme o escopo.

## Executar

Requer Node.js 22.13+ e npm. Na pasta do projeto:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_square_loa.sql
npm run dev
```

Acesse o endereço exibido pelo servidor (normalmente http://127.0.0.1:5173). Entre pelo botão da página. O login local do starter utiliza uma identidade de desenvolvimento e NÃO é incluído na publicação. A migração deve ser aplicada apenas uma vez por banco local. O comando de desenvolvimento também pode ser executado sem npm: `node scripts/run-framework.mjs dev --hostname 127.0.0.1`.

Em Windows com falha `uv_os_get_passwd` ao gerar novas migrações, a limitação vem da consulta ao usuário do sistema feita pelo Drizzle/tsx em ambiente restrito. As migrações SQL já geradas estão incluídas.

## Serviços externos

Copie os NOMES de `.env.example` para `.dev.vars` no desenvolvimento e preencha localmente. Não envie segredos para o Git. Em produção, configure as variáveis de ambiente do Site e publique uma versão para aplicar a configuração.

- **Letterboxd:** não exige chave para RSS público. Informe somente o usuário. Importa entradas disponíveis no feed e guarda novas entradas ao sincronizar. RSS não fornece todo o histórico; registros antigos fora do feed não podem ser recuperados por esta integração. A API oficial tem aprovação separada.
- **Steam:** configure `STEAM_API_KEY` obtida em https://steamcommunity.com/dev/apikey. A vinculação verifica a identidade com Steam OpenID. Os detalhes de jogos devem estar públicos. Biblioteca e horas são importadas; conquistas são consultadas em lotes de oito jogos para respeitar o tempo das requisições. A importação continua nas sincronizações seguintes. O jogo mais jogado pode ser ordenado por horas; favorito é uma escolha do usuário via fixação.
- **Last.fm:** configure `LASTFM_API_KEY` de https://www.last.fm/api/account/create. Informe o usuário do perfil público. Novas reproduções e artistas do mês são importados; o histórico anterior é percorrido em lotes de 200 registros. A documentação solicita contato prévio para uso acadêmico/comercial. Sem scrobbles registrados no Last.fm, não há histórico a importar.
- **Spotify:** configure `SPOTIFY_CLIENT_ID`. No dashboard do Spotify, cadastre exatamente a URL abaixo e autorize os usuários de teste conforme as regras do aplicativo. O fluxo utiliza Authorization Code com PKCE, não precisa de client secret e solicita `user-read-recently-played` e `user-top-read`. Tokens são cifrados com AES-GCM usando `TOKEN_SECRET`, uma chave aleatória de pelo menos 32 bytes. O modo de desenvolvimento do Spotify tem requisitos próprios (inclusive Premium para o proprietário do app); consulte a documentação oficial.

Callback de produção:
```
https://allike-museu-cultural.jammy-cove-0301.chatgpt.site/api/callback/spotify
```

O Spotify fornece reproduções recentes, não um histórico vitalício completo. Allike acumula os dados que consegue consultar. Steam, Last.fm e Spotify precisam de credenciais reais antes do primeiro uso. O aplicativo mostra explicitamente quando elas não foram configuradas.

## Como sincroniza

Ao abrir o próprio museu, conexões com mais de cinco minutos são atualizadas. Com a página visível, uma verificação acontece a cada 65 segundos; históricos em importação continuam em lotes e conexões atualizadas são respeitadas. O botão Atualizar permite solicitar uma nova consulta com intervalo mínimo de um minuto por serviço.

**Esta entrega não executa um agendador quando o site está fechado.** Uma rotina de servidor autenticada e agendada deve ser instalada para essa modalidade. Dados antigos fora das janelas dos serviços podem deixar de ser capturados enquanto não houver consultas.

Itens usam identificadores estáveis por usuário/serviço, preservando a fixação nas atualizações. Falhas não apagam a coleção existente. Desconectar remove a conexão e seus itens importados, mediante confirmação na interface.

## Dados e acesso

- Banco D1 persistente com perfis, conexões, itens, comentários e estados de autorização.
- Identidade fornecida pelo Sites. Edição é sempre vinculada ao usuário autenticado.
- Publicação inicial privada: o link não concede automaticamente acesso aos colegas.
- Busca de perfis por nome/endereço, sem algoritmo de afinidade.
- Comentários de até 1.500 caracteres, com intervalo de postagem e remoção pelo autor ou dono do museu.
- CSS avançado em iframe sem scripts e com política de conteúdo restritiva. A área externa do aplicativo continua acessível.
- O mural exibe até 100 comentários recentes. A consulta inicial inclui até 2.000 itens recentes/fixados; os contadores usam toda a base. A tela exibe 12 itens na visão geral e até 120 por categoria.

## Estrutura

- `app/museum.tsx`: interface e interações.
- `app/globals.css`: visual e responsividade.
- `app/api/[...path]/route.ts`: autenticação, CRUD e autorização das conexões.
- `lib/sync.ts`: conectores reais dos quatro serviços.
- `lib/catalog.ts`: RSS, tipos e validação de URLs.
- `lib/server.ts`: banco, proteção de escrita e criptografia.
- `db/schema.ts` e `drizzle/`: schema e migrações.

## Verificação

```sh
npm test
node node_modules/typescript/bin/tsc --noEmit
npm run test:api
```

O teste de API usa exclusivamente localhost e o usuário de desenvolvimento. Com `TEST_LIVE_RSS=1`, também importa temporariamente o RSS público do perfil jack para verificar a integração e remove os dados ao terminar. Não usa dados de teste em produção.

Verificações realizadas: testes de RSS/URLs, autenticação, validação, bloqueio de origem, persistência de perfil e comentários, importação de RSS real, intervalo de sincronização, fixação e desconexão. Steam, Spotify e Last.fm não foram testados com credenciais reais.

## Referências

- https://partner.steamgames.com/doc/webapi/IPlayerService
- https://partner.steamgames.com/doc/webapi/ISteamUserStats
- https://letterboxd.com/api-beta/
- https://www.last.fm/api/show/user.getRecentTracks
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
