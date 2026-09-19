# 2. Metodologia

## 2.1 Arquitetura de coleta

A página grava três blocos passivos e um fluxo contínuo de eventos:

| Bloco | Módulo | Quando |
|---|---|---|
| Artefatos de automação | `web/src/collect/automation.js` | síncrono, no load |
| Ambiente e coerência | `web/src/collect/environment.js` | assíncrono, ~500ms |
| Timing e runtime | `web/src/collect/timing.js` | assíncrono, ~1,2s |
| Eventos de interação | `web/src/collect/behavior.js` | contínuo |

A ordem importa. O gravador de eventos é acoplado antes de qualquer `await`, porque
uma ferramenta de automação costuma agir nos primeiros centenas de milissegundos,
exatamente a janela que se perderia coletando o ambiente primeiro.

A captura de rolagem inclui a página e as caixas internas, com um número por alvo
para não misturar as posições. Toda sonda roda dentro de `safe()`: consultar APIs
exóticas lança exceção em configurações reais o bastante para que um coletor
desprotegido perdesse a sessão inteira por um acesso ruim. Sonda que falha é
registrada como falha, porque a falha também é informação.

## 2.2 Uma única implementação de features

`web/src/features.js` roda nos dois lados: no navegador durante a inferência e sob
Node ao reconstruir a matriz a partir das sessões gravadas. Isso elimina
*train/serve skew* por construção. A alternativa usual, coletar em JavaScript e
reimplementar as features em Python, faz o modelo aprender com uma definição de
"retidão da trajetória" e pontuar com outra, sutilmente diferente.

Como as sessões são gravadas em eventos brutos, revisar a engenharia de features não
exige recoletar. Isso já se pagou: a revisão da §2.7 mudou metade das features
comportamentais e todas as sessões foram repontuadas sem recoletar uma linha. O que
obrigou a recoletar foi outra coisa, a página ter mudado (§2.6), porque sessão
gravada por outra versão da página não é comparável.

## 2.3 Valores ausentes

Features comportamentais valem `NaN`, nunca zero, quando a sessão não produziu
interação suficiente. Os limiares são 15 movimentos de ponteiro, 4 teclas e 3
eventos de rolagem.

A distinção não é cosmética. Zero afirmaria "o ponteiro não se moveu", e `NaN` diz
"ainda não sei". Colapsar as duas ensinaria o modelo que uma pessoa que apenas lê a
página se parece com um bot, o falso positivo mais caro deste sistema.

O `HistGradientBoostingClassifier` consome `NaN` nativamente, aprendendo por nó para
que lado mandar o ausente. A regressão logística precisa de imputação por mediana com
indicador de ausência. Três features de suficiência (`b_has_pointer`, `b_has_keys`,
`b_has_scroll`, somadas em `b_evidence_score`) deixam o modelo distinguir "parece
automatizada" de "ainda não me mostrou nada".

## 2.4 Geração do dataset

### Sessões automatizadas

Matriz em `harness/run-matrix.js`, com quatro eixos independentes:

- ferramenta: Playwright Chromium, Playwright Firefox e Playwright Chromium com o
  `puppeteer-extra-plugin-stealth`, via `playwright-extra`;
- modo: headless novo, headless shell antigo, headful;
- evasão: nenhuma, a evasão ingênua de `harness/evasion.js`, só a flag
  `--disable-blink-features=AutomationControlled`, ou o plugin de stealth;
- jornada: `naive`, `humanized`, `idle`.

Mais variação de viewport, locale e fuso por execução. Nem toda combinação existe: o
plugin e a flag só rodam no Chromium. Sem `channel`, o Playwright roda o headless
shell antigo; o modo novo exige `channel: 'chromium'`.

A evasão ingênua esconde os mesmos sinais que os plugins de stealth escondem, sem o
cuidado deles: apaga o acessor em vez de usar a flag, instala funções JavaScript sem
mascarar `Function.prototype.toString` e corrige só o WebGL 1. É o limite inferior da
evasão. Para não confundir as duas coisas, a matriz inclui o plugin público sem
modificação e a flag de lançamento sozinha.

A jornada `idle` é o controle: carrega a página e não faz nada, produzindo o caso em
que a evidência comportamental está genuinamente ausente.

### Sessões headful e o ponteiro real

Em headful a janela é real, e o mouse de quem roda o harness gera eventos genuínos se
passar por cima dela. A primeira sessão `naive` headful saiu com 399 eventos de
ponteiro, contra 1 ou 2 nas limpas: o rótulo dizia bot, e parte da trajetória era de
uma pessoa.

