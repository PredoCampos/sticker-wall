// Gera obras de teste para desenvolvimento local: um JSON em data/stickers/
// e um PNG com alfa em stickers/ para cada uma. Não depende de sharp —
// escreve o PNG manualmente (assinatura + IHDR + IDAT + IEND) usando só
// node:zlib, para que `npm run seed` funcione sem npm install.
//
// Algumas obras são posicionadas de propósito para se sobrepor (regra dos
// 50% de geometry.js), como pede o item 8 do Bloco 1 — útil para testar a
// navegação e o hit-test contra vizinhos conflitantes.

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CONFIG } from '../shared/config.js';
import { validarSticker } from '../shared/schema.js';
import { conflitos } from '../shared/geometry.js';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIR_JSON = path.join(RAIZ, '..', 'data', 'stickers');
const DIR_PNG = path.join(RAIZ, '..', 'stickers');

const QUANTIDADE = 30;
const QUANTIDADE_PARES_SOBREPOSTOS = 3;

// --- PNG mínimo, sem dependências -----------------------------------------

const CRC_TABELA = (() => {
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
    c = CRC_TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
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

// Gera um PNG RGBA 8 bits: um blob elíptico opaco sobre fundo transparente,
// para que a obra tenha pixels não-opacos de verdade (não é um retângulo cheio).
function pngBlobEliptico(largura, altura, [r, g, b]) {
  const linhas = [];
  const cx = largura / 2;
  const cy = altura / 2;
  for (let y = 0; y < altura; y += 1) {
    const linha = Buffer.alloc(1 + largura * 4);
    linha[0] = 0; // sem filtro
    for (let x = 0; x < largura; x += 1) {
      const nx = (x + 0.5 - cx) / cx;
      const ny = (y + 0.5 - cy) / cy;
      const dentro = nx * nx + ny * ny <= 1;
      const offset = 1 + x * 4;
      linha[offset] = r;
      linha[offset + 1] = g;
      linha[offset + 2] = b;
      linha[offset + 3] = dentro ? 255 : 0;
    }
    linhas.push(linha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const bruto = Buffer.concat(linhas);
  const idat = deflateSync(bruto);

  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    assinatura,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- geração das obras -----------------------------------------------------

const NOMES = [
  'Zinco', 'Aurora Beco', 'Rasgo', 'Maré Cheia', 'Concreto Mole', 'Vira-Lata',
  'Fumaça Preta', 'Girassol de Asfalto', 'Ladrilho', 'Corvo Neon', 'Poeira Fina',
  'Selva de Pedra', 'Lambreta', 'Marola', 'Grafite Azul', 'Tijolo Cru',
];
const CIDADES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Recife', 'Curitiba', 'Salvador', 'Porto Alegre'];
const DESCRICOES = [
  'Feito numa tarde de domingo.',
  'Primeira obra colada no território.',
  'Homenagem ao muro da esquina de casa.',
  'Testando cor e forma antes de ir pra rua de verdade.',
  '',
];

function aleatorioEntre(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function itemAleatorio(lista) {
  return lista[aleatorioEntre(0, lista.length - 1)];
}

function corAleatoria() {
  const h = Math.random();
  const s = 0.55 + Math.random() * 0.35;
  const l = 0.4 + Math.random() * 0.25;
  return hslParaRgb(h, s, l);
}

function hslParaRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function gerarId() {
  return randomBytes(4).toString('hex');
}

// build-index.mjs deriva seq da ordem de enviadoEm — gera timestamps
// crescentes e determinísticos (1 min de diferença) para manter a mesma
// ordem que os antigos valores de seq davam.
const BASE_ENVIADO_EM = Date.parse('2026-01-01T00:00:00.000Z');
function enviadoEmParaIndice(indice) {
  return new Date(BASE_ENVIADO_EM + indice * 60_000).toISOString();
}

function gerarObraAleatoria(indice) {
  const { ladoMinimo, ladoMaximo } = CONFIG.obra;
  const largura = aleatorioEntre(ladoMinimo, Math.min(ladoMaximo, 220));
  const altura = aleatorioEntre(ladoMinimo, Math.min(ladoMaximo, 220));
  const x = aleatorioEntre(0, CONFIG.territorio.largura - largura);
  const y = aleatorioEntre(0, CONFIG.territorio.altura - altura);

  return {
    id: gerarId(),
    enviadoEm: enviadoEmParaIndice(indice),
    x,
    y,
    width: largura,
    height: altura,
    nomeArtistico: itemAleatorio(NOMES),
    handle: `@${itemAleatorio(NOMES).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    cidade: itemAleatorio(CIDADES),
    descricao: itemAleatorio(DESCRICOES),
    autoriaDeclarada: true,
    _cor: corAleatoria(),
  };
}

// Cria uma obra do mesmo tamanho que `base`, deslocada 20% para criar um
// conflito de propósito garantido (>50% de cobertura nos dois sentidos —
// ver B.5, item 8: "algumas se sobrepondo"). Tamanhos diferentes tornariam
// a sobreposição resultante incerta, por isso o par nasce com dimensões iguais.
function gerarObraSobreposta(base, indice) {
  const deslocamentoX = Math.round(base.width * 0.2);
  const deslocamentoY = Math.round(base.height * 0.2);
  const x = Math.max(0, Math.min(CONFIG.territorio.largura - base.width, base.x + deslocamentoX));
  const y = Math.max(0, Math.min(CONFIG.territorio.altura - base.height, base.y + deslocamentoY));

  return {
    id: gerarId(),
    enviadoEm: enviadoEmParaIndice(indice),
    x,
    y,
    width: base.width,
    height: base.height,
    nomeArtistico: itemAleatorio(NOMES),
    handle: `@${itemAleatorio(NOMES).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    cidade: itemAleatorio(CIDADES),
    descricao: itemAleatorio(DESCRICOES),
    autoriaDeclarada: true,
    _cor: corAleatoria(),
  };
}

async function limparDiretorio(dir) {
  const entradas = await readdir(dir);
  await Promise.all(
    entradas
      .filter((nome) => nome !== '.gitkeep')
      .map((nome) => rm(path.join(dir, nome), { recursive: true, force: true })),
  );
}

async function main() {
  await mkdir(DIR_JSON, { recursive: true });
  await mkdir(DIR_PNG, { recursive: true });
  await limparDiretorio(DIR_JSON);
  await limparDiretorio(DIR_PNG);

  const obras = [];
  for (let i = 0; i < QUANTIDADE; i += 1) {
    obras.push(gerarObraAleatoria(i));
  }

  for (let i = 0; i < QUANTIDADE_PARES_SOBREPOSTOS; i += 1) {
    const base = obras[i * 2];
    obras[i * 2 + 1] = gerarObraSobreposta(base, i * 2 + 1);
  }

  for (const obra of obras) {
    const { _cor, ...sticker } = obra;
    const erros = validarSticker(sticker);
    if (erros.length > 0) {
      throw new Error(`obra gerada é inválida (${sticker.id}): ${erros.join(', ')}`);
    }

    await writeFile(path.join(DIR_JSON, `${sticker.id}.json`), `${JSON.stringify(sticker, null, 2)}\n`);
    await writeFile(path.join(DIR_PNG, `${sticker.id}.png`), pngBlobEliptico(sticker.width, sticker.height, _cor));
  }

  console.log(`${obras.length} obras geradas em data/stickers/ e stickers/.`);

  const publicadas = obras.map(({ _cor, ...sticker }) => sticker);
  for (const obra of publicadas) {
    const outras = publicadas.filter((o) => o.id !== obra.id);
    const conflitantes = conflitos(obra, outras);
    if (conflitantes.length > 0) {
      console.log(`  conflito de propósito: ${obra.id} sobrepõe ${conflitantes.map((o) => o.id).join(', ')}`);
    }
  }
}

main();
