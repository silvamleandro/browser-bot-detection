# 3. Resultados

> Gerado por `analysis/notebooks/bot_detection_analysis.ipynb`. Não editar à mão.

## Composição do Dataset

211 sessões, 192 participantes/grupos, 185 features não constantes.

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
| — | natural | 15 |
| — | reading | 15 |
| — | sem roteiro | 1 |

## Detecção do Motor de Regras

Motor de regras avaliado separadamente, nas sessões completas e no seu limiar de operação. Para sessões `bot` a coluna `taxa` é detecção; para `human`, falso positivo. As regras foram escritas olhando estas mesmas sessões automatizadas, então a taxa dos bots descreve o ajuste, e não uma medida fora da amostra.

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
| bot | pw-chromium-shell | humanized | 6 | 1.0 | 0.9952 | 0.9933 |
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
| human | — | natural | 15 | 0.0 | 0.1693 | 0.1693 |
| human | — | reading | 15 | 0.0 | 0.1693 | 0.1693 |
| human | — | sem roteiro | 1 | 0.0 | 0.2872 | 0.2872 |

## Testes Distributivos

Kolmogorov-Smirnov por feature com correção de Benjamini-Hochberg a 5%: **118 de 185** features separam as classes com significância.

As 15 mais discriminantes:

| feature | camada | ks | p |
|---|---|---|---|
| b_pm_turn_mean | D (comportamento) | 1.0 | 0.0 |
| b_wheel_delta_unique_ratio | D (comportamento) | 1.0 | 0.0 |
| b_pm_reversal_rate | D (comportamento) | 1.0 | 0.0 |
| b_pm_turn_std | D (comportamento) | 1.0 | 0.0 |
| b_pm_turn_p95 | D (comportamento) | 1.0 | 0.0 |
| b_pm_turn_p50 | D (comportamento) | 0.9375 | 0.0 |
| b_pm_accel_cv | D (comportamento) | 0.9208 | 0.0 |
| b_click_dwell_mean | D (comportamento) | 0.9174 | 0.0 |
| b_click_dwell_p50 | D (comportamento) | 0.9091 | 0.0 |
| b_click_dwell_max | D (comportamento) | 0.9032 | 0.0 |
| b_click_dwell_p95 | D (comportamento) | 0.895 | 0.0 |
| b_pm_speed_std | D (comportamento) | 0.875 | 0.0 |
| b_pm_speed_p95 | D (comportamento) | 0.875 | 0.0 |
| b_interkey_p50 | D (comportamento) | 0.8333 | 0.0 |
| b_pm_jerk_cv | D (comportamento) | 0.825 | 0.0 |

## E4: Regras contra Modelos Treinados

Intervalos de 95% por bootstrap agrupado por participante. Com 31 sessões humanas, o menor FPR acima de zero é 3.2%.

| modelo | roc_auc | auc_lo | auc_hi | pr_auc | tpr@1%fpr | tpr_lo | tpr_hi | f1 |
|---|---|---|---|---|---|---|---|---|
| Regras (baseline) | 0.903 | 0.8563 | 0.9402 | 0.9787 | 0.8056 | 0.7473 | 0.8619 | 0.8923 |
| Regressão logística L1 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.989 |
| Gradient boosting | 0.9995 | 0.9977 | 1.0 | 0.9999 | 0.9889 | 0.9724 | 1.0 | 0.9917 |

### Contribuição por Camada de Sinal

| conjunto | n_features | roc_auc | tpr@1%fpr | f1 |
|---|---|---|---|---|
| Passivo (A+B+C) | 69 | 0.9935 | 0.9333 | 0.9863 |
| Comportamental (D) | 116 | 0.9995 | 0.9889 | 0.9945 |
| Combinado | 185 | 0.9995 | 0.9889 | 0.9917 |

## E1: Ablação dos Artefatos Óbvios

Quanto sinal sobra quando o atacante apaga todo rastro direto de automação.

