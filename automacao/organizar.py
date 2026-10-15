"""
Organiza os arquivos enviados pelos alunos em pastas por problema, renomeando
por e-mail, a partir da aba "Envios" exportada da planilha (salva como CSV).

Uso:
    python organizar.py envios.csv "G:/Meu Drive/<pasta do formulário>" saida/

- envios.csv : aba "Envios" exportada (Arquivo > Fazer download > CSV)
- origem     : pasta que contém as subpastas "Problema N (File responses)"
               (Google Drive para desktop) — ou qualquer pasta onde os
               arquivos estejam, mesmo misturados (procura recursivamente)
- saida      : pasta destino; cria saida/P1, saida/P2, ... com os arquivos
               copiados como  <email>__<nome>__<n>.<ext>

Também gera saida/mapa_P<N>.csv (email, nome, arquivos) para o corretor.
"""
import csv
import os
import re
import shutil
import sys
from collections import defaultdict


def limpa(s):
    s = re.sub(r"[^\w.@-]+", "_", s.strip())
    return s[:80]


def main(envios_csv, origem, saida):
    # indexa todos os arquivos da origem pelo nome
    por_nome = {}
    for raiz, _, arquivos in os.walk(origem):
        for a in arquivos:
            por_nome.setdefault(a, os.path.join(raiz, a))

    mapa = defaultdict(lambda: defaultdict(list))  # problema -> email -> [(nome, arq)]
    faltando = []
    with open(envios_csv, newline="", encoding="utf-8-sig") as f:
        for linha in csv.DictReader(f):
            prob = linha["problema"].strip()
            email = linha["email"].strip().lower()
            nome = linha["nome"].strip()
            arq = linha["nomeDoArquivo"].strip()
            if not arq or arq.startswith("("):
                mapa[prob][email]  # registra aluno sem arquivo
                continue
            if arq not in por_nome:
                faltando.append((prob, email, arq))
                continue
            mapa[prob][email].append((nome, por_nome[arq]))

    for prob, alunos in mapa.items():
        m = re.search(r"\d+", prob)
        pasta = os.path.join(saida, "P" + (m.group(0) if m else limpa(prob)))
        os.makedirs(pasta, exist_ok=True)
        linhas = []
        for email, itens in sorted(alunos.items()):
            nomes = []
            for n, (nome, caminho) in enumerate(itens, 1):
                ext = os.path.splitext(caminho)[1].lower() or ".bin"
                destino = os.path.join(pasta, f"{limpa(email)}__{limpa(nome)}__{n}{ext}")
                shutil.copy2(caminho, destino)
                nomes.append(os.path.basename(destino))
            linhas.append([email, itens[0][0] if itens else "", ";".join(nomes)])
        with open(os.path.join(saida, f"mapa_{os.path.basename(pasta)}.csv"), "w",
                  newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["email", "nome", "arquivos"])
            w.writerows(linhas)
        print(f"{prob}: {sum(1 for v in alunos.values() if v)} alunos com arquivo, "
              f"{sum(1 for v in alunos.values() if not v)} sem arquivo -> {pasta}")

    if faltando:
        print("\nArquivos listados em Envios mas não encontrados na origem:")
        for p, e, a in faltando:
            print(f"  {p} | {e} | {a}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(*sys.argv[1:])
