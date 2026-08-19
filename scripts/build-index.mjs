// Monta _site/: copia o que é site (HTML, css/, js/, shared/, assets/,
// stickers/) e gera _site/data/stickers.json a partir de data/stickers/*.json.
// scripts/, test/, worker/, .github/ e os .json individuais de data/stickers/
// ficam de fora — ver B.4, item 2. Falha o processo se alguma obra for
// inválida, para nunca publicar dado que quebraria o schema no cliente.

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CONFIG } from '../shared/config.js';
import { validarSticker } from '../shared/schema.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_SITE = path.join(RAIZ, '_site');
const DIR_DADOS_FONTE = path.join(RAIZ, 'data', 'stickers');
const DIR_STICKERS = path.join(RAIZ, 'stickers');

const ARQUIVOS_HTML = ['index.html', 'sobre.html', 'diretrizes.html', '404.html'];
const DIRETORIOS_SITE = ['css', 'js', 'shared', 'assets', 'stickers'];

async function existe(caminho) {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

async function listarArquivosDeObras() {
  try {
    return (await readdir(DIR_DADOS_FONTE)).filter((n) => n.endsWith('.json'));
  } catch (erro) {
    if (erro.code === 'ENOENT') return []; // ainda não existe nenhuma obra
    throw erro;
  }
}

async function carregarObras() {
  const nomes = await listarArquivosDeObras();
  const obras = [];
  const idsVistos = new Set();
  const erros = [];

  for (const nome of nomes) {
    const caminho = path.join(DIR_DADOS_FONTE, nome);
    const sticker = JSON.parse(await readFile(caminho, 'utf8'));
    const errosSticker = validarSticker(sticker);

    if (errosSticker.length > 0) {
      erros.push(`${nome}: ${errosSticker.join(', ')}`);
      continue;
    }
    if (sticker.id !== path.basename(nome, '.json')) {
      erros.push(`${nome}: id do arquivo ("${sticker.id}") não bate com o nome do arquivo`);
      continue;
    }
    if (idsVistos.has(sticker.id)) {
      erros.push(`${nome}: id duplicado (${sticker.id})`);
      continue;
    }
    if (!(await existe(path.join(DIR_STICKERS, `${sticker.id}.png`)))) {
      erros.push(`${nome}: stickers/${sticker.id}.png não encontrado`);
      continue;
    }

    idsVistos.add(sticker.id);
    obras.push(sticker);
  }

  if (erros.length > 0) {
    throw new Error(`obras inválidas em data/stickers/:\n  ${erros.join('\n  ')}`);
  }

  // seq não vem do arquivo-fonte — um inteiro gravado ali exigiria
  // coordenação entre PRs concorrentes para não colidir. Em vez disso,
  // ordena por enviadoEm (atribuído pelo Worker, sem coordenação nenhuma)
  // e calcula seq aqui, uma vez, no momento da publicação.
  obras.sort((a, b) => Date.parse(a.enviadoEm) - Date.parse(b.enviadoEm));
  return obras.map((obra, indice) => ({ ...obra, seq: indice + 1 }));
}

async function montarSite(obras) {
  await rm(DIR_SITE, { recursive: true, force: true });
  await mkdir(DIR_SITE, { recursive: true });

  for (const arquivo of ARQUIVOS_HTML) {
    const origem = path.join(RAIZ, arquivo);
    if (await existe(origem)) {
      await cp(origem, path.join(DIR_SITE, arquivo));
    }
  }

  for (const dir of DIRETORIOS_SITE) {
    const origem = path.join(RAIZ, dir);
    if (await existe(origem)) {
      await cp(origem, path.join(DIR_SITE, dir), { recursive: true });
    }
  }

  const dirDados = path.join(DIR_SITE, 'data');
  await mkdir(dirDados, { recursive: true });

  const envelope = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    territorio: { largura: CONFIG.territorio.largura, altura: CONFIG.territorio.altura },
    total: obras.length,
    obras,
  };

  await writeFile(path.join(dirDados, 'stickers.json'), `${JSON.stringify(envelope)}\n`);
}

async function main() {
  const obras = await carregarObras();
  await montarSite(obras);
  console.log(`_site/ montado com ${obras.length} obra(s) em data/stickers.json.`);
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
