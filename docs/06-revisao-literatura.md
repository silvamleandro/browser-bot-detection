# 6. Revisão de literatura

O que sustenta as decisões técnicas deste projeto. A revisão narrativa da seção
[1.2](01-pesquisa.md) resume as conclusões; aqui estão os trabalhos que eu li em
texto completo, o que cada um de fato mede, e onde eles se contradizem.

## 6.1 Escopo

**Pergunta orientadora.** Quais sinais observáveis por JavaScript distinguem um
navegador operado por pessoa de um operado por programa, e quais deles sobrevivem a
um adversário que tenta ativamente parecer humano?

**Busca.** arXiv, ACM Digital Library, IEEE Xplore, SpringerLink e ScienceDirect,
em setembro de 2026, combinando *web bot detection*, *headless browser detection*,
*mouse dynamics*, *behavioral biometrics*, *keystroke dynamics*, *bot evasion GAN*,
*LLM browser agent detection* e *TLS fingerprint bot*. Sem recorte temporal, porque
a base motora é de 1985 e o problema de agentes de IA é de 2026.

**Fora de escopo.** Detecção de bots em redes sociais (problema de conteúdo, não de
navegador), CAPTCHA visual, e detecção puramente em camada de rede sem componente
de cliente.

## 6.2 Os trabalhos que sustentam decisões aqui

Estes eu li em texto completo, e cada um mudou alguma coisa no projeto.