O critério de descarte está em `data/quarantine/`: movimento antes de a jornada
começar, `idle` com qualquer movimento, e contagem acima do máximo observado em
headless, onde não existe ponteiro real. Ele tirou 7 das 54 sessões da primeira
rodada e 1 das 90 da coleta final.

### O adversário humanizado

`harness/journeys/humanized.js` implementa o modelo motor do alcance humano:

- trajetória de jerk mínimo (Flash & Hogan, 1985), com perfil `10τ³ − 15τ⁴ + 6τ⁵`;
- curvatura por Bézier quadrática, para que o caminho seja arco e não reta;
- ruído posicional por passo, evitando suavidade analítica;
- overshoot com submovimento corretivo, o padrão bifásico do alcance humano;
- duração por lei de Fitts, crescendo com a distância;
- temporização log-normal por passo, tecla e rajada, com piso acima do limite motor;
- rolagem por eventos de roda reais, não `scrollTo()`.

Um adversário fraco produziria métricas boas e falsas. Este passa por todas as regras
comportamentais: o que o detecta, quando detecta, é artefato ou marca de adulteração.

## 2.5 Protocolo de avaliação

**Particionamento agrupado por participante** (`StratifiedGroupKFold`). Sem isso,
sessões da mesma pessoa caem nos dois lados da divisão e a métrica mede memorização
daquela pessoa. É o erro mais comum em biometria comportamental e o mais difícil de
notar, porque só faz o número melhorar. Cada execução automatizada também recebe seu
próprio grupo.

**Ponto de operação em TPR @ FPR = 1%, não acurácia.** Em prevenção a fraude o custo
de um falso positivo, que é atrito imposto a um usuário legítimo, é assimétrico em
relação ao de um falso negativo.

**Intervalos por bootstrap agrupado por participante.** Com poucas dezenas de
participantes, uma métrica pontual comunica precisão que a amostra não sustenta. Há
um piso de resolução: com N sessões humanas o menor FPR acima de zero é 1/N, e abaixo
de 100 sessões "TPR @ 1% FPR" é, na prática, a detecção sem nenhum falso positivo.

**Testes KS por feature com correção de Benjamini-Hochberg.** Testar cerca de 260
features a 5% sem correção produziria por volta de doze descobertas só por acaso.

**Limiar fora da amostra, sem calibração.** O limiar do modelo sai das predições da
validação cruzada agrupada, o que evita escolhê-lo sobre o próprio ajuste, mas não
garante o mesmo FPR em acessos novos. Não há calibração de probabilidades: a página
mostra um score de risco.

**As regras não são avaliação independente.** Elas foram ajustadas olhando as sessões
automatizadas, então as métricas delas nesse conjunto descrevem o ajuste.

**Features de caminho de rede ficam fora do treino.** Tempo de resposta,
`domInteractive`, primeiro paint, `connection.rtt`, tamanho do histórico e presença de
referrer são descartados: neste dataset eles separam as classes pelo motivo errado,
porque bot e humano não chegam pelo mesmo caminho nem quando a URL é a mesma. Pelo
mesmo motivo o dataset foi gerado contra a mesma URL pública que as pessoas
receberam, com as 180 sessões automatizadas e as 31 humanas vindo da página
publicada; as sessões antigas de `localhost` ficaram fora.

**O protocolo de coleta vaza o rótulo por outro caminho.** A pessoa decide quando
enviar, o bot é gravado ao fim de um roteiro de duração fixa. Duração, tempo até o
primeiro evento e contagens brutas ficam fora dos modelos; taxas e razões ficam.

## 2.6 Dois artefatos de medição encontrados no caminho

**A interface contaminando a rolagem.** A primeira versão reconstruía a tabela de
sinais a cada tick do laço de atualização, deslocando o layout e emitindo eventos de
rolagem no período exato da atualização, 500ms. Apareceu como
`b_scroll_orphan_ratio ≈ 0,99` numa sessão com 24 eventos legítimos de roda: o
instrumento contaminando a própria medição. A correção foi tornar condicional toda
escrita no DOM, e os eventos de rolagem caíram de 80 para 18 na mesma configuração.

