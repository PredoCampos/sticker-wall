// Validação de um objeto sticker: chaves permitidas, tipos, tamanhos de
// texto, coordenadas, URL só https:. Não depende de geometry.js — geometria
// e forma dos dados são preocupações separadas (ver B.3).

import { CONFIG } from './config.js';

// seq não é um campo armazenado — build-index.mjs o calcula a partir da
// ordem de enviadoEm (ver scripts/build-index.mjs). Um inteiro gravado no
// arquivo-fonte exigiria coordenação entre PRs concorrentes para não colidir;
// um timestamp atribuído pelo Worker no momento do envio não exige nada.
const CHAVES_PERMITIDAS = new Set([
  'id', 'enviadoEm', 'x', 'y', 'width', 'height',
  'nomeArtistico', 'handle', 'cidade', 'descricao', 'url',
  'autoriaDeclarada',
]);

const CHAVES_OBRIGATORIAS = [
  'id', 'enviadoEm', 'x', 'y', 'width', 'height', 'nomeArtistico', 'autoriaDeclarada',
];

const ID_RE = /^[0-9a-f]{8}$/;

function numeroFinito(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function textoDentroDoLimite(v, max) {
  return typeof v === 'string' && v.length <= max;
}

// Retorna a lista de códigos de erro encontrados; array vazio = válido.
export function validarSticker(sticker) {
  const erros = [];

  if (typeof sticker !== 'object' || sticker === null || Array.isArray(sticker)) {
    return ['sticker_invalido'];
  }

  for (const chave of Object.keys(sticker)) {
    if (!CHAVES_PERMITIDAS.has(chave)) erros.push(`chave_nao_permitida:${chave}`);
  }

  for (const chave of CHAVES_OBRIGATORIAS) {
    if (!(chave in sticker)) erros.push(`chave_obrigatoria_ausente:${chave}`);
  }

  if ('id' in sticker && !ID_RE.test(sticker.id)) erros.push('id_invalido');

  if ('enviadoEm' in sticker) {
    const valor = sticker.enviadoEm;
    if (typeof valor !== 'string' || Number.isNaN(Date.parse(valor))) {
      erros.push('enviadoEm_invalido');
    }
  }

  if ('x' in sticker && !numeroFinito(sticker.x)) erros.push('x_invalido');
  if ('y' in sticker && !numeroFinito(sticker.y)) erros.push('y_invalido');

  if ('width' in sticker) {
    const { ladoMinimo, ladoMaximo } = CONFIG.obra;
    if (!numeroFinito(sticker.width) || sticker.width < ladoMinimo || sticker.width > ladoMaximo) {
      erros.push('width_invalido');
    }
  }

  if ('height' in sticker) {
    const { ladoMinimo, ladoMaximo } = CONFIG.obra;
    if (!numeroFinito(sticker.height) || sticker.height < ladoMinimo || sticker.height > ladoMaximo) {
      erros.push('height_invalido');
    }
  }

  if ('nomeArtistico' in sticker) {
    const nome = sticker.nomeArtistico;
    if (typeof nome !== 'string' || nome.trim().length === 0 || nome.length > CONFIG.texto.nomeArtisticoMax) {
      erros.push('nomeArtistico_invalido');
    }
  }

  if ('handle' in sticker && !textoDentroDoLimite(sticker.handle, CONFIG.texto.handleMax)) {
    erros.push('handle_invalido');
  }

  if ('cidade' in sticker && !textoDentroDoLimite(sticker.cidade, CONFIG.texto.cidadeMax)) {
    erros.push('cidade_invalido');
  }

  if ('descricao' in sticker && !textoDentroDoLimite(sticker.descricao, CONFIG.texto.descricaoMax)) {
    erros.push('descricao_invalido');
  }

  if ('url' in sticker) {
    const url = sticker.url;
    if (typeof url !== 'string' || url.length > CONFIG.texto.urlMax || !url.startsWith('https://')) {
      erros.push('url_invalido');
    }
  }

  if ('autoriaDeclarada' in sticker && sticker.autoriaDeclarada !== true) {
    erros.push('autoriaDeclarada_invalido');
  }

  return erros;
}

export function stickerValido(sticker) {
  return validarSticker(sticker).length === 0;
}