| features disponíveis | n | roc_auc | tpr@1%fpr | recall | f1 |
|---|---|---|---|---|---|
| Todas as features | 185 | 0.9995 | 0.9889 | 0.9944 | 0.9917 |
| Sem flags diretas | 183 | 0.9993 | 0.9833 | 1.0 | 0.9945 |
| Sem a camada A inteira | 174 | 0.9993 | 0.9833 | 1.0 | 0.9945 |
| Sem camada A e sem ambiente | 131 | 0.9989 | 0.9722 | 1.0 | 0.9945 |
| Só comportamento (camada D) | 116 | 0.9995 | 0.9889 | 1.0 | 0.9945 |

## E2: Generalização para Ferramenta Não Vista

| ferramenta retida | n_bot | roc_auc | tpr@1%fpr | recall no retido |
|---|---|---|---|---|
| playwright-chromium | 109 | 0.9897 | 0.9174 | 0.9174 |
| playwright-firefox | 36 | 0.3889 | 0.0 | 0.5278 |
| playwright-stealth | 35 | 1.0 | 1.0 | 1.0 |

## E3: Desempenho por Sofisticação

| estrato | n | recall | p mediana |
|---|---|---|---|
| jornada: humanized | 60 | 0.9833 | 0.9988 |
| jornada: idle | 59 | 1.0 | 0.9992 |
| jornada: naive | 61 | 1.0 | 0.9992 |
| evasão: basic | 36 | 1.0 | 0.9992 |
| evasão: flag | 18 | 0.9444 | 0.9991 |
| evasão: none | 91 | 1.0 | 0.9992 |
| evasão: stealth-plugin | 35 | 1.0 | 0.9991 |
| jornada × evasão: humanized / basic | 12 | 1.0 | 0.9983 |
| jornada × evasão: humanized / flag | 6 | 0.8333 | 0.9991 |
| jornada × evasão: humanized / none | 30 | 1.0 | 0.9988 |
| jornada × evasão: humanized / stealth-plugin | 12 | 1.0 | 0.9991 |
| jornada × evasão: idle / basic | 12 | 1.0 | 0.9992 |
| jornada × evasão: idle / flag | 6 | 1.0 | 0.9991 |
| jornada × evasão: idle / none | 30 | 1.0 | 0.9992 |
| jornada × evasão: idle / stealth-plugin | 11 | 1.0 | 0.9992 |
| jornada × evasão: naive / basic | 12 | 1.0 | 0.9992 |
| jornada × evasão: naive / flag | 6 | 1.0 | 0.9991 |
| jornada × evasão: naive / none | 31 | 1.0 | 0.9992 |
| jornada × evasão: naive / stealth-plugin | 12 | 1.0 | 0.9991 |
| humanos (taxa de falso positivo) | 31 | 0.0645 | 0.002 |

## E5: Detecção de Novidade sobre a Classe Humana

Treinado só com pessoas, sem ver nenhum bot. Sessão sem interação não tem comportamento a julgar: a imputação pela mediana a faz parecer a pessoa média, então o experimento aparece com e sem essas sessões.

Mediana de 20 divisões treino/teste por participante, com a faixa entre parênteses: com pouco mais de dez pessoas, quem cai no treino move o resultado em várias décimas.

- Só com evidência comportamental, teste com 9 humanas e 60 bots: ROC AUC **0.824** (0.617 a 0.914), TPR @ 1% FPR **0.000** (0.000 a 0.183)
- Todas as sessões, teste com 10 humanas e 180 bots: ROC AUC **0.355** (0.237 a 0.643), TPR @ 1% FPR **0.000** (0.000 a 0.233)

## Auditoria do Motor de Regras

Taxa de disparo de cada uma das 37 regras, por classe, nas sessões completas. Peso positivo acusa automação, negativo defende o visitante; `aponta` compara o sinal da separação com o sinal do peso.

19 regras não disparam em nenhuma sessão deste conjunto: são cobertura para adversários que a matriz não gera, e não contribuem com a detecção medida aqui.

