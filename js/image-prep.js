// Prepara o arquivo escolhido pelo usuário: decodifica, redimensiona para
// caber em CONFIG.obra.ladoMaximoPx no maior lado (nunca aumenta imagens
// pequenas — isso é decisão de layout do submit-ui, não de redimensionar),
// recodifica como PNG e verifica se existe algum pixel não-opaco (senão não
// é um adesivo, é um retângulo cheio). Não decide o que fazer com o
// resultado — quem chama decide se um erro de decodificação ou a ausência
// de transparência bloqueiam o envio.

import { CONFIG } from '../shared/config.js';

export async function prepararImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo);

  const maiorLado = Math.max(bitmap.width, bitmap.height);
  const escala = Math.min(1, CONFIG.obra.ladoMaximoPx / maiorLado);
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const temTransparencia = verificarTransparencia(ctx, largura, altura);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  return { blob, largura, altura, temTransparencia };
}

function verificarTransparencia(ctx, largura, altura) {
  const { data } = ctx.getImageData(0, 0, largura, altura);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}
