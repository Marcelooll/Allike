// Never trust identity headers supplied by visitors on an independently hosted Worker.
export function independentRequest(request, env) {
  if (!['admin', 'supabase'].includes(env.AUTH_PROVIDER)) {
    return Response.json({error:'Configure a autenticação própria antes de usar o Allike.'}, {status:503, headers:{'Cache-Control':'no-store'}});
  }
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.startsWith('oai-authenticated-user-')) headers.delete(name);
  }
  return new Request(request, {headers});
}
