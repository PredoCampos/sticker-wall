// Upload, obra pendente fixa no centro da tela (o território é que se move
// por baixo — ver camera.js/input.js, inalterados), destaque de conflito ao
// vivo usando geometry.js, formulário, checkbox de autoria declarada.
// Ativado/desativado por router.js ao entrar/sair de #enviar.

import { CONFIG } from '../shared/config.js';
import { validarSticker } from '../shared/schema.js';
import { conflitos, dentroDosLimites } from '../shared/geometry.js';
import { obterEstado } from './camera.js';
import * as store from './store.js';
import { prepararImagem } from './image-prep.js';
import { enviar } from './api.js';

const painel = document.getElementById('painel-submissao');

const MENSAGENS_ERRO = {
  nomeArtistico_invalido: 'nome artístico é obrigatório (até 60 caracteres).',
  handle_invalido: 'handle muito longo.',
  cidade_invalido: 'cidade muito longa.',
  descricao_invalido: 'descrição muito longa (até 280 caracteres).',
  url_invalido: 'o link precisa começar com https://',
  autoriaDeclarada_invalido: 'é preciso declarar a autoria para enviar.',
};

let obraPendente = null; // { largura, altura, blob, objectUrl }
let reticulo = null;
let rafId = null;
let enviando = false;
let refs = {};

function construirFormulario() {
  painel.innerHTML = `
    <div id="passo-arquivo">
      <label class="botao-arquivo">
        escolher imagem PNG
        <input type="file" accept="image/png" class="visualmente-oculto" id="campo-arquivo" />
      </label>
    </div>
    <form id="form-submissao" novalidate hidden>
      <div class="preview-arquivo">
        <span id="nome-arquivo"></span>
        <button type="button" id="botao-trocar">trocar imagem</button>
      </div>
      <div class="campo">
        <label for="campo-nome">nome artístico</label>
        <input type="text" id="campo-nome" required />
      </div>
      <div class="campo">
        <label for="campo-handle">handle (opcional)</label>
        <input type="text" id="campo-handle" />
      </div>
      <div class="campo">
        <label for="campo-cidade">cidade (opcional)</label>
        <input type="text" id="campo-cidade" />
      </div>
      <div class="campo">
        <label for="campo-descricao">descrição (opcional)</label>
        <textarea id="campo-descricao"></textarea>
      </div>
      <div class="campo">
        <label for="campo-url">link (opcional)</label>
        <input type="url" id="campo-url" placeholder="https://" />
      </div>
      <label class="campo-checkbox">
        <input type="checkbox" id="campo-autoria" />
        declaro que esta obra é minha ou que tenho autorização para publicá-la — ver
        <a href="diretrizes.html" target="_blank" rel="noopener">diretrizes</a>
      </label>
      <p class="submissao-status" id="status-submissao" role="status"></p>
      <button type="submit" class="botao-principal" id="botao-enviar">colar no território</button>
    </form>
  `;

  refs = {
    passoArquivo: painel.querySelector('#passo-arquivo'),
    campoArquivo: painel.querySelector('#campo-arquivo'),
    form: painel.querySelector('#form-submissao'),
    nomeArquivo: painel.querySelector('#nome-arquivo'),
    botaoTrocar: painel.querySelector('#botao-trocar'),
    campoNome: painel.querySelector('#campo-nome'),
    campoHandle: painel.querySelector('#campo-handle'),
    campoCidade: painel.querySelector('#campo-cidade'),
    campoDescricao: painel.querySelector('#campo-descricao'),
    campoUrl: painel.querySelector('#campo-url'),
    campoAutoria: painel.querySelector('#campo-autoria'),
    status: painel.querySelector('#status-submissao'),
    botaoEnviar: painel.querySelector('#botao-enviar'),
  };

  refs.campoNome.maxLength = CONFIG.texto.nomeArtisticoMax;
  refs.campoHandle.maxLength = CONFIG.texto.handleMax;
  refs.campoCidade.maxLength = CONFIG.texto.cidadeMax;
  refs.campoDescricao.maxLength = CONFIG.texto.descricaoMax;
  refs.campoUrl.maxLength = CONFIG.texto.urlMax;

  refs.campoArquivo.addEventListener('change', aoEscolherArquivo);
  refs.botaoTrocar.addEventListener('click', trocarImagem);
  refs.form.addEventListener('submit', aoSubmeter);
}

function definirStatus(mensagem, tipo) {
  if (!refs.status) return;
  refs.status.textContent = mensagem;
  refs.status.className = `submissao-status${tipo ? ` ${tipo}` : ''}`;
}

function criarReticulo() {
  reticulo = document.createElement('div');
  reticulo.className = 'reticulo-obra';
  const img = document.createElement('img');
  img.src = obraPendente.objectUrl;
  img.alt = '';
  reticulo.appendChild(img);
  document.body.appendChild(reticulo);
}

function limparObraPendente() {
  if (reticulo) {
    reticulo.remove();
    reticulo = null;
  }
  if (obraPendente) {
    URL.revokeObjectURL(obraPendente.objectUrl);
    obraPendente = null;
  }
}

