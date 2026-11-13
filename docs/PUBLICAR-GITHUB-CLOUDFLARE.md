# Publicar o Allike na sua própria conta

O projeto tem dois destinos separados. Os comandos originais continuam atendendo ao Sites. Os comandos com independent usam Cloudflare Workers e D1 diretamente, sem login do ChatGPT nem serviços do Sites. O D1 continua sendo Cloudflare; a independência é em relação ao Sites, com banco e hospedagem sob sua conta.

## GitHub

Crie um repositório privado allike e envie o código com Git. Não faça upload indiscriminado da pasta pelo navegador: respeite o .gitignore. Não envie .dev.vars, .env, node_modules, .wrangler, .sites-runtime, dist nem backups. O histórico e o conteúdo devem ser revisados antes do push. A integração GitHub precisa estar conectada para o agente criar e enviar o repositório.

## Desenvolvimento independente

Requer Node 24 e npm. Na raiz do projeto:

~~~sh
npm ci
npm run db:migrate:local
npm run dev:independent
~~~

Abra http://localhost:5174. O banco independente usa .wrangler/independent; não altera o banco local anterior. Use .dev.vars para os segredos locais, seguindo .env.example. Na máquina de desenvolvimento original, a conta administrativa já está configurada nesse arquivo ignorado pelo Git. Quem clonar o repositório precisará configurar seu próprio acesso.

## Criar o D1 remoto

~~~sh
npx wrangler login
npx wrangler d1 create allike-db
node scripts/configure-d1.mjs UUID_RETORNADO_PELA_CLOUDFLARE
npm run db:migrate:remote
~~~

O UUID é um identificador, não uma senha. O script atualiza wrangler.independent.json. Envie essa mudança ao GitHub para que as publicações usem o mesmo banco. Os comandos remotos recusam o identificador provisório. As três migrações são registradas pelo Wrangler; uma segunda execução não recria tabelas já migradas.

Este fluxo é para um banco NOVO. Ele não copia automaticamente perfis, comentários ou conexões do Sites. O Alli será criado no primeiro acesso autenticado. Para migrar dados existentes, faça exportação e restauração em uma etapa separada, com backup, preservando TOKEN_SECRET se houver dados criptografados. Não execute as migrações iniciais sobre uma cópia de banco já populado sem conciliar o histórico de migrações.

## Segredos e autenticação

AUTH_PROVIDER=admin e DEPLOYMENT_TARGET=independent já estão na configuração de produção. Configure os três segredos no Worker allike:

~~~sh
npx wrangler secret put ADMIN_USERNAME --config wrangler.independent.json
npx wrangler secret put ADMIN_PASSWORD_HASH --config wrangler.independent.json
npx wrangler secret put TOKEN_SECRET --config wrangler.independent.json
~~~

Cada comando pede o valor sem gravá-lo no código. Se o Worker ainda não existir, o Wrangler pode pedir para criá-lo. Use o hash e TOKEN_SECRET do .dev.vars original por entrada protegida, sem colar valores em issues, commits ou comandos de terminal. A senha em texto puro não deve ser colocada no hash. Formato esperado: pbkdf2-sha256$100000$SALT_BASE64URL$HASH_BASE64URL.

Para cadastro de pessoas por e-mail, configure Supabase, altere AUTH_PROVIDER para supabase e adicione SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY. A conta admin é um acesso individual de teste, não um cadastro multiusuário nem um painel de moderação.

## Publicar

~~~sh
npm run check
npm run test:unit
npm run deploy:independent
~~~

O comando constrói a aplicação independente, confere o banco no artefato e publica com Wrangler. Uma publicação independente expõe o endereço workers.dev; o conteúdo autenticado continua protegido pelo login próprio. O acesso privado do Sites não é transferido à Cloudflare. Não publique usando o comando original de build do Sites.

Para conferir o pacote sem publicar:

~~~sh
node scripts/independent-deploy.mjs dry-run
~~~

## Publicação automática do GitHub

No Cloudflare Workers, conecte o repositório e a branch main. Use Node 24, build command npm run build:independent e deploy command npm run deploy:independent. O comando de deploy refaz o build como verificação de destino. Configure os segredos no Worker, não em arquivos do repositório. Aplique migrações remotas antes de publicar mudanças de banco. O workflow .github/workflows/ci.yml valida código, testes e build, mas não publica sozinho.

## Verificação após publicar

Entre, recarregue, confira lembre-me e saia. Confirme que requisições sem sessão não podem ler o museu. Teste Alli e mural; chat exige duas contas reais e, portanto, o provedor multiusuário configurado. Teste a CPU do login no plano gratuito. Steam e Last.fm ainda exigem chaves de aplicativo no servidor; hospedagem não ativa essas integrações automaticamente.

Referências: https://developers.cloudflare.com/d1/reference/migrations/ e https://developers.cloudflare.com/workers/ci-cd/builds/configuration/.

## Resultado da validação nesta entrega

TypeScript, oito testes, criação do D1 local, reaplicação idempotente das migrações e build independente passaram. Login real, lembre-me, revogação por logout e 15 itens do Alli foram verificados pela API no banco novo. O dry-run final do Wrangler foi bloqueado por uma restrição de leitura de diretório ancestral no ambiente Windows; precisa ser repetido em um terminal com acesso normal ou no CI. Não houve publicação remota nem criação do banco remoto nesta etapa.
