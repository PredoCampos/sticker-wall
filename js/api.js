// Cliente do Worker. Troca o mock (item 30) pelo endpoint real — mesma
// assinatura enviar(payload), então submit-ui.js não muda. Um 409 vem com
// as bboxes conflitantes no corpo (worker/src/errors.js); aqui isso vira
// erro.conflitos para quem chamou destacar.

import { CONFIG } from '../shared/config.js';

export async function enviar(payload) {
  const corpo = new FormData();
  corpo.set('x', String(payload.x));
  corpo.set('y', String(payload.y));
  corpo.set('width', String(payload.width));
  corpo.set('height', String(payload.height));
  corpo.set('nomeArtistico', payload.nomeArtistico);
  if (payload.handle) corpo.set('handle', payload.handle);
  if (payload.cidade) corpo.set('cidade', payload.cidade);
  if (payload.descricao) corpo.set('descricao', payload.descricao);
  if (payload.url) corpo.set('url', payload.url);
  corpo.set('autoriaDeclarada', String(payload.autoriaDeclarada));
  corpo.set('imagem', payload.imagem, 'obra.png');

  const resposta = await fetch(`${CONFIG.worker.baseUrl}/submit`, { method: 'POST', body: corpo });
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const erro = new Error(dados.erro || 'erro_desconhecido');
    erro.codigo = dados.erro;
    if (resposta.status === 409) erro.conflitos = dados.conflitos || [];
    throw erro;
  }

  return dados;
}
