# Correção de listas do PETI com Claude Code

Fluxo para corrigir listas de olimpíada de matemática (PETI, níveis 2 e 3) com
o Claude Code. Os alunos enviam fotos ou PDFs pelo Google Forms. Subagentes
corrigem em lotes seguindo um critério fixo. O resultado é um único CSV de
notas com feedback, que é importado na planilha de respostas por um menu.

## Como funciona

1. **Coleta.** Um Apps Script instalado no formulário copia os envios para o
   Google Drive e monta uma aba `Envios` (e-mail, nome, problema, arquivo).
   Com o Drive para Desktop, os arquivos aparecem sozinhos no PC.
2. **Organização.** `automacao/organizar.py` nomeia os arquivos como
   `email__nome__k.ext` e separa por lista e problema.
3. **Correção.** O Claude lê a pauta (enunciado e critério) e divide os alunos
   em lotes de cerca de 8. Cada lote vai para um subagente, que segue
   `CORRECAO.md` e devolve uma linha por aluno com nota bruta, falha
   principal e feedback. A conversa principal só coordena. Ela converte a
   escala, uniformiza descontos entre lotes e junta o resultado.
4. **Saída.** Um CSV `email,nome,problema,nota,feedback`. No menu PETI da
   planilha, "Importar notas do CSV" lança tudo de uma vez.

## Estrutura

```
automacao/    Apps Script (Code.gs), guia de instalação e organizar.py
CORRECAO.md   Metodologia de correção que os subagentes seguem
linkedin/     Diagrama do fluxo e script que o gera
```

Ficam fora do repositório (ver `.gitignore`), por conterem dados de alunos:
`listas/` (arquivos enviados), `notas/` (CSVs), `pautas/` e `CLAUDE.md`
(instruções do projeto com histórico do que já foi corrigido).

## Metodologia (resumo)

- A nota mede se o aluno provou o que foi pedido, como numa banca de OBM.
- Solução alternativa completa vale nota cheia.
- Fatos padrão do nível não precisam de prova.
- Só há desconto por passo essencial sem prova ou por afirmação falsa, e a
  falsidade é verificada antes.
- A mesma falha recebe o mesmo desconto em todos os lotes.
- Na dúvida, vale a nota maior e o professor é avisado.

Detalhes em [`CORRECAO.md`](CORRECAO.md).

## Instalação

Veja [`automacao/INSTALACAO.md`](automacao/INSTALACAO.md). A instalação é feita
uma vez por formulário.

## Requisitos

- [Claude Code](https://claude.com/claude-code)
- Google Drive para Desktop
- Python 3 (para `organizar.py`)
