import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { bboxOf, coverage, conflitos, dentroDosLimites } from '../shared/geometry.js';
import { CONFIG } from '../shared/config.js';

describe('bboxOf', () => {
  test('deriva os limites a partir de x, y, width, height', () => {
    const obra = { x: 10, y: 20, width: 30, height: 40 };
    assert.deepEqual(bboxOf(obra), { x0: 10, y0: 20, x1: 40, y1: 60 });
  });
});

describe('conflitos — regra dos 50%', () => {
  const candidata = { x: 0, y: 0, width: 100, height: 100 };

  test('sem interseção não conflita', () => {
    const existente = { x: 200, y: 200, width: 50, height: 50 };
    assert.equal(conflitos(candidata, [existente]).length, 0);
  });

  test('tangente (bordas encostando, área de interseção zero) não conflita', () => {
    const existente = { x: 100, y: 0, width: 50, height: 100 };
    assert.equal(coverage(candidata, existente), 0);
    assert.equal(conflitos(candidata, [existente]).length, 0);
  });

  test('49% de cobertura não conflita', () => {
    const existente = { x: 0, y: 51, width: 100, height: 100 };
    assert.equal(coverage(candidata, existente), 0.49);
    assert.equal(conflitos(candidata, [existente]).length, 0);
  });

  test('51% de cobertura conflita', () => {
    const existente = { x: 0, y: 49, width: 100, height: 100 };
    assert.equal(coverage(candidata, existente), 0.51);
    assert.equal(conflitos(candidata, [existente]).length, 1);
  });

  test('obra inteiramente contida na outra conflita', () => {
    const existente = { x: 25, y: 25, width: 10, height: 10 };
    assert.equal(coverage(existente, candidata), 1);
    assert.equal(conflitos(candidata, [existente]).length, 1);
  });

  test('obras idênticas conflitam', () => {
    const existente = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(conflitos(candidata, [existente]).length, 1);
  });
});

describe('dentroDosLimites', () => {
  test('obra dentro do território está dentro dos limites', () => {
    const obra = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(dentroDosLimites(obra), true);
  });

  test('obra que ultrapassa a borda direita ou inferior fica fora', () => {
    const obra = { x: CONFIG.territorio.largura - 10, y: 0, width: 100, height: 100 };
    assert.equal(dentroDosLimites(obra), false);
  });

  test('obra com coordenada negativa fica fora', () => {
    const obra = { x: -1, y: 0, width: 10, height: 10 };
    assert.equal(dentroDosLimites(obra), false);
  });
});
