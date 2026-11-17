# 🏷️ Triage evaluation dataset

Labelled test failures used to measure the AI triage classifier
([`scripts/qa-agent/triage-core.js`](../../../scripts/qa-agent/triage-core.js)). Run the evaluation
with `pnpm eval:triage`; results and how to read them are in
[`docs/ai-triage-evaluation.md`](../../../docs/ai-triage-evaluation.md).

---

## The three classes

| Class                | One-sentence definition                                                                                                        | What fixes it                        |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| `DOM_SELECTOR_DRIFT` | The app works for a user, but the test's locator (or the UI it expects) no longer matches what the app renders.                | Update the test / page object        |
| `TRANSIENT_RPC`      | A dependency (network, DNS, RPC node, upstream API, gateway) was unavailable or too slow during the run; nothing is broken.    | Re-run (and watch dependency health) |
| `REGRESSION_DEFECT`  | The app (front end or API) behaves wrongly: wrong data, broken contract, broken feature, or it mishandles a recoverable error. | Fix the app; file a bug              |

## Decision rules for ambiguous failures

Apply them in order. The first rule that matches decides the label.

1. **Could a correct app have passed?** If the dependency recovered, or the error was a single
   one the app should retry or report, the failure is the app's: `REGRESSION_DEFECT`. Example: one
   RPC 429 that leaves the vault page on a loading skeleton forever (aphelion-app#1667).
2. **Was the dependency unavailable for the whole failing step?** DNS failure, refused or reset
   connections, a gateway 502/503 page, an upstream that never answers or answers after the
   timeout: `TRANSIENT_RPC`, even when the visible error is only a locator timeout.
3. **Does the API answer, but wrongly?** Wrong values, missing or mistyped fields, a 5xx with an
   application stack trace, a status code that breaks the documented contract (200 where 400/405 is
   required): `REGRESSION_DEFECT`. A retry will not fix it.
4. **Is the element missing because the feature broke, or because the markup changed?**
   - A control that is still there but does nothing, navigation to the wrong page, or a product
     missing from a list is `REGRESSION_DEFECT`.
   - A renamed test id, label or role, a copy change, a new banner the test must dismiss, or an
     extra matching element (strict mode violation) is `DOM_SELECTOR_DRIFT`.
5. **Did the test code change and break its own locator?** `DOM_SELECTOR_DRIFT` (the diff usually
   shows it).

If a case still needs product knowledge to decide (e.g. was this copy change intended?), label it
with the intended outcome, mark it `hard` and explain the ambiguity in `notes`.

## Case format

One file per case, `dataset/TRI-NNN.json`:

```json
{
  "id": "TRI-017",
  "label": "TRANSIENT_RPC",
  "labelSource": "fault-injection",
  "difficulty": "hard",
  "notes": "Why this label is correct; for hard cases, why it is ambiguous.",
  "capturedAt": "2026-11-16",
  "failure": {
    "...": "extractFailureContext() shape: testTitle, filePath, line, status, errorSnippet, stackTrace, sourceCodeSnippet, gitDiff, ..."
  }
}
```

- **`labelSource`**: `fault-injection` (the cause was injected on purpose, so the label is true
  by construction), `real-failure` (a CI failure whose root cause a person confirmed) or
  `synthetic` (hand-written, for patterns that are hard to reproduce safely; at most 30% of the
  set).
- **`difficulty`**: `hard` when the visible error points to a different class than the true one.
  Keep at least 25% of the set hard: easy cases only show that keywords work.
- **Targets:** ≥ 30 cases, ≥ 8 per class.

## Adding a case

**From a failure you reproduced** (preferred). Inject the fault on a throwaway branch or worktree,
never in committed code. Run the failing test, then capture it from the same checkout:

```bash
RETRIES=0 npx playwright test <spec> -g "<test>"
pnpm eval:capture --label TRANSIENT_RPC --difficulty hard \
  --notes "Fault injection: <what you broke>. <Why this label>. <Why it is hard, if it is>."
```

Faults used for the current set:

| Class                | How the fault was injected                                                                                                                                                                              |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TRANSIENT_RPC`      | A local proxy in front of staging (`BASE_URL` pointed at it) returning 502 / 429, resetting or hanging connections, or delaying `/api/rpc`; an unresolvable or refusing `BASE_URL`                      |
| `DOM_SELECTOR_DRIFT` | The same proxy injecting a script that renames test ids, labels or copy, duplicates a link or adds an overlay (app-side change, no test diff); typos in page-object locators (test-side change)         |
| `REGRESSION_DEFECT`  | The proxy rewriting API responses (missing or mistyped fields, wrong values, 500 with a stack, 200 where 400/405 is required) or breaking a feature in the page (dead button, wrong link, missing card) |

Use `--rewrite <proxy-url>=<real-url>` so captured errors show the real base URL, as in CI.

**From a real CI failure.** Triage reports now store the failure context
(`ai-reports/triage-*.json` → `analyses[].failureContext`). Once a person has confirmed the root
cause, copy it into a new case with `labelSource: "real-failure"`.

**Secrets.** `pnpm eval:capture` scrubs every case (private keys and other 64-hex values,
key-bearing RPC URLs, webhooks, tokens, local home paths, and the literal values of secret
variables in the environment and `.env`). Check the file before committing it anyway.
