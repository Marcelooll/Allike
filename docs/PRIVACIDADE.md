# Arquivos privados e repositório público

O repositório GitHub é público. O Git publica arquivos rastreados, não todas as pastas existentes no computador.

## Ambiente e segredos

- `.env` e `.dev.vars`: configuração local e possíveis segredos. São ignorados, incluindo variantes como `.env.local` e `.dev.vars.cloudflare.json`.
- `.env.example`: modelo público com nomes de variáveis e valores vazios. Deve permanecer versionado.
- `.venv/` e `venv/`: ambientes virtuais de Python, também ignorados. O Allike usa Node.js e não depende deles.
- `node_modules/`, builds, estado Wrangler, bancos locais, backups e arquivos temporários não são fonte para publicação.
- Senha, hash administrativo, TOKEN_SECRET e chaves Steam/Last.fm pertencem à configuração protegida do servidor. Não devem ir para TSX, imagens, documentação ou commits.

O identificador D1 em `wrangler.independent.json` não é uma credencial e precisa identificar o banco de destino. Isso não concede acesso ao banco. A configuração do projeto Sites original também não deve conter tokens.

## O que o gitignore não faz

Ignorar não criptografa nem protege um arquivo no computador. Também não remove arquivos já rastreados ou presentes no histórico. Se um segredo for publicado, revogue ou troque a credencial; removê-lo apenas do último commit é insuficiente.

Antes de publicar, confira `git status --short`, `git diff --cached` e a lista `git ls-files`. Não use `git add -f` para enviar arquivos de ambiente. Não envie a pasta inteira por upload manual.

Arquivos locais continuam sujeitos às permissões do sistema, backups e sincronização da máquina. Dados de usuários pertencem ao banco; não devem ser incluídos em dumps públicos de demonstração.

## Limites desta revisão

A revisão desta organização procura arquivos sensíveis rastreados e ocorrências dos segredos locais conhecidos no código e histórico. Ela não é uma auditoria completa de segurança nem certifica que nunca existiu outro segredo desconhecido. Novos commits exigem o mesmo cuidado.

## IA e exportação

O pedido enviado ao Alli vai para Workers AI. Incluir bio, tags e obras é opcional na interface; e-mails, chaves e chats privados não são contexto. A conversa com o mascote não é persistida no banco do Allike. A exportação do museu contém dados pessoais escolhidos pelo usuário e deve ser guardada privadamente.
