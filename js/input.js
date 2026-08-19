// Pan por arraste, zoom por roda e pinça, hit-test em ordem decrescente de
// seq. Usa Pointer Events para tratar mouse e toque com o mesmo código; o
// pan de dois dedos e o pinch-zoom são compostos no mesmo gesto.
//
// Não conhece hud.js nem router.js — ao detectar um clique/toque real (sem
// arrasto), dispara um CustomEvent `territorio:clique` em window com a obra
// tocada (ou null, se foi área vazia). hud.js escuta esse evento.

import * as store from './store.js';
import { bboxOf } from '../shared/geometry.js';
import { screenToWorld, mover, zoomEm, obterEstado } from './camera.js';

const LIMIAR_CLIQUE_PX = 6;
const SENSIBILIDADE_RODA = 0.0015;
const DISTANCIA_MINIMA_PINCH = 8;

function contemPonto(obra, pontoMundo) {
  const box = bboxOf(obra);
  return pontoMundo.x >= box.x0 && pontoMundo.x <= box.x1
    && pontoMundo.y >= box.y0 && pontoMundo.y <= box.y1;
}

// Obras mais recentes (seq maior) são desenhadas por cima — store.all() vem
// ordenado crescente, então percorrer de trás para frente já dá a ordem
// decrescente de seq que o hit-test precisa.
export function obraSobPonto(pontoTela) {
  const pontoMundo = screenToWorld(pontoTela);
  const obras = store.all();
  for (let i = obras.length - 1; i >= 0; i -= 1) {
    if (contemPonto(obras[i], pontoMundo)) return obras[i];
  }
  return null;
}

function distanciaEntre(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function meioEntre(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function iniciar(canvas) {
  const pointers = new Map();
  let gesto = null;
  let pontoInicialClique = null;
  let arrastouBastante = false;

  function pontoRelativo(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function capturarGesto() {
    const pts = [...pointers.values()];
    if (pts.length === 1) {
      gesto = { tipo: 'pan', ponto: pts[0] };
    } else if (pts.length === 2) {
      gesto = { tipo: 'pinch', meio: meioEntre(pts[0], pts[1]), distancia: distanciaEntre(pts[0], pts[1]) };
    } else {
      gesto = null;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const ponto = pontoRelativo(e);
    pointers.set(e.pointerId, ponto);

    if (pointers.size === 1) {
      pontoInicialClique = ponto;
      arrastouBastante = false;
    } else {
      arrastouBastante = true; // segundo dedo: nunca é clique
    }

    document.body.classList.add('arrastando');
    capturarGesto();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const ponto = pontoRelativo(e);
    pointers.set(e.pointerId, ponto);

    if (pontoInicialClique && distanciaEntre(ponto, pontoInicialClique) > LIMIAR_CLIQUE_PX) {
      arrastouBastante = true;
    }

    const pts = [...pointers.values()];
    if (pts.length === 1 && gesto?.tipo === 'pan') {
      mover(ponto.x - gesto.ponto.x, ponto.y - gesto.ponto.y);
      gesto = { tipo: 'pan', ponto };
    } else if (pts.length === 2 && gesto?.tipo === 'pinch') {
      const meio = meioEntre(pts[0], pts[1]);
      const distancia = distanciaEntre(pts[0], pts[1]);
      mover(meio.x - gesto.meio.x, meio.y - gesto.meio.y);
      // dedos quase no mesmo ponto tornam a razão de distâncias instável
      // (perto de divisão por zero) — só aplica o zoom acima desse piso.
      if (distancia > DISTANCIA_MINIMA_PINCH && gesto.distancia > DISTANCIA_MINIMA_PINCH) {
        zoomEm(obterEstado().zoom * (distancia / gesto.distancia), meio);
      }
      gesto = { tipo: 'pinch', meio, distancia };
    }
  });

  function finalizarPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const foiClique = pointers.size === 1 && !arrastouBastante;
    const ponto = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);

    if (pointers.size === 0) {
      document.body.classList.remove('arrastando');
    }
    capturarGesto();

    if (foiClique) {
      window.dispatchEvent(new CustomEvent('territorio:clique', { detail: { obra: obraSobPonto(ponto) } }));
    }
  }

  canvas.addEventListener('pointerup', finalizarPointer);
  canvas.addEventListener('pointercancel', finalizarPointer);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const foco = pontoRelativo(e);
    const fator = Math.exp(-e.deltaY * SENSIBILIDADE_RODA);
    zoomEm(obterEstado().zoom * fator, foco);
  }, { passive: false });
}
