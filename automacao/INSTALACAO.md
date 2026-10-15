# Automação da correção — instalação (fazer uma vez por formulário)

## O que isso resolve

Hoje o custo alto está em (a) achar/abrir os arquivos dos alunos e (b) clicar
resposta por resposta no Google Forms para lançar nota. Com esta automação:

- os arquivos aparecem no seu PC sozinhos (Google Drive para desktop);
- uma aba **Envios** na planilha diz exatamente qual arquivo é de qual aluno;
- o Claude só **lê os arquivos e escreve um CSV de notas** (parte barata);
- um script grava notas + feedback no formulário em 1 clique.

## Passo único — instalar o script no formulário

1. Abra o formulário em modo de edição.
2. Clique nos **⋮** (canto superior direito) → **Editor de script**.
3. Apague o que estiver lá, cole todo o conteúdo de `Code.gs` e salve (Ctrl+S).
   Dê um nome ao projeto (ex.: "PETI correção").
4. No topo do editor, escolha a função **`instalarMenu`** e clique em
   **Executar**. Na primeira vez o Google pede autorização: *Revisar permissões*
   → sua conta → *Avançado* → *Acessar (não seguro)* → *Permitir*.
   (É o seu próprio script; ele precisa de acesso a Forms, Drive e Planilhas.)
5. Abra a planilha de respostas (botão verde "Link para as Planilhas" na aba
   Respostas). Recarregue: aparece um menu **PETI** na barra.

Repita o passo 2 para cada formulário novo (cada lista tem o seu). É só colar.

## Uso a cada lista (fluxo completo)

1. **Planilha → menu PETI → "1b) Copiar envios para o Drive"**. Roda o
   "Exportar envios" e copia os arquivos dos alunos para
   `PETI Envios/<lista>/P<N>/<email>__<k>.<ext>` no seu Drive (+ `mapa.csv`).
   Com o Google Drive para Desktop, eles aparecem em
   `G:\Meu Drive\PETI Envios\...` sozinhos — espere o ícone de sincronização
   terminar. Se aparecer "TEMPO ESGOTADO", clique de novo (ele continua de
   onde parou; não copia repetido).
2. **Claude Code**: abra uma sessão na pasta `correcoespeti` e peça, por exemplo:
   > corrija a lista <nome> (Problemas 1 a 5); critério em `pautas/<arquivo>`
   O Claude copia os arquivos de `G:\Meu Drive\PETI Envios\<lista>` para
   `listas/<lista>/`, corrige em lotes com subagentes (as fotos nunca entram
   na conversa principal, que é o que custava caro) e gera
   `notas/<lista>_todos.csv`. O `CLAUDE.md` já explica a ele o formato e as
   regras (escala do critério ≠ escala do form, notas inteiras, consistência
   entre alunos). Pode pedir a lista inteira numa sessão só.
3. Revise o CSV (nota + feedback por aluno). O Claude também deixa uma cópia
   na pasta **PETI Notas** do seu Drive.
4. **Planilha → PETI → "2) Importar notas do CSV"**. Aparece uma caixa com o
   nome do arquivo mais recente da pasta PETI Notas — confirme com **Sim**.
   O script copia para a aba `Notas`, grava nota e feedback em cada resposta,
   mostra avisos (aluno não encontrado etc.) e renomeia o arquivo para
   `importado_...` para não importar duas vezes.
5. (Alternativa manual) "Criar aba Notas" + preencher à mão + "Importar notas
   da aba Notas" — só se quiser ajustar algo direto na planilha.
6. Confira no Forms e clique em **Liberar pontuação** quando quiser.

### Opcional: arquivos sem download (Google Drive para desktop)

Se instalar o Drive para desktop, os arquivos já ficam no PC e o Claude não
precisa baixar nada. Nesse caso, exporte a aba `Envios` como CSV e rode
`python automacao/organizar.py envios.csv "G:/Meu Drive/<pasta>" listas/<lista>`
para copiá-los renomeados por e-mail (`email__nome__1.pdf`) em `listas/<lista>/P<N>/`.

## Dicas

- `problema` na aba Notas tem de ser igual ao título da pergunta no form
  (ex.: `Problema 1`). Maiúsculas/minúsculas não importam.
- Se um aluno enviou duas vezes, vale a última resposta dele.
- Notas de quem não enviou arquivo: coloque `0` no CSV para o form registrar.
- Para reprocessar, é só rodar "Importar notas" de novo — ele sobrescreve.
