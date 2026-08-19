// Índice espacial em grid: bucketiza obras por célula e responde
// "quais obras tocam este retângulo" sem varrer a lista inteira. Usado pelo
// viewport (o que desenhar/carregar) e pelo hit-test de áreas densas.
// Puro — recebe a lista de obras, devolve um índice; não sabe de DOM.

import { CONFIG } from '../shared/config.js';
import { bboxOf } from '../shared/geometry.js';

const TAMANHO_CELULA = CONFIG.obra.ladoMaximo * 2;

function chaveCelula(cx, cy) {
  return `${cx}:${cy}`;
}

function celulasDoBbox(box) {
  const cx0 = Math.floor(box.x0 / TAMANHO_CELULA);
  const cy0 = Math.floor(box.y0 / TAMANHO_CELULA);
  const cx1 = Math.floor(box.x1 / TAMANHO_CELULA);
  const cy1 = Math.floor(box.y1 / TAMANHO_CELULA);

  const celulas = [];
  for (let cy = cy0; cy <= cy1; cy += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      celulas.push(chaveCelula(cx, cy));
    }
  }
  return celulas;
}

function intersecta(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function construirIndice(obras) {
  const grade = new Map();

  for (const obra of obras) {
    for (const chave of celulasDoBbox(bboxOf(obra))) {
      if (!grade.has(chave)) grade.set(chave, []);
      grade.get(chave).push(obra);
    }
  }

  function consultarRetangulo(bbox) {
    const encontrados = new Set();
    for (const chave of celulasDoBbox(bbox)) {
      const bucket = grade.get(chave);
      if (!bucket) continue;
      for (const obra of bucket) {
        if (intersecta(bbox, bboxOf(obra))) encontrados.add(obra);
      }
    }
    return [...encontrados].sort((a, b) => a.seq - b.seq);
  }

  return { consultarRetangulo };
}
