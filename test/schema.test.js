import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validarSticker, stickerValido } from '../shared/schema.js';
import { CONFIG } from '../shared/config.js';

function stickerValidoBase() {
  return {
    id: 'a1b2c3d4',
    enviadoEm: '2026-08-18T12:00:00.000Z',
    x: 100,
    y: 100,
    width: 128,
    height: 128,
    nomeArtistico: 'Artista Teste',
    handle: '@artista',
    cidade: 'São Paulo',
    descricao: 'Uma descrição qualquer.',
    url: 'https://example.com',
    autoriaDeclarada: true,
  };
}

describe('validarSticker — caso válido', () => {
  test('objeto completo e correto não gera erros', () => {
    assert.deepEqual(validarSticker(stickerValidoBase()), []);
    assert.equal(stickerValido(stickerValidoBase()), true);
  });

  test('campos opcionais podem estar ausentes', () => {
    const sticker = stickerValidoBase();
    delete sticker.handle;
    delete sticker.cidade;
    delete sticker.descricao;
    delete sticker.url;
    assert.deepEqual(validarSticker(sticker), []);
  });
});

describe('validarSticker — entrada não é um objeto', () => {
  test('null, array e string são rejeitados', () => {
    assert.deepEqual(validarSticker(null), ['sticker_invalido']);
    assert.deepEqual(validarSticker([]), ['sticker_invalido']);
    assert.deepEqual(validarSticker('sticker'), ['sticker_invalido']);
  });
});

describe('validarSticker — chaves', () => {
  test('chave desconhecida é rejeitada', () => {
    const sticker = { ...stickerValidoBase(), foo: 'bar' };
    assert.ok(validarSticker(sticker).includes('chave_nao_permitida:foo'));
  });

  test('chave obrigatória ausente é reportada e não gera erro duplicado', () => {
    const sticker = stickerValidoBase();
    delete sticker.width;
    const erros = validarSticker(sticker);
    assert.ok(erros.includes('chave_obrigatoria_ausente:width'));
    assert.ok(!erros.includes('width_invalido'));
  });
});

describe('validarSticker — id', () => {
  test('id com maiúsculas ou tamanho errado é inválido', () => {
    assert.ok(validarSticker({ ...stickerValidoBase(), id: 'ABCD1234' }).includes('id_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), id: 'a1b2c3' }).includes('id_invalido'));
  });
});

describe('validarSticker — enviadoEm', () => {
  test('precisa ser uma data válida em string', () => {
    assert.ok(validarSticker({ ...stickerValidoBase(), enviadoEm: 'não é uma data' }).includes('enviadoEm_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), enviadoEm: 1755518400000 }).includes('enviadoEm_invalido'));
  });
});

describe('validarSticker — coordenadas', () => {
  test('x e y devem ser números finitos', () => {
    assert.ok(validarSticker({ ...stickerValidoBase(), x: NaN }).includes('x_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), x: Infinity }).includes('x_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), y: '10' }).includes('y_invalido'));
  });
});

describe('validarSticker — dimensões', () => {
  test('width e height respeitam os limites de CONFIG.obra', () => {
    const { ladoMinimo, ladoMaximo } = CONFIG.obra;
    assert.ok(validarSticker({ ...stickerValidoBase(), width: ladoMinimo - 1 }).includes('width_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), width: ladoMaximo + 1 }).includes('width_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), height: ladoMinimo - 1 }).includes('height_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), height: ladoMaximo + 1 }).includes('height_invalido'));
  });
});

describe('validarSticker — textos', () => {
  test('nomeArtistico vazio, muito longo ou não-string é inválido', () => {
    assert.ok(validarSticker({ ...stickerValidoBase(), nomeArtistico: '' }).includes('nomeArtistico_invalido'));
    assert.ok(validarSticker({
      ...stickerValidoBase(),
      nomeArtistico: 'x'.repeat(CONFIG.texto.nomeArtisticoMax + 1),
    }).includes('nomeArtistico_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), nomeArtistico: 42 }).includes('nomeArtistico_invalido'));
  });

  test('handle acima do limite é inválido', () => {
    const sticker = { ...stickerValidoBase(), handle: 'x'.repeat(CONFIG.texto.handleMax + 1) };
    assert.ok(validarSticker(sticker).includes('handle_invalido'));
  });

  test('cidade acima do limite é inválida', () => {
    const sticker = { ...stickerValidoBase(), cidade: 'x'.repeat(CONFIG.texto.cidadeMax + 1) };
    assert.ok(validarSticker(sticker).includes('cidade_invalido'));
  });

  test('descrição acima do limite é inválida', () => {
    const sticker = { ...stickerValidoBase(), descricao: 'x'.repeat(CONFIG.texto.descricaoMax + 1) };
    assert.ok(validarSticker(sticker).includes('descricao_invalido'));
  });
});

describe('validarSticker — url', () => {
  test('url que não começa com https:// é inválida', () => {
    assert.ok(validarSticker({ ...stickerValidoBase(), url: 'http://example.com' }).includes('url_invalido'));
  });

  test('url acima do limite de tamanho é inválida', () => {
    const url = `https://example.com/${'x'.repeat(CONFIG.texto.urlMax)}`;
    assert.ok(validarSticker({ ...stickerValidoBase(), url }).includes('url_invalido'));
  });
});

describe('validarSticker — autoria declarada', () => {
  test('autoriaDeclarada precisa ser exatamente true', () => {
    assert.ok(validarSticker({ ...stickerValidoBase(), autoriaDeclarada: false }).includes('autoriaDeclarada_invalido'));
    assert.ok(validarSticker({ ...stickerValidoBase(), autoriaDeclarada: 'true' }).includes('autoriaDeclarada_invalido'));
  });
});
