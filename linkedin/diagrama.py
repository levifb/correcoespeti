import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams["font.family"] = "Segoe UI"

BG = "#0f172a"
CARD = "#1e293b"
EDGE = "#334155"
TXT = "#e2e8f0"
SUB = "#94a3b8"
ACC = "#38bdf8"   # coordenador
AG = "#a78bfa"    # corretores
OK = "#34d399"    # saída
WARN = "#fbbf24"  # nova regra

fig = plt.figure(figsize=(12, 12), dpi=150)
fig.patch.set_facecolor(BG)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis("off")


def box(x, y, w, h, title, sub="", color=ACC, tsize=17, ssize=12.5):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=1.8",
                                fc=CARD, ec=color, lw=2.2))
    cy = y + h / 2
    if sub:
        ax.text(x + w / 2, cy + 1.6, title, ha="center", va="center", color=TXT,
                fontsize=tsize, weight="bold")
        ax.text(x + w / 2, cy - 2.0, sub, ha="center", va="center", color=SUB,
                fontsize=ssize, linespacing=1.35)
    else:
        ax.text(x + w / 2, cy, title, ha="center", va="center", color=TXT,
                fontsize=tsize, weight="bold")


def arrow(p, q, color=SUB, style="-|>", ls="-", rad=0.0, lw=2):
    ax.add_patch(FancyArrowPatch(p, q, arrowstyle=style, mutation_scale=18, color=color,
                                 lw=lw, linestyle=ls, connectionstyle=f"arc3,rad={rad}"))


ax.text(50, 94.5, "Correção de provas com agentes de IA", ha="center", color=TXT,
        fontsize=30, weight="bold")
ax.text(50, 90.3, "~1.400 soluções manuscritas corrigidas  ·  13 listas  ·  nota + feedback individual",
        ha="center", color=SUB, fontsize=14.5)

# 1. envios
box(8, 76, 84, 9, "Envios dos alunos", "fotos de caderno e PDFs  →  Apps Script organiza no Drive",
    color=EDGE)
arrow((50, 76), (50, 70.5))

# 2. coordenador
box(18, 58, 64, 12, "Agente coordenador",
    "lê o critério oficial  ·  fixa a escala  ·  divide em lotes\nnunca abre as imagens (contexto leve)",
    color=ACC)

# 3. corretores
xs = [4, 28, 52, 76]
labels = ["lote 1", "lote 2", "lote 3", "lote n"]
for x, lab in zip(xs, labels):
    arrow((50, 58), (x + 10, 45.5), color=ACC, rad=0.0)
    box(x, 33, 20, 12.5, "Corretor", lab + "\nlê as soluções", color=AG, tsize=16, ssize=12)

ax.text(50, 49.6, "em paralelo", ha="center", color=ACC, fontsize=12.5, style="italic",
        bbox=dict(fc=BG, ec="none", pad=2))

# skill bar
ax.add_patch(FancyBboxPatch((4, 25), 92, 5, boxstyle="round,pad=0,rounding_size=1.2",
                            fc="#1e1b4b", ec=AG, lw=1.5, ls="--"))
ax.text(50, 27.5, "Skills + metodologia de correção compartilhada por todos os corretores",
        ha="center", va="center", color="#c4b5fd", fontsize=13.5)

# nova regra loop
arrow((88, 45.5), (80, 60), color=WARN, ls="--", rad=0.35)
arrow((20, 60), (12, 45.5), color=WARN, ls="--", rad=0.35)
ax.text(93.5, 54, "NOVA\nREGRA", ha="center", va="center", color=WARN, fontsize=12,
        weight="bold", linespacing=1.2)
ax.text(6.5, 54, "mesmo\ncritério", ha="center", va="center", color=WARN, fontsize=12,
        weight="bold", linespacing=1.2)

# 4. saída
arrow((50, 25), (50, 19.5))
box(8, 8, 84, 11.5, "CSV de notas  →  formulário",
    "coordenador confere consistência entre lotes  ·  importação com um clique",
    color=OK)

fig.savefig(r"C:\Users\levif\OneDrive\Desktop\abasclaude\correcoespeti\linkedin\diagrama.png",
            facecolor=BG)
