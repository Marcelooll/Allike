# Ativar cadastro por e-mail no Allike

## Estado desta entrega

Chat privado e mural usam D1. O destino independente publicado usa login administrativo; o destino Sites é separado. O adaptador Supabase, cadastro, senha, código de confirmação, reenvio, saída e lembre-me estão implementados, mas desativados até configurar um projeto real. Nenhum plano pago foi contratado, nenhum e-mail foi enviado e nenhuma conta Supabase foi criada.

## Começar sem contratar plano pago

1. Crie uma conta e um projeto **Free** em https://supabase.com/dashboard . Não escolha upgrade, add-ons ou plano Pro. A criação e aceitação dos termos precisam ser feitas pelo titular.
2. Em Authentication, habilite o provedor Email, cadastro de novos usuários e **Confirm email**. Use senha mínima de 12 caracteres.
3. Em Email Templates → Confirm signup, inclua o código no corpo: **{{ .Token }}**. O Allike confirma por código digitado na tela, não usa os tokens de um redirecionamento implícito. Você pode usar o modelo HTML em [email-confirmation.html](email-confirmation.html).
4. O SMTP padrão do Supabase é limitado a destinatários autorizados da equipe e tem limite baixo; serve para testes do titular. Ele não libera cadastros de qualquer colega. Para esses envios, configure SMTP próprio com uma opção gratuita que aceite seu remetente e seus limites. Não foi contratado nem configurado um provedor de e-mail nesta entrega.
5. Copie somente a URL do projeto e a chave **publishable** (ou anon) para as variáveis de ambiente do servidor: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY. Nunca use service_role/secret. TOKEN_SECRET já existe na hospedagem; no ambiente local, gere um segredo aleatório de pelo menos 32 bytes e guarde em .dev.vars.
6. Quando o projeto e o envio estiverem prontos, configure AUTH_PROVIDER=supabase e publique. No destino independente, AUTH_PROVIDER=admin mantém o acesso administrativo. O login ChatGPT pertence somente ao destino Sites.
7. Cadastre um e-mail autorizado, receba o código, confirme, saia e entre novamente. Depois teste reenvio, código inválido/expirado e lembre-me. Estes testes reais estão pendentes.

## Acesso dos colegas e hospedagem

O destino independente já está em https://allike.marceloggamer27.workers.dev, sem barreira de login ChatGPT. O cadastro de colegas ainda depende de configurar Supabase e o envio de e-mails. A hospedagem Sites original continua sendo um destino separado.

Perfis ChatGPT e Supabase têm identidades distintas; não são mesclados automaticamente por e-mail. Ativar Supabase cria um novo museu para cada identidade Supabase. Os museus anteriores ficam preservados no banco. Uma migração de propriedade, se desejada, exige comprovar as duas contas.

## Sessão e dados

Lembre-me marcado: cookie persistente e validade máxima de 30 dias. Desmarcado: cookie de sessão com validade máxima de 12 horas; restauração do navegador pode preservar cookies de sessão. Cookies são HttpOnly, SameSite=Lax e Secure em HTTPS. O navegador recebe somente um token aleatório; tokens Supabase ficam cifrados no servidor. Identidade e confirmação são verificadas com o provedor. A saída revoga a sessão local. Não existe senha ou e-mail no perfil público.

Chat: consulta automática a cada cinco segundos com a aba visível; não é WebSocket. Somente remetente e destinatário podem ler a conversa via aplicativo. Não há criptografia ponta a ponta. Mensagens têm até 3.000 caracteres e paginação de 50. Contadores mostram conversas não lidas. O Alli é fictício e não recebe chats; seu mural aceita comentários.

## Documentação oficial consultada

- https://supabase.com/pricing — Free: US$ 0/mês, sujeito a limites e pausa por inatividade.
- https://supabase.com/docs/guides/auth/auth-smtp — restrições do SMTP padrão.
- https://supabase.com/docs/guides/auth/auth-email-templates — código {{ .Token }}.
- https://supabase.com/docs/guides/auth/passwords — confirmação e senhas.

## Recuperação de senha

Configure também o template Reset Password com o código {{ .Token }}. Use [email-recovery.html](email-recovery.html). O app oferece Esqueci minha senha, código, confirmação de nova senha e revogação das sessões. O envio real continua dependendo do projeto e SMTP.
