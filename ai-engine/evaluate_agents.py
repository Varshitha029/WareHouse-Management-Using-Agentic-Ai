"""
WMS Multi-Agent System — Research Paper Evaluation Framework
============================================================
Evaluates all 6 specialist agents + the Master Agent orchestrator:
  Inventory, Market Pricing, Storage Duration, Loan Risk, Anomaly, Email

Metrics produced:
  1. Intent Routing Accuracy   (overall % correct classifications)
  2. Per-Agent Precision       (TP / (TP+FP) — no false alarms)
  3. Per-Agent Recall          (TP / (TP+FN) — no missed queries)
  4. Per-Agent F1 Score        (harmonic mean of Precision & Recall)
  5. Macro-F1 / Weighted-F1   (system-level aggregated F1)
  6. Agent Success Rate        (per agent valid-response rate)
  7. Response Recall           (keyword coverage in agent replies)
  8. Response F1               (combined keyword precision + recall)
  9. Response Latency          (per agent, mean ± std)
  10. Agent Utilization        (distribution of master routing decisions)
  11. Orchestration Overhead   (master round-trip vs direct call delta)

Output:
  • Console: full metrics table + LaTeX table snippet
  • eval_results/  folder:
      - confusion_matrix.png
      - classification_metrics.png  (Precision / Recall / F1 per agent)
      - response_latency.png
      - success_rate.png
      - agent_utilization.png
      - orchestration_overhead.png
      - radar_chart.png
      - eval_summary.json

Run from ai-engine/ directory:
    python evaluate_agents.py
"""

import asyncio
import json
import os
import sys
import time
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
from matplotlib.gridspec import GridSpec
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from datetime import datetime

# ── make sure imports work when running from ai-engine/ ──────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Force UTF-8 output so emoji / box-drawing chars don't crash on Windows CP1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from coordinator.master_agent import MasterAgent

# ─────────────────────────────────────────────────────────────────────────────
#  Ground-truth routing test set
#  Each entry: (query_text, expected_agent)
# ─────────────────────────────────────────────────────────────────────────────
ROUTING_TEST_SET = [
    # ── Inventory (8 queries) ──────────────────────────────────────────────
    ("How many bags of rice are currently in the warehouse?",          "inventory"),
    ("What is the total stock quantity available right now?",          "inventory"),
    ("Show me the current inventory levels for all grain types.",      "inventory"),
    ("Which grain has the highest quantity in storage?",               "inventory"),
    ("Is there a shortage of wheat in the warehouse?",                 "inventory"),
    ("What is the warehouse occupancy percentage today?",              "inventory"),
    ("Give me a complete inventory breakdown by commodity.",           "inventory"),
    ("How much maize stock do we currently hold?",                     "inventory"),

    # ── Market Pricing (8 queries) ─────────────────────────────────────────
    ("What is the current market price of wheat?",                     "pricing"),
    ("Predict rice prices for the next 3 months.",                     "pricing"),
    ("Should I sell my grain now or wait for better prices?",          "pricing"),
    ("What is the price trend for soybean this season?",               "pricing"),
    ("Give me market price forecast for all grains.",                  "pricing"),
    ("Are grain prices expected to rise or fall next quarter?",        "pricing"),
    ("What is the best time to sell maize based on market analysis?",  "pricing"),
    ("Compare current prices with historical averages.",               "pricing"),

    # ── Storage Duration (8 queries) ──────────────────────────────────────
    ("How long has the grain been stored in the warehouse?",           "duration"),
    ("Which customers have grain stored for more than 6 months?",      "duration"),
    ("What is the average storage duration for rice?",                 "duration"),
    ("Predict the optimal storage duration to maximise profit.",       "duration"),
    ("Which lots are approaching their maximum safe storage period?",  "duration"),
    ("Estimate the storage charges for the current inventory.",        "duration"),
    ("How many days has customer John's wheat been in storage?",       "duration"),
    ("What is the storage duration distribution across all lots?",     "duration"),

    # ── Loan Risk (8 queries) ──────────────────────────────────────────────
    ("What is the loan default risk for my current portfolio?",        "loan_risk"),
    ("Which customers are at high risk of loan default?",              "loan_risk"),
    ("Assess the credit risk for a new loan application.",             "loan_risk"),
    ("What percentage of outstanding loans are high risk?",            "loan_risk"),
    ("Give me a loan risk portfolio summary.",                         "loan_risk"),
    ("Which loans should I flag for immediate review?",                "loan_risk"),
    ("What is the total exposure on risky loans?",                     "loan_risk"),
    ("Recommend loan limits based on grain collateral value.",         "loan_risk"),

    # ── Anomaly Detection (8 queries) ─────────────────────────────────────
    ("Are there any suspicious transactions in the weighbridge data?", "anomaly"),
    ("Detect any fraud or anomalies in recent operations.",            "anomaly"),
    ("Flag transactions that look unusual or out of pattern.",         "anomaly"),
    ("Have there been any weight discrepancies in the last week?",     "anomaly"),
    ("Check for irregularities in vehicle weighing records.",          "anomaly"),
    ("Are there any outliers in the payment data?",                    "anomaly"),
    ("Identify abnormal patterns in grain movements.",                 "anomaly"),
    ("Has there been any data tampering or unusual activity?",         "anomaly"),

    # ── Email Agent (8 queries) ──────────────────────────────────────────────
    ("Send a loan reminder email to overdue customers.",               "email"),
    ("Draft a payment alert for customers with pending dues.",         "email"),
    ("Write a storage expiry notice for grain stored over 6 months.",  "email"),
    ("Generate a bulk outreach email for all active customers.",       "email"),
    ("Email a loan approval notification to the customer.",            "email"),
    ("Compose a professional email reminding customers about repayment.", "email"),
    ("Send a warehouse storage charge invoice via email.",             "email"),
    ("Notify customers whose grain is approaching the storage deadline.", "email"),
]

AGENT_LABELS = ["inventory", "pricing", "duration", "loan_risk", "anomaly", "email"]

# Expected keywords that a good agent response should contain
EXPECTED_KEYWORDS = {
    "inventory":  ["stock", "bag", "quantity", "grain", "inventory", "warehouse", "ton", "kg"],
    "pricing":    ["price", "market", "forecast", "predict", "trend", "₹", "sell", "rate"],
    "duration":   ["day", "month", "storage", "duration", "stored", "period", "charge", "lot"],
    "loan_risk":  ["loan", "risk", "default", "credit", "portfolio", "customer", "exposure"],
    "anomaly":    ["anomaly", "unusual", "fraud", "irregular", "discrepancy", "pattern", "flag"],
    "email":      ["email", "subject", "dear", "reminder", "notice", "payment", "regards"],
}

