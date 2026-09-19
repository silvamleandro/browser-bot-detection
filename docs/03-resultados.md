# 3. Resultados

> Gerado por `analysis/notebooks/bot_detection_analysis.ipynb`. Não editar à mão.

## Composição do dataset

211 sessões, 192 participantes/grupos, 192 features não constantes.

| config | journey | n |
|---|---|---|
| pw-chromium-headful | humanized | 6 |
| pw-chromium-headful | idle | 6 |
| pw-chromium-headful | naive | 6 |
| pw-chromium-headful-evasion | humanized | 6 |
| pw-chromium-headful-evasion | idle | 6 |
| pw-chromium-headful-evasion | naive | 6 |
| pw-chromium-headful-flag | humanized | 6 |
| pw-chromium-headful-flag | idle | 6 |
| pw-chromium-headful-flag | naive | 6 |
| pw-chromium-headless | humanized | 6 |
| pw-chromium-headless | idle | 6 |
| pw-chromium-headless | naive | 7 |
| pw-chromium-headless-evasion | humanized | 6 |
| pw-chromium-headless-evasion | idle | 6 |
| pw-chromium-headless-evasion | naive | 6 |
| pw-chromium-shell | humanized | 6 |
| pw-chromium-shell | idle | 6 |
| pw-chromium-shell | naive | 6 |
| pw-firefox-headful | humanized | 6 |
| pw-firefox-headful | idle | 6 |
| pw-firefox-headful | naive | 6 |
| pw-firefox-headless | humanized | 6 |
| pw-firefox-headless | idle | 6 |
| pw-firefox-headless | naive | 6 |
| pw-stealth-headful | humanized | 6 |
| pw-stealth-headful | idle | 5 |
| pw-stealth-headful | naive | 6 |
| pw-stealth-headless | humanized | 6 |
| pw-stealth-headless | idle | 6 |
| pw-stealth-headless | naive | 6 |
| nan | natural | 15 |
| nan | reading | 15 |
| nan | nan | 1 |

## Detecção do motor de regras

O que a página executa hoje, no limiar de operação. Para sessões `bot` a coluna `taxa` é detecção; para `human`, falso positivo. As regras foram escritas olhando estas mesmas sessões automatizadas, então a taxa dos bots descreve o ajuste, e não uma medida fora da amostra.

| label | config | journey | n | taxa | p_mediana | p_min |
|---|---|---|---|---|---|---|
| bot | pw-chromium-headful | humanized | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-chromium-headful | idle | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-chromium-headful | naive | 6 | 1.0 | 0.9553 | 0.9505 |
| bot | pw-chromium-headful-evasion | humanized | 6 | 1.0 | 0.9066 | 0.9066 |
| bot | pw-chromium-headful-evasion | idle | 6 | 1.0 | 0.9066 | 0.9066 |
| bot | pw-chromium-headful-evasion | naive | 6 | 1.0 | 0.9933 | 0.9933 |
| bot | pw-chromium-headful-flag | humanized | 6 | 0.0 | 0.1865 | 0.1693 |
| bot | pw-chromium-headful-flag | idle | 6 | 0.0 | 0.1865 | 0.1693 |
| bot | pw-chromium-headful-flag | naive | 6 | 1.0 | 0.757 | 0.757 |
| bot | pw-chromium-headless | humanized | 6 | 1.0 | 0.9641 | 0.9601 |
| bot | pw-chromium-headless | idle | 6 | 1.0 | 0.9641 | 0.9601 |
| bot | pw-chromium-headless | naive | 7 | 1.0 | 0.9973 | 0.9973 |
| bot | pw-chromium-headless-evasion | humanized | 6 | 1.0 | 0.9947 | 0.9947 |
| bot | pw-chromium-headless-evasion | idle | 6 | 1.0 | 0.9947 | 0.9947 |
| bot | pw-chromium-headless-evasion | naive | 6 | 1.0 | 0.9996 | 0.9996 |
| bot | pw-chromium-shell | humanized | 6 | 1.0 | 0.9916 | 0.9895 |
| bot | pw-chromium-shell | idle | 6 | 1.0 | 0.9895 | 0.9895 |
| bot | pw-chromium-shell | naive | 6 | 1.0 | 0.9993 | 0.9993 |
| bot | pw-firefox-headful | humanized | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-firefox-headful | idle | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-firefox-headful | naive | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-firefox-headless | humanized | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-firefox-headless | idle | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-firefox-headless | naive | 6 | 1.0 | 0.95 | 0.95 |
| bot | pw-stealth-headful | humanized | 6 | 0.0 | 0.1865 | 0.1693 |
| bot | pw-stealth-headful | idle | 5 | 0.0 | 0.1693 | 0.1693 |
| bot | pw-stealth-headful | naive | 6 | 1.0 | 0.757 | 0.757 |
| bot | pw-stealth-headless | humanized | 6 | 0.0 | 0.1693 | 0.1693 |
| bot | pw-stealth-headless | idle | 6 | 0.0 | 0.1865 | 0.1693 |
| bot | pw-stealth-headless | naive | 6 | 1.0 | 0.757 | 0.757 |
| human | nan | natural | 15 | 0.0 | 0.1693 | 0.1693 |
| human | nan | reading | 15 | 0.0 | 0.1693 | 0.1693 |
| human | nan | nan | 1 | 0.0 | 0.2872 | 0.2872 |

