// Câmera do território: transforma coordenadas de mundo em coordenadas de
// tela e vice-versa, e mantém o zoom e a posição dentro dos limites.
// Estado de módulo único — há só uma câmera por página, como store.js.

import { CONFIG } from '../shared/config.js';

const { largura: TERRITORIO_LARGURA, altura: TERRITORIO_ALTURA, margemCamera, zoomMin, zoomMax } = CONFIG.territorio;

const estado = {
  x: TERRITORIO_LARGURA / 2,
  y: TERRITORIO_ALTURA / 2,
  zoom: 1,
  larguraTela: 0,
  alturaTela: 0,
};

function clampPosicao() {
  const meiaLarguraMundo = estado.larguraTela / 2 / estado.zoom;
  const meiaAlturaMundo = estado.alturaTela / 2 / estado.zoom;

  const minX = -margemCamera + meiaLarguraMundo;
  const maxX = TERRITORIO_LARGURA + margemCamera - meiaLarguraMundo;
  const minY = -margemCamera + meiaAlturaMundo;
  const maxY = TERRITORIO_ALTURA + margemCamera - meiaAlturaMundo;

  estado.x = minX <= maxX ? Math.min(Math.max(estado.x, minX), maxX) : TERRITORIO_LARGURA / 2;
  estado.y = minY <= maxY ? Math.min(Math.max(estado.y, minY), maxY) : TERRITORIO_ALTURA / 2;
}

export function definirTamanhoTela(largura, altura) {
  estado.larguraTela = largura;
  estado.alturaTela = altura;
  clampPosicao();
}

export function worldToScreen(ponto) {
  return {
    x: (ponto.x - estado.x) * estado.zoom + estado.larguraTela / 2,
    y: (ponto.y - estado.y) * estado.zoom + estado.alturaTela / 2,
  };
}

export function screenToWorld(ponto) {
  return {
    x: (ponto.x - estado.larguraTela / 2) / estado.zoom + estado.x,
    y: (ponto.y - estado.alturaTela / 2) / estado.zoom + estado.y,
  };
}

export function mover(deltaTelaX, deltaTelaY) {
  estado.x -= deltaTelaX / estado.zoom;
  estado.y -= deltaTelaY / estado.zoom;
  clampPosicao();
}

// Aplica `novoZoom` mantendo fixo, na tela, o ponto de mundo que hoje está
// sob `focoTela` — é o que faz o zoom "seguir o cursor" em vez de recentralizar.
export function zoomEm(novoZoom, focoTela) {
  if (!Number.isFinite(novoZoom)) return; // ex.: pinch com os dois dedos no mesmo ponto (distância 0)

  const zoomAnterior = estado.zoom;
  const alvo = Math.min(Math.max(novoZoom, zoomMin), zoomMax);
  if (alvo === zoomAnterior) return;

  const mundoSobCursor = screenToWorld(focoTela);
  estado.zoom = alvo;
  estado.x = mundoSobCursor.x - (focoTela.x - estado.larguraTela / 2) / estado.zoom;
  estado.y = mundoSobCursor.y - (focoTela.y - estado.alturaTela / 2) / estado.zoom;
  clampPosicao();
}

export function centralizarEm(pontoMundo, zoom = estado.zoom) {
  estado.zoom = Math.min(Math.max(zoom, zoomMin), zoomMax);
  estado.x = pontoMundo.x;
  estado.y = pontoMundo.y;
  clampPosicao();
}

export function obterEstado() {
  return { x: estado.x, y: estado.y, zoom: estado.zoom };
}

export function obterTamanhoTela() {
  return { largura: estado.larguraTela, altura: estado.alturaTela };
}