AGENT_COLORS = {
    "inventory":  "#4caf50",
    "pricing":    "#f44336",
    "duration":   "#2196f3",
    "loan_risk":  "#9c27b0",
    "anomaly":    "#795548",
    "email":      "#00bcd4",
    "master":     "#3f51b5",
}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eval_results")
os.makedirs(OUTPUT_DIR, exist_ok=True)
USE_EVAL_CACHE = os.getenv("USE_EVAL_CACHE", "0") == "1"


# ─────────────────────────────────────────────────────────────────────────────
#  Evaluation runner
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_routing(master: MasterAgent, n_runs: int = 1):
    """
    Test master agent intent routing on the labelled query set.
    Returns per-query results with predicted agent + latency.
    """
    print("\n" + "="*60)
    print("  PHASE 1: Intent Routing Accuracy")
    print("="*60)

    results = []
    total = len(ROUTING_TEST_SET)
    for i, (query, expected) in enumerate(ROUTING_TEST_SET):
        print(f"  [{i+1:02d}/{total}] {expected.upper():12s} | {query[:55]}...", end="", flush=True)
        t0 = time.perf_counter()
        try:
            predicted = await master._classify_intent(query)
            predicted = predicted.strip().lower()
        except Exception as e:
            predicted = "error"
        latency = (time.perf_counter() - t0) * 1000  # ms
        correct = (predicted == expected)
        results.append({
            "query": query,
            "expected": expected,
            "predicted": predicted,
            "correct": correct,
            "latency_ms": round(latency, 1),
        })
        print(f"  → {predicted.upper():12s}  {'✓' if correct else '✗'}  {latency:.0f}ms")
        await asyncio.sleep(0.3)   # polite rate-limiting

    return results


async def evaluate_agents_directly(master: MasterAgent, n_runs: int = 3):
    """
    Call each specialist agent directly (bypass routing) and measure
    success rate, response latency, and response Precision / Recall / F1
    (replacing the old keyword-completeness / SW-completeness metric).

    Response Precision = relevant keywords found / all words in response
                         (how much of the response is on-topic)
    Response Recall    = relevant keywords found / total expected keywords
                         (how completely the response covers the domain)
    Response F1        = harmonic mean of Precision and Recall
    """
    print("\n" + "="*60)
    print("  PHASE 2: Individual Agent Performance")
    print("="*60)

    # One representative payload per agent
    agent_payloads = {
        "inventory":  {"action": "analyze", "role": "owner"},
        "pricing":    {"action": "predict", "grainType": "all", "horizon": "3months", "role": "owner"},
        "duration":   {"action": "predict", "grainType": "all", "role": "owner"},
        "loan_risk":  {"action": "portfolio", "role": "owner"},
        "anomaly":    {"action": "detect", "role": "owner"},
        "email":      {"action": "loan_reminder", "customerName": "Test Customer", "loanAmount": 50000, "dueDate": "2025-08-01", "daysOverdue": 15, "role": "owner"},
    }

    agent_results = {}
    for agent_name, payload in agent_payloads.items():
        latencies, successes = [], []
        resp_precisions, resp_recalls, resp_f1s = [], [], []
        print(f"\n  Agent: {agent_name.upper()}")
        for run in range(n_runs):
            t0 = time.perf_counter()
            try:
                result = await master.route(agent_name, payload)
                latency = (time.perf_counter() - t0) * 1000
                success_flag = (result.get("success") is True)
                has_error = bool(result.get("error") or result.get("errors"))
                success = bool(success_flag and not has_error)
                # ── Response Precision / Recall / F1 ─────────────────────────
                text = json.dumps(result, default=str).lower()
                expected_kws = EXPECTED_KEYWORDS.get(agent_name, [])
                # tokenise response into simple words (no stopwords needed for this proxy)
                response_words = set(text.replace(',', ' ').replace('.', ' ').split())
                found_kws = [k for k in expected_kws if k in text]  # keyword present in text
                # Precision: of all response tokens, what fraction are expected keywords
                resp_p = len(found_kws) / len(response_words) if response_words else 0.0
                # Recall: of all expected keywords, what fraction were found
                resp_r = len(found_kws) / len(expected_kws) if expected_kws else 1.0
                resp_f = (2 * resp_p * resp_r / (resp_p + resp_r)) if (resp_p + resp_r) > 0 else 0.0
            except Exception as e:
                latency = (time.perf_counter() - t0) * 1000
                success = False
                resp_p = resp_r = resp_f = 0.0
                print(f"    Run {run+1}: ERROR — {e}")

            latencies.append(latency)
            successes.append(int(success))
            resp_precisions.append(resp_p)
            resp_recalls.append(resp_r)
            resp_f1s.append(resp_f)
            print(f"    Run {run+1}: {'✓' if success else '✗'}  {latency:.0f}ms  "
                  f"P={resp_p:.0%}  R={resp_r:.0%}  F1={resp_f:.0%}")
            await asyncio.sleep(0.5)

        agent_results[agent_name] = {
            "success_rate":      round(np.mean(successes) * 100, 1),
            "mean_latency_ms":   round(np.mean(latencies), 0),
            "std_latency_ms":    round(np.std(latencies), 0),
            "min_latency_ms":    round(np.min(latencies), 0),
            "max_latency_ms":    round(np.max(latencies), 0),
            "response_precision": round(np.mean(resp_precisions) * 100, 1),
            "response_recall":    round(np.mean(resp_recalls) * 100, 1),
            "response_f1":        round(np.mean(resp_f1s) * 100, 1),
        }

    return agent_results


async def evaluate_orchestration_overhead(master: MasterAgent, n_samples: int = 2):
    """
    Compare: (a) master auto_route()  vs  (b) direct agent call
    for the same query. The difference is the orchestration overhead
    (routing classification + chat-agent formatting pass).
    """
    print("\n" + "="*60)
    print("  PHASE 3: Orchestration Overhead")
    print("="*60)

    test_pairs = [
        ("How many bags of rice are stored right now?",   "inventory",  {"action": "analyze", "role": "owner"}),
        ("What is the market price forecast for wheat?",  "pricing",    {"action": "predict", "grainType": "wheat", "role": "owner"}),
        ("Any suspicious transactions this week?",        "anomaly",    {"action": "detect", "role": "owner"}),
    ]

    overhead_data = []
    for query, agent, direct_payload in test_pairs:
        direct_times, master_times = [], []
        for _ in range(n_samples):
            # Direct call
            t0 = time.perf_counter()
            try:
                await master.route(agent, direct_payload)
            except Exception:
                pass
            direct_times.append((time.perf_counter() - t0) * 1000)
            await asyncio.sleep(0.4)

            # Master auto_route
            t0 = time.perf_counter()
            try:
                await master.auto_route(query, {"role": "owner"})
            except Exception:
                pass
            master_times.append((time.perf_counter() - t0) * 1000)
            await asyncio.sleep(0.4)

        overhead_data.append({
            "query_label": agent,
            "direct_mean":  round(np.mean(direct_times), 0),
            "master_mean":  round(np.mean(master_times), 0),
            "overhead_ms":  round(np.mean(master_times) - np.mean(direct_times), 0),
            "overhead_pct": round((np.mean(master_times) - np.mean(direct_times)) / np.mean(master_times) * 100, 1),
        })
        print(f"  {agent:12s}  direct={overhead_data[-1]['direct_mean']}ms  master={overhead_data[-1]['master_mean']}ms  overhead={overhead_data[-1]['overhead_ms']}ms ({overhead_data[-1]['overhead_pct']}%)")
        await asyncio.sleep(0.5)

    return overhead_data


