# Descobertas, IA e recuperação de acesso

## Recursos desta atualização

- Pessoas: afinidade determinística por tags e obras em comum, com feedback privado de interesse/desinteresse. Até 200 perfis recentes e 40 obras por perfil. O número de pontos serve para ordenar; não é porcentagem de compatibilidade. Desinteresse esconde o perfil e penaliza tags semelhantes; redefinir preferências apaga o feedback.
- Obras: IA escolhe até três entradas do catálogo real inicial. IDs desconhecidos ou duplicados são rejeitados. Não há pesquisa na web nem catálogo ilimitado.
- Conversa: Alli usa até seis mensagens anteriores. O histórico fica no estado da tela, não no banco. Recarregar ou sair da tela o apaga.
- Bio: sugestão editável, limitada a 500 caracteres; só salva após confirmação.
- Tema: o modelo escolhe cores e arredondamento. O servidor valida cores, limites e contraste mínimo de 4,5:1 entre texto e fundo, depois produz CSS a partir de um modelo controlado. Não executa HTML/JS/CSS arbitrário retornado pela IA. A prévia usa iframe isolado; aplicar substitui o CSS da Sala livre após confirmação.
- Conta: exportação do museu (sem chats/segredos, limite de 5.000 itens por categoria) e saída de todos os dispositivos.

## IA no servidor e custos

A entrada é `lib/assistant.ts`. A interface é `app/assistant.tsx`; afinidade e validação de temas estão em `lib/intelligence.ts`.

O destino independente usa binding Workers AI `AI` e `AI_ENABLED=true`. Modelo escolhido: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Nenhuma chave é enviada ao navegador.

Limites atômicos no D1: 20 pedidos por pessoa/dia e 30 por aplicação/dia, com reinício às 00:00 UTC. Pedidos que falham também podem consumir limite. Esses limites são de requisições, não uma medição exata de neurons. A cota da Cloudflare é compartilhada com outros usos da conta; falhas de cota retornam indisponibilidade, sem respostas fictícias nem troca automática de provedor. Nenhum upgrade foi contratado.

A mensagem enviada vai para a Cloudflare. Bio, tags e até 12 obras só são incluídas se a pessoa marcar a opção. E-mail, tokens e conversas privadas não são usados como contexto. Respostas são renderizadas como texto, nunca como HTML executável.

No Windows restrito, o proxy de IA do Wrangler pode falhar. Para testar a interface sem conexão remota, use `ALLIKE_LOCAL_OFFLINE=1` no ambiente e `npm run dev:independent`. Respostas reais precisam de conexão com Workers AI; esse modo não simula respostas. É possível definir `AI_ENABLED=false` em `.dev.vars` para apresentar a indisponibilidade explicitamente.

## Esqueci minha senha

Fluxo implementado para Supabase:

1. POST `/api/auth/forgot` solicita um código; a mensagem é genérica para não revelar se o endereço existe.
2. A pessoa informa e-mail, código de recuperação e nova senha duas vezes.
3. POST `/api/auth/reset` exige código de tipo `recovery`, valida a nova senha e atualiza o provedor.
4. O app remove as sessões desse usuário e pede novo login. Não transforma a recuperação em uma sessão de navegação automática.

Configure o template **Reset Password** do Supabase com `{{ .Token }}`; exemplo em [email-recovery.html](email-recovery.html). A interface usa código digitado, não tokens em fragmentos da URL. O projeto precisa de Supabase real, confirmação de e-mail e envio SMTP configurado. Isso permanece pendente; testes usam um provedor simulado e não comprovam entrega de e-mail.

A conta administrativa atual não tem endereço de recuperação. “Esqueci minha senha” explica que o mantenedor precisa redefinir o hash protegido. Não existe bypass, senha mestra pública nem envio fictício.

A migração `0003_account_discovery.sql` adiciona dono às sessões e tabela de preferências. Sessões antigas sem dono identificado são revogadas ao recuperar senha ou sair de todos os dispositivos; sessões novas de outras pessoas são preservadas.

## Próximas prioridades

1. Configurar Supabase e SMTP para cadastro, confirmação e recuperação reais.
2. Ativar as chaves Steam/Last.fm e testar sincronização com contas reais.
3. Bloquear usuários, denunciar conteúdo e oferecer moderação.
4. Exclusão de conta/dados, política de privacidade e processo de atendimento.
5. Melhorar paginação/escala da descoberta e ampliar catálogo.
6. Notificações e sincronização agendada, conforme uso e cotas.

## Fontes oficiais

- [Workers AI: binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Modelo escolhido](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Cotas e preços](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Supabase: recuperação de senha](https://supabase.com/docs/guides/auth/passwords)
- [Supabase: confirmação de códigos](https://supabase.com/docs/reference/javascript/auth-verifyotp)
