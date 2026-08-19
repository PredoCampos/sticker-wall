// Geometria pura: nenhuma dependência de DOM ou rede, para ser importável
// pelo frontend, pelo Worker e pelos testes por igual.
// Uma obra é {x, y, width, height} em coordenadas de mundo (x, y = canto
// superior esquerdo).

import { CONFIG } from './config.js';

export function bboxOf(obra) {
  return {
    x0: obra.x,
    y0: obra.y,
    x1: obra.x + obra.width,
    y1: obra.y + obra.height,
  };
}

function areaDe(obra) {
  return obra.width * obra.height;
}

function areaIntersecao(a, b) {
  const boxA = bboxOf(a);
  const boxB = bboxOf(b);
  const largura = Math.min(boxA.x1, boxB.x1) - Math.max(boxA.x0, boxB.x0);
  const altura = Math.min(boxA.y1, boxB.y1) - Math.max(boxA.y0, boxB.y0);
  if (largura <= 0 || altura <= 0) return 0;
  return largura * altura;
}

// Fração da área de `a` que fica coberta por `b`. Não é simétrica:
// coverage(a, b) e coverage(b, a) podem ser diferentes quando as áreas
// diferem — por isso conflitos() checa as duas direções.
export function coverage(a, b) {
  const areaA = areaDe(a);
  if (areaA <= 0) return 0;
  return areaIntersecao(a, b) / areaA;
}

// Obras existentes que conflitam com `candidata`: a interseção cobre mais
// que `limiar` da área de qualquer um dos dois lados (a regra dos 50%).
// Tangência e ausência de interseção resultam em área 0, logo nunca conflitam.
export function conflitos(candidata, existentes, limiar = CONFIG.sobreposicao.limiar) {
  return existentes.filter((existente) => (
    coverage(candidata, existente) > limiar || coverage(existente, candidata) > limiar
  ));
}

export function dentroDosLimites(obra, limites = CONFIG.territorio) {
  const box = bboxOf(obra);
  return box.x0 >= 0 && box.y0 >= 0 && box.x1 <= limites.largura && box.y1 <= limites.altura;
}
