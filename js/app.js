// Bootstrap: monta o canvas, carrega o store e liga câmera, render, input,
// hud e router. É o único arquivo que conhece todos os outros — cresce a
// cada bloco (submit-ui.js entra no Bloco 3).

import * as store from './store.js';
import { definirTamanhoTela } from './camera.js';
import { iniciar as iniciarRender } from './render.js';
import { iniciar as iniciarInput } from './input.js';
import { iniciar as iniciarHud } from './hud.js';
import { iniciar as iniciarRouter } from './router.js';

const canvas = document.getElementById('territorio');
const ctx = canvas.getContext('2d');

function redimensionar() {
  const dpr = window.devicePixelRatio || 1;
  const largura = window.innerWidth;
  const altura = window.innerHeight;
  canvas.width = largura * dpr;
  canvas.height = altura * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  definirTamanhoTela(largura, altura);
}

async function iniciarApp() {
  redimensionar();
  window.addEventListener('resize', redimensionar);

  try {
    await store.carregar();
  } catch (erro) {
    console.error('falha ao carregar data/stickers.json', erro);
  }

  iniciarInput(canvas);
  iniciarRender(ctx);
  iniciarHud();
  iniciarRouter();
}

iniciarApp();