# ─────────────────────────────────────────────────────────────────────────────
#  Chart generators
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
#  Classification metrics helper  (Precision / Recall / F1)
# ─────────────────────────────────────────────────────────────────────────────

def compute_classification_metrics(routing_results):
    """
    Compute per-agent and system-level classification metrics from routing results.

    For each agent A:
      TP  = queries labelled A that were routed to A
      FP  = queries NOT labelled A but routed to A  (false alarms)
      FN  = queries labelled A but routed elsewhere (missed)

      Precision = TP / (TP + FP)   — when master says "A", how often is it right?
      Recall    = TP / (TP + FN)   — of all true-A queries, how many did master catch?
      F1        = 2*P*R / (P+R)    — harmonic mean penalising both errors equally

    System metrics:
      Macro-F1    = unweighted mean of per-agent F1 scores
      Weighted-F1 = support-weighted mean (same as Macro here since each agent has
                    equal support = 8 queries, included for completeness)
    """
    labels = AGENT_LABELS
    tp = {a: 0 for a in labels}
    fp = {a: 0 for a in labels}
    fn = {a: 0 for a in labels}

    for r in routing_results:
        exp  = r["expected"]
        pred = r["predicted"]
        if pred == exp:
            if exp in tp:
                tp[exp] += 1
        else:
            if pred in fp:
                fp[pred] += 1
            if exp in fn:
                fn[exp] += 1

    clf_metrics = {}
    for a in labels:
        p = tp[a] / (tp[a] + fp[a]) if (tp[a] + fp[a]) > 0 else 0.0
        r = tp[a] / (tp[a] + fn[a]) if (tp[a] + fn[a]) > 0 else 0.0
        f = 2 * p * r / (p + r)     if (p + r)         > 0 else 0.0
        clf_metrics[a] = {
            "precision": round(p * 100, 1),
            "recall":    round(r * 100, 1),
            "f1":        round(f * 100, 1),
            "tp": tp[a], "fp": fp[a], "fn": fn[a],
        }

    support     = {a: sum(1 for r in ROUTING_TEST_SET if r[1] == a) for a in labels}
    total_sup   = sum(support.values()) or 1
    macro_f1    = round(np.mean([clf_metrics[a]["f1"]  for a in labels]), 1)
    weighted_f1 = round(sum(clf_metrics[a]["f1"] * support[a] / total_sup for a in labels), 1)
    macro_p     = round(np.mean([clf_metrics[a]["precision"] for a in labels]), 1)
    macro_r     = round(np.mean([clf_metrics[a]["recall"]    for a in labels]), 1)

    return clf_metrics, macro_f1, weighted_f1, macro_p, macro_r


def plot_confusion_matrix(routing_results):
    """Confusion matrix: predicted vs expected agent for routing."""
    labels = AGENT_LABELS
    n = len(labels)
    matrix = np.zeros((n, n), dtype=int)
    idx = {l: i for i, l in enumerate(labels)}

    for r in routing_results:
        i = idx.get(r["expected"], -1)
        j = idx.get(r["predicted"], -1)
        if i >= 0 and j >= 0:
            matrix[i][j] += 1

    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(matrix, interpolation='nearest', cmap='Blues')
    plt.colorbar(im, ax=ax, label='Query Count')

    tick_labels = [l.replace("_", "\n") for l in labels]
    ax.set(xticks=range(n), yticks=range(n),
           xticklabels=tick_labels, yticklabels=tick_labels,
           ylabel='True Agent (Expected)', xlabel='Predicted Agent')
    ax.set_title("Master Agent — Intent Routing Confusion Matrix", fontsize=13, fontweight='bold', pad=12)

    thresh = matrix.max() / 2.0
    for i in range(n):
        for j in range(n):
            ax.text(j, i, str(matrix[i][j]), ha='center', va='center',
                    color='white' if matrix[i][j] > thresh else 'black', fontsize=11, fontweight='bold')

    # Accuracy annotation
    correct = sum(1 for r in routing_results if r["correct"])
    acc = correct / len(routing_results) * 100
    fig.text(0.5, 0.01, f"Overall Routing Accuracy: {acc:.1f}%  ({correct}/{len(routing_results)} queries correct)",
             ha='center', fontsize=11, color='#3f51b5', fontweight='bold')

    plt.tight_layout(rect=[0, 0.04, 1, 1])
    out = os.path.join(OUTPUT_DIR, "confusion_matrix.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")
    return acc


