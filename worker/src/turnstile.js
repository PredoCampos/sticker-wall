// Verificação antibot via Cloudflare Turnstile: troca o token que o widget
// gerou no navegador por uma confirmação server-side na siteverify API.
// env.TURNSTILE_SECRET_KEY é um secret do Cloudflare
// (`wrangler secret put TURNSTILE_SECRET_KEY`), nunca lido daqui, só repassado.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verificarTurnstile(token, env, ip) {
  if (typeof token !== 'string' || token.length === 0) return false;

  const corpo = new URLSearchParams();
  corpo.set('secret', env.TURNSTILE_SECRET_KEY);
  corpo.set('response', token);
  if (ip) corpo.set('remoteip', ip);

  const resposta = await fetch(SITEVERIFY_URL, { method: 'POST', body: corpo });
  if (!resposta.ok) return false;

  const dados = await resposta.json();
  return dados.success === true;
}
