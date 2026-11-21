'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck,LoaderCircle} from 'lucide-react';
type Status={configured:boolean;provider:string;user:null|{name:string;email:string;role?:string};session?:{remember:boolean;expires:number}|null};
type Mode='login'|'signup'|'verify'|'forgot'|'reset';
export default function Account(){
 const [status,setStatus]=useState<Status|null>(null);
 const [mode,setMode]=useState<Mode>('login'),[email,setEmail]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[name,setName]=useState(''),[code,setCode]=useState(''),[remember,setRemember]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmLogout,setConfirmLogout]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/auth/status').then(async r=>{const d=await r.json() as Status & {error?:string};if(!r.ok)throw Error(d.error);if(active)setStatus(d);}).catch(()=>{if(active)setError('Não foi possível consultar o acesso. Recarregue a página.');});return()=>{active=false;};},[]);
 const admin=status?.provider==='admin';
 function change(next:Mode){setMode(next);setError('');setMessage('');setPassword('');setConfirmPassword('');setCode('');}
 async function submit(action:string=mode){
  if(busy)return;
  if((action==='reset'||action==='signup')&&password!==confirmPassword){setError('As senhas precisam ser iguais.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,username,password,confirmPassword,name,code,remember})});
   const d=await r.json() as {error?:string;message:string};if(!r.ok)throw Error(d.error||'Não foi possível concluir.');
   if(action==='login'||action==='verify'){location.assign('/');return;}
   if(action==='logout'||action==='logout-all'){location.assign('/?view=account');return;}
   setMessage(d.message);setPassword('');setConfirmPassword('');
   if(action==='signup')setMode('verify');
   if(action==='forgot')setMode('reset');
   if(action==='reset'){setMode('login');setCode('');setStatus(old=>old?{...old,user:null,session:null}:old);}
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}
 }
 async function exportMuseum(){setBusy(true);setError('');try{const r=await fetch('/api/account/export');if(!r.ok){const d=await r.json() as {error?:string};throw Error(d.error);}const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='allike-meu-museu.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Seu museu foi exportado. Guarde o arquivo em um lugar privado.');}catch(e){setError(e instanceof Error?e.message:'Falha ao exportar.');}finally{setBusy(false);}}
 const titles={login:'Que bom te ver.',signup:'Abra seu museu',verify:'Confirme seu e-mail',forgot:'Recupere seu acesso',reset:'Escolha uma nova senha'};
 return <main className="account-page"><a className="account-back" href="/">Voltar ao museu</a><div className="account-layout"><section className="account-story"><span className="eyebrow">UM UNIVERSO SÓ SEU</span><h1>Todo gosto<br/>tem uma <em>história.</em></h1><p>Guarde as suas. Encontre pessoas que também querem ouvir.</p><img src="/alli/mascot-chibi.png" alt="Alli segurando seu disco favorito"/><small>Seu museu. Suas conversas. Seu jeito.</small></section>
 <section className="account-form" aria-busy={busy}><span className="eyebrow">BEM-VINDO AO ALLIKE</span><h2>{status?.user?'Sua conta':admin&&mode==='login'?'Entrar no Allike':titles[mode]}</h2>
 {!status&&!error&&<p role="status"><LoaderCircle className="spin"/> Consultando o acesso…</p>}
 {status&&!status.configured&&<div className="account-notice" role="status"><ShieldCheck/><div><strong>Acesso em configuração</strong><p>O mantenedor precisa configurar a autenticação e o envio de e-mails.</p>{status.provider==='chatgpt'&&<a className="button" href="/signin-with-chatgpt?return_to=/" target="_top">Continuar com ChatGPT</a>}</div></div>}
 {status?.user?<><p>Conectado como <strong>{status.user.name||status.user.email}</strong>.</p>{status.user.email&&<p>{status.user.email}</p>}<div className="account-verified"><ShieldCheck size={18}/>{status.user.role==='admin'?'Administrador do Allike':'E-mail confirmado'}</div>
 {status.session&&<p className="session-help">{status.session.remember?'Lembre-me ativado neste dispositivo.':'Sessão temporária: lembre-me desativado.'}<br/>Validade máxima: {new Date(status.session.expires).toLocaleString('pt-BR')}.</p>}
 <div className="account-actions"><a href="/" className="button primary">Abrir meu museu</a><button className="button" disabled={busy} onClick={()=>void submit('logout')}>Sair desta conta</button></div>
 <section className="account-security"><h3>Segurança e seus dados</h3><p>Encerre o acesso em outros dispositivos ou baixe uma cópia do seu museu.</p><button className="button" disabled={busy} onClick={()=>setConfirmLogout(true)}>Sair de todos os dispositivos</button>
 {confirmLogout&&<div className="account-notice"><div><p>Isso também encerra a sessão neste dispositivo. Deseja continuar?</p><button className="button" disabled={busy} onClick={()=>void submit('logout-all')}>Confirmar saída de todos</button><button className="button subtle" disabled={busy} onClick={()=>setConfirmLogout(false)}>Cancelar</button></div></div>}
 <button className="button" disabled={busy} onClick={()=>void exportMuseum()}>Exportar meu museu</button><small>Perfil, coleção, conexões públicas, comentários escritos e preferências. Não inclui senhas nem mensagens privadas. Até 5.000 registros por categoria.</small>
 {!admin&&<p>Para trocar sua senha, saia e use “Esqueci minha senha” com seu e-mail.</p>}</section></>:<>
 {!admin&&status?.configured&&<div className="account-tabs"><button aria-pressed={mode==='login'} disabled={busy} onClick={()=>change('login')}>Entrar</button><button aria-pressed={mode==='signup'} disabled={busy} onClick={()=>change('signup')}>Criar conta</button></div>}
 {admin&&mode==='forgot'?<div className="account-notice" role="status"><ShieldCheck/><div><strong>Recuperação da conta administrativa</strong><p>Esta conta não tem e-mail associado. O mantenedor precisa redefinir a senha na configuração protegida da hospedagem. Não existe uma senha de recuperação pública.</p><button className="button" onClick={()=>change('login')}>Voltar para entrar</button></div></div>:<form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy||!status?.configured}>
 {mode==='signup'&&<label>Como quer ser chamado?<input required maxLength={60} autoComplete="nickname" value={name} onChange={e=>setName(e.target.value)}/></label>}
 {admin?<label>Usuário<input required autoComplete="username" maxLength={100} value={username} onChange={e=>setUsername(e.target.value)}/></label>:<label>E-mail<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>}
 {(mode==='verify'||mode==='reset')&&<label>Código recebido por e-mail<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={e=>setCode(e.target.value)}/></label>}
 {!['verify','forgot'].includes(mode)&&<label>{mode==='reset'?'Nova senha':'Senha'}<input required type="password" minLength={mode==='login'?1:12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/>{mode!=='login'&&<small>Use de 12 a 128 caracteres. Uma frase longa funciona bem.</small>}</label>}
 {(mode==='signup'||mode==='reset')&&<label>Confirme a senha<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>}
 {['login','signup','verify'].includes(mode)&&<><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Lembre-me neste dispositivo</label><small className="session-help">Marcado: até 30 dias. Desmarcado: cookie de sessão com limite de 12 horas. A restauração do navegador pode manter a sessão até esse limite.</small></>}
 {mode==='forgot'&&<p>Enviaremos um código para você escolher uma nova senha.</p>}
 <button className="button primary full" type="submit">{busy?'Aguarde…':mode==='signup'?'Criar conta e receber código':mode==='verify'?'Confirmar e entrar':mode==='forgot'?'Enviar código de recuperação':mode==='reset'?'Salvar nova senha':'Entrar no meu museu'}</button>
 </fieldset></form>}
 <div className="account-links">{mode==='login'?<button disabled={busy} onClick={()=>change('forgot')}>Esqueci minha senha</button>:<button disabled={busy} onClick={()=>change('login')}>Voltar para entrar</button>}
 {!admin&&mode==='login'&&<button disabled={busy} onClick={()=>change('verify')}>Já tenho um código de cadastro</button>}
 {!admin&&mode==='forgot'&&<button disabled={busy} onClick={()=>change('reset')}>Já tenho um código de recuperação</button>}
 {!admin&&(mode==='verify'||mode==='reset')&&<button disabled={busy||!email||!status?.configured} onClick={()=>void submit(mode==='reset'?'forgot':'resend')}>Reenviar código</button>}</div></>}
 {error&&<p className="inline-error" role="alert">{error}</p>}{message&&<p className="social-message" role="status">{message}</p>}<p className="account-footer">{admin?'Sua senha é verificada no servidor.':'Seu e-mail não aparece no perfil público.'}</p>
 </section></div></main>;
}