def plot_response_latency(agent_results):
    """Grouped bar chart: mean latency ± std per agent."""
    agents = list(agent_results.keys())
    means  = [agent_results[a]["mean_latency_ms"] for a in agents]
    stds   = [agent_results[a]["std_latency_ms"]  for a in agents]
    colors = [AGENT_COLORS.get(a, "#999") for a in agents]
    names  = [a.replace("_", "\n") for a in agents]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(names, means, yerr=stds, capsize=6,
                  color=colors, alpha=0.85, edgecolor='black', linewidth=0.6,
                  error_kw={"elinewidth": 1.5, "ecolor": "#333"})

    for bar, mean, std in zip(bars, means, stds):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + std + 30,
                f"{mean:.0f}ms", ha='center', va='bottom', fontsize=9, fontweight='bold')

    ax.set_xlabel("Agent", fontsize=11)
    ax.set_ylabel("Response Latency (ms)", fontsize=11)
    ax.set_title("Agent Response Latency — Mean ± Std Dev", fontsize=13, fontweight='bold')
    ax.yaxis.grid(True, linestyle='--', alpha=0.5)
    ax.set_axisbelow(True)
    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "response_latency.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_success_rate(agent_results):
    """Horizontal grouped bar chart: Success Rate + Response Recall + Response F1 per agent."""
    agents = list(agent_results.keys())
    sr     = [agent_results[a]["success_rate"]      for a in agents]
    rr     = [agent_results[a]["response_recall"]   for a in agents]
    rf1    = [agent_results[a]["response_f1"]       for a in agents]
    y      = np.arange(len(agents))
    h      = 0.24
    colors = [AGENT_COLORS.get(a, "#999") for a in agents]
    labels = [a.replace("_", " ").title() for a in agents]

    fig, ax = plt.subplots(figsize=(10, 5))
    bars1 = ax.barh(y + h,   sr,  h, label='Success Rate (%)',      color=colors, alpha=0.88, edgecolor='black', linewidth=0.5)
    bars2 = ax.barh(y,       rr,  h, label='Response Recall (%)',   color=colors, alpha=0.60, edgecolor='black', linewidth=0.5, hatch='xx')
    bars3 = ax.barh(y - h,   rf1, h, label='Response F1 (%)',       color=colors, alpha=0.40, edgecolor='black', linewidth=0.5, hatch='//')

    for bars, vals in [(bars1, sr), (bars2, rr), (bars3, rf1)]:
        for bar, val in zip(bars, vals):
            ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
                    f"{val:.0f}%", va='center', fontsize=8, fontweight='bold')

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=10)
    ax.set_xlabel("Score (%)", fontsize=11)
    ax.set_xlim(0, 120)
    ax.set_title("Agent Success Rate  |  Response Recall  |  Response F1", fontsize=13, fontweight='bold')
    ax.legend(loc='lower right', fontsize=9)
    ax.xaxis.grid(True, linestyle='--', alpha=0.5)
    ax.set_axisbelow(True)
    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "success_rate.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_agent_utilization(routing_results):
    """Pie chart: how often the master routes to each agent."""
    counts = {a: 0 for a in AGENT_LABELS}
    for r in routing_results:
        p = r["predicted"]
        if p in counts:
            counts[p] += 1

    labels  = [a.replace("_", "\n") for a in counts]
    sizes   = list(counts.values())
    colors  = [AGENT_COLORS.get(a, "#999") for a in counts]
    explode = [0.04] * len(sizes)

    fig, ax = plt.subplots(figsize=(7, 7))
    wedges, texts, autotexts = ax.pie(
        sizes, explode=explode, labels=labels, autopct='%1.1f%%',
        colors=colors, startangle=140, pctdistance=0.78,
        wedgeprops={"edgecolor": "white", "linewidth": 2},
        textprops={"fontsize": 10}
    )
    for at in autotexts:
        at.set_fontsize(9)
        at.set_fontweight('bold')
        at.set_color('white')

    ax.set_title("Master Agent — Routing Distribution\n(Agent Utilization across test queries)",
                 fontsize=12, fontweight='bold')
    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "agent_utilization.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_orchestration_overhead(overhead_data):
    """Stacked bar showing direct call time vs orchestration overhead."""
    labels   = [d["query_label"].replace("_", "\n") for d in overhead_data]
    direct   = [d["direct_mean"] for d in overhead_data]
    overhead = [d["overhead_ms"] for d in overhead_data]

    x  = np.arange(len(labels))
    fig, ax = plt.subplots(figsize=(7, 5))
    b1 = ax.bar(x, direct,   color='#4caf50', alpha=0.85, label='Direct Agent Call', edgecolor='black', linewidth=0.6)
    b2 = ax.bar(x, overhead, bottom=direct, color='#ff9800', alpha=0.85, label='Orchestration Overhead', edgecolor='black', linewidth=0.6)

    total_labels = [d["master_mean"] for d in overhead_data]
    for xi, tot in zip(x, total_labels):
        ax.text(xi, tot + 30, f"{tot:.0f}ms total", ha='center', va='bottom', fontsize=9, fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylabel("Response Time (ms)", fontsize=11)
    ax.set_title("Orchestration Overhead:\nMaster Agent vs Direct Specialist Call", fontsize=12, fontweight='bold')
    ax.legend(fontsize=9)
    ax.yaxis.grid(True, linestyle='--', alpha=0.5)
    ax.set_axisbelow(True)

    # Overhead % label
    for d, xi in zip(overhead_data, x):
        ax.text(xi, d["direct_mean"] + d["overhead_ms"] / 2, f"+{d['overhead_pct']}%",
                ha='center', va='center', fontsize=8, color='white', fontweight='bold')

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "orchestration_overhead.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_radar_chart(agent_results, routing_acc):
    """Radar (spider) chart — 5 axes: Success Rate, Response Recall, Response F1, Speed, Routing Recall."""
    agents     = [a for a in AGENT_LABELS if a in agent_results]
    categories = ['Success\nRate', 'Response\nRecall', 'Response\nF1', 'Speed\nScore', 'Routing\nRecall']
    N          = len(categories)
    angles     = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    angles    += angles[:1]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))

    # Per-agent routing Recall  (TP / (TP+FN))
    per_agent_recall = {}
    for a in agents:
        total   = sum(1 for r in ROUTING_TEST_SET if r[1] == a)
        correct = sum(1 for r in routing_results_global if r["expected"] == a and r["correct"])
        per_agent_recall[a] = (correct / total * 100) if total > 0 else 0

    for agent in agents:
        r = agent_results[agent]
        max_lat = max(agent_results[a]["mean_latency_ms"] for a in agents)
        speed   = max(0, 100 * (1 - r["mean_latency_ms"] / max_lat))
        values  = [
            r["success_rate"],
            r["response_recall"],
            r["response_f1"],
            speed,
            per_agent_recall.get(agent, 0),
        ]
        values += values[:1]
        color  = AGENT_COLORS.get(agent, "#999")
        ax.plot(angles, values, 'o-', linewidth=1.8, label=agent.replace("_", " ").title(), color=color)
        ax.fill(angles, values, alpha=0.12, color=color)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=11)
    ax.set_ylim(0, 100)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(['20', '40', '60', '80', '100'], fontsize=7)
    ax.set_title("Multi-Agent Performance Profile\n(Success · Response Recall · F1 · Speed · Routing Recall)",
                 fontsize=12, fontweight='bold', y=1.08)
    ax.legend(loc='upper right', bbox_to_anchor=(1.35, 1.1), fontsize=9)
    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "radar_chart.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_per_agent_accuracy(routing_results, agent_results):
    """
    Per-agent accuracy chart combining:
      - Routing Recall   (% of an agent's true queries caught by master)
      - Agent Success Rate
      - Response F1
    """
    agents = AGENT_LABELS
    n = len(agents)

    routing_recall_per = []
    for a in agents:
        total   = sum(1 for r in ROUTING_TEST_SET if r[1] == a)
        correct = sum(1 for r in routing_results if r["expected"] == a and r["correct"])
        routing_recall_per.append((correct / total * 100) if total > 0 else 0.0)

    success_rates = [agent_results.get(a, {}).get("success_rate", 0)   for a in agents]
    resp_f1s      = [agent_results.get(a, {}).get("response_f1",   0)  for a in agents]

    x      = np.arange(n)
    width  = 0.26
    labels = [a.replace("_", "\n").title() for a in agents]
    colors = [AGENT_COLORS.get(a, "#999") for a in agents]

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    fig.suptitle("Per-Agent Accuracy — WMS Multi-Agent System", fontsize=14, fontweight='bold', y=1.02)

    # ── Left: grouped bar chart ──────────────────────────────────────────
    ax = axes[0]
    b1 = ax.bar(x - width, routing_recall_per, width, label='Routing Recall (%)',
                color=[c + 'cc' for c in colors], edgecolor='black', linewidth=0.6)
    b2 = ax.bar(x,         success_rates,       width, label='Agent Success Rate (%)',
                color=colors, edgecolor='black', linewidth=0.6)
    b3 = ax.bar(x + width, resp_f1s,            width, label='Response F1 (%)',
                color=colors, edgecolor='black', linewidth=0.6, alpha=0.55, hatch='//')

    for bars in [b1, b2, b3]:
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.8,
                    f"{h:.0f}%", ha='center', va='bottom', fontsize=7.5, fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Score (%)", fontsize=11)
    ax.set_ylim(0, 118)
    ax.set_title("Routing Recall  vs  Success Rate  vs  Response F1", fontsize=11, fontweight='bold')
    ax.legend(fontsize=9)
    ax.yaxis.grid(True, linestyle='--', alpha=0.4)
    ax.set_axisbelow(True)

    # ── Right: combined score (mean of all 3) ────────────────────────────
    ax2 = axes[1]
    combined = [(rr + sr + rf) / 3 for rr, sr, rf in zip(routing_recall_per, success_rates, resp_f1s)]
    bars = ax2.bar(labels, combined, color=colors, edgecolor='black', linewidth=0.7, alpha=0.88)

    for bar, val, agent, rr, sr, rf in zip(bars, combined, agents, routing_recall_per, success_rates, resp_f1s):
        ax2.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.8,
                 f"{val:.1f}%", ha='center', va='bottom', fontsize=9, fontweight='bold')
        mid = bar.get_height() / 2
        ax2.text(bar.get_x() + bar.get_width() / 2, mid,
                 f"RR:{rr:.0f}% SR:{sr:.0f}%\nF1:{rf:.0f}%",
                 ha='center', va='center', fontsize=7, color='white', fontweight='bold')

    ax2.set_ylabel("Combined Score (%)", fontsize=11)
    ax2.set_ylim(0, 118)
    ax2.set_title("Combined Score per Agent\n(mean of Routing Recall + Success + Response F1)",
                  fontsize=11, fontweight='bold')
    ax2.yaxis.grid(True, linestyle='--', alpha=0.4)
    ax2.set_axisbelow(True)

    mean_combined = np.mean(combined)
    ax2.axhline(mean_combined, color='#333', linestyle='--', linewidth=1.3,
                label=f'System Mean: {mean_combined:.1f}%')
    ax2.legend(fontsize=9)

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "per_agent_accuracy.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_classification_metrics(routing_results):
    """
    Dedicated chart showing Precision, Recall, and F1 per agent for routing.
    Two subplots:
      Left  — grouped bar: Precision / Recall / F1 per agent
      Right — horizontal precision-recall bar comparison  (macro averages annotated)
    """
    clf_metrics, macro_f1, weighted_f1, macro_p, macro_r = compute_classification_metrics(routing_results)

    agents     = AGENT_LABELS
    precisions = [clf_metrics[a]["precision"] for a in agents]
    recalls    = [clf_metrics[a]["recall"]    for a in agents]
    f1s        = [clf_metrics[a]["f1"]        for a in agents]
    colors     = [AGENT_COLORS.get(a, "#999") for a in agents]
    xlabels    = [a.replace("_", "\n").title() for a in agents]

    x     = np.arange(len(agents))
    width = 0.26

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    fig.suptitle(
        f"Routing Classification Metrics — Macro-F1: {macro_f1:.1f}%  |  Weighted-F1: {weighted_f1:.1f}%",
        fontsize=13, fontweight='bold', y=1.02
    )

    # ── Left: Precision / Recall / F1 grouped bar ────────────────────────
    ax = axes[0]
    b1 = ax.bar(x - width, precisions, width, label='Precision (%)',
                color=colors, edgecolor='black', linewidth=0.6, alpha=0.9)
    b2 = ax.bar(x,         recalls,   width, label='Recall (%)',
                color=colors, edgecolor='black', linewidth=0.6, alpha=0.65, hatch='xx')
    b3 = ax.bar(x + width, f1s,       width, label='F1 Score (%)',
                color=colors, edgecolor='black', linewidth=0.6, alpha=0.45, hatch='//')

    for bars, vals in [(b1, precisions), (b2, recalls), (b3, f1s)]:
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.8,
                    f"{val:.0f}%", ha='center', va='bottom', fontsize=7.5, fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(xlabels, fontsize=9)
    ax.set_ylabel("Score (%)", fontsize=11)
    ax.set_ylim(0, 118)
    ax.set_title("Per-Agent Routing  Precision / Recall / F1", fontsize=11, fontweight='bold')
    ax.legend(fontsize=9)
    ax.yaxis.grid(True, linestyle='--', alpha=0.4)
    ax.set_axisbelow(True)

    # Macro averages
    ax.axhline(macro_p,  color='navy',   linestyle=':', linewidth=1.2, label=f'Macro Precision: {macro_p:.1f}%')
    ax.axhline(macro_r,  color='green',  linestyle=':', linewidth=1.2, label=f'Macro Recall: {macro_r:.1f}%')
    ax.axhline(macro_f1, color='crimson',linestyle='--',linewidth=1.4, label=f'Macro F1: {macro_f1:.1f}%')
    ax.legend(fontsize=8, loc='lower right')

    # ── Right: TP / FP / FN stacked info per agent ──────────────────────
    ax2 = axes[1]
    tps  = [clf_metrics[a]["tp"] for a in agents]
    fps  = [clf_metrics[a]["fp"] for a in agents]
    fns  = [clf_metrics[a]["fn"] for a in agents]

    ax2.bar(xlabels, tps, color=colors, edgecolor='black', linewidth=0.6, alpha=0.88, label='TP (correct)')
    ax2.bar(xlabels, fps, bottom=tps, color='#ff9800', edgecolor='black', linewidth=0.6, alpha=0.75, label='FP (false alarm)')
    bottom2 = [t + f for t, f in zip(tps, fps)]
    ax2.bar(xlabels, fns, bottom=bottom2, color='#f44336', edgecolor='black', linewidth=0.6, alpha=0.75, label='FN (missed)')

    for i, (a, tp_, fp_, fn_, f1_) in enumerate(zip(agents, tps, fps, fns, f1s)):
        ax2.text(i, tp_ / 2, f"TP={tp_}", ha='center', va='center', fontsize=8, color='white', fontweight='bold')
        if fp_ > 0:
            ax2.text(i, tp_ + fp_ / 2, f"FP={fp_}", ha='center', va='center', fontsize=7.5, color='white')
        if fn_ > 0:
            ax2.text(i, tp_ + fp_ + fn_ / 2, f"FN={fn_}", ha='center', va='center', fontsize=7.5, color='white')
        ax2.text(i, tp_ + fp_ + fn_ + 0.15, f"F1={f1_:.0f}%",
                 ha='center', va='bottom', fontsize=8, fontweight='bold',
                 color=AGENT_COLORS.get(a, '#333'))

    ax2.set_ylabel("Query Count", fontsize=11)
    ax2.set_ylim(0, 14)
    ax2.set_title("TP / FP / FN Breakdown per Agent", fontsize=11, fontweight='bold')
    ax2.legend(fontsize=9)
    ax2.yaxis.grid(True, linestyle='--', alpha=0.4)
    ax2.set_axisbelow(True)

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "classification_metrics.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


