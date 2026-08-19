# Sticker Wall

Um território digital coberto de arte urbana colada por quem quiser participar. Site estático (canvas navegável) publicado no GitHub Pages, com um Worker no Cloudflare que modera cada envio abrindo um Pull Request para curadoria.

## Como rodar localmente

```bash
npm install
npm test           # roda shared/ (geometria, schema, validação de PNG)
npm run seed        # gera obras de teste em data/stickers/ e stickers/
npm run build        # monta _site/
npm run dev          # serve _site/ em http://localhost:8000
```

Pro Worker, numa pasta separada (não compartilha `node_modules` com o site):

```bash
cd worker
npm install
npx wrangler dev      # roda o Worker localmente, com KV de preview
```

## Como fazer deploy

- **Site:** todo push em `main` dispara `.github/workflows/deploy.yml`, que roda os testes, monta `_site/` e publica no GitHub Pages (`predocampos.github.io/sticker-wall/`). Nada manual.
- **Worker:** `cd worker && npx wrangler deploy`. Não é automatizado por CI — é feito manualmente quando o código do Worker muda. Segredos (`GITHUB_TOKEN`, `TURNSTILE_SECRET_KEY`) são configurados uma vez via `wrangler secret put <NOME>`, nunca versionados.

## Arquitetura em cinco linhas

O site (`index.html` + `js/`) é um canvas navegável servido como estático puro — nenhuma chamada de rede é necessária pra navegar o território, só pra enviar uma obra nova. `shared/` (config, geometria, schema, validação de PNG) é a fonte única de regras, importada pelo frontend, pelo Worker e pelos testes por igual, então os três nunca podem divergir sobre o que é um conflito de espaço. Uma submissão vai direto pro Worker (Cloudflare), que valida tudo de novo do lado do servidor e abre um Pull Request com o PNG e o JSON da obra — nada é publicado sem passar por um PR. `scripts/normalize.mjs`, rodado em CI a cada PR, decodifica e recodifica a imagem, corrige metadados e bloqueia o merge se algo não bater. Curadoria é humana: revisar o PR e mesclar é o que efetivamente publica a obra no próximo deploy.

## Outros documentos

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — fluxo de curadoria e remoção manual de uma obra
- [`diretrizes.html`](diretrizes.html) — política editorial: o que é aceito, o que é recusado
- [`LICENSE`](LICENSE) — licença do código (as obras enviadas seguem o que está em `diretrizes.html`)
