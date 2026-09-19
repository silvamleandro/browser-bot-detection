# 7. Coleta com Pessoas: O Protocolo Usado

Registro de como as sessões humanas foram obtidas. Os números estão em
[03-resultados.md](03-resultados.md).

## Antes de Convidar

A página corrigida foi publicada antes de qualquer convite, e o caminho de coleta
foi verificado com uma sessão de teste: painel de pesquisa visível, envio aceito pelo
coletor, sessão presente no armazenamento.

Essa verificação aconteceu antes de o protocolo de códigos existir, então ela ficou
com o código que o navegador sorteia (`p_mk19vj8e`) e é excluída da análise: o
notebook só aceita sessões humanas cujo código de participante segue o padrão `P`
seguido de dígitos. O certo é reservar um código próprio para esse teste, como `TESTE01`, que o
mesmo filtro descarta sem ambiguidade.

Cada pessoa recebeu um código neutro e exclusivo, `P01` em diante. Nome, e-mail ou
telefone nunca entraram na URL.

## O que Foi Pedido a Cada Participante

Duas sessões curtas por aparelho, de 2 a 3 minutos no total:

- **Uso normal** (`journey=natural`): explorar por cerca de um minuto, digitar um
  texto inventado, usar o botão e rolar a página e a caixa de texto como de costume.
- **Leitura** (`journey=reading`): ler por 20 a 30 segundos, rolando se precisar, sem
  obrigação de digitar ou clicar.

Os links seguem este formato, com o mesmo código em todos os aparelhos da pessoa:

```
https://silvamleandro.github.io/browser-bot-detection/?research=1&participant=P01&label=human&config=desktop&journey=natural
```

`config` distingue `desktop` de `mobile` e `journey` distingue os dois cenários. Os
parâmetros só registram a condição informada: não mudam o navegador, o zoom, nem
executam ações pelo participante.

Três instruções importavam mais que as outras:

- usar o navegador, o zoom e a configuração de sempre, sem preparar nada;
- enviar a sessão mesmo que a página dissesse **Bot**, porque tentar convencer o
  detector estragaria o dado;
- clicar em **Submit This Session** ao fim de cada sessão e esperar a confirmação
  antes de abrir o próximo link.

Em caso de falha no envio, o participante usava **Download JSON** e mandava o
arquivo.

## Regras que Valeram na Consolidação

- Toda sessão coletada assim tem rótulo **human**, independentemente do que a página
  previu. Sessão classificada como bot não é descartada: é justamente o dado que
  interessa.
- Nada de repetir uma sessão até sair um resultado melhor. Repetição só por falha
  técnica, com o motivo registrado.
- Pessoas e sessões são contadas separadamente. Duas sessões da mesma pessoa não são
  duas pessoas, e todas as sessões dela ficam do mesmo lado da divisão treino e
  teste.
- Sessões duplicadas, quando chegaram pelo coletor e por arquivo, foram mantidas uma
  vez por `session_id`.
- Os bots da comparação foram gerados contra a mesma versão publicada da página. As
  sessões antigas ficaram fora.
- Casos de compatibilidade que dependiam de configuração específica, como zoom a 80%
  e arraste da barra de rolagem, foram testados por quem conduziu a coleta e
  identificados como tal, em vez de impostos aos participantes.
