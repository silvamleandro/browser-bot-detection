# Detecção de Bots: Case Técnico Incognia

Página web que classifica um acesso como **Humano** ou **Bot / Automação**, com
score de risco e reason codes, decidindo inteiramente no navegador. Na interface, em
inglês, os rótulos são *Human* e *Bot / Automation*.

**Página no ar:** <https://silvamleandro.github.io/browser-bot-detection/>

## Abordagem

Checar `navigator.webdriver` atende ao enunciado, mas não sobrevive ao primeiro
plugin de evasão. O projeto trata o problema como detecção sob adversário
adaptativo: *quanto sinal sobra quando o atacante apaga os rastros óbvios?*

- **259 sinais em quatro camadas**, por custo de evasão: artefatos de automação e
  adulteração de API (`a_`), coerência de ambiente (`e_`), cadência de runtime
  (`t_`) e comportamento (`b_`), que cobre ponteiro, digitação e rolagem.
- **Motor de regras próprio** (`web/src/baseline.js`, 42 regras) produz os reason
  codes e faz a classificação inicial. O score parte de um viés
  heurístico, 0,17 sem evidência, e evidência de "parece humano" só cancela suspeita
  comportamental, nunca apaga adulteração detectada.
- **Modelo treinado no veredito** (`web/src/model.json`, gradient boosting exportado
  como JSON e avaliado por `web/src/infer.js`). Ele só é publicado quando supera as
  regras em TPR @ 1% FPR fora da amostra e há participantes suficientes: o mínimo era
  30, o alvo de coleta, e foi baixado para 11 por decisão registrada no notebook. Foi
  treinado com 13 pessoas, o que é pouco, e a ressalva está em
  [`03-resultados.md`](docs/03-resultados.md).
- **Regras no início, modelo com dados disponíveis** (`web/src/decision.js`): as
  regras decidem enquanto faltam as features comportamentais usadas pelas árvores.
  No modelo atual, isso significa esperar dados de rolagem. Sinais diretos de
  automação mantêm a decisão das regras mesmo depois. O score indica qual motor
  está ativo; os indicadores Passive Signals, Pointer, Typing e Scrolling mostram
  quais tipos de dados já foram coletados, não uma classificação por categoria.
- **Adversários em escada**: jornadas ingênua, humanizada e parada, combinadas com
  uma evasão ingênua escrita aqui, com a flag de lançamento sozinha e com o
  `puppeteer-extra-plugin-stealth` público.
- **Uma só implementação de features** (`web/src/features.js`), usada no navegador e
  em Node na análise, o que elimina divergência entre treino e inferência.