| regra | camada | grupo | peso | em humanos | em bots | separação | aponta |
|---|---|---|---|---|---|---|---|
| webdriver | A | hard | 4.0 | 0.0 | 0.5056 | 0.5056 | certo |
| click_without_approach | D | behaviour | 2.0 | 0.0 | 0.3389 | 0.3389 | certo |
| scroll_programmatic | D | behaviour | 1.5 | 0.0 | 0.3389 | 0.3389 | certo |
| ua_headless | A | hard | 3.5 | 0.0 | 0.3056 | 0.3056 | certo |
| utc_no_dst | B | env | 0.5 | 0.0 | 0.2611 | 0.2611 | certo |
| programmatic_fill | D | behaviour | 2.5 | 0.0323 | 0.2722 | 0.24 | certo |
| webgl_context_mismatch | A | tamper | 2.0 | 0.0 | 0.2 | 0.2 | certo |
| accessors_patched | A | tamper | 2.0 | 0.0 | 0.2 | 0.2 | certo |
| webdriver_tampered | A | tamper | 2.5 | 0.0 | 0.2 | 0.2 | certo |
| natives_patched | A | tamper | 2.0 | 0.0 | 0.2 | 0.2 | certo |
| no_window_chrome | B | env | 1.5 | 0.129 | 0.3111 | 0.1821 | certo |
| software_gpu | B | env | 1.5 | 0.129 | 0.3056 | 0.1765 | certo |
| perm_mismatch | B | env | 1.5 | 0.0 | 0.1 | 0.1 | certo |
| chrome_stub | A | tamper | 1.5 | 0.0 | 0.1 | 0.1 | certo |
| screen_client_eq | D | behaviour | 3.0 | 0.0 | 0.0333 | 0.0333 | certo |
| globals | A | hard | 4.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| doc_keys | A | hard | 4.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| exposed_binding | A | hard | 4.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| cdp | A | env | 1.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| no_media_stack | B | env | 0.75 | 0.0 | 0.0 | 0.0 | nunca dispara |
| pointer_none | B | env | 1.5 | 0.0 | 0.0 | 0.0 | nunca dispara |
| no_raf | C | timing | 2.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| ua_incoherent | B | env | 2.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| few_fonts | B | env | 1.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| chromium_codecs | B | env | 1.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| typed_too_fast | D | behaviour | 2.5 | 0.0 | 0.0 | 0.0 | nunca dispara |
| raf_off_vsync | C | timing | 1.5 | 0.0 | 0.0 | 0.0 | nunca dispara |
| no_movement_delta | D | behaviour | 2.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| scroll_orphan | D | behaviour | 0.75 | 0.0 | 0.0 | 0.0 | nunca dispara |
| no_submovements | D | behaviour | 1.5 | 0.0 | 0.0 | 0.0 | nunca dispara |
| constant_dwell | D | behaviour | 1.5 | 0.0 | 0.0 | 0.0 | nunca dispara |
| single_pressure | D | behaviour | 1.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| untrusted_events | D | behaviour | 3.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| human_pressure | D | behaviour | -1.0 | 0.0 | 0.0 | 0.0 | nunca dispara |
| human_curvature | D | behaviour | -1.0 | 0.0968 | 0.0611 | -0.0357 | certo |
| human_submovements | D | behaviour | -1.5 | 0.5161 | 0.3333 | -0.1828 | certo |
| human_touch | D | behaviour | -1.0 | 0.4839 | 0.0 | -0.4839 | certo |

## O Veredito ao Longo da Visita

Eventos cortados em instantes fixos e reavaliados com a política de `web/src/decision.js`. A pontuação do modelo é fora da amostra: as árvores de cada partição veem só sessões completas de outros participantes.

Esta é a tabela que as métricas de sessão completa não mostram. O falso positivo da sessão completa é zero, mas durante a visita existem falsos positivos transitórios, enquanto a evidência comportamental ainda não chegou.

