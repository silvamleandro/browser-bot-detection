# Dados

`raw/` recebe as sessões gravadas, uma por linha em JSONL. Não vai para o
repositório: são grandes e carregam traços comportamentais de participantes.

`sample/` traz uma sessão automatizada por configuração e jornada da matriz, o
suficiente para rodar o pipeline a partir de um clone limpo:

```bash
node analysis/scripts/extract_features.js --in data/sample
```

`quarantine/` guarda sessões excluídas da análise, com o motivo registrado.

Sessões automatizadas não contêm dado de pessoa. As de participantes humanos
ficam apenas em `raw/`, e o conteúdo digitado nunca é gravado em nenhuma das duas
(ver [`docs/04-producao.md`](../docs/04-producao.md) §4.1).