## Testes distributivos

Kolmogorov-Smirnov por feature com correção de Benjamini-Hochberg a 5%: **125 de 192** features separam as classes com significância.

As 15 mais discriminantes:

| feature | camada | ks | p |
|---|---|---|---|
| b_scroll_jump_p95 | D (comportamento) | 1.0 | 0.0 |
| b_scroll_jump_mean | D (comportamento) | 1.0 | 0.0 |
| b_scroll_jump_p50 | D (comportamento) | 1.0 | 0.0 |
| b_wheel_delta_unique_ratio | D (comportamento) | 1.0 | 0.0 |
| b_pm_turn_std | D (comportamento) | 1.0 | 0.0 |
| b_pm_turn_mean | D (comportamento) | 1.0 | 0.0 |
| b_pm_turn_p95 | D (comportamento) | 1.0 | 0.0 |
| b_pm_reversal_rate | D (comportamento) | 1.0 | 0.0 |
| b_scroll_jump_min | D (comportamento) | 0.9667 | 0.0 |
| b_pm_turn_p50 | D (comportamento) | 0.9375 | 0.0 |
| b_pm_accel_cv | D (comportamento) | 0.9208 | 0.0 |
| b_scroll_jump_std | D (comportamento) | 0.9188 | 0.0 |
| b_scroll_jump_cv | D (comportamento) | 0.9188 | 0.0 |
| b_click_dwell_mean | D (comportamento) | 0.9174 | 0.0 |
| b_click_dwell_p50 | D (comportamento) | 0.9091 | 0.0 |

## E4: regras contra modelos treinados

Intervalos de 95% por bootstrap agrupado por participante. Com 31 sessões humanas, o menor FPR acima de zero é 3.2%.

| modelo | roc_auc | auc_lo | auc_hi | pr_auc | tpr@1%fpr | tpr_lo | tpr_hi | f1 |
|---|---|---|---|---|---|---|---|---|
| Regras (baseline) | 0.903 | 0.8563 | 0.9402 | 0.9787 | 0.8056 | 0.7473 | 0.8619 | 0.8923 |
| Regressão logística L1 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| Gradient boosting | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |

### Contribuição por camada de sinal

| conjunto | n_features | roc_auc | tpr@1%fpr | f1 |
|---|---|---|---|---|
| Passivo (A+B+C) | 69 | 0.9935 | 0.9333 | 0.9863 |
| Comportamental (D) | 123 | 1.0 | 1.0 | 1.0 |
| Combinado | 192 | 1.0 | 1.0 | 1.0 |

