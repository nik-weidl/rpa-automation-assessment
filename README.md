# RPA Automation Assessment Tool

**Evaluating Agentic Large Language Models for Assessing RPA Automation Potential from XES Event Logs**

*Master Thesis — Niklas Weidl — Ulm University — 2026*

---

## Overview

This tool is a research prototype that combines **Process Mining** with **Large Language Models** to assess the RPA (Robotic Process Automation) automation potential of business process activities derived from XES event logs.

It implements and compares four assessment strategies:

| Strategy | Description |
|---|---|
| **Rule-Based** | Weighted linear scoring over six event-log-derived metrics, grounded in Wellmann et al. (2020) |
| **Single-Shot LLM** | One-shot structured prompt to an LLM returning a score, label, reasoning, risks, and missing information |
| **Hybrid** | 70 % rule-based + 30 % independent LLM score, computed without cross-contamination |
| **Agentic** | Multi-turn loop: initial assessment → self-critique → optional metric retrieval → revised final assessment |

---

## Research Questions

- **RQ1** — Which event-log-derived metrics are useful for assessing RPA automation potential?
- **RQ2** — How does an agentic LLM workflow compare to rule-based, single-shot, and hybrid assessment?
- **RQ3** — How effectively can LLMs identify missing information required for RPA implementation?
- **RQ4** — What limitations exist when using XES event logs and LLMs for RPA assessment?

---

## Architecture

```
Browser (Next.js)
    │
    ├── Upload Page          → POST /api/upload
    ├── Dashboard            → GET  /api/process-logs
    ├── Process Log Detail
    │     ├── Activity Profiles tab
    │     ├── Scoring Workbench tab
    │     └── Process Graph tab    (Canvas 2D + Web Worker)
    └── Export               → GET  /api/export/[id]
          │
    Next.js Route Handlers (API Layer)
          │
    Feature / Service Layer
    ├── upload/          XES parser (pm4js), log ingestion
    ├── activity-profiles/   Metric extraction + rule-based scoring
    ├── automation-scoring/  LLM single-shot, agentic, hybrid
    ├── process-mining/      DFG adapter for graph view
    └── export/              CSV export (paired-row format)
          │
    Prisma ORM → PostgreSQL
          │
    OpenRouter API  (external LLM gateway)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router, TypeScript) |
| Database | PostgreSQL 16 + [Prisma ORM](https://www.prisma.io/) |
| Process Mining | [PM4JS](https://www.pm4js.org/) |
| LLM Gateway | [OpenRouter](https://openrouter.ai/) |
| Graph Layout | [Dagre](https://github.com/dagrejs/dagre) (via Web Worker) |
| Graph Render | Canvas 2D (custom renderer) |
| Containerisation | Docker + Docker Compose |

---

## Data Model

```
ProcessLog ──< Trace ──< Event
     │
     ├──< Activity   (pre-computed profile per activity)
     └──< Assessment (one row per strategy × activity)
```

- **ProcessLog** — uploaded XES file metadata and parse status
- **Trace** — one case (process instance)
- **Event** — one event within a trace (activity name, timestamp, resource, attributes)
- **Activity** — aggregated profile: frequency, duration statistics, predecessor/successor entropy, resource entropy, case coverage
- **Assessment** — scoring result: type (`RULE_BASED` | `LLM_SINGLE_SHOT` | `LLM_AGENTIC`), score, label (`LOW` | `MEDIUM` | `HIGH`), reasoning, risks, missing information, latency, cost

---

## Rule-Based Scoring

Scores are computed as a weighted linear combination of six normalised sub-scores.  
Weights are derived from the citation frequency counts in **Table 1 of Wellmann et al. (2020)**, normalised over the XES-derivable subset of criteria (n = 55 total citations):

| Criterion | Weight | Wellmann source |
|---|---|---|
| Frequency | **0.327** | Frequency (18 citations) |
| Case coverage | **0.182** | ½ × Standardization (20) |
| Routing complexity | **0.182** | ½ × Standardization (20) |
| Timing predictability | **0.182** | Maturity (7) + Stability (3) |
| Resource entropy | **0.091** | Handover of work (5) |
| Duration | **0.036** | Execution time (2) |

Criteria not derivable from XES (number of systems, structuredness of data, proneness to human error, failure rate) are excluded from the normalisation.

Final labels: `HIGH` ≥ 70 · `MEDIUM` ≥ 40 · `LOW` < 40

---

## Agentic Assessment Workflow

```
1. Initial assessment prompt
        ↓
2. Self-critique prompt
        ↓
3. (optional) Metric retrieval  ← controlled: only pre-computed PM metrics
        ↓
4. Revised final assessment
```

The agent has access only to the pre-computed activity profile metrics, ensuring controlled and explainable reasoning without hallucinated process context.

---

## Quickstart

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- An [OpenRouter](https://openrouter.ai/) API key

### 1 — Create `.env`

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://rpa_user:rpa_password@localhost:5432/rpa_assessment?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OPENROUTER_API_KEY="your_openrouter_api_key_here"
```

### 2 — Start

```bash
docker compose up --build
```

The application will be available at **http://localhost:3000**.  
Database migrations are applied automatically on startup.

### 3 — Development (hot reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

### 4 — Run tests

```bash
npm test
```

---

## Export Format

The export endpoint produces a **paired-row CSV** — each activity has two consecutive rows, one for the rule-based score and one for the LLM score. This layout is designed for direct import into R, Python (pandas), or SPSS for statistical comparison.

---

## References

- Wellmann, C., Stierle, M., Dunzer, S., Matzner, M. (2020). *A Framework to Evaluate the Viability of Robotic Process Automation for Business Process Activities.* BPM 2020. https://doi.org/10.1007/978-3-030-58779-6_14
- Bédard, M., Leshob, A., Benzarti, I., Mili, H., Rab, R., Hussain, O. (2024). *A rule-based method to effectively adopt robotic process automation.* J. Softw. Evol. Proc. https://doi.org/10.1002/smr.2709
- van der Aalst, W. (2016). *Process Mining: Data Science in Action.* Springer. https://doi.org/10.1007/978-3-662-49851-4
- PM4JS — https://www.pm4js.org/
- OpenRouter — https://openrouter.ai/