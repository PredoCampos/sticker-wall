// Renormaliza obras já commitadas em data/stickers/ e stickers/: revalida a
// estrutura do PNG, decodifica com sharp (decodificação falha = processo
// falha, e falhar aqui é o que bloqueia o PR via o check `normalize` — ver
// .github/workflows/normalize.yml), confirma que a imagem tem transparência
// real (mesma checagem de js/image-prep.js, repetida aqui porque o
// navegador pode ser contornado), redimensiona para caber em
// CONFIG.obra.ladoMaximoPx e recodifica sem metadados. width/height no JSON
// são sobrescritos com as dimensões reais do PNG final — nunca confiar no
// que o cliente declarou.
//
// `node scripts/normalize.mjs <id...>` processa só os ids passados (é como
// o workflow chama, com os ids alterados no PR). Sem argumentos, processa
// tudo em data/stickers/ — útil para reprocessar depois de mudar
// CONFIG.obra.ladoMaximoPx, por exemplo.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

import { CONFIG } from '../shared/config.js';
import { validarSticker } from '../shared/schema.js';
import { validarPng } from '../shared/png.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_DADOS = path.join(RAIZ, 'data', 'stickers');
const DIR_STICKERS = path.join(RAIZ, 'stickers');

async function idsDeTodasAsObras() {
  try {
    return (await readdir(DIR_DADOS)).filter((n) => n.endsWith('.json')).map((n) => path.basename(n, '.json'));
  } catch (erro) {
    if (erro.code === 'ENOENT') return [];
    throw erro;
  }
}

function temPixelNaoOpaco(dataRgba) {
  for (let i = 3; i < dataRgba.length; i += 4) {
    if (dataRgba[i] < 255) return true;
  }
  return false;
}

const CHUNKS_MANTIDOS = new Set(['IHDR', 'IDAT', 'IEND']);

// sharp grava um pHYs no PNG de saída por padrão (resolução default da
// libvips, mesmo quando a imagem de origem não tinha nenhum), e shared/png.js
// só permite IHDR/IDAT/IEND — é o que canvas.toBlob('image/png') produz no
// navegador (ver js/image-prep.js). Em vez de afrouxar uma validação já
// testada dos dois lados (cliente e Worker), removemos aqui qualquer chunk
// fora dessa allowlist antes de gravar o PNG final.
function removerChunksNaoPermitidos(bytes) {
  const partes = [bytes.subarray(0, 8)]; // assinatura
  let offset = 8;
  while (offset < bytes.length) {
    const tamanho = bytes.readUInt32BE(offset);
    const tipo = bytes.toString('ascii', offset + 4, offset + 8);
    const fimChunk = offset + 8 + tamanho + 4;
    if (CHUNKS_MANTIDOS.has(tipo)) partes.push(bytes.subarray(offset, fimChunk));
    offset = fimChunk;
    if (tipo === 'IEND') break;
  }
  return Buffer.concat(partes);
}

async function normalizarObra(id) {
  const caminhoJson = path.join(DIR_DADOS, `${id}.json`);
  const caminhoPng = path.join(DIR_STICKERS, `${id}.png`);

  let sticker;
  let pngOriginal;
  try {
    sticker = JSON.parse(await readFile(caminhoJson, 'utf8'));
    pngOriginal = await readFile(caminhoPng);
  } catch {
    return [`${id}: data/stickers/${id}.json ou stickers/${id}.png não encontrado`];
  }

  const errosEstruturais = validarPng(pngOriginal);
  if (errosEstruturais.length > 0) {
    return errosEstruturais.map((e) => `${id}: ${e}`);
  }

  let bruto;
  try {
    const { width, height } = await sharp(pngOriginal).metadata();
    const maiorLado = Math.max(width, height);
    const escala = Math.min(1, CONFIG.obra.ladoMaximoPx / maiorLado);
    const larguraFinal = Math.max(1, Math.round(width * escala));
    const alturaFinal = Math.max(1, Math.round(height * escala));

    bruto = await sharp(pngOriginal)
      .resize(larguraFinal, alturaFinal, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (erro) {
    return [`${id}: falha ao decodificar a imagem (${erro.message})`];
  }

  const { data, info } = bruto;
  if (!temPixelNaoOpaco(data)) {
    return [`${id}: sem_transparencia_real`];
  }

  const pngBruto = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
  const pngFinal = removerChunksNaoPermitidos(pngBruto);

  // Revalida o PNG que sharp acabou de gerar contra a mesma estrutura que o
  // Worker exige na entrada — garante que a saída deste script nunca viola
  // a invariante que o resto do sistema já assume em toda parte.
  const errosPngFinal = validarPng(pngFinal);
  if (errosPngFinal.length > 0) {
    return errosPngFinal.map((e) => `${id}: pos_normalizacao:${e}`);
  }

  const stickerCorrigido = { ...sticker, width: info.width, height: info.height };
  const errosSchema = validarSticker(stickerCorrigido);
  if (errosSchema.length > 0) {
    return errosSchema.map((e) => `${id}: ${e}`);
  }

  await writeFile(caminhoJson, `${JSON.stringify(stickerCorrigido, null, 2)}\n`);
  await writeFile(caminhoPng, pngFinal);

  console.log(`normalizado: ${id} (${info.width}x${info.height})`);
  return [];
}

async function main() {
  const ids = process.argv.length > 2 ? process.argv.slice(2) : await idsDeTodasAsObras();

  if (ids.length === 0) {
    console.log('nenhuma obra para normalizar.');
    return;
  }

  const erros = [];
  for (const id of ids) {
    erros.push(...(await normalizarObra(id)));
  }

  if (erros.length > 0) {
    throw new Error(`normalização falhou:\n  ${erros.join('\n  ')}`);
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
