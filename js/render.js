// Loop de desenho do território. Revisão do item 20: só desenha (e só
// carrega) o que está dentro do viewport, consultando o índice espacial em
// vez de varrer todas as obras — é a mitigação do gargalo de banda de A.11.
// Ordem de desenho: seq crescente (consultarRetangulo já devolve nessa
// ordem), para que obras mais recentes fiquem por cima das mais antigas.

import * as store from './store.js';
import { worldToScreen, screenToWorld, obterEstado, obterTamanhoTela } from './camera.js';
import { construirIndice } from './spatial.js';
import { obterImagem } from './loader.js';

const corFundo = getComputedStyle(document.documentElement).getPropertyValue('--cor-fundo').trim() || '#16171a';
const corPlaceholder = getComputedStyle(document.documentElement).getPropertyValue('--cor-superficie-alta').trim() || '#29292e';

let indice = null;

function bboxViewportMundo() {
  const { largura, altura } = obterTamanhoTela();
  const cantoSuperiorEsquerdo = screenToWorld({ x: 0, y: 0 });
  const cantoInferiorDireito = screenToWorld({ x: largura, y: altura });
  return {
    x0: cantoSuperiorEsquerdo.x,
    y0: cantoSuperiorEsquerdo.y,
    x1: cantoInferiorDireito.x,
    y1: cantoInferiorDireito.y,
  };
}

function desenharObra(ctx, obra, zoom) {
  const cantoSuperiorEsquerdo = worldToScreen({ x: obra.x, y: obra.y });
  const larguraTela = obra.width * zoom;
  const alturaTela = obra.height * zoom;

  const entrada = obterImagem(obra);
  if (entrada.estado === 'pronta') {
    ctx.drawImage(entrada.imagem, cantoSuperiorEsquerdo.x, cantoSuperiorEsquerdo.y, larguraTela, alturaTela);
  } else {
    ctx.fillStyle = corPlaceholder;
    ctx.fillRect(cantoSuperiorEsquerdo.x, cantoSuperiorEsquerdo.y, larguraTela, alturaTela);
  }
}

function desenharQuadro(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = corFundo;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  const { zoom } = obterEstado();
  const visiveis = indice.consultarRetangulo(bboxViewportMundo());
  for (const obra of visiveis) {
    desenharObra(ctx, obra, zoom);
  }
}

export function iniciar(ctx) {
  indice = construirIndice(store.all());

  function quadro() {
    desenharQuadro(ctx);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}
