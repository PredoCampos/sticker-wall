// Cria a branch, commita o PNG e o JSON, abre o Pull Request. REST direto
// com o PAT (env.GITHUB_TOKEN, um secret do Cloudflare — nunca lido daqui,
// só repassado) — ver B.4, item 3, sobre por que não é uma GitHub App.

const API = 'https://api.github.com';

function cabecalhos(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sticker-wall-worker',
  };
}

async function chamarGithub(caminho, token, opcoes = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos(token), ...(opcoes.headers || {}) },
  });
  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`GitHub ${opcoes.method || 'GET'} ${caminho} -> ${resposta.status}: ${corpo}`);
  }
  return resposta.json();
}

function base64DeBytes(bytes) {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function base64DeTexto(texto) {
  return base64DeBytes(new TextEncoder().encode(texto));
}

async function obterShaDaBase(env) {
  const ref = await chamarGithub(
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/ref/heads/${env.GITHUB_BRANCH_BASE}`,
    env.GITHUB_TOKEN,
  );
  return ref.object.sha;
}

async function criarBranch(env, nomeBranch, sha) {
  await chamarGithub(`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs`, env.GITHUB_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${nomeBranch}`, sha }),
  });
}

async function commitarArquivo(env, nomeBranch, caminho, conteudoBase64, mensagem) {
  await chamarGithub(`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${caminho}`, env.GITHUB_TOKEN, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: mensagem, content: conteudoBase64, branch: nomeBranch }),
  });
}

async function abrirPullRequest(env, nomeBranch, titulo, corpo) {
  return chamarGithub(`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/pulls`, env.GITHUB_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titulo, head: nomeBranch, base: env.GITHUB_BRANCH_BASE, body: corpo }),
  });
}

function montarCorpoPr(sticker) {
  const linhas = [
    `**Nome artístico:** ${sticker.nomeArtistico}`,
    sticker.handle && `**Handle:** ${sticker.handle}`,
    sticker.cidade && `**Cidade:** ${sticker.cidade}`,
    sticker.descricao && `**Descrição:** ${sticker.descricao}`,
    sticker.url && `**Link:** ${sticker.url}`,
    '',
    'Enviado pelo formulário do território. Revisar contra as diretrizes antes de aceitar.',
  ];
  return linhas.filter(Boolean).join('\n');
}

// sticker: objeto já validado por schema.js (sem seq — ver shared/schema.js).
// pngBytes: Uint8Array já validado por shared/png.js.
export async function abrirSubmissaoComoPr(env, sticker, pngBytes) {
  const nomeBranch = `obra/${sticker.id}`;
  const sha = await obterShaDaBase(env);
  await criarBranch(env, nomeBranch, sha);

  await commitarArquivo(
    env,
    nomeBranch,
    `data/stickers/${sticker.id}.json`,
    base64DeTexto(`${JSON.stringify(sticker, null, 2)}\n`),
    `obra: adiciona ${sticker.id}.json`,
  );
  await commitarArquivo(
    env,
    nomeBranch,
    `stickers/${sticker.id}.png`,
    base64DeBytes(pngBytes),
    `obra: adiciona ${sticker.id}.png`,
  );

  const pr = await abrirPullRequest(env, nomeBranch, `Nova obra: ${sticker.nomeArtistico}`, montarCorpoPr(sticker));
  return { numero: pr.number, url: pr.html_url };
}