def plot_architecture_diagram(agent_results, routing_acc):
    """
    Draws the WMS Master-Coordinator architecture diagram showing:
      User Query → Master Agent → Intent Classifier → Specialist Agents
      Specialist results → Chat Agent → Enriched Response → User
    Annotated with live accuracy / success metrics.
    """
    fig, ax = plt.subplots(figsize=(18, 11))
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 11)
    ax.axis('off')
    fig.patch.set_facecolor('#fafafa')

    def box(ax, x, y, w, h, label, sublabel='', color='#3f51b5', text_color='white',
            fontsize=10, subfontsize=8, radius=0.25):
        fancy = FancyBboxPatch((x - w/2, y - h/2), w, h,
                               boxstyle=f"round,pad={radius}",
                               facecolor=color, edgecolor='white',
                               linewidth=2, zorder=3)
        ax.add_patch(fancy)
        ax.text(x, y + (0.12 if sublabel else 0), label,
                ha='center', va='center', fontsize=fontsize,
                fontweight='bold', color=text_color, zorder=4)
        if sublabel:
            ax.text(x, y - 0.28, sublabel, ha='center', va='center',
                    fontsize=subfontsize, color=text_color, alpha=0.88, zorder=4)

    def arrow(ax, x1, y1, x2, y2, color='#555', lw=1.8, style='->'):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle=style, color=color,
                                   lw=lw, connectionstyle='arc3,rad=0.0'),
                    zorder=2)

    def curved_arrow(ax, x1, y1, x2, y2, color='#555', lw=1.5, rad=0.2):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='->', color=color,
                                   lw=lw, connectionstyle=f'arc3,rad={rad}'),
                    zorder=2)

    # ── Title ────────────────────────────────────────────────────────────────
    ax.text(9, 10.5, 'WMS Multi-Agent System — Master-Coordinator Architecture',
            ha='center', va='center', fontsize=15, fontweight='bold', color='#1a237e')
    ax.text(9, 10.1, f'Overall Routing Accuracy: {routing_acc:.1f}%   |   Agents: {len(AGENT_LABELS)}   |   n8n + Gemini AI',
            ha='center', va='center', fontsize=10, color='#555')

    # ── User Query ────────────────────────────────────────────────────────────
    box(ax, 2.0, 7.8, 2.6, 0.9, '[USER]  User / Front-end',
        'Sends natural language query', color='#37474f', fontsize=9.5)

    # ── n8n Workflow ──────────────────────────────────────────────────────────
    box(ax, 5.5, 7.8, 2.4, 0.9, '[n8n]  n8n Webhook',
        'wms-chat / wms-full-analysis', color='#e65100', fontsize=9.5)
    arrow(ax, 3.3, 7.8, 4.3, 7.8, color='#e65100', lw=2)
    ax.text(3.8, 7.95, 'HTTP POST', ha='center', fontsize=7.5, color='#e65100')

    # ── Master Agent box ──────────────────────────────────────────────────────
    box(ax, 9.0, 7.8, 2.8, 1.05, '[MASTER]  Master Agent',
        f'Coordinator  |  Routing Acc: {routing_acc:.1f}%', color='#3f51b5', fontsize=10)
    arrow(ax, 6.7, 7.8, 7.6, 7.8, color='#3f51b5', lw=2)
    ax.text(7.15, 7.95, 'FastAPI', ha='center', fontsize=7.5, color='#3f51b5')

    # ── Intent Classifier sub-box ─────────────────────────────────────────────
    box(ax, 9.0, 6.4, 2.4, 0.75, '[ROUTER]  Intent Classifier',
        '_classify_intent( )', color='#5c6bc0', fontsize=9)
    arrow(ax, 9.0, 7.27, 9.0, 6.78, color='#5c6bc0', lw=1.8)

    # ── Specialist agents ────────────────────────────────────────────────────
    agent_specs = [
        ("inventory",  "[INV] Inventory Agent",      "Stock & capacity\nanalysis"),
        ("pricing",    "[PRC] Market Pricing Agent",  "Price forecast\n& sell advice"),
        ("duration",   "[DUR] Duration Agent",        "Storage period\nprediction"),
        ("loan_risk",  "[LOAN] Loan Risk Agent",      "Credit risk &\nportfolio"),
        ("anomaly",    "[ANO] Anomaly Agent",         "Fraud detection\n& alerts"),
        ("email",      "[EML] Email Agent",           "Draft reminders\n& notices"),
    ]

    xs = [1.5, 4.1, 6.7, 11.3, 13.9, 16.5]
    y_agent = 4.0

    for (agent_key, label, desc), x_pos in zip(agent_specs, xs):
        color  = AGENT_COLORS.get(agent_key, '#999')
        m      = agent_results.get(agent_key, {})
        sr     = m.get('success_rate', 0)
        rf1    = m.get('response_f1', 0)
        total  = sum(1 for r in ROUTING_TEST_SET if r[1] == agent_key)
        correct= sum(1 for r in routing_results_global if r['expected'] == agent_key and r['correct'])
        ra     = (correct / total * 100) if total > 0 else 0.0

        # Agent box
        box(ax, x_pos, y_agent, 2.3, 1.35, label, desc, color=color, fontsize=8.5, subfontsize=7.5)

        # Accuracy badge below — now shows Routing Recall / Success Rate / Response F1
        badge_y = y_agent - 1.1
        badge = FancyBboxPatch((x_pos - 1.1, badge_y - 0.32), 2.2, 0.65,
                               boxstyle='round,pad=0.08', facecolor='white',
                               edgecolor=color, linewidth=1.5, zorder=3)
        ax.add_patch(badge)
        ax.text(x_pos, badge_y + 0.05,
                f'Recall:{ra:.0f}%  SR:{sr:.0f}%  F1:{rf1:.0f}%',
                ha='center', va='center', fontsize=6.8,
                color=color, fontweight='bold', zorder=4)
        ax.text(x_pos, badge_y - 0.18, 'Metrics', ha='center',
                fontsize=6, color='#888', zorder=4)

        # Arrow from intent classifier down to agent
        curved_arrow(ax, 9.0, 6.02, x_pos, y_agent + 0.68,
                     color=color, lw=1.4, rad=-0.15 if x_pos < 9 else 0.15)

        # Arrow from agent up to Chat Agent (return path)
        curved_arrow(ax, x_pos, y_agent - 0.68, 9.0, 2.18,
                     color=color, lw=1.1, rad=0.15 if x_pos < 9 else -0.15)

    # ── Chat Agent ────────────────────────────────────────────────────────────
    box(ax, 9.0, 1.7, 2.8, 0.88, '[CHAT]  Chat Agent',
        'Formats specialist data\ninto natural language reply',
        color='#00897b', fontsize=9.5, subfontsize=7.8)
    ax.text(9.0, 1.06,
            'Synthesises multi-agent results → context-aware, conversational response',
            ha='center', fontsize=8, color='#00695c', style='italic')

    # ── Response arrow back to user ───────────────────────────────────────────
    arrow(ax, 7.6, 1.7, 6.7, 7.45, color='#00897b', lw=2)
    ax.text(6.6, 4.5, 'Natural\nLanguage\nResponse', ha='center', fontsize=7.5,
            color='#00897b', fontweight='bold')

    # ── DB / Tools note ───────────────────────────────────────────────────────
    box(ax, 9.0, 0.45, 7.0, 0.55,
        '[DB] MongoDB   |   [AI] Gemini AI   |   [n8n] Workflows   |   [ML] wms-analytics Models',
        color='#546e7a', fontsize=8.5)
    arrow(ax, 9.0, 1.26, 9.0, 0.73, color='#546e7a', lw=1.6)

    # ── Legend ────────────────────────────────────────────────────────────────
    legend_patches = [
        mpatches.Patch(facecolor=AGENT_COLORS[a], label=a.replace('_',' ').title())
        for a in AGENT_LABELS
    ]
    legend_patches.append(mpatches.Patch(facecolor='#3f51b5', label='Master Agent'))
    legend_patches.append(mpatches.Patch(facecolor='#00897b', label='Chat Agent'))
    ax.legend(handles=legend_patches, loc='upper right', fontsize=8,
              ncol=2, framealpha=0.9, bbox_to_anchor=(1.0, 0.98))

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "architecture_diagram.png")
    plt.savefig(out, dpi=180, bbox_inches='tight')
    plt.close()
    print(f"  Saved: {out}")


