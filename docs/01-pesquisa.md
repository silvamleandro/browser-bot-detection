# 1. Pesquisa: O que se Sabe sobre Detectar Automação de Navegador

## 1.1 O Problema e o Modelo de Ameaça

Uma ferramenta de automação é um navegador real controlado por um programa. Ela roda
o mesmo motor de renderização, o mesmo interpretador de JavaScript e as mesmas APIs
que o navegador de uma pessoa. Não existe pergunta ao ambiente cuja resposta seja
necessariamente diferente, porque o ambiente pode ser o mesmo. O que difere é quem
está no controle, e por isso a solução não pode se apoiar só em fingerprint.

Assume-se um adversário que:

- controla o código que roda no navegador dele e pode falsificar qualquer resposta de
  API que a página consulte;
- pode ler a lógica de detecção, já que ela é entregue ao cliente;
- tem custo crescente conforme a falsificação precisa ser coerente entre mais sinais;
- não controla o que está abaixo do JavaScript sem esforço desproporcional: pilha
  TLS, compositor gráfico, driver de entrada do sistema operacional.

A última premissa sustenta a solução. Não existe sinal impossível de falsificar;
existem sinais cujo custo de falsificação coerente é alto o bastante para deslocar a
economia do ataque.

## 1.2 O que a Literatura Mostra

### Comportamento Supera Fingerprint

FP-Agent (arXiv 2605.01247, 2026) é o primeiro estudo controlado comparando agentes
de navegação com humanos. Com XGBoost sobre 418 features de fingerprint e 50
comportamentais, no cenário com os sete agentes e os humanos (Tabela 2):

| Conjunto de features | Precisão | Recall | F₁ |
|---|---|---|---|
| Só fingerprint do navegador | 0,884 | 0,841 | 0,822 |
| Só comportamento | 0,999 | 0,999 | 0,999 |
| Combinado | 1,000 | 1,000 | 1,000 |

O que interessa é a explicação, não o número: agentes distintos compartilhavam
fingerprints idênticos quando rodavam no mesmo sistema. O fingerprint descreve a
máquina, e a máquina é a mesma. O classificador combinado estabiliza depois de cerca
de um minuto de observação, e o comportamental sozinho só depois de três, o que leva
direto ao veredito progressivo da seção 1.4.

### Camadas de Sinal e Custo de Evasão

