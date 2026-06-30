"""
generate_agent_diagram.py  --  AI Engine agent topology diagram
"""
import os, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import math

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eval_results")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def rbox(ax, x, y, w, h, title, sub='', fc='#3f51b5', tc='white',
         fs=9.5, sfs=7.5, pad=0.18, zorder=4):
    ax.add_patch(FancyBboxPatch(
        (x - w/2, y - h/2), w, h,
        boxstyle="round,pad=%.2f" % pad,
        facecolor=fc, edgecolor='white', linewidth=2.2, zorder=zorder))
    ty = y + (0.13 if sub else 0)
    ax.text(x, ty, title, ha='center', va='center',
            fontsize=fs, fontweight='bold', color=tc, zorder=zorder+1)
    if sub:
        ax.text(x, y - 0.22, sub, ha='center', va='center',
                fontsize=sfs, color=tc, alpha=0.90, zorder=zorder+1)

def straight_arrow(ax, x1, y1, x2, y2, color='#555', lw=1.6, label='',
                   lfs=7.5, label_side='right'):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw,
                                connectionstyle='arc3,rad=0.0'), zorder=3)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        offset = 0.12 if label_side == 'right' else -0.12
        ax.text(mx + offset, my, label, ha='left' if label_side=='right' else 'right',
                va='center', fontsize=lfs, color=color, style='italic', zorder=5)

def double_arrow(ax, x1, y1, x2, y2, color='#555', lw=1.5):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='<->', color=color, lw=lw,
                                connectionstyle='arc3,rad=0.0'), zorder=3)