## E1: ablação dos artefatos óbvios

Quanto sinal sobra quando o atacante apaga todo rastro direto de automação.

| features disponíveis | n | roc_auc | tpr@1%fpr | recall | f1 |
|---|---|---|---|---|---|
| Todas as features | 192 | 1.0 | 1.0 | 1.0 | 1.0 |
| Sem flags diretas | 190 | 1.0 | 1.0 | 1.0 | 1.0 |
| Sem a camada A inteira | 181 | 1.0 | 1.0 | 1.0 | 1.0 |
| Sem camada A e sem ambiente | 138 | 1.0 | 1.0 | 1.0 | 1.0 |
| Só comportamento (camada D) | 123 | 1.0 | 1.0 | 1.0 | 1.0 |

## E2: generalização para ferramenta não vista

| ferramenta retida | n_bot | roc_auc | tpr@1%fpr | recall no retido |
|---|---|---|---|---|
| playwright-chromium | 109 | 1.0 | 1.0 | 1.0 |
| playwright-firefox | 36 | 1.0 | 1.0 | 1.0 |
| playwright-stealth | 35 | 1.0 | 1.0 | 1.0 |

## E3: desempenho por sofisticação

| estrato | n | recall | p mediana |
|---|---|---|---|
| jornada: humanized | 60 | 1.0 | 0.999 |
| jornada: idle | 59 | 1.0 | 0.999 |
| jornada: naive | 61 | 1.0 | 0.999 |
| evasão: basic | 36 | 1.0 | 0.999 |
| evasão: flag | 18 | 1.0 | 0.999 |
| evasão: none | 91 | 1.0 | 0.999 |
| evasão: stealth-plugin | 35 | 1.0 | 0.999 |
| jornada × evasão: humanized / basic | 12 | 1.0 | 0.999 |
| jornada × evasão: humanized / flag | 6 | 1.0 | 0.999 |
| jornada × evasão: humanized / none | 30 | 1.0 | 0.999 |
| jornada × evasão: humanized / stealth-plugin | 12 | 1.0 | 0.999 |
| jornada × evasão: idle / basic | 12 | 1.0 | 0.999 |
| jornada × evasão: idle / flag | 6 | 1.0 | 0.999 |
| jornada × evasão: idle / none | 30 | 1.0 | 0.999 |
| jornada × evasão: idle / stealth-plugin | 11 | 1.0 | 0.999 |
| jornada × evasão: naive / basic | 12 | 1.0 | 0.999 |
| jornada × evasão: naive / flag | 6 | 1.0 | 0.999 |
| jornada × evasão: naive / none | 31 | 1.0 | 0.999 |
| jornada × evasão: naive / stealth-plugin | 12 | 1.0 | 0.999 |
| humanos (taxa de falso positivo) | 31 | 0.0 | 0.001 |

## E5: detecção de novidade sobre a classe humana

Treinado só com pessoas, sem ver nenhum bot. Sessão sem interação não tem comportamento a julgar: a imputação pela mediana a faz parecer a pessoa média, então o experimento aparece com e sem essas sessões.

Mediana de 20 divisões treino/teste por participante, com a faixa entre parênteses: com pouco mais de dez pessoas, quem cai no treino move o resultado em várias décimas.

- Só com evidência comportamental, teste com 9 humanas e 60 bots: ROC AUC **0.888** (0.530 a 0.956), TPR @ 1% FPR **0.017** (0.000 a 0.700)
- Todas as sessões, teste com 10 humanas e 180 bots: ROC AUC **0.337** (0.252 a 0.563), TPR @ 1% FPR **0.003** (0.000 a 0.267)

## Modelo na página

Decisão desta execução: modelo publicado: TPR @ 1% FPR 1.0000 contra 0.8056 das regras, 13 participantes humanos.
