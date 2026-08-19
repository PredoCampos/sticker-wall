// Hash routing: #/ (território livre), #obra/<id> (obra selecionada,
// enquadrada), #enviar (modo de submissão — liga/desliga submit-ui.js).
//
// Distinção importante: um clique no território já mostra o painel da obra
// (hud.js reage a territorio:clique sozinho) sem mover a câmera — a obra já
// está visível, foi assim que deu para clicar nela. "Enquadrar" (recentrar
// e aproximar o zoom) só acontece quando a rota chega de fora: carregamento
// inicial, um link compartilhado, ou voltar/avançar no histórico. Por isso
// o clique só sincroniza a URL via history.replaceState — que não dispara
// hashchange — em vez de deixar o listener de hashchange reprocessar tudo.

import * as store from './store.js';
import { centralizarEm, obterEstado } from './camera.js';
import { mostrarObra, esconderObra } from './hud.js';
import { ativar as ativarSubmissao, desativar as desativarSubmissao } from './submit-ui.js';

const painelSubmissao = document.getElementById('painel-submissao');
const ZOOM_ENQUADRAMENTO = 2;

let rotaAnterior = null;

function analisarHash(hash) {
  const valor = hash.replace(/^#/, '');
  if (valor === '' || valor === '/') return { tipo: 'territorio' };
  if (valor === 'enviar') return { tipo: 'enviar' };
  const m = valor.match(/^obra\/([0-9a-f]{8})$/);
  if (m) return { tipo: 'obra', id: m[1] };
  return { tipo: 'territorio' };
}

function processarRota({ enquadrar }) {
  const rota = analisarHash(location.hash);

  if (rotaAnterior === 'enviar' && rota.tipo !== 'enviar') {
    desativarSubmissao();
  }
  painelSubmissao.hidden = rota.tipo !== 'enviar';

  if (rota.tipo === 'enviar') {
    if (rotaAnterior !== 'enviar') ativarSubmissao();
    esconderObra();
    rotaAnterior = rota.tipo;
    return;
  }

  if (rota.tipo !== 'obra') {
    esconderObra();
    rotaAnterior = rota.tipo;
    return;
  }

  const obra = store.byId(rota.id);
  if (!obra) {
    esconderObra();
    rotaAnterior = rota.tipo;
    return;
  }

  mostrarObra(obra);
  if (enquadrar) {
    const centro = { x: obra.x + obra.width / 2, y: obra.y + obra.height / 2 };
    centralizarEm(centro, Math.max(obterEstado().zoom, ZOOM_ENQUADRAMENTO));
  }
  rotaAnterior = rota.tipo;
}

export function iniciar() {
  window.addEventListener('territorio:clique', (e) => {
    // Em #enviar, um clique no território é só parte do gesto de posicionar
    // a obra pendente (ex.: um arrasto curto demais que virou "clique") —
    // não deve reabrir #painel-obra (que ocupa o mesmo espaço na tela que
    // #painel-submissao) nem reescrever a URL para longe de #enviar.
    // hud.js reage a este mesmo evento sem saber da rota; esconderObra()
    // aqui desfaz o que aquele listener acabou de fazer.
    if (rotaAnterior === 'enviar') {
      esconderObra();
      return;
    }

    const { obra } = e.detail;
    const hash = obra ? `#obra/${obra.id}` : '#/';
    if (location.hash !== hash) history.replaceState(null, '', hash);
  });

  window.addEventListener('hashchange', () => processarRota({ enquadrar: true }));
  processarRota({ enquadrar: true });
}