| instante | falso positivo | detecção | decididas pelo modelo |
|---|---|---|---|
| 0.5s | 0 | 0.7056 | 0 |
| 1s | 0 | 0.7056 | 0 |
| 2s | 0 | 0.7056 | 0 |
| 5s | 0 | 0.8 | 2 |
| 10s | 1 | 0.8056 | 7 |
| 20s | 1 | 0.9 | 36 |
| completa | 0 | 0.9 | 38 |

## Curva de Aprendizado por Participante

AUC em função de quantas pessoas entram no treino, separando por participante: um terço das pessoas e um terço dos bots ficam de fora em cada sorteio. Mediana de 12 sorteios por ponto.

Da metade da curva ao último ponto a AUC mediana move +0.0000, e o máximo já aparece com 5 pessoas. A curva satura porque a AUC encosta no teto contra este gerador de bots, e teto não é evidência de que participantes deixem de importar: retendo uma ferramenta inteira do treino, o E2 cai para AUC 0.3889. O que falta a este conjunto é variedade de adversário, e isso nenhuma quantidade de participantes resolve.

| pessoas no treino | sorteios | sessões humanas | auc_mediana | auc_p10 | tpr_mediano |
|---|---|---|---|---|---|
| 1 | 12 | 2.0 | 0.9002 | 0.8186 | 0.75 |
| 2 | 12 | 4.0 | 0.9858 | 0.9057 | 0.925 |
| 3 | 12 | 6.0 | 0.9983 | 0.9934 | 0.9833 |
| 4 | 12 | 9.5 | 0.9992 | 0.9 | 0.9917 |
| 5 | 12 | 12.0 | 1.0 | 0.9472 | 1.0 |
| 6 | 12 | 14.0 | 1.0 | 0.9953 | 1.0 |
| 7 | 12 | 16.5 | 1.0 | 0.995 | 1.0 |
| 8 | 12 | 19.0 | 1.0 | 0.995 | 1.0 |
| 9 | 12 | 21.0 | 1.0 | 0.9968 | 1.0 |

## Modelo na Página

Decisão desta execução: modelo publicado: detecção sem nenhum falso positivo entre as 31 sessões humanas, 0.9889 contra 0.8056 das regras, com 13 participantes humanos.

O modelo exportado decide com 19 features, de 185 disponíveis. A página só o usa quando as comportamentais entre elas existem na sessão; até lá, decidem as regras.

| feature | camada | nós |
|---|---|---|
| b_click_dwell_max | D (comportamento) | 144 |
| b_pm_reversal_rate | D (comportamento) | 126 |
| b_click_dwell_mean | D (comportamento) | 123 |
| b_events_per_sec | D (comportamento) | 57 |
| a_webdriver | A (automação) | 33 |
| e_outer_inner_h_diff | B (ambiente) | 27 |
| b_click_dwell_std | D (comportamento) | 27 |
| b_pm_accel_p50 | D (comportamento) | 26 |
| b_pm_accel_p95 | D (comportamento) | 17 |
| b_click_dwell_p95 | D (comportamento) | 16 |
| b_pm_submovement_rate | D (comportamento) | 13 |
| b_pm_step_min | D (comportamento) | 8 |
| b_wheel_delta_unique_ratio | D (comportamento) | 8 |
| b_pm_accel_cv | D (comportamento) | 6 |
| b_pm_speed_p95 | D (comportamento) | 5 |
| t_loop_lag_mean | C (timing) | 4 |
| b_wheel_delta_std | D (comportamento) | 4 |
| b_pm_dt_p95 | D (comportamento) | 3 |
| b_pm_accel_min | D (comportamento) | 3 |

A página usa regras no início e passa ao modelo quando as features comportamentais usadas pelas árvores estão disponíveis. Sinais diretos de automação mantêm a decisão das regras. As métricas de cada motor avaliam regras e modelos separadamente em sessões completas; a seção sobre o veredito ao longo da visita mede a transição. Veja a [política de decisão](02-metodologia.md#27-como-o-veredito-é-decidido-e-por-que-humanos-vinham-dando-bot).
