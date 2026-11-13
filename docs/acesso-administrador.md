# Acesso administrativo

A implementação local usa AUTH_PROVIDER=admin, ADMIN_USERNAME e ADMIN_PASSWORD_HASH no arquivo .dev.vars, ignorado pelo Git. TOKEN_SECRET protege os dados das sessões. Nunca coloque senhas no código nem no navegador.

O hash usa PBKDF2 SHA-256, salt aleatório e 100.000 iterações. O cookie HttpOnly contém um token aleatório; o banco guarda seu digest. Lembre-me dura até 30 dias; sem ele, cookie de sessão com limite de 12 horas. Sair revoga a sessão no servidor. Alterar o hash invalida as sessões administrativas anteriores.

A conta tem identificação administrativa; não foi criado um painel de moderação. O cadastro por e-mail continua dependendo da configuração do Supabase.

Para iniciar localmente: `node scripts/run-framework.mjs dev --hostname 127.0.0.1`. Abra http://127.0.0.1:5173/?view=account.

Validação: `node --test tests/admin.test.mjs tests/account.test.mjs` e `node node_modules/typescript/bin/tsc --noEmit`.

Publicação pendente: o conector retornou codex_auth, sem credencial compatível com o helper instalado; o Git remoto recusou autenticação. A versão pública anterior permanece inalterada. Para publicar esta versão, restaurar autenticação do repositório, enviar fonte, configurar as variáveis administrativas como segredos no Sites e publicar o mesmo commit.
