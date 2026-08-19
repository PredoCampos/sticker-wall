// Carrega data/stickers.json (o envelope gerado por build-index.mjs) e
// mantém o estado publicado em memória: a lista ordenada por seq e um
// índice por id. app.js chama carregar() uma vez, no bootstrap.

let obras = [];
let indice = new Map();
let territorio = null;

export async function carregar(url = 'data/stickers.json') {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`falha ao carregar ${url}: ${resposta.status}`);
  }

  const envelope = await resposta.json();
  obras = [...envelope.obras].sort((a, b) => a.seq - b.seq);
  indice = new Map(obras.map((obra) => [obra.id, obra]));
  territorio = envelope.territorio;
}

export function all() {
  return obras;
}

export function byId(id) {
  return indice.get(id);
}

export function territorioPublicado() {
  return territorio;
}