# ─────────────────────────────────────────────────────────────────────────────
#  Metrics table printer
# ─────────────────────────────────────────────────────────────────────────────

def print_metrics_table(routing_acc, agent_results, overhead_data, clf_metrics, macro_f1, weighted_f1):
    print(f"\n{'='*100}")
    print(f"  WMS MULTI-AGENT EVALUATION RESULTS  —  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*100}")

    # ── System-level summary ─────────────────────────────────────────────────
    n_correct      = sum(1 for r in routing_results_global if r["correct"])
    mean_route_lat = np.mean([r["latency_ms"] for r in routing_results_global])
    overall_sr     = np.mean([m["success_rate"]      for m in agent_results.values()])
    overall_lat    = np.mean([m["mean_latency_ms"]   for m in agent_results.values()])
    overall_rr     = np.mean([m["response_recall"]   for m in agent_results.values()])
    overall_rf1    = np.mean([m["response_f1"]       for m in agent_results.values()])
    overall_p      = np.mean([clf_metrics[a]["precision"] for a in AGENT_LABELS])
    overall_r      = np.mean([clf_metrics[a]["recall"]    for a in AGENT_LABELS])

    print(f"\n{'─'*80}")
    print(f"  {'SYSTEM METRIC':<45} {'VALUE':>15}")
    print(f"{'─'*80}")
    print(f"  {'Overall Routing Accuracy':<45} {routing_acc:>14.1f}%")
    print(f"  {'Correct Routings / Total Queries':<45} {n_correct:>12d} / {len(ROUTING_TEST_SET)}")
    print(f"  {'Macro Precision  (routing)':<45} {overall_p:>14.1f}%")
    print(f"  {'Macro Recall     (routing)':<45} {overall_r:>14.1f}%")
    print(f"  {'Macro-F1         (routing)':<45} {macro_f1:>14.1f}%")
    print(f"  {'Weighted-F1      (routing)':<45} {weighted_f1:>14.1f}%")
    print(f"  {'Mean Routing Classification Latency':<45} {mean_route_lat:>12.0f} ms")
    if overhead_data:
        oh_pct = np.mean([d["overhead_pct"] for d in overhead_data])
        print(f"  {'Mean Orchestration Overhead':<45} {oh_pct:>13.1f}%")
    print(f"  {'System Avg Agent Success Rate':<45} {overall_sr:>14.1f}%")
    print(f"  {'System Avg Response Recall':<45} {overall_rr:>14.1f}%")
    print(f"  {'System Avg Response F1':<45} {overall_rf1:>14.1f}%")
    print(f"{'='*80}\n")

    # ── Per-agent detailed table ─────────────────────────────────────────────
    H = 110
    print(f"{'─'*H}")
    print(f"  {'AGENT':<14} {'SUCCESS':>8} {'LAT(ms)':>9} {'RESP-P':>8} {'RESP-R':>8} "
          f"{'RESP-F1':>8} {'ROUT-P':>8} {'ROUT-R':>8} {'ROUT-F1':>9} {'TP':>4} {'FP':>4} {'FN':>4}")
    print(f"{'─'*H}")
    for agent, m in agent_results.items():
        cm = clf_metrics.get(agent, {"precision": 0, "recall": 0, "f1": 0, "tp": 0, "fp": 0, "fn": 0})
        print(
            f"  {agent.replace('_',' ').title():<14}"
            f" {m['success_rate']:>7.0f}%"
            f" {m['mean_latency_ms']:>8.0f}"
            f" {m['response_precision']:>7.1f}%"
            f" {m['response_recall']:>7.1f}%"
            f" {m['response_f1']:>7.1f}%"
            f" {cm['precision']:>7.1f}%"
            f" {cm['recall']:>7.1f}%"
            f" {cm['f1']:>8.1f}%"
            f" {cm['tp']:>4d}"
            f" {cm['fp']:>4d}"
            f" {cm['fn']:>4d}"
        )
    print(f"{'─'*H}")
    print(
        f"  {'SYSTEM AVG':<14}"
        f" {overall_sr:>7.0f}%"
        f" {overall_lat:>8.0f}"
        f" {np.mean([m['response_precision'] for m in agent_results.values()]):>7.1f}%"
        f" {overall_rr:>7.1f}%"
        f" {overall_rf1:>7.1f}%"
        f" {overall_p:>7.1f}%"
        f" {overall_r:>7.1f}%"
        f" {macro_f1:>8.1f}%"
    )
    print(f"{'='*H}\n")

    # ── LaTeX table ──────────────────────────────────────────────────────────
    print("  ── LaTeX Table (paste into your paper) ──────────────────────────────")
    print(r"  \begin{table}[h]")
    print(r"  \centering")
    print(r"  \caption{WMS Multi-Agent System --- Classification \& Response Metrics}")
    print(r"  \label{tab:agent_eval}")
    print(r"  \begin{tabular}{lrrrrrrr}")
    print(r"  \hline")
    print(r"  \textbf{Agent} & \textbf{Succ (\%)} & \textbf{Lat (ms)} "
          r"& \textbf{Resp-R (\%)} & \textbf{Resp-F1 (\%)} "
          r"& \textbf{Rout-P (\%)} & \textbf{Rout-R (\%)} & \textbf{Rout-F1 (\%)} \\")
    print(r"  \hline")
    for agent, m in agent_results.items():
        cm   = clf_metrics.get(agent, {"precision": 0, "recall": 0, "f1": 0})
        name = agent.replace("_", " ").title()
        print(f"  {name} & {m['success_rate']:.0f} & {m['mean_latency_ms']:.0f}"
              f" & {m['response_recall']:.0f} & {m['response_f1']:.0f}"
              f" & {cm['precision']:.0f} & {cm['recall']:.0f} & {cm['f1']:.0f} \\\\")
    print(r"  \hline")
    print(f"  \\textbf{{System Avg}} & {overall_sr:.0f} & {overall_lat:.0f}"
          f" & {overall_rr:.0f} & {overall_rf1:.0f}"
          f" & {overall_p:.0f} & {overall_r:.0f} & {macro_f1:.0f} \\\\")
    print(r"  \hline")
    print(f"  \\multicolumn{{8}}{{l}}{{\\small Macro-F1 (routing): {macro_f1:.1f}\\%"
          f"  |  Weighted-F1: {weighted_f1:.1f}\\%}} \\\\")
    print(r"  \hline")
    print(r"  \end{tabular}")
    print(r"  \end{table}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

routing_results_global = []   # used by radar chart & per-agent routing acc

async def main():
    global routing_results_global

    print("\n" + "="*60)
    print("  WMS MULTI-AGENT EVALUATION FRAMEWORK")
    print("  Research Paper — Performance & Orchestration Metrics")
    print("="*60)

    master = MasterAgent()

    # ── Phase 1: Routing (cache optional, disabled by default) ────────────
    p1_cache = os.path.join(OUTPUT_DIR, "_phase1.json")
    if USE_EVAL_CACHE and os.path.exists(p1_cache):
        print("\n  [Phase 1] Loading cached routing results...")
        with open(p1_cache) as f:
            p1 = json.load(f)
        routing_results = p1["routing_results"]
        routing_acc     = p1["routing_acc"]
    else:
        routing_results = await evaluate_routing(master)
        routing_acc = sum(1 for r in routing_results if r["correct"]) / len(routing_results) * 100
        if USE_EVAL_CACHE:
            with open(p1_cache, "w") as f:
                json.dump({"routing_results": routing_results, "routing_acc": routing_acc}, f, indent=2)
    routing_results_global = routing_results

    # ── Phase 2: Agent performance (cache optional, disabled by default) ──
    p2_cache = os.path.join(OUTPUT_DIR, "_phase2.json")
    if USE_EVAL_CACHE and os.path.exists(p2_cache):
        print("\n  [Phase 2] Loading cached agent results...")
        with open(p2_cache) as f:
            agent_results = json.load(f)
    else:
        agent_results = await evaluate_agents_directly(master, n_runs=2)
        if USE_EVAL_CACHE:
            with open(p2_cache, "w") as f:
                json.dump(agent_results, f, indent=2)

    # ── Compute classification metrics (Precision / Recall / F1) ─────────
    clf_metrics, macro_f1, weighted_f1, macro_p, macro_r = compute_classification_metrics(routing_results)

    # ── Generate Phase 1+2 charts immediately ────────────────────────────
    print("\n" + "="*60)
    print("  Generating Phase 1+2 charts...")
    print("="*60)
    plot_confusion_matrix(routing_results)
    plot_classification_metrics(routing_results)   # NEW: Precision / Recall / F1 per agent
    plot_response_latency(agent_results)
    plot_success_rate(agent_results)
    plot_agent_utilization(routing_results)
    plot_radar_chart(agent_results, routing_acc)
    plot_per_agent_accuracy(routing_results, agent_results)
    plot_architecture_diagram(agent_results, routing_acc)

    # ── Phase 3: Orchestration overhead (1 sample, fast) ─────────────────
    p3_cache = os.path.join(OUTPUT_DIR, "_phase3.json")
    if USE_EVAL_CACHE and os.path.exists(p3_cache):
        print("\n  [Phase 3] Loading cached overhead results...")
        with open(p3_cache) as f:
            overhead_data = json.load(f)
    else:
        overhead_data = await evaluate_orchestration_overhead(master, n_samples=1)
        if USE_EVAL_CACHE:
            with open(p3_cache, "w") as f:
                json.dump(overhead_data, f, indent=2)
    plot_orchestration_overhead(overhead_data)

    # ── Print metrics table ───────────────────────────────────────────────
    print_metrics_table(routing_acc, agent_results, overhead_data, clf_metrics, macro_f1, weighted_f1)

    # ── Save full JSON summary ─────────────────────────────────────────────
    summary = {
        "timestamp":         datetime.now().isoformat(),
        "routing_accuracy":  round(routing_acc, 2),
        "macro_f1":          macro_f1,
        "weighted_f1":       weighted_f1,
        "macro_precision":   macro_p,
        "macro_recall":      macro_r,
        "classification_metrics_per_agent": clf_metrics,
        "routing_results":   routing_results,
        "agent_results":     agent_results,
        "overhead_data":     overhead_data,
    }
    json_path = os.path.join(OUTPUT_DIR, "eval_summary.json")
    with open(json_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"  Saved: {json_path}")

    print("\n" + "="*60)
    print(f"  DONE. All outputs in: {OUTPUT_DIR}")
    print("  Files: confusion_matrix.png  classification_metrics.png")
    print("         response_latency.png  success_rate.png")
    print("         agent_utilization.png  orchestration_overhead.png")
    print("         radar_chart.png  per_agent_accuracy.png")
    print("         architecture_diagram.png  eval_summary.json")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())

