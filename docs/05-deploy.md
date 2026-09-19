# 5. Publicação e coleta

Notas operacionais. A página entregue funciona sozinha; o coletor existe só para a
fase de pesquisa.

## Página

Página publicada: <https://silvamleandro.github.io/browser-bot-detection/>.

A branch `dev` contém o projeto completo. A branch `web` contém somente o conteúdo
de `web/`, na raiz, e é a origem da página publicada. Ao atualizar o site, copie as
alterações de `web/` para a raiz de um checkout separado da branch `web`, faça
commit e push. As branches têm históricos separados; não faça merge de `dev`
na branch `web`.

O workflow em `.github/workflows/pages.yml`, presente em `dev`, é uma alternativa
para publicar `web/` via GitHub Actions; não é o fluxo usado pela branch `web` atual.

## Endpoint de coleta

A página envia para a constante `RESEARCH_ENDPOINT` no topo de `web/src/ui.js`,
a menos que a URL traga `?endpoint=`; para enviar ao coletor local, use esse
parâmetro (abaixo).

O coletor usa **Workers KV**, com o binding `SESSIONS` configurado em
`collector/worker/wrangler.toml`. Cada sessão vira uma chave
`sessions/AAAA-MM-DD/<session_id>.json`. A leitura das sessões exige autenticação
na Cloudflare; o Worker público recebe coletas e oferece `/health`.

Endpoint configurado:
<https://incognia-case-collector.incognia-bot-detection.workers.dev/collect>.

```bash
npx wrangler login
npx wrangler deploy --config collector/worker/wrangler.toml
```

O namespace desta conta já está criado. Em outra conta, execute
`npx wrangler kv namespace create SESSIONS --config collector/worker/wrangler.toml`
e substitua o `id` em
`wrangler.toml` pelo valor retornado antes de publicar. No primeiro deploy, a conta
também precisa ter um subdomínio `workers.dev` cadastrado.

Configure `RESEARCH_ENDPOINT` com a URL completa do Worker **terminada em
`/collect`**, e publique a alteração na página. O modo local pode usar
`?research=1&endpoint=http://localhost:8787/collect` para enviar ao coletor local.

O [plano gratuito do KV](https://developers.cloudflare.com/kv/platform/pricing/)
inclui 1.000 gravações por dia e 1 GB de armazenamento. O botão **Download JSON**
continua disponível como alternativa ao envio.

Para trazer as sessões do KV para o pipeline local, a partir da raiz do projeto:

```bash
node analysis/scripts/fetch_sessions.js
```

O script consulta o KV remoto e acrescenta as sessões a `data/raw/collected.jsonl`,
sem repetir identificadores já baixados. O KV tem consistência eventual: uma nova
gravação pode não aparecer imediatamente em uma leitura de outra região; nesse
caso, repita a consulta mais tarde.

## Coleta com participantes

O link é `https://<usuario>.github.io/<repo>/?research=1&participant=P01`, com um
código por pessoa. O modo de pesquisa mostra um painel de consentimento e nada é
enviado antes do clique. A pessoa usa o mesmo link em todos os aparelhos, e as
sessões dela ficam num só grupo na validação cruzada. Use códigos neutros, não
nomes: o código vai junto com a sessão. Sem `participant`, a página sorteia um código
por navegador, e cada aparelho ou janela anônima vira um participante diferente.

Peça variedade, não volume. Dez pessoas em dez configurações diferentes valem mais
que cem sessões da mesma máquina: notebook com trackpad **e** desktop com mouse,
celular, Chrome e Firefox e Safari, alguém que use a página só pelo teclado. Quem
abre no celular e quem rola com o teclado são os casos mais valiosos, porque foram
exatamente eles que a versão anterior da detecção classificava como bot.

## Sessões automatizadas

Para o dataset de comparação com humanos, gere as sessões de bot contra a **mesma URL
pública** que as pessoas recebem, para que o caminho de rede não vire proxy do rótulo.
O dataset atual foi gerado assim, contra a página publicada; as sessões antigas de
`localhost` ficaram fora dele:

```bash
node harness/run-matrix.js --url https://<usuario>.github.io/<repo> \
  --collect https://<worker>/collect --runs 6
```

As configurações `headful` abrem janelas reais na sessão gráfica e roubam foco
enquanto rodam; leva cerca de meia hora para as cinco. Sem evasão, headless carrega
sinais de ambiente fáceis de separar; com o plugin de stealth, nem isso.

## Reconstruir tudo

```bash
node analysis/scripts/extract_features.js
.venv/bin/jupyter nbconvert --to notebook --execute --inplace \
  analysis/notebooks/bot_detection_analysis.ipynb
```

Como as sessões são gravadas como eventos brutos, mudar a engenharia de features e
rodar `extract_features.js` de novo reconstrói toda a matriz sem recoletar nada.
