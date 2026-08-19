// Painel de informação da obra e indicador de zoom.
// Escuta o evento `territorio:clique` que input.js dispara — não importa
// input.js diretamente, só reage ao que ele publica em window. mostrarObra()
// e esconderObra() também ficam exportadas para router.js usar no item 22,
// quando a navegação por #obra/<id> precisa abrir o painel sem passar por
// um clique real.
//
// Também importa camera.js só para ler o zoom atual (obterEstado) — não é
// uma dependência listada na tabela B.5, mas não há outra fonte para esse
// número; é um import pequeno e isolado ao indicador.

import { obterEstado } from './camera.js';

const painelObra = document.getElementById('painel-obra');
const indicadorZoom = document.getElementById('indicador-zoom');

function criarLinha(tag, texto, classe) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.textContent = texto;
  return el;
}

function renderizarObra(obra) {
  painelObra.innerHTML = '';

  const fechar = document.createElement('button');
  fechar.dataset.fechar = '';
  fechar.setAttribute('aria-label', 'Fechar');
  fechar.textContent = '×';
  painelObra.appendChild(fechar);

  painelObra.appendChild(criarLinha('h2', obra.nomeArtistico));

  const metaPartes = [obra.handle, obra.cidade].filter(Boolean);
  if (metaPartes.length > 0) {
    painelObra.appendChild(criarLinha('p', metaPartes.join(' · '), 'hud-meta'));
  }

  if (obra.descricao) {
    painelObra.appendChild(criarLinha('p', obra.descricao, 'hud-descricao'));
  }

  if (obra.url) {
    const link = document.createElement('a');
    link.className = 'hud-link';
    link.href = obra.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'ver mais →';
    painelObra.appendChild(link);
  }
}

export function mostrarObra(obra) {
  renderizarObra(obra);
  painelObra.hidden = false;
}

export function esconderObra() {
  painelObra.hidden = true;
}

painelObra.addEventListener('click', (e) => {
  if (e.target.closest('[data-fechar]')) esconderObra();
});

window.addEventListener('territorio:clique', (e) => {
  const { obra } = e.detail;
  if (obra) mostrarObra(obra); else esconderObra();
});

function atualizarIndicadorZoom() {
  indicadorZoom.textContent = `${Math.round(obterEstado().zoom * 100)}%`;
  requestAnimationFrame(atualizarIndicadorZoom);
}

export function iniciar() {
  atualizarIndicadorZoom();
}
