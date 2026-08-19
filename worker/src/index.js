// Roteador: GET /pending, POST /submit. Fluxo de POST /submit reconstruído
// a partir do que B.4 e o restante do Anexo B já fixam (não temos o texto
// literal do fluxo de 10 passos citado em A.6), com o antibot do Bloco 6
// (item 49) inserido como um novo passo:
//   1. checar Origin
//   2. checar quota diária por IP
//   3. checar reservas pendentes em excesso por IP
//   4. ler o payload (multipart/form-data)
//   5. verificar o token antibot (Cloudflare Turnstile)
//   6. validar a imagem (shared/png.js)
//   7. gerar id único e validar o rascunho do sticker (shared/schema.js)
//   8. checar limites do território (shared/geometry.js)
//   9. checar conflito de geometria contra publicadas ∪ pendentes
//   10. criar a reserva no KV e abrir o Pull Request no GitHub
//   11. registrar a submissão na quota diária e responder 201

import { validarSticker } from '../../shared/schema.js';
import { validarPng } from '../../shared/png.js';
import { conflitos, dentroDosLimites } from '../../shared/geometry.js';
import { ERROS, cabecalhosCors, respostaJson, respostaErro } from './errors.js';
import { ocupacaoAtual } from './occupancy.js';
import { criarReserva, listarReservas } from './reservations.js';
import { hashIp, limiteDiarioExcedido, registrarSubmissao, pendentesExcedidos } from './ratelimit.js';
import { abrirSubmissaoComoPr } from './github.js';
import { verificarTurnstile } from './turnstile.js';

function gerarId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function gerarIdUnico(ocupacao) {
  let id = gerarId();
  let tentativas = 0;
  while (ocupacao.some((o) => o.id === id) && tentativas < 5) {
    id = gerarId();
    tentativas += 1;
  }
  return id;
}

async function tratarPending(request, env) {
  const reservas = await listarReservas(env.STICKER_WALL_KV);
  return respostaJson({ pending: reservas }, 200, request.headers.get('Origin'), env.ORIGEM_PAGES);
}

async function tratarSubmit(request, env) {
  const origem = request.headers.get('Origin');

  // 2, 3. quota por IP -----------------------------------------------------
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const hash = await hashIp(ip);

  if (await limiteDiarioExcedido(env.STICKER_WALL_KV, hash)) {
    return respostaErro(ERROS.LIMITE_EXCEDIDO, origem, env.ORIGEM_PAGES, { motivo: 'diario' });
  }
  if (await pendentesExcedidos(env.STICKER_WALL_KV, hash)) {
    return respostaErro(ERROS.LIMITE_EXCEDIDO, origem, env.ORIGEM_PAGES, { motivo: 'pendentes' });
  }

  // 4. payload ---------------------------------------------------------------
  let dados;
  try {
    dados = await request.formData();
  } catch {
    return respostaErro(ERROS.PAYLOAD_INVALIDO, origem, env.ORIGEM_PAGES);
  }

  // 5. antibot ---------------------------------------------------------------
  const turnstileOk = await verificarTurnstile(dados.get('turnstileToken'), env, ip);
  if (!turnstileOk) {
    return respostaErro(ERROS.ANTIBOT_FALHOU, origem, env.ORIGEM_PAGES);
  }

  const arquivo = dados.get('imagem');
  if (!(arquivo instanceof File)) {
    return respostaErro(ERROS.IMAGEM_INVALIDA, origem, env.ORIGEM_PAGES);
  }

  // 6. imagem ------------------------------------------------------------
  const pngBytes = new Uint8Array(await arquivo.arrayBuffer());
  const errosPng = validarPng(pngBytes);
  if (errosPng.length > 0) {
    return respostaErro(ERROS.IMAGEM_INVALIDA, origem, env.ORIGEM_PAGES, { detalhes: errosPng });
  }

  // 7. id + schema ---------------------------------------------------------
  const ocupacao = await ocupacaoAtual(env, env.STICKER_WALL_KV);
  const id = gerarIdUnico(ocupacao);

  // FormData.get() devolve null pra campo ausente, e Number(null) é 0 — um
  // número finito válido, não um erro. Sem isso, x/y ausentes virariam
  // (0, 0) em silêncio em vez de payload_invalido (width/height são
  // protegidos por acidente, já que 0 < ladoMinimo).
  const numeroDoFormulario = (chave) => {
    const valor = dados.get(chave);
    return valor === null ? NaN : Number(valor);
  };

  const rascunho = {
    id,
    enviadoEm: new Date().toISOString(),
    x: numeroDoFormulario('x'),
    y: numeroDoFormulario('y'),
    width: numeroDoFormulario('width'),
    height: numeroDoFormulario('height'),
    nomeArtistico: String(dados.get('nomeArtistico') || '').trim(),
    handle: String(dados.get('handle') || '').trim(),
    cidade: String(dados.get('cidade') || '').trim(),
    descricao: String(dados.get('descricao') || '').trim(),
    url: String(dados.get('url') || '').trim(),
    autoriaDeclarada: dados.get('autoriaDeclarada') === 'true',
  };
  for (const chave of ['handle', 'cidade', 'descricao', 'url']) {
    if (rascunho[chave] === '') delete rascunho[chave];
  }

  const errosSchema = validarSticker(rascunho);
  if (errosSchema.length > 0) {
    return respostaErro(ERROS.PAYLOAD_INVALIDO, origem, env.ORIGEM_PAGES, { detalhes: errosSchema });
  }

  // 8, 9. geometria ----------------------------------------------------------
  if (!dentroDosLimites(rascunho)) {
    return respostaErro(ERROS.FORA_DOS_LIMITES, origem, env.ORIGEM_PAGES);
  }

  const conflitantes = conflitos(rascunho, ocupacao);
  if (conflitantes.length > 0) {
    return respostaErro(ERROS.CONFLITO_DE_ESPACO, origem, env.ORIGEM_PAGES, {
      conflitos: conflitantes.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height })),
    });
  }

  // 10. reserva + PR ------------------------------------------------------
  await criarReserva(env.STICKER_WALL_KV, {
    id, x: rascunho.x, y: rascunho.y, width: rascunho.width, height: rascunho.height, ipHash: hash,
  });

  let pr;
  try {
    pr = await abrirSubmissaoComoPr(env, rascunho, pngBytes);
  } catch (erro) {
    console.error('falha ao abrir PR', erro);
    // a reserva já criada expira sozinha (CONFIG.quotas.reservaTtlMinutos);
    // não existe rollback atômico possível com KV.
    return respostaErro(ERROS.ERRO_INTERNO, origem, env.ORIGEM_PAGES);
  }

  // 11. quota + resposta -----------------------------------------------------
  await registrarSubmissao(env.STICKER_WALL_KV, hash);

  return respostaJson({ id, pr: pr.url }, 201, origem, env.ORIGEM_PAGES);
}

export default {
  async fetch(request, env) {
    const origem = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecalhosCors(origem, env.ORIGEM_PAGES) });
    }

    // 1. Origin -----------------------------------------------------------
    if (origem !== env.ORIGEM_PAGES) {
      return respostaErro(ERROS.ORIGEM_NAO_PERMITIDA, origem, env.ORIGEM_PAGES);
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/pending') {
      return tratarPending(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/submit') {
      return tratarSubmit(request, env);
    }

    return respostaErro(ERROS.ROTA_DESCONHECIDA, origem, env.ORIGEM_PAGES);
  },
};
