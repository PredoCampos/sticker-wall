// Reservas pendentes: obras já aceitas pelo Worker (PR aberto) mas ainda não
// mescladas em main, então ainda não aparecem em data/stickers.json. Ficam
// todas numa única chave KV como array — a escala do projeto não justifica
// uma chave por reserva. KV não tem read-modify-write atômico: duas
// submissões quase simultâneas podem ler a mesma lista e uma sobrescrever a
// reserva da outra. Aceitável no tamanho deste projeto; documentado aqui
// para não ser redescoberto como bug.

import { CONFIG } from '../../shared/config.js';

const CHAVE = 'pending';

function expirada(reserva, agora) {
  return agora - reserva.criadoEm > CONFIG.quotas.reservaTtlMinutos * 60 * 1000;
}

export async function listarReservas(kv) {
  const lista = (await kv.get(CHAVE, 'json')) || [];
  const agora = Date.now();
  return lista.filter((reserva) => !expirada(reserva, agora));
}

export async function criarReserva(kv, { id, x, y, width, height, ipHash }) {
  const ativas = await listarReservas(kv);
  const reserva = { id, x, y, width, height, ipHash, criadoEm: Date.now() };
  await kv.put(CHAVE, JSON.stringify([...ativas, reserva]));
  return reserva;
}
