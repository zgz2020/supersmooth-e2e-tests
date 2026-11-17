# 🧪 AI Triage Evaluation

How we measure the triage classifier behind `pnpm agent:triage`
([Applied AI & Agentic QA](applied-ai-agent-qa.md)) and what the measurements say. The rule for
trusting an AI classifier here: **measure it before acting on it.**

---

## 📋 Table of Contents

- [Why: the motivating finding](#-why-the-motivating-finding)
- [What changed in the triage agent](#-what-changed-in-the-triage-agent)
- [The labelled dataset](#-the-labelled-dataset)
- [Running the evaluation](#-running-the-evaluation)
- [Latest results (2026-11-16)](#-latest-results-2026-11-16)
- [Decision rule: when a triage result may become a patch](#-decision-rule-when-a-triage-result-may-become-a-patch)
- [Impact on the quality metrics](#-impact-on-the-quality-metrics)
- [Follow-ups](#-follow-ups)

---

## 🔍 Why: the motivating finding

The same injected failure (`connectWallet.spec.ts`, "search for a wallet") was triaged six times
on 2026-11-03:

| Runs | Classification       | Confidence |
| :--: | :------------------- | :--------: |
|  2   | `REGRESSION_DEFECT`  |     82     |
|  4   | `DOM_SELECTOR_DRIFT` |     92     |

82 and 92 are the hard-coded confidences of the keyword fallback (`heuristicFallbackClassifier`),
and the fallback is deterministic, so at least one group came from Gemini and the other from the
fallback. The report gave no way to tell which: when the Gemini call failed, the agent returned the
keyword answer **silently**, under the same headings as an AI answer.

## 🛠️ What changed in the triage agent

- The classifier lives in [`scripts/qa-agent/triage-core.js`](../scripts/qa-agent/triage-core.js)
  (prompt, Gemini call, keyword fallback), so the agent and the evaluation run the same code.
- Every result says who answered: **`source: 'gemini' | 'heuristic'`**, and when Gemini failed,
  **`fallbackReason`** (`http_429`, `http_503`, `timeout`, `parse_error`, `empty_response`,
  `invalid_classification`, `network_error`, `no_api_key`). It appears in the triage JSON, the
  PR comment / job summary (**Classifier** column) and the Discord card.
- Triage JSON reports also store the scrubbed **`failureContext`**, so a confirmed real failure can
  be added to the dataset later.

## 🏷️ The labelled dataset

32 cases in [`tests/eval/triage/dataset/`](../tests/eval/triage/dataset/), labelled with the guide
in [`tests/eval/triage/README.md`](../tests/eval/triage/README.md) (class definitions, decision
rules for ambiguous failures, how to add a case).

| Class                | Cases | of which hard |
| :------------------- | :---: | :-----------: |
| `DOM_SELECTOR_DRIFT` |  10   |       3       |
| `TRANSIENT_RPC`      |  12   |       5       |
| `REGRESSION_DEFECT`  |  10   |       4       |
| **Total**            |  32   |  12 (37.5%)   |

- **29 fault-injection cases:** real test runs against staging with a known, deliberate cause, so
  the label is true by construction. Faults came from a local proxy in front of staging (gateway
  502, 429, connection resets, hangs, slow RPC, rewritten API responses, scripts that rename test
  ids or break a button) and from locator typos in a throwaway worktree. No broken code was
  committed.
- **3 synthetic cases** (9%): wallet-transaction errors on the Anvil fork (nonce too low,
  replacement transaction underpriced, an archive-RPC 503) that cannot be injected safely on a
  real chain.
- **Hard cases** are failures whose visible error points to another class: a gateway 502 that
  reads like a regression, a slow RPC that surfaces as a locator timeout, a dead button that looks
  like selector drift.
- Every case is scrubbed (keys, private keys, tokens, webhooks, local paths) by
  [`scripts/eval/scrub.js`](../scripts/eval/scrub.js).

## 🚀 Running the evaluation

```bash
pnpm eval:triage                                    # heuristic only (free, deterministic)
pnpm eval:triage --provider gemini                  # needs GEMINI_API_KEY
pnpm eval:triage --provider all --repeats 3 --min-accuracy 0.78
```

| Metric                | What it answers                                                                                             |
| :-------------------- | :---------------------------------------------------------------------------------------------------------- |
| Accuracy, macro-F1    | How often it is right overall, with every class weighted equally                                            |
| Per-class P / R / F1  | E.g. drift **precision**: when it says "drift", how often is it really drift?                               |
| Confusion matrix      | Which classes it confuses (rows: true label, columns: predicted)                                            |
| Easy vs hard accuracy | Whether it handles anything beyond keywords                                                                 |
| Calibration           | Does "92% confident" mean right 92% of the time?                                                            |
| Consistency (repeats) | Share of cases where repeated Gemini runs agree (LLMs vary even at temperature 0.1)                         |
| Fallback rate         | Share of Gemini calls answered by the keyword fallback; when above 0, Gemini scores are reported separately |
| API calls, latency    | Cost proxy                                                                                                  |

Reports go to `eval-reports/` (git-ignored): `triage-eval-latest.md` (tables plus the five most
confident misclassifications with their notes) and a timestamped JSON with every prediction.

**Cost guards.** At most 3 repeats × dataset size Gemini calls per run, one call every 13 s by
default (the free tier allows 5 requests per minute), and the run **stops after 5 fallbacks in a
row**: a dead quota then costs 5 calls, and no Gemini score is reported.

**CI** ([`triage-eval.yml`](../.github/workflows/triage-eval.yml)): on PRs that change the
classifier, its prompt or the dataset, the heuristic is evaluated and the PR **fails below 78%
accuracy** (the measured baseline, rounded down). The Gemini evaluation runs only by manual
dispatch, because it spends the same daily quota as production triage.

## 📊 Latest results (2026-11-16)

### Heuristic (keyword) classifier

| Accuracy  | Macro-F1 | Easy (20) | Hard (12) |
| :-------: | :------: | :-------: | :-------: |
| **78.1%** |   0.78   |   100%    | **41.7%** |

| True ↓ / Predicted → | Drift  | Transient | Regression |
| :------------------- | :----: | :-------: | :--------: |
| `DOM_SELECTOR_DRIFT` | **10** |     0     |     0      |
| `TRANSIENT_RPC`      |   1    |   **8**   |     3      |
| `REGRESSION_DEFECT`  |   3    |     0     |   **7**    |

| Class                | Precision | Recall |  F1  |
| :------------------- | :-------: | :----: | :--: |
| `DOM_SELECTOR_DRIFT` |   71.4%   |  100%  | 0.83 |
| `TRANSIENT_RPC`      |   100%    | 66.7%  | 0.80 |
| `REGRESSION_DEFECT`  |   70.0%   | 70.0%  | 0.70 |

| Stated confidence  | Cases | Actual accuracy |
| :----------------- | :---: | :-------------: |
| 70–84 (says 82)    |  10   |      70.0%      |
| 85–94 (says 88–92) |  22   |      81.8%      |

What it means:

- The keywords catch every **easy** case and fewer than half of the **hard** ones.
- **Drift precision is 71%**: 4 of its 14 "drift" answers are wrong, and 3 of those are **real app
  regressions** (a dead "Get Help" button, a link to the wrong page, a missing product card),
  each reported with 92% confidence. Under the current heal policy, those failures are candidates
  for a self-healing patch, which would "fix" the test instead of reporting the bug.
- The stated confidences are fixed numbers, not estimates: 92 on a drift answer means right 71% of the time.
- The misses are the cases where the error text points to another class: a gateway 502 or a
  bare upstream timeout (no network keyword), slow RPC behind a locator timeout.

### Gemini (`gemini-flash-latest`)

**Not measured: no Gemini answer was obtained.** Two evaluation runs (3 repeats × 32 cases each)
got **0 Gemini answers out of 192 calls**, all answered by the fallback:

| Run                     | Fallbacks | Reasons                                                                                        |
| :---------------------- | :-------: | :--------------------------------------------------------------------------------------------- |
| 1 (one call per second) |  96 / 96  | 76 × `http_429` (5 requests/minute), 10 × `http_503` (model overloaded), 10 × `timeout` (15 s) |
| 2 (one call every 13 s) |  96 / 96  | 95 × `http_429` (daily quota: **20 requests per model per day**), 1 × `http_503`               |

The project's key is on the **Gemini free tier: 5 requests per minute and 20 per day per model**.
This is a production finding, not only an evaluation problem: CI triage uses the same key, a
nightly run triages up to 3 failures in each of several parallel jobs, and every PR run that
fails triages too, so on a busy day **many "AI" triage answers are likely the keyword fallback**.
Until now nothing showed it; the `source` field now does, so the real share can be measured from
the triage reports.

To measure Gemini, run `pnpm eval:triage --provider gemini --repeats 3` (or the workflow's manual
dispatch) with a key whose quota covers ~100 calls, and add the numbers here.

## ⚖️ Decision rule: when a triage result may become a patch

Derived from the numbers above and wired into
[`heal-agent.js`](../scripts/qa-agent/heal-agent.js) behind **`HEAL_POLICY`**:

| `HEAL_POLICY`        | A triage result becomes a self-healing patch when                                                                                                 |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| `legacy` (default)   | it is `DOM_SELECTOR_DRIFT`, or it carries a patch (behaviour unchanged)                                                                           |
| `evaluated` (opt-in) | it is `DOM_SELECTOR_DRIFT` **and** `source === 'gemini'` **and** `confidenceScore >= HEAL_MIN_CONFIDENCE` (default **95**) **and** it has a patch |

Everything else is reported (comment, summary), not patched, and the heal agent logs why.

- **Never heal on a keyword answer:** its drift precision is 71% and its misses include real
  regressions.
- **95% for Gemini** is a conservative placeholder: Gemini's calibration could not be measured.
  Set `HEAL_MIN_CONFIDENCE` from the `≥95` calibration bucket once Gemini has been evaluated.
- **To opt in**, set `HEAL_POLICY: evaluated` on the heal step of the workflows. Nothing changes
  in CI until then. With the current free-tier key this means almost no automatic heal PRs, which
  is the safe outcome.

## 📈 Impact on the quality metrics

[M4, the failure cause mix](quality-metrics.md), is built from triage labels. Its accuracy is now
measured: read the weekly mix with the 78% heuristic accuracy in mind, and with the knowledge that,
with the current key, many labels are likely the keyword fallback's (see `source` in the reports).

## 🧭 Follow-ups

- Measure Gemini with a key whose quota fits the evaluation (and production triage).
- Improve the keyword fallback where the worst-5 list points: 5xx gateway pages and bare upstream
  timeouts as `TRANSIENT_RPC`.
- Add confirmed real CI failures (`failureContext` in triage JSON) to the dataset.
- Evaluate the predictive test selection (`pr-impact-analyzer.js`) the same way: recall of the
  specs that actually fail.
- Evaluate the heal patches themselves: does the patched test pass, and is it the right fix?