| Trabalho | Ano | O que mede | Resultado | O que mudou aqui |
|---|---|---|---|---|
| [FP-Agent: Fingerprinting AI Browsing Agents](https://arxiv.org/abs/2605.01247) | 2026 | 418 features de fingerprint e 50 comportamentais; 546 sessões humanas (56 pessoas) contra 7.000 de sete agentes; XGBoost multiclasse | Com humanos: F₁ 0,822 só fingerprint, 0,999 só comportamento, 1,000 combinado; o combinado estabiliza com cerca de um minuto de observação | Veredito progressivo em dois estágios, e uma camada comportamental ao lado do fingerprint |
| [What Does It Take to Detect an AI Agent?](https://arxiv.org/abs/2607.26935) | 2026 | 17 features contínuas; 14k sessões humanas (CaptchaSolve30k), 1.025 de agente real, 2.299 de uma escada de evasão em cinco níveis | 100% de detecção em todos os níveis; conjunto mínimo suficiente de duas features | Confirmou as features de estrutura do fluxo de eventos, e delimitou o que fica fora do modelo de ameaça (injeção via sistema operacional) |
| [Web Bot Detection Evasion Using GANs](https://eprints.bournemouth.ac.uk/36301/) (Iliou et al.) | 2021 | GAN gera imagens de trajetória semelhantes às humanas | Evade mesmo com o servidor conhecendo o método e treinando com as mesmas configurações | A razão de não apostar em features de forma da trajetória |
| [BeCAPTCHA-Mouse](https://arxiv.org/abs/2005.00890) (Acien et al.) | 2022 | Dois sintetizadores de trajetória: modelo neuromotor e GAN; benchmark de 15.000 trajetórias, 58 usuários | 93% de acurácia detectando trajetórias sintéticas com uma única amostra | O modelo neuromotor que a jornada humanizada implementa |
| [Detecting Bot Detection](https://arxiv.org/abs/2606.14525) (Gundelach et al.) | 2026 | Prevalência real de detecção: 10.000 sites, 4 configurações, 40k visitas | Chromium headless sofre 15% de bloqueio contra 7% das demais; 75% dos bloqueios exclusivos de headless vêm só de cabeçalhos; 83% dos artigos da área não discutem bloqueio | A decisão de reportar headless e headful em estratos separados |
| Flash & Hogan, *The coordination of arm movements* | 1985 | Movimento de alcance humano minimiza o jerk | Perfil de velocidade em sino: acelera, pico no meio, desacelera no alvo | O perfil `10τ³ − 15τ⁴ + 6τ⁵` da jornada humanizada e as features de cinemática |

Fitts (1954) entra pelo mesmo caminho: o tempo de movimento cresce com a razão
entre distância e tamanho do alvo, e é o que define a duração de cada alcance no
harness. Entradas formatadas em [referencias.bib](referencias.bib).

A taxonomia de quatro camadas por custo de evasão usada em
[01-pesquisa.md](01-pesquisa.md) vem de material técnico de fornecedor (c/side,
2026), não de artigo revisado. Ela organiza bem a prática, mas seus números não têm
o mesmo peso probatório e não são citados como evidência.

## 6.3 A contradição que vale entender

FP-Agent e o trabalho de features mínimas dizem que detecção comportamental
funciona. Iliou et al. dizem que uma GAN evade detecção por movimento de mouse
mesmo quando o servidor conhece o método de ataque. Os dois não podem estar certos
sobre a mesma coisa, e não estão: **medem camadas diferentes.**

Iliou ataca detecção baseada na **forma da trajetória**, convertendo movimento em
imagem e classificando com CNN. Contra isso, uma GAN que aprendeu a desenhar curvas
humanas realmente vence, porque o alvo é a aparência do traçado.

O trabalho de features mínimas não olha para a forma. Os três sinais que ele
identifica como sobreviventes são ausências e regularidades na **estrutura do fluxo
de eventos**: clique sem nenhum `mousemove` bruto anterior terminando no alvo,
ausência completa de eventos de roda, e temporização muito regular entre rolagens
despachadas por script. Esses sinais codificam como a API de automação entrega os
eventos, não o formato do caminho. Uma GAN pode desenhar a trajetória perfeita e
ainda assim precisa entregá-la por algum canal, e é a entrega que deixa rastro.

A consequência de projeto parecia direta: features de forma são atacáveis por modelos
generativos, e features de estrutura do fluxo de eventos não seriam, enquanto o
adversário dependesse de API de automação. Neste projeto, a segunda metade não se
sustentou. O adversário humanizado usa só a API do Playwright (`page.mouse.move()` em
muitos passos, `page.mouse.wheel()`), e isso basta para produzir o fluxo contínuo de
movimento e os eventos de roda cuja ausência aquele trabalho detecta. Nenhuma regra
comportamental da página dispara contra ele; o que o detecta, quando detecta, é
`navigator.webdriver` ou marca de adulteração. Isso não contradiz o resultado do
trabalho de features mínimas, que usa um modelo treinado com 14 mil sessões humanas.
Mostra que regras escritas à mão sobre a estrutura do fluxo não bastam contra um
adversário que gera esse fluxo.

## 6.4 Lacunas, e onde este trabalho se situa

**Injeção de entrada em nível de sistema operacional não é testada por ninguém.**
`xdotool`, `PyAutoGUI` e APIs de acessibilidade estão explicitamente fora de escopo
no trabalho de features mínimas, porque não passam por CDP. Um adversário que move
o cursor pelo sistema operacional gera fluxo de eventos genuíno, com micromovimento
real e eventos de roda reais, e os sinais de ausência deixam de valer. É a fronteira
real do problema, e fica fora do meu modelo de ameaça pelo mesmo motivo.

**Validação agrupada por participante quase nunca é reportada.** Nenhum dos
trabalhos que li em texto completo descreve explicitamente impedir que sessões da
mesma pessoa caiam nos dois lados da divisão treino e teste. Como o efeito desse
vazamento é sempre melhorar o número reportado, a omissão importa, e é por isso que
o protocolo daqui parte de `StratifiedGroupKFold`, conforme a
[seção 2.5 da metodologia](02-metodologia.md#25-protocolo-de-avaliação).

**Dados humanos são escassos e específicos de tarefa.** 56 participantes no
FP-Agent, 58 no BeCAPTCHA-Mouse. O trabalho de features mínimas usa humanos
resolvendo CAPTCHA, tarefa em que praticamente todo mundo usa a roda do mouse, o
que, como se vê na seção 2.7 da metodologia, faz "ausência de roda" parecer um sinal mais
forte do que ele é fora daquele contexto.

**Onde meu adversário se situa.** Acima do nível 2 da escada do trabalho de
features mínimas e abaixo do nível 5: a jornada humanizada usa `page.mouse.move()`
em muitos passos, então gera fluxo contínuo de movimento, ao contrário do nível 2,
que ainda teleporta. Mas não usa GAN nem replay de trajetória humana real. A
comparação honesta é essa, e não "meu adversário é equivalente ao estado da arte".

**O que acrescento.** A camada de detecção de adulteração (`a_natives_patched_*`,
`a_webdriver_getter_not_native`, `a_nav_accessors_nonnative`) não aparece medida em
nenhum dos trabalhos acima. Ela inverte a pergunta, de "a flag está ligada" para
"alguém editou as APIs deste navegador", e é a única evidência contra a evasão
ingênua em headful com jornada humanizada. Contra o plugin de stealth público, que
mascara `toString`, ela não dispara, e as sessões paradas e humanizadas passam como
humanas. Os números estão em
[03-resultados.md](03-resultados.md), gerados a partir das sessões, e não repetidos à
mão aqui justamente para não envelhecer.
