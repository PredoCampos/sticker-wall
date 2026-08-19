// Cache de imagens por obra. Não sabe de canvas nem de câmera — quem decide
// "isto está no viewport" é quem chama obterImagem() (a revisão de render.js
// no item 20, usando spatial.consultarRetangulo() para filtrar antes de
// pedir a imagem). Aqui só existe carregamento sob demanda e memorização:
// cada PNG é pedido no máximo uma vez, mesmo que a obra apareça e desapareça
// do viewport várias vezes.

const cache = new Map();

export function obterImagem(obra) {
  let entrada = cache.get(obra.id);
  if (entrada) return entrada;

  const imagem = new Image();
  entrada = { estado: 'carregando', imagem };
  cache.set(obra.id, entrada);

  imagem.onload = () => { entrada.estado = 'pronta'; };
  imagem.onerror = () => { entrada.estado = 'erro'; };
  imagem.src = `stickers/${obra.id}.png`;

  return entrada;
}
