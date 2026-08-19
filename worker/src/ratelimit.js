// Quota por IP: um contador rl:<hash>:<dia> no KV (expira sozinho) para
// submissões aceitas por dia, mais uma contagem de quantas reservas
// pendentes (reservations.js) já pertencem a esse IP. hashIp existe aqui
// porque é o único outro lugar (reservations.js) que precisa da mesma
// derivação — nunca guardamos o IP em texto puro.

import { CONFIG } from '../../shared/config.js';
import { listarReservas } from './reservations.js';

export async function hashIp(ip) {
  const dados = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function chaveDoDia(hash) {
  const dia = new Date().toISOString().slice(0, 10);
  return `rl:${hash}:${dia}`;
}

export async function limiteDiarioExcedido(kv, hash) {
  const valor = await kv.get(chaveDoDia(hash));
  return Number(valor || 0) >= CONFIG.quotas.submissoesPorDiaPorIp;
}

export async function registrarSubmissao(kv, hash) {
  const chave = chaveDoDia(hash);
  const atual = Number((await kv.get(chave)) || 0);
  // TTL um pouco maior que um dia: só limpeza, a chave já muda por data.
  await kv.put(chave, String(atual + 1), { expirationTtl: 60 * 60 * 26 });
}

export async function pendentesExcedidos(kv, hash) {
  const reservas = await listarReservas(kv);
  return reservas.filter((r) => r.ipHash === hash).length >= CONFIG.quotas.pendentesPorIp;
}
