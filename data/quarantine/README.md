# Quarentena

Sessões excluídas da análise, mantidas como registro do motivo.

## `pre-ui-fix.jsonl`: a interface contaminando a medição

Contém a única sessão gravada antes da correção descrita em
[docs/02-metodologia.md](../../docs/02-metodologia.md), seção 2.6. Naquela versão a
interface reconstruía a tabela de sinais a cada 500ms, deslocando o layout e
emitindo eventos de rolagem que ninguém produziu. A sessão tem 80 eventos de
rolagem, contra 18 na mesma configuração depois da correção.

Fica aqui porque é a evidência do problema, e sai da análise porque as features de
rolagem dela medem o laço de interface, não o comportamento do bot.

## `pre-2026-09-15-harness-fix.jsonl`: o adversário que nunca digitou no campo

73 sessões automatizadas, o dataset inteiro coletado até 14/09. Descartadas quando
se descobriu que **as 31 sessões da jornada humanizada nunca digitaram no campo**:
o clique caía fora do `input` porque o painel de reason codes, que ficava acima da
área de interação, mudava de altura entre a medição da posição e o clique.

O texto ia para o documento, e os três espaços do texto rolavam a página, o que a
detecção lia como "rolagem sem roda do mouse". O adversário mais forte da matriz
estava sendo pego por um defeito dele mesmo. Detalhe em
[docs/02-metodologia.md](../../docs/02-metodologia.md), seção 2.6.

As sessões saem da análise porque o rótulo `humanized` descreve uma jornada que não
aconteceu. O arquivo não vai para o repositório (1,9 MB, e não acrescenta nada além
do registro acima).

Este arquivo não é versionado; a linha correspondente está no `.gitignore`.

## `headful-real-pointer.jsonl`: o mouse de quem rodava o harness

7 das 54 sessões headful coletadas em 16/09. Nas configurações headful a janela é
real, e o ponteiro do sistema que passa por cima dela gera eventos genuínos que o
gravador registra junto com os do Playwright. Uma sessão `naive` com 399 eventos de
ponteiro, contra 1 ou 2 nas limpas, deixou isso evidente.

Critério de descarte, aplicado a todas as sessões: movimento de ponteiro antes de
2,5s (a jornada só começa depois disso); `idle` com qualquer movimento; `naive` com
mais de 2 eventos de ponteiro; `humanized` com mais de 320 (o máximo nas 24 sessões
headless, onde não há ponteiro real, é 302). Um único evento parado no
carregamento é o hover do próprio navegador e aparece também em headless, então não
conta.

Na rodada seguinte, com a flag de lançamento e o plugin de stealth, o mesmo critério
tirou 1 das 36 sessões headful: uma `idle` com 70 eventos de ponteiro.

Na coleta contra a URL pública, em 18/09, o mesmo critério tirou 1 das 90 sessões
headful: uma `idle` do `pw-stealth-headful` com 33 eventos de ponteiro, contra no
máximo 1 nas headless da mesma jornada.

O arquivo não vai para o repositório (550 KB).
