# Como contribuir

Este repositório publica um território coletivo de arte urbana digital. Não
há contribuições de código abertas neste momento — o que segue é sobre
**curadoria de obras**, o mecanismo pelo qual o conteúdo do território entra
e sai.

## Como uma obra chega até aqui

1. Alguém envia uma obra pelo formulário em `#enviar` no site.
2. O Worker valida o envio (geometria, schema, estrutura do PNG) e abre um
   Pull Request automaticamente, com o PNG e o JSON da obra.
3. O check `normalize` roda `scripts/normalize.mjs`: decodifica a imagem,
   confirma que ela tem transparência real, redimensiona e recodifica sem
   metadados, e corrige `width`/`height` no JSON para bater com o resultado
   final. Se qualquer uma dessas checagens falhar, o check fica vermelho e o
   PR não pode ser mesclado — `main` exige esse check (ver branch
   protection, configurada manualmente em Settings → Branches).
4. Um curador revisa o PR: a imagem, o nome artístico, a cidade, a
   descrição e as coordenadas, tudo visível no corpo do PR e nos arquivos
   alterados (ver `.github/pull_request_template.md` para o checklist).
5. Aprovado, o merge é *squash* (um commit só por obra) e a branch é
   apagada automaticamente. O próximo deploy publica a obra no território.
6. Recusado, o PR é fechado sem merge — nada é publicado.

## O que orienta a decisão de aceitar ou recusar

`diretrizes.html` é a política editorial: o que é aceito, o que é recusado,
e o texto de autoria declarada que quem envia confirma no formulário. Em
caso de dúvida, ela é a referência — não julgamento caso a caso.

## Removendo uma obra já publicada

Não existe uma interface de remoção — é sempre manual, por PR:

1. Numa branch, apague `data/stickers/<id>.json` e `stickers/<id>.png`.
2. Abra um PR explicando o motivo da remoção.
3. Mesclado, a obra some do território no próximo deploy —
   `scripts/build-index.mjs` só inclui o que existe em `data/stickers/` no
   momento do build.

> **Nota:** o Anexo A original referenciava critérios e prazos específicos
> de remoção (§10) que não chegaram a ser detalhados nesta sessão. O
> procedimento acima é o mínimo necessário para o mecanismo funcionar;
> ajuste os critérios quando esse texto existir.