async function aoEscolherArquivo(e) {
  const arquivo = e.target.files[0];
  if (!arquivo) return;

  try {
    const { blob, largura, altura, temTransparencia } = await prepararImagem(arquivo);
    if (!temTransparencia) {
      definirStatus('essa imagem não tem transparência — precisa ser um recorte, não um retângulo cheio.', 'erro');
      refs.campoArquivo.value = '';
      return;
    }

    limparObraPendente();
    obraPendente = { largura, altura, blob, objectUrl: URL.createObjectURL(blob) };
    criarReticulo();

    refs.nomeArquivo.textContent = arquivo.name;
    refs.passoArquivo.hidden = true;
    refs.form.hidden = false;
    definirStatus('');
  } catch (erro) {
    console.error('falha ao processar imagem', erro);
    definirStatus('não foi possível ler essa imagem.', 'erro');
  }
}

function trocarImagem() {
  limparObraPendente();
  refs.campoArquivo.value = '';
  refs.passoArquivo.hidden = false;
  refs.form.hidden = true;
  definirStatus('');
}

function obraPendenteComoRetangulo() {
  const { x, y } = obterEstado();
  return {
    x: x - obraPendente.largura / 2,
    y: y - obraPendente.altura / 2,
    width: obraPendente.largura,
    height: obraPendente.altura,
  };
}

function atualizarConflito() {
  const retangulo = obraPendenteComoRetangulo();
  const conflitantes = conflitos(retangulo, store.all());
  const dentro = dentroDosLimites(retangulo);
  const bloqueado = conflitantes.length > 0 || !dentro;

  reticulo.classList.toggle('conflito', bloqueado);

  if (!dentro) {
    definirStatus('essa posição sai do território — mova a câmera até caber.', 'erro');
  } else if (conflitantes.length > 0) {
    const plural = conflitantes.length === 1 ? 'outra obra' : `${conflitantes.length} obras`;
    definirStatus(`essa posição sobrepõe ${plural} — mova para continuar.`, 'erro');
  } else {
    definirStatus('');
  }

  refs.botaoEnviar.disabled = bloqueado || enviando;
  return retangulo;
}

function quadro() {
  if (obraPendente && reticulo) {
    const { zoom } = obterEstado();
    reticulo.style.width = `${obraPendente.largura * zoom}px`;
    reticulo.style.height = `${obraPendente.altura * zoom}px`;
    atualizarConflito();
  }
  rafId = requestAnimationFrame(quadro);
}

function traduzirErro(codigo) {
  return MENSAGENS_ERRO[codigo] || 'revise os campos antes de enviar.';
}

async function aoSubmeter(e) {
  e.preventDefault();
  if (!obraPendente || enviando) return;

  const retangulo = obraPendenteComoRetangulo();

  // Reaproveita as regras de schema.js com um id de mentira — id e
  // enviadoEm reais são atribuídos pelo servidor ao aceitar a submissão
  // (worker/src/index.js), então qualquer erro causado só pelo id é
  // descartado abaixo.
  const rascunho = {
    id: '00000000',
    enviadoEm: new Date().toISOString(),
    x: retangulo.x,
    y: retangulo.y,
    width: retangulo.width,
    height: retangulo.height,
    nomeArtistico: refs.campoNome.value.trim(),
    handle: refs.campoHandle.value.trim(),
    cidade: refs.campoCidade.value.trim(),
    descricao: refs.campoDescricao.value.trim(),
    url: refs.campoUrl.value.trim(),
    autoriaDeclarada: refs.campoAutoria.checked,
  };

  for (const chave of ['handle', 'cidade', 'descricao', 'url']) {
    if (rascunho[chave] === '') delete rascunho[chave];
  }

  const erros = validarSticker(rascunho).filter((codigo) => codigo !== 'id_invalido');
  if (erros.length > 0) {
    definirStatus(traduzirErro(erros[0]), 'erro');
    return;
  }

  if (conflitos(retangulo, store.all()).length > 0 || !dentroDosLimites(retangulo)) {
    definirStatus('ajuste a posição antes de enviar.', 'erro');
    return;
  }

  enviando = true;
  refs.botaoEnviar.disabled = true;
  definirStatus('enviando…');

  try {
    await enviar({ ...rascunho, imagem: obraPendente.blob });
    definirStatus('obra enviada — vai passar por curadoria antes de aparecer no território.', 'ok');
    setTimeout(() => { location.hash = '#/'; }, 1500);
  } catch (erro) {
    console.error('falha ao enviar', erro);
    if (erro.codigo === 'conflito_de_espaco') {
      definirStatus('alguém colou uma obra aí entre você abrir o formulário e enviar — mova e tente de novo.', 'erro');
    } else {
      definirStatus('não deu pra enviar agora — tenta de novo em instantes.', 'erro');
    }
  } finally {
    enviando = false;
    refs.botaoEnviar.disabled = false;
  }
}

export function ativar() {
  construirFormulario();
  rafId = requestAnimationFrame(quadro);
}

export function desativar() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  enviando = false;
  limparObraPendente();
  painel.innerHTML = '';
  refs = {};
}
