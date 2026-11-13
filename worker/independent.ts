import handler from 'vinext/server/fetch-handler';
import {independentRequest} from '../lib/independent-request.mjs';

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const checked = independentRequest(request, env as unknown as Record<string, string>);
    if (checked instanceof Response) return checked;
    return handler.fetch(checked, env, ctx);
  },
};