A página não envia dados no modo padrão, e a coleta de pesquisa não guarda hashes nem
identificadores do aparelho; o único código é o do participante, que vem do link de
convite (detalhes na
[seção de privacidade](docs/04-producao.md#41-privacidade)).

## Documentação

Comece por estes dois, que respondem ao que o enunciado pede:

| Documento | Conteúdo |
|---|---|
| [01-pesquisa.md](docs/01-pesquisa.md) | problema, modelo de ameaça, literatura e a abordagem escolhida |
| [03-resultados.md](docs/03-resultados.md) | resultados medidos, gerados pelo notebook |

Apêndices, para quem quiser o detalhe:

| Documento | Conteúdo |
|---|---|
| [02-metodologia.md](docs/02-metodologia.md) | coleta, features, dataset, regra de decisão e os falsos positivos corrigidos |
| [04-producao.md](docs/04-producao.md) | privacidade, scoring no servidor, monitoramento |
| [05-deploy.md](docs/05-deploy.md) | publicação da página e do coletor |
| [06-revisao-literatura.md](docs/06-revisao-literatura.md) | protocolo e tabela de extração da revisão |
| [07-coleta-humana.md](docs/07-coleta-humana.md) | roteiro usado na coleta com pessoas |

## Execução

Requisito: Node 20+.

```bash
npm install && npx playwright install chromium chromium-headless-shell firefox
                              # só para os testes de automação
node collector/server.js      # serve web/ em http://localhost:8787
```

Qualquer servidor HTTP estático também serve (`python3 -m http.server -d web 8787`);
`file://` não funciona porque a página usa ES modules.

## Como testar

**Como pessoa.** Abra <http://localhost:8787> e use a página por uns 30 segundos:
mova o ponteiro, digite, clique, role. O esperado é **Human**. Vale testar os casos
que já quebraram antes: rolar só com teclado, colar texto no meio da digitação, aba em
segundo plano, DevTools aberto, iPhone e Android.

**Como automação.** Com o servidor rodando:

```bash
node harness/smoke.mjs                  # uma sessão Playwright: veredito e sinais
node harness/run-matrix.js --list       # configurações × jornadas disponíveis
node harness/run-matrix.js --runs 6     # matriz completa
```

As configurações `headful` abrem janelas reais. Sem evasão, headless carrega sinais de
ambiente fáceis de separar; com o plugin de stealth, nem isso. Durante a execução, não
passe o mouse sobre essas janelas: o ponteiro real entra na sessão gravada.

**Testes das regras e da transição para o modelo.** `npm test`. Os testes cobrem
falsos positivos conhecidos, abertura sem interação, troca para o modelo, reinício
da sessão e prioridade dos sinais diretos de automação.

## Reproduzir a análise

```bash
node analysis/scripts/extract_features.js --in data/sample   # sem --in, lê data/raw
python -m venv .venv && .venv/bin/pip install -r analysis/requirements.txt jupyter
.venv/bin/jupyter nbconvert --to notebook --execute --inplace \
  analysis/notebooks/bot_detection_analysis.ipynb
```

As sessões brutas (`data/raw/`) não vão para o repositório; num clone limpo, a
amostra em `data/sample/` basta para rodar o pipeline. O notebook regenera
`docs/03-resultados.md` e `web/src/model.json`, então o relatório nunca diverge do
que foi medido. Rodado sobre a amostra, ele sobrescreve os resultados do conjunto
completo: não faça commit dessa saída.

## Estrutura

```
web/                 página estática: coleta, features, regras, interface
harness/             sessões automatizadas: jornadas naive/humanized/idle, evasão
collector/           servidor local + coletor (Cloudflare Worker em produção)
tests/               falsos positivos que o motor não pode voltar a ter
analysis/            extração da matriz e notebook de avaliação
docs/                pesquisa, metodologia, resultados, produção
data/                amostra de sessões e quarentena (dados brutos fora do git)
```

## Limites conhecidos

Evasão cuidadosa passa pelas regras. Com a flag
`--disable-blink-features=AutomationControlled` em headful, ou com o
`puppeteer-extra-plugin-stealth`, as sessões paradas e humanizadas recebem das regras
o mesmo score de quem não produziu evidência nenhuma: nenhuma regra dispara contra
elas. Só a jornada ingênua, que preenche e clica sem aproximação, continua detectada.
Nas sessões completas, nenhuma das 31 sessões de 13 pessoas foi classificada como
bot pelas regras. Esse resultado não mede a classificação a cada instante da visita.

O modelo foi avaliado separadamente nas sessões completas. A primeira versão
publicada decidia com uma feature só, a média dos saltos de rolagem, o que chamava
de bot quem rola pelo teclado ou com a roda sem rolagem suave: essa medida descreve
o passo de rolagem do aparelho, não quem está no controle, e saiu do treino junto com
as features de caminho de rede. A versão atual usa 19 features, com tempo de pressão
do clique, reversões do ponteiro e o próprio `navigator.webdriver` no topo, e a
tabela está em [`03-resultados.md`](docs/03-resultados.md). A página só a consulta
quando as entradas comportamentais dela existem na sessão; até lá decidem as regras,
e bots com evasão que ficam parados passam nessa etapa.

As métricas do notebook não são métricas da combinação ao longo da visita. O
modelo foi medido contra bots de um mesmo gerador, e o experimento E5 mostra a
limitação de generalização. Antes de ampliar seu uso, é necessário validar o treino
com etapas parciais das sessões e novos participantes. Números por configuração em
[`03-resultados.md`](docs/03-resultados.md).

Sinais de transporte (TLS, HTTP/2, ordem de cabeçalhos) são invisíveis para
JavaScript, e injeção de entrada pelo sistema operacional (`xdotool`, `PyAutoGUI`)
gera eventos genuínos, fora do modelo de ameaça. Veja a seção sobre
[limitações do JavaScript](docs/01-pesquisa.md#15-o-que-javascript-não-alcança).