**O adversário que nunca digitou.** Nas 31 sessões da jornada humanizada,
`b_input_count` valia zero: o clique caía fora do campo, porque o painel de reason
codes ficava acima da área de interação e crescia conforme as regras disparavam. Entre
medir a posição do campo e apertar o botão, o alvo descia uns cem pixels. O texto ia
para o documento e os espaços rolavam a página, o que a detecção lia como rolagem
programática. O adversário mais forte da matriz estava sendo pego por um defeito dele
mesmo. Três correções: o painel foi para baixo da área de interação, a jornada passou
a conferir `document.activeElement` e a falhar se o campo não recebeu o texto, e a
regra de rolagem deixou de tratar "sem roda do mouse" como script. As 73 sessões
antigas foram para `data/quarantine/`.

## 2.7 Como o veredito é decidido, e por que humanos vinham dando "bot"

Quando há modelo publicado, ele decide e as regras explicam. Sem modelo, as regras
decidem. Três decisões do motor de regras merecem explicação, porque as três vieram
de erro.

**Existe um viés, e ele puxa para humano.** A versão anterior somava evidência e
passava a soma por uma sigmoide: sem nenhum sinal o score era exatamente 0,5, e o
comparador `p >= 0,5` exibia "Bot / Automação" para quem só tinha aberto a página.
Hoje o score é `sigmoide((evidência − 3,5) / 2,2)`, o que dá 0,17 sem evidência. O 3,5
é um viés heurístico escolhido à mão, não uma taxa-base estimada da proporção de
humanos e bots.

**Evidência humana só cancela evidência comportamental.** As regras são agrupadas em
`hard`, `tamper`, `env`, `timing` e `behaviour`. O grupo comportamental é somado e
truncado em zero: trajetória convincente cancela suspeita comportamental e para aí.
Deixar que ela subtraia de "o acessor de `navigator.webdriver` foi apagado" seria
entregar ao adversário a alavanca que ele treina para ter, e o adversário humanizado
aciona todas as regras "parece humano" ao mesmo tempo.

**Artefato direto não é questão de grau.** `navigator.webdriver` ligado, global de
framework injetada ou chave `cdc_` no documento põem o veredito no piso de 0,95.

### Os falsos positivos que estavam lá

Cada um destes marcava uma pessoa comum como bot, ou a deixava a um sinal fraco da
linha. Todos viraram teste em `tests/rules.test.mjs`.

| Sinal | Quem ele pegava | Correção |
|---|---|---|
| `Notification.permission` ≠ `permissions.query()` | todo navegador com permissão no estado padrão, porque um diz `default` e o outro diz `prompt` | normalizar antes de comparar; a assinatura de headless é `denied` contra `prompt` |
| `window.chrome` ausente | todo Firefox e todo Safari | só conta quando o próprio User-Agent diz Chrome |
| pressão do ponteiro invariante | todo usuário de mouse: o spec fixa 0 sem botão e 0,5 com botão | só medir em caneta |
| clique sem aproximação | toque, ativação por teclado e quem pausa antes de clicar | procurar a trilha de movimento que termina no alvo |
| rolagem sem roda do mouse | teclado, toque, barra de rolagem e restauração de scroll no F5 | só vale sem roda, tecla nem toque na sessão inteira; rolagem com o botão pressionado, que é o arrasto da barra, não conta |
| digitação abaixo do limite motor | quem segura Backspace: autorepeat dispara a ~30ms | descartar `event.repeat` e medir só teclas que produzem caractere |
| preenchimento programático | colar, autocorreção do celular e o botão Restart, que não limpava o campo | ignorar `inputType` de colagem e composição; limpar o campo no Restart |
| nenhum quadro renderizado | aba em segundo plano, onde o navegador não desenha | medir `document.hidden` e marcar a família inteira como ausente |
| cadência fora do vsync | monitor de 240Hz, com 4,2ms por quadro | faixa de 2 a 45ms |
| depurador conectado | qualquer avaliador que abra o DevTools | peso reduzido a corroboração, incapaz de decidir sozinho |
| `platform` contra User-Agent | todo iPhone: o UA diz "like Mac OS X" e a plataforma diz "iPhone" | tirar iOS da checagem de macOS |
| salto no comprimento do campo | quem cola no meio da digitação, e o teclado do celular, que compõe a palavra antes de confirmar | medir o salto contra o input imediatamente anterior, de qualquer tipo |
| cinemática de ponteiro | todo celular: o swipe é reto e não traz delta de movimento do sistema | cinemática só com mouse e caneta; o toque conta à parte |

O padrão que liga quase todos: o sinal era real, mas a hipótese nula estava errada.
"Ausência de roda do mouse" não é "script", é "não usou a roda do mouse". Sem sessões
humanas para conferir, esse tipo de erro não aparece.
