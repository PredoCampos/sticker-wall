// Estado publicado ∪ reservas pendentes: o conjunto completo que uma nova
// submissão precisa checar contra (geometry.conflitos, chamado por quem usa
// isto — occupancy.js só monta a lista, não julga geometria).
//
// As obras publicadas vêm do próprio Pages via Cache API, com TTL curto —
// o Worker não tem acesso direto ao repositório fora do fluxo de PR, então
// "o que está no ar agora" é, literalmente, o stickers.json publicado.

import { CONFIG } from '../../shared/config.js';
import { listarReservas } from './reservations.js';

async function obterPublicadas(env) {
  const url = `${env.ORIGEM_PAGES}/sticker-wall/data/stickers.json`;
  const requisicao = new Request(url);
  const cache = caches.default;

  let resposta = await cache.match(requisicao);
  if (!resposta) {
    const buscada = await fetch(requisicao);
    if (!buscada.ok) throw new Error(`falha ao buscar stickers.json: ${buscada.status}`);
    resposta = new Response(buscada.body, buscada);
    resposta.headers.set('Cache-Control', `max-age=${CONFIG.quotas.occupancyCacheTtlSegundos}`);
    await cache.put(requisicao, resposta.clone());
  }

  const envelope = await resposta.json();
  return envelope.obras;
}

export async function ocupacaoAtual(env, kv) {
  const [publicadas, reservas] = await Promise.all([
    obterPublicadas(env),
    listarReservas(kv),
  ]);
  return [...publicadas, ...reservas];
}
