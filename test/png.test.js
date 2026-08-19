import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { validarPng } from '../shared/png.js';
import { CONFIG } from '../shared/config.js';

const ASSINATURA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipoBuf, dados])), 0);
  return Buffer.concat([tamanho, tipoBuf, dados, crc]);
}

function construirPng({ largura = 4, altura = 4, corTipo = 6, chunksExtras = [], omitirIend = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = corTipo;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const bytesPorPixel = corTipo === 6 ? 4 : 3;
  const linhas = [];
  for (let y = 0; y < altura; y += 1) {
    linhas.push(Buffer.alloc(1 + largura * bytesPorPixel));
  }
  const idat = deflateSync(Buffer.concat(linhas));

  const partes = [ASSINATURA, chunk('IHDR', ihdr), chunk('IDAT', idat), ...chunksExtras];
  if (!omitirIend) partes.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(partes);
}

describe('validarPng', () => {
  test('PNG RGBA válido não gera erros', () => {
    assert.deepEqual(validarPng(construirPng({ corTipo: 6 })), []);
  });

  test('PNG sem alfa (RGB) é inválido', () => {
    assert.ok(validarPng(construirPng({ corTipo: 2 })).includes('sem_alfa'));
  });

  test('dimensões maiores que o limite são inválidas', () => {
    const grande = CONFIG.obra.ladoMaximoPx + 1;
    assert.ok(validarPng(construirPng({ largura: grande })).includes('dimensoes_invalidas'));
  });

  test('IHDR com tamanho declarado errado é rejeitado, não lido com índices deslocados', () => {
    const assinatura = ASSINATURA;
    const ihdrCurto = chunk('IHDR', Buffer.alloc(8)); // válido teria 13 bytes
    const idat = chunk('IDAT', deflateSync(Buffer.alloc(1 + 4 * 4)));
    const iend = chunk('IEND', Buffer.alloc(0));
    const png = Buffer.concat([assinatura, ihdrCurto, idat, iend]);

    const erros = validarPng(png);
    assert.ok(erros.includes('ihdr_invalido'));
    assert.ok(erros.includes('ihdr_ausente'));
    assert.ok(!erros.includes('sem_alfa') && !erros.includes('dimensoes_invalidas'));
  });

  test('chunk fora da allowlist (tEXt) é rejeitado', () => {
    const textoChunk = chunk('tEXt', Buffer.from('comentario\0oi'));
    const erros = validarPng(construirPng({ chunksExtras: [textoChunk] }));
    assert.ok(erros.some((e) => e.startsWith('chunk_nao_permitido:tEXt')));
  });

  test('bytes depois do IEND são rejeitados', () => {
    const png = construirPng();
    const comLixo = Buffer.concat([png, Buffer.from([1, 2, 3])]);
    assert.ok(validarPng(comLixo).includes('bytes_apos_iend'));
  });

  test('arquivo truncado é rejeitado', () => {
    const png = construirPng();
    const truncado = png.subarray(0, png.length - 10);
    assert.ok(validarPng(truncado).includes('arquivo_truncado'));
  });

  test('assinatura inválida é rejeitada imediatamente', () => {
    assert.deepEqual(validarPng(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])), ['assinatura_invalida']);
  });
});
