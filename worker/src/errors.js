// Tabela de códigos de erro que o Worker pode devolver, e helpers de
// resposta JSON com CORS. Todo endpoint responde por aqui — nunca com um
// Response construído à mão — para que o formato do corpo seja sempre
// { erro: <codigo>, ...detalhes } e o cabeçalho de CORS nunca seja esquecido.

export const ERROS = {
  PAYLOAD_INVALIDO: { status: 400, codigo: 'payload_invalido' },
  IMAGEM_INVALIDA: { status: 400, codigo: 'imagem_invalida' },
  FORA_DOS_LIMITES: { status: 400, codigo: 'fora_dos_limites' },
  CONFLITO_DE_ESPACO: { status: 409, codigo: 'conflito_de_espaco' },
  ORIGEM_NAO_PERMITIDA: { status: 403, codigo: 'origem_nao_permitida' },
  ANTIBOT_FALHOU: { status: 403, codigo: 'antibot_falhou' },
  LIMITE_EXCEDIDO: { status: 429, codigo: 'limite_excedido' },
  ROTA_DESCONHECIDA: { status: 404, codigo: 'rota_desconhecida' },
  ERRO_INTERNO: { status: 500, codigo: 'erro_interno' },
};

export function cabecalhosCors(origem, origemPermitida) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  if (origem && origem === origemPermitida) {
    cabecalhos['Access-Control-Allow-Origin'] = origem;
    cabecalhos['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    cabecalhos['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return cabecalhos;
}

export function respostaJson(corpo, status, origem, origemPermitida) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: cabecalhosCors(origem, origemPermitida),
  });
}

export function respostaErro(erro, origem, origemPermitida, detalhes) {
  return respostaJson({ erro: erro.codigo, ...detalhes }, erro.status, origem, origemPermitida);
}