Uma síntese de fornecedor ([c/side, 2026](https://cside.com/blog/headless-browser-detection))
organiza os sinais por custo de falsificação, e essa ordenação vira o eixo do projeto:

| Camada | Exemplos | Custo de evasão |
|---|---|---|
| 1. APIs do navigator | `navigator.webdriver`, plugins, `window.chrome` | Trivial, qualquer lib de stealth resolve |
| 2. Renderização / GPU | WebGL, canvas, fontes | Médio, a string é fácil, a coerência com as capacidades não |
| 3. Rede / transporte | JA3/JA4, frames HTTP/2, ordem de cabeçalhos | Alto, exige build modificado do navegador |
| 4. Comportamento | cinemática de ponteiro, rolagem, digitação | Muito alto, nenhuma biblioteca replica em escala |

A ordenação é de fornecedor, não medida. Neste projeto a jornada humanizada, com
cerca de 200 linhas, passou por todas as regras comportamentais escritas à mão.

### Evasão Ingênua Troca de Sinal, o Plugin Público Apaga

A evasão escrita aqui (`harness/evasion.js`) esconde os mesmos sinais que um plugin
de stealth, sem o cuidado dele. Contra ela as regras de adulteração disparam em 36 de
36 sessões: ela não apagou o rastro, trocou de rastro. O exemplo mais limpo é a GPU.
Ela sobrescreve `WebGLRenderingContext.prototype.getParameter` e esquece que
`WebGL2RenderingContext` é outro protótipo, então o WebGL 1 declara "Intel Iris
OpenGL Engine" enquanto o WebGL 2, na mesma página, responde "SwiftShader".

Reescrever a API deixa marca: um getter nativo vira função JavaScript, e
`Function.prototype.toString` revela; uma propriedade de `Navigator.prototype`
aparece como própria da instância. Daí a inversão que orienta a camada A. A pergunta
produtiva não é "a flag de automação está ligada?", e sim "alguém andou editando as
APIs deste navegador?".

O `puppeteer-extra-plugin-stealth`, sem modificação, mostra o limite dessa pergunta.
Ele tira a flag pela linha de comando sem apagar nada, envolve cada função alterada
num `Proxy` cujo `toString` continua respondendo `[native code]` e corrige os dois
contextos WebGL. Nas 35 sessões dele, nenhuma regra de adulteração ou de ambiente
dispara. Sobra o comportamento, e só a jornada ingênua é detectada.

Artefatos específicos de ferramenta que os plugins não cobrem continuam valendo:
`window.__playwright__binding__`, `__pwInitScripts`, chaves `cdc_` do ChromeDriver em
`document` e o `toString` do wrapper de `page.exposeFunction()`.

### Biometria Comportamental

Acien et al. (BeCAPTCHA-Mouse, 2022) sintetizam trajetórias com modelo neuromotor e
com GAN, e ainda assim detectam 93% delas com uma única trajetória. Iliou et al.
(2021) mostram o contrário quando o detector olha só para a forma do traçado. A
reconciliação está na [seção 6.3 da revisão de literatura](06-revisao-literatura.md#63-a-contradição-que-vale-entender)
e orienta a escolha das features do projeto.

O fundamento motor vem de Flash & Hogan (1985): alcance humano minimiza o *jerk* e
produz velocidade em sino, com aceleração, pico no meio e desaceleração no alvo.
Somam-se a lei de Fitts e os submovimentos corretivos, porque a mão ultrapassa o alvo
e corrige. Esses fatos determinam as features de cinemática e o adversário humanizado
que as testa.

## 1.3 Taxonomia Adotada

As 259 features usam prefixo no nome para que a camada seja recuperável na análise:

| Prefixo | Camada | O que mede |
|---|---|---|
| `a_` | Automação e adulteração | Flags diretas, globais injetadas, chaves de driver, sonda de CDP (que não disparou em nenhuma das 180 sessões), funções nativas que perderam `[native code]`, acessador de `webdriver` removido ou virado propriedade própria |
| `e_` | Coerência de ambiente | Contradições, não valores: UA de desktop com GPU em software, UA-CH contra a string de UA, UA de celular com `maxTouchPoints` zero, janela sem altura de barra, `Notification.permission` contra `permissions.query()`, ausência de codecs proprietários, fuso UTC sem variação sazonal |
| `t_` | Timing e runtime | Cadência de `requestAnimationFrame` e sua dispersão, resolução do relógio, latência do laço de eventos, entradas de paint |
| `b_` | Comportamento | Cinemática de ponteiro, coerência de eventos (tela contra página, `movementX/Y` contra delta de posição), dinâmica de digitação e rolagem |

## 1.4 Abordagem Escolhida

**O veredito é progressivo.** Sinais passivos existem em t≈0 e respondem à exigência
de classificar "ao ser acessada". Sinais comportamentais chegam ao longo de segundos
e revisam o veredito. A interface mostra qual evidência já chegou, para que um
veredito dado só com sinais passivos seja lido como tal. As regras fazem a avaliação
inicial. O modelo passa a decidir quando suas entradas comportamentais estão
disponíveis, exceto quando há um sinal direto de automação, que mantém a decisão
das regras. O modelo atual precisa de ponteiro, cliques e rolagem para responder.

**Ausência de interação é ausência de informação.** Um bot que carrega a página e não
faz nada não gera evidência comportamental, mas uma pessoa que só lê também não.
Features comportamentais valem `NaN` até haver evidência suficiente, nunca zero.
O modelo treinado, porém, aprende com sessões completas e trata ausência como
evidência: a primeira versão publicada lia falta de rolagem como bot. A política de
decisão da página impede seu uso enquanto as entradas não existem, o que não
substitui avaliá-lo em sessões parciais.

**O adversário de teste implementa o modelo motor humano.** A jornada humanizada usa
trajetória de jerk mínimo com curvatura, ruído por passo, overshoot com submovimento
corretivo, temporização log-normal e rolagem por eventos de roda reais. Um adversário
fraco produziria métricas boas e falsas. Contra este, nenhuma regra comportamental
dispara, e com a flag de lançamento ou com o plugin de stealth as sessões paradas e
humanizadas passam como humanas. Os experimentos por sofisticação rodaram com 31
sessões de 13 participantes coletadas contra a página publicada; os números estão em
[`03-resultados.md`](03-resultados.md).

## 1.5 O que JavaScript Não Alcança

A camada 3, com impressão digital de TLS, parâmetros de HTTP/2 e ordem de cabeçalhos,
é das mais robustas e é inacessível à página: exige observar a conexão no servidor.
É limitação de arquitetura, não de implementação. O que um sistema de produção ganharia
combinando as duas está em [`04-producao.md`](04-producao.md).

Injeção de entrada pelo sistema operacional (`xdotool`, `PyAutoGUI`) fica fora do
modelo de ameaça: ela gera eventos genuínos do sistema e os sinais de estrutura do
fluxo deixam de valer. É a fronteira real do problema, e nenhum trabalho revisado a
cobre.

## Referências

O que cada trabalho mede e onde eles se contradizem está em
[06-revisao-literatura.md](06-revisao-literatura.md). Entradas formatadas em
[referencias.bib](referencias.bib).
