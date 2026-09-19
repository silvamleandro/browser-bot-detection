# 4. Privacidade, Monitoramento e Escala

Notas sobre o que muda entre este case e um sistema em produção.

## 4.1 Privacidade

Fingerprinting é uma técnica adjacente a rastreamento, e tratar isso com
naturalidade seria um erro, ainda mais para uma empresa cujo posicionamento é
prevenção a fraude com preservação de privacidade.

Decisões tomadas aqui:

O conteúdo digitado **nunca** é registrado. O gravador armazena a categoria da tecla,
entre letra, dígito, pontuação, apagar e controle, mais os tempos, jamais o
caractere. Uma senha digitada na página de coleta não pode acabar no dataset. O custo
é real e vale declarar: features de dígrafo específico, a latência de "th" contra
"qu", usadas em autenticação contínua, ficam indisponíveis. Para separar humano de
automação a distribuição agregada de latências basta.

Nenhum identificador persistente de dispositivo. O identificador de participante é
um código neutro do link de convite (`P01`, `P02`...), o mesmo em todos os aparelhos
da pessoa, e existe apenas para agrupar as sessões dela na validação cruzada. Não é
derivado de nenhuma característica do dispositivo. Quem distribui os códigos sabe a
quem entregou cada um, então ele é um pseudônimo, não um dado anônimo. Sem código no
link, a página sorteia um e o guarda no navegador, e ele só agrupa as sessões daquele
navegador.

Nenhum identificador que a detecção não use. Saíram das sondas o hash de canvas, o
hash e a soma do buffer de áudio, que é a receita do fingerprint de áudio do
FingerprintJS, a lista de fontes instaladas, os Client Hints de alta entropia, o
nível da bateria e a posição da janela na tela. Nenhum alimentava feature ou regra, e
coletar identificador que o modelo não usa é custo puro de privacidade.

O que ficou ainda descreve o ambiente, e não é anônimo: User-Agent, strings da GPU,
tamanho da tela, idioma, fuso horário, contagens e limites de capacidade, larguras
de texto. Esses valores são a matéria das checagens de coerência, e juntos se
aproximam de um fingerprint. Por isso a coleta é restrita e tem prazo.

Coleta é opt-in explícito e de escopo limitado. Só existe com `?research=1`, com
painel de consentimento visível que diz quem coleta, para quê e por quanto tempo, e
nada é enviado antes de um clique. Fora desse modo, a página não envia dado nenhum.

Retenção. Para este case, as sessões existem enquanto o processo seletivo durar
e devem ser descartadas depois. Em produção, sinais comportamentais brutos são
dados sensíveis: o desenho correto é computar features na borda e reter os
agregados, não as trajetórias.

## 4.2 O que o Scoring no Servidor Acrescentaria

A camada 3 da taxonomia, que reúne JA3/JA4 de TLS, ordenação de frames e parâmetros
SETTINGS de HTTP/2, ordem de cabeçalhos, é das mais robustas disponíveis e é
inacessível a JavaScript. Exige observar a conexão.

Num sistema de produção isso renderia três ganhos:

1. Sinais que exigem build modificado para falsificar. Contornar um fingerprint
   de TLS não é questão de patchear uma API: exige recompilar a pilha de rede.
2. Um cross-check novo e forte. Um handshake TLS com assinatura de Chrome
   headless em Linux, vindo de um JavaScript que se declara Chrome em Windows, é
   uma contradição que nenhuma das duas camadas detecta sozinha.
3. A lógica de decisão deixa de ser visível ao atacante. Hoje ela é entregue ao
   cliente inteira, as regras e o `model.json`, e pode ser lida e
   otimizada contra. Com scoring no servidor, o adversário observa apenas a decisão.

A arquitetura correspondente mantém a coleta no cliente, que é onde os sinais
comportamentais existem, e move a pontuação para o servidor, com o cliente
enviando o vetor de features assinado junto à requisição.

## 4.3 Monitoramento e Decaimento

Um detector de bots é um modelo com adversário adaptativo: ele degrada não porque o
mundo muda devagar, mas porque alguém está ativamente trabalhando contra ele. O
monitoramento precisa refletir isso.

**Deriva por feature.** Índice de estabilidade populacional comparando a janela
corrente com a de referência. Um salto isolado costuma ser mudança de versão de
navegador; um salto correlacionado em várias features da camada A indica ferramenta
de evasão nova ganhando tração.

**Testes periódicos com bots conhecidos.** O harness deste projeto rodando contra produção em
intervalo fixo, com alerta se o score de uma configuração conhecida cair. Detecta
degradação sem esperar rótulo, que em fraude chega com semanas de atraso.

**Métricas por estrato, nunca só agregadas.** O número global é dominado pelo
adversário mais comum, que é o mais fácil, e a degradação aparece primeiro no estrato
sofisticado.

**Rótulos atrasados.** Chargebacks e contas banidas são o rótulo mais confiável, e
chegam depois. O retreinamento precisa deles com atenção ao viés de seleção: sessão
bloqueada não gera desfecho observável, e ignorar isso enviesa o modelo a favor do
que ele já bloqueava.

## 4.4 Escala

O dataset deste case tem ordem de centena de sessões e cabe em memória. O cálculo
de features roda no cliente e é refeito a cada atualização sobre os eventos
acumulados. Há ordenações e buscas entre sequências de eventos, portanto não é uma
única passada de custo linear. O gravador limita cada sessão a 12.000 eventos.

A página usa o motor de regras ou, quando publicado, o modelo de árvores. Não foram
medidos latência de inferência ou gargalos em escala de produção. Antes de ampliar
o volume, seria necessário medir esses custos. Enviar apenas features agregadas,
como proposto na seção 4.1, reduziria o transporte; a coleta de pesquisa atual envia
eventos brutos para permitir reanálise.

Neste case, os eventos brutos permitem recalcular features durante a pesquisa,
com a retenção limitada descrita na seção de privacidade. Isso não implica guardar
trajetórias indefinidamente em produção. A proposta para produção é reter os
agregados necessários à detecção e ao monitoramento; uma coleta de eventos brutos
para investigação exigiria finalidade e prazo próprios. O processamento em lote
pode juntar esses agregados aos desfechos atrasados e calcular estatísticas de
deriva.