def make_agent_topology():
    fig, ax = plt.subplots(figsize=(16, 12))
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 12)
    ax.axis('off')
    fig.patch.set_facecolor('#f0f2f8')

    # ?? Title ?????????????????????????????????????????????????????????????????
    ax.text(8.0, 11.55,
            'WMS AI Engine  --  Agent Topology & Communication Flow',
            ha='center', fontsize=14, fontweight='bold', color='#1a237e')
    ax.text(8.0, 11.17,
            'How the Master Agent coordinates specialist agents via intent classification',
            ha='center', fontsize=9.5, color='#555', style='italic')

    # ?? Outer border ??????????????????????????????????????????????????????????
    border = FancyBboxPatch((0.3, 0.3), 15.4, 10.55,
                            boxstyle='round,pad=0.2',
                            facecolor='#fce4ec', edgecolor='#ef9a9a',
                            linewidth=2.0, zorder=0, alpha=0.45)
    ax.add_patch(border)
    ax.text(0.65, 10.72, 'AI ENGINE LAYER  (Python / FastAPI  --  port 8000)',
            fontsize=8, color='#b71c1c', fontweight='bold', style='italic')

    # ?? Infrastructure row (top) ???????????????????????????????????????????
    rbox(ax, 2.5, 9.8, 3.2, 0.80,
         'FastAPI Application', 'Receives HTTP requests from Node.js server',
         fc='#b71c1c', fs=9.5, sfs=7.5)

    rbox(ax, 7.2, 9.8, 2.8, 0.80,
         'Gemini 1.5 Flash', 'LLM  --  intent classify + reasoning',
         fc='#e53935', fs=9.5, sfs=7.5)

    rbox(ax,11.8, 9.8, 3.0, 0.80,
         'MongoDB Connector', 'Reads live warehouse data for each agent',
         fc='#e65100', fs=9.5, sfs=7.5)

    # arrows: FastAPI -> Gemini, FastAPI -> MongoDB
    straight_arrow(ax, 4.1, 9.8, 5.8, 9.8,  color='#555', lw=1.5, label='calls')
    straight_arrow(ax, 8.6, 9.8,10.3, 9.8,  color='#555', lw=1.5, label='calls')

    # ?? Master Agent (centre) ??????????????????????????????????????????????
    rbox(ax, 8.0, 7.90, 4.2, 1.10,
         'MASTER AGENT', 'MasterAgent.auto_route()  /  full_analysis()',
         fc='#1a237e', fs=12, sfs=8.5, pad=0.22)

    # arrow FastAPI -> Master Agent
    straight_arrow(ax, 2.5, 9.39, 5.9, 8.35, color='#b71c1c', lw=2.0,
                   label='route request', lfs=8)

    # ?? Intent Classifier sub-box ??????????????????????????????????????????
    rbox(ax, 8.0, 6.55, 3.5, 0.72,
         'Intent Classifier', '_classify_intent()  -- Gemini LLM call',
         fc='#283593', fs=9.5, sfs=7.8)

    straight_arrow(ax, 8.0, 7.34, 8.0, 6.92,
                   color='#7986cb', lw=1.8, label='1. classify intent', lfs=7.5)

    # ?? asyncio.gather note ????????????????????????????????????????????????
    gather_box = FancyBboxPatch((5.4, 5.98), 5.2, 0.38,
                                boxstyle='round,pad=0.08',
                                facecolor='#e8f5e9', edgecolor='#43a047',
                                linewidth=1.4, zorder=3)
    ax.add_patch(gather_box)
    ax.text(8.0, 6.17,
            'Full Analysis: asyncio.gather() -- all 5 agents run in PARALLEL',
            ha='center', va='center', fontsize=8, color='#1b5e20',
            fontweight='bold', zorder=4)

    straight_arrow(ax, 8.0, 6.19, 8.0, 6.00,
                   color='#283593', lw=1.6, label='2. route', lfs=7.5)

    # ?? Specialist Agents (ring) ???????????????????????????????????????????
    specialist_defs = [
        # (label, sublabel, color, x, y)
        ('Inventory Agent',
         'analyze()\nStock levels, capacity,\noccupancy analysis',
         '#2e7d32',  2.2, 4.80),

        ('Pricing Agent',
         'predict() / live() / advise()\nMarket price forecast\n(Agmarknet API + Gemini)',
         '#e65100',  5.0, 3.30),

        ('Duration Agent',
         'predict()\nStorage duration category\n(ML Model 3 + Gemini)',
         '#1565c0',  8.0, 2.60),

        ('Loan Risk Agent',
         'assess() / score() / portfolio()\nCredit scoring, collateral\ncoverage ratio',
         '#6a1b9a', 11.0, 3.30),

        ('Anomaly Agent',
         'detect() / alerts()\nFraud & operational\nanomaly detection',
         '#4e342e', 13.8, 4.80),

        ('Email Agent',
         'generate()\nDraft overdue reminders\n& customer notices',
         '#00695c',  8.0, 5.20),
    ]

    for label, sublabel, color, xp, yp in specialist_defs:
        rbox(ax, xp, yp, 2.9, 1.55, label, sublabel,
             fc=color, fs=9.5, sfs=7.2, pad=0.16)

    # ?? Arrows: Intent Classifier -> each specialist ???????????????????????
    # We draw from the bottom of Intent Classifier box (8.0, 6.19) or Master (8.0, ~7.3)
    # to top of each specialist box
    src_x, src_y = 8.0, 5.98   # bottom of gather box

    for label, sublabel, color, xp, yp in specialist_defs:
        # top-centre of specialist box
        tx = xp
        ty = yp + 0.775
        ax.annotate('', xy=(tx, ty), xytext=(src_x, src_y),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.5,
                                   connectionstyle='arc3,rad=0.0'), zorder=3)

    # ?? Arrows: each specialist -> Chat Agent (results return) ????????????
    # Chat Agent is below Master, point results back up via a return flow label
    rbox(ax, 8.0, 0.90, 4.5, 0.90,
         'Chat Agent', 'Synthesises all specialist results into a natural language reply',
         fc='#00695c', fs=10, sfs=8, pad=0.18)

    for label, sublabel, color, xp, yp in specialist_defs:
        bx = xp
        by = yp - 0.775
        ax.annotate('', xy=(8.0 + (bx - 8.0)*0.15, 1.36),
                    xytext=(bx, by),
                    arrowprops=dict(arrowstyle='->', color=color, lw=1.0,
                                   connectionstyle='arc3,rad=0.0',
                                   alpha=0.55), zorder=2)

    # arrow Chat Agent -> Master Agent (final reply)
    straight_arrow(ax, 8.0, 1.36, 8.0, 7.35,
                   color='#00897b', lw=2.0,
                   label='3. NL reply', lfs=8.5, label_side='right')

    # ?? Legend ????????????????????????????????????????????????????????????
    legend_items = [
        ('#1a237e', 'Master Agent  (orchestrator)'),
        ('#283593', 'Intent Classifier  (Gemini LLM)'),
        ('#2e7d32', 'Inventory Agent'),
        ('#e65100', 'Pricing Agent'),
        ('#1565c0', 'Duration Agent'),
        ('#6a1b9a', 'Loan Risk Agent'),
        ('#4e342e', 'Anomaly Agent'),
        ('#00695c', 'Email / Chat Agent'),
        ('#b71c1c', 'FastAPI  +  MongoDB'),
    ]
    for i, (color, label) in enumerate(legend_items):
        row, col = divmod(i, 3)
        lx = 0.55 + col * 5.2
        ly = 0.38 - row * 0.0   # single row legend at bottom
    # use matplotlib legend instead
    patches = [mpatches.Patch(color=c, label=l) for c,l in legend_items]
    ax.legend(handles=patches, loc='lower center', fontsize=7.8,
              ncol=5, framealpha=0.92, edgecolor='#bbb',
              bbox_to_anchor=(0.5, -0.01))

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, 'doc_agent_topology.png')
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print("  Saved: " + out)


if __name__ == '__main__':
    print("\n  Generating agent topology diagram...\n")
    make_agent_topology()
    print("  Done.\n")