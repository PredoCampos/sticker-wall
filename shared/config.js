// Fonte única de constantes do sistema. Importado pelo frontend, pelo Worker
// e pelos scripts de build/CI — mudar um valor aqui propaga para os três.
// Valores marcados como placeholder ainda não vieram do Anexo A; ajuste
// livremente, os testes do Bloco 0 devem continuar passando.

export const CONFIG = Object.freeze({
  territorio: Object.freeze({
    largura: 8000, // placeholder — unidades de mundo (px em zoom 1)
    altura: 8000,
    margemCamera: 400, // folga além dos limites para o clamp da câmera
    zoomMin: 0.1,
    zoomMax: 4,
  }),

  obra: Object.freeze({
    ladoMinimo: 32, // menor lado possível de uma obra, em unidades de mundo
    ladoMaximo: 512, // maior lado possível de uma obra, em unidades de mundo
    ladoMaximoPx: 512, // limite de codificação em image-prep.js (px reais do PNG)
    tamanhoMaximoBytes: 2 * 1024 * 1024, // 2 MB por PNG
  }),

  sobreposicao: Object.freeze({
    // regra dos 50%: uma obra nova não pode cobrir mais que este limiar
    // da área de nenhuma obra publicada nem de nenhuma reserva pendente
    limiar: 0.5,
  }),

  texto: Object.freeze({
    nomeArtisticoMax: 60,
    handleMax: 30,
    cidadeMax: 60,
    descricaoMax: 280,
    urlMax: 200,
  }),

  quotas: Object.freeze({
    submissoesPorDiaPorIp: 5,
    pendentesPorIp: 3,
    reservaTtlMinutos: 15, // tempo que uma reserva ocupa espaço antes de expirar
    occupancyCacheTtlSegundos: 60, // TTL do cache do Worker sobre stickers.json
  }),

  rede: Object.freeze({
    // espelha a regra de Rate Limiting configurada no painel Cloudflare (item 51)
    requisicoesPorMinutoPorIp: 10,
  }),

  worker: Object.freeze({
    // PLACEHOLDER — troque pela URL real depois de `wrangler deploy`
    // (algo como https://sticker-wall-worker.<subdominio>.workers.dev,
    // ou um domínio próprio se você configurar uma rota).
    baseUrl: 'https://SUBSTITUA.workers.dev',
  }),
});
