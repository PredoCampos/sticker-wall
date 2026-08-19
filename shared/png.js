// Validação estrutural de PNG: assinatura, IHDR, allowlist de chunks, IEND
// no fim exato. Não decodifica pixels (isso é sharp, em normalize.mjs) — só
// verifica que o arquivo tem a forma de um PNG que image-prep.js poderia ter
// gerado, antes do Worker aceitar o upload. Roda tanto no Worker (sem
// node:zlib disponível) quanto em testes Node, por isso não decodifica IDAT.

import { CONFIG } from './config.js';

const ASSINATURA = [137, 80, 78, 71, 13, 10, 26, 10];
const CHUNKS_PERMITIDOS = new Set(['IHDR', 'IDAT', 'IEND']);

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

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Retorna a lista de códigos de erro encontrados; array vazio = válido.
export function validarPng(entrada) {
  const bytes = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);

  if (bytes.length < 8 || !ASSINATURA.every((b, i) => bytes[i] === b)) {
    return ['assinatura_invalida'];
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const erros = [];
  let offset = 8;
  let primeiro = true;
  let viuIend = false;
  let ihdr = null;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      erros.push('arquivo_truncado');
      break;
    }

    const tamanho = view.getUint32(offset, false);
    const tipo = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const inicioDados = offset + 8;
    const fimDados = inicioDados + tamanho;
    const fimChunk = fimDados + 4;

    if (fimChunk > bytes.length) {
      erros.push('arquivo_truncado');
      break;
    }

    if (primeiro && tipo !== 'IHDR') erros.push('ihdr_ausente');
    primeiro = false;

    if (!CHUNKS_PERMITIDOS.has(tipo)) erros.push(`chunk_nao_permitido:${tipo}`);

    const crcLido = view.getUint32(fimDados, false);
    const crcEsperado = crc32(bytes.subarray(offset + 4, fimDados));
    if (crcLido !== crcEsperado) erros.push(`crc_invalido:${tipo}`);

    if (tipo === 'IHDR') {
      // IHDR sempre tem 13 bytes de dados. Sem checar isso, um tamanho
      // declarado menor faria os índices fixos abaixo lerem bytes de fora
      // dos dados do IHDR (o CRC do próprio chunk, ou o chunk seguinte) —
      // ainda dentro do buffer, então sem erro, só com valores de lixo que
      // por acaso poderiam passar nas checagens de profundidade/corTipo.
      if (tamanho !== 13) {
        erros.push('ihdr_invalido');
      } else {
        ihdr = {
          largura: view.getUint32(inicioDados, false),
          altura: view.getUint32(inicioDados + 4, false),
          profundidade: bytes[inicioDados + 8],
          corTipo: bytes[inicioDados + 9],
        };
      }
    }

    offset = fimChunk;
    if (tipo === 'IEND') {
      viuIend = true;
      break;
    }
  }

  if (!ihdr) {
    erros.push('ihdr_ausente');
  } else {
    const { largura, altura, profundidade, corTipo } = ihdr;
    if (largura <= 0 || altura <= 0 || largura > CONFIG.obra.ladoMaximoPx || altura > CONFIG.obra.ladoMaximoPx) {
      erros.push('dimensoes_invalidas');
    }
    if (profundidade !== 8) erros.push('profundidade_invalida');
    if (corTipo !== 6) erros.push('sem_alfa');
  }

  if (!viuIend) {
    erros.push('iend_ausente');
  } else if (offset !== bytes.length) {
    erros.push('bytes_apos_iend');
  }

  return erros;
}
