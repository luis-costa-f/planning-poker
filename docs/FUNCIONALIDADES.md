# Funcionalidades

Lista completa do que o Planning Poker P2P faz, agrupada por área.

## Entrada (Lobby)

- Criar sala informando só o seu nome (obrigatório, até 30 caracteres), sem cadastro.
- **Nome da sala** opcional ao criar (até 40 caracteres).
- Entrar numa sala pelo **código** de 6 caracteres (sem 0/O/1/I para evitar confusão); aceita minúsculas, espaços e símbolos.
- Entrar pelo **link de convite** (`?sala=CÓDIGO`): o código já vem preenchido.
- **Contador de salas abertas** em tempo real ("N salas abertas · M pessoas"), sem servidor próprio.
- Mensagens de erro claras: sala não encontrada, falha de rede, navegador sem WebRTC, tempo esgotado.

## Sala

- Cabeçalho com o código da sala, o nome da sala e o selo "Host".
- Botões **Copiar código**, **Convidar** (copia o link) e **Sair** (o Host precisa confirmar, porque isso encerra a sala para todos).
- O Host **renomeia a sala** a qualquer momento.
- Mesa com os participantes distribuídos acima e abaixo; 👑 no Host e o próprio nome em azul.
- Status de cada pessoa: **Votando...** ou **Votou!**
- **Jogar emoji em alguém** para chamar a atenção: clique na carta da pessoa e escolha um dos atalhos (👋 ⏰ ☕ 🍅 🎯 🎉 🤔 💤) ou qualquer outro em **Mais emojis…**, com busca. É **anônimo**: todos veem o emoji vir de um ponto aleatório da borda da tela até a carta da pessoa, que balança com o impacto, mas ninguém sabe quem jogou.

## Votação

- Baralho Fibonacci: `0 ½ 1 2 3 5 8 13 21 34 55 89 ? ☕`.
- Para desmarcar o voto, basta clicar de novo na mesma carta.
- Os **votos ficam ocultos** até o Host revelar, inclusive na rede: os valores só são enviados depois da revelação.
- O Host pode escolher **só conduzir a sala, sem votar** (e voltar a votar quando quiser). Na mesa ele aparece como "Só conduzindo" e, na capacidade, com a barra laranja de quem não vota.
- O Host **revela as cartas** (precisa haver pelo menos um voto) e as cartas viram com animação 3D.
- Resultado da rodada:
  - **valor mais votado** no centro da mesa (ou a média, se houver empate);
  - gráfico de barras com a distribuição dos votos;
  - anel de **concordância** (% no valor mais votado; 🎉 quando há consenso);
  - **média** (`?` e `☕` não entram na conta).
- O Host inicia uma nova rodada com **Votar novamente** (zera os votos).

## Capacidade do time

- Tabela "👥 Capacidade do time" no canto da sala, que pode ser recolhida.
- Quem está na sala entra na tabela automaticamente, com 100% de alocação.
- Cada membro informa a **própria alocação (%)**; o Host pode ajustar a de todos.
- Qualquer pessoa pode **adicionar alguém do time pelo nome**, mesmo que não vote (até 30 pessoas), e remover depois. Basta digitar na última linha da tabela: a pessoa passa a existir na primeira letra, sem botão de confirmar, e o nome continua editável. Essas pessoas aparecem com uma barra laranja, explicada na legenda "Não está votando".
- **Configuração da sprint** de cada sala, que qualquer pessoa altera:
  - **dias úteis** (padrão 15);
  - **feriados/folgas**, que diminuem os dias da sprint;
  - **pontos por dia** (padrão 1, ou seja, 15 dias = 15 pontos por pessoa);
  - opção de **arredondar para baixo** os pontos de cada pessoa (4,5 → 4).
- Tudo isso pode ser alterado **a qualquer momento**, inclusive durante a votação.
- O cálculo atualiza na hora, enquanto alguém digita a alocação ou a configuração.
- A tabela calcula os pontos de cada pessoa (dias úteis × pontos por dia × alocação), a alocação média e a capacidade total do time. Exemplo: sprint de 15 dias com 30% de alocação = 4,5 pontos (ou 4, arredondando).

## Fechamento das salas

- A sala fecha na hora quando o Host fecha a aba, e os convidados voltam ao Lobby com um aviso.
- Fecha sozinha depois de **60 minutos sem atividade**.
- O contador de salas descarta salas que ficarem sem sinal por 2,5 minutos.

## Painel do admin (link mágico)

- Acesso por um link secreto (`#admin=...`), protegido por criptografia de chave pública, sem senha no código.
- Aba **Salas abertas**:
  - total de salas e de pessoas;
  - um card por sala com código, nome, há quanto tempo está aberta, última atividade, rodada, quantos votaram e os nomes dos participantes;
  - **Entrar** na sala ou **Encerrar** uma sala ou todas de uma vez.
- Os dados das salas chegam **criptografados**: só o link do admin consegue ler.
- Os comandos de encerrar vão **assinados**, e cada Host confere a assinatura antes de obedecer.
- Aba **Estatísticas** (precisa do Supabase): ver abaixo.

## Estatísticas anônimas (opcional, Supabase)

- A cada revelação é gravada uma linha com as cartas jogadas e quantas pessoas não votaram, **sem nomes nem código da sala**.
- No geral: total de salas, rodadas reveladas, média geral, taxa de abstenção, cartas mais e menos votadas e gráfico com todo o baralho.
- Por sala (as 100 mais recentes): data de abertura, rodadas, média, mais e menos votada, abstenções.
- Se o Supabase não estiver configurado, o jogo funciona normalmente e nada é enviado.

## Privacidade e segurança

- Sem cadastro, sem cookies e sem `localStorage`: tudo fica na memória do Host e some quando a sala fecha.
- Comunicação **peer-to-peer** (WebRTC): o servidor do PeerJS só apresenta os navegadores, sem ver nomes nem votos.
- O contador de salas recebe em claro apenas números.
- O build é bloqueado se alguém tentar publicar uma chave secreta do Supabase.

## Técnico

- Site 100% estático no **GitHub Pages**, com deploy automático via GitHub Actions.
- Layout responsivo para desktop e celular.
- Interface toda em português do Brasil.
