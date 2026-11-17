/**
 * Classification metrics for the triage evaluation (pure functions, unit-tested).
 *
 * A value that cannot be computed (e.g. the precision of a class that was never predicted) is
 * `null`, shown as "n/a" in reports, never NaN.
 */

const ratio = (num, den) => (den > 0 ? num / den : null);

/**
 * @param {Array<{ truth: string, predicted: string }>} pairs
 * @param {string[]} classes
 * @returns {Record<string, Record<string, number>>} matrix[truth][predicted] = count
 */
export function confusionMatrix(pairs, classes) {
  const matrix = Object.fromEntries(
    classes.map((truth) => [truth, Object.fromEntries(classes.map((p) => [p, 0]))]),
  );
  for (const { truth, predicted } of pairs) {
    if (matrix[truth] && predicted in matrix[truth]) matrix[truth][predicted] += 1;
  }
  return matrix;
}

/** Precision, recall, F1 and support per class. */
export function perClassMetrics(matrix, classes) {
  return Object.fromEntries(
    classes.map((cls) => {
      const tp = matrix[cls][cls];
      const support = classes.reduce((sum, p) => sum + matrix[cls][p], 0);
      const predictedCount = classes.reduce((sum, t) => sum + matrix[t][cls], 0);
      const precision = ratio(tp, predictedCount);
      const recall = ratio(tp, support);
      const f1 =
        precision === null || recall === null
          ? null
          : precision + recall === 0
            ? 0
            : (2 * precision * recall) / (precision + recall);
      return [cls, { precision, recall, f1, support, predicted: predictedCount }];
    }),
  );
}

/**
 * Accuracy, macro-F1 and per-class metrics. Macro-F1 averages the classes present in the data;
 * a class that was never predicted counts as F1 = 0 there.
 */
export function classificationMetrics(pairs, classes) {
  const matrix = confusionMatrix(pairs, classes);
  const perClass = perClassMetrics(matrix, classes);
  const correct = pairs.filter((p) => p.truth === p.predicted).length;
  const present = classes.filter((cls) => perClass[cls].support > 0);
  const macroF1 = present.length
    ? present.reduce((sum, cls) => sum + (perClass[cls].f1 ?? 0), 0) / present.length
    : null;
  return {
    total: pairs.length,
    correct,
    accuracy: ratio(correct, pairs.length),
    macroF1,
    matrix,
    perClass,
  };
}

/**
 * Share of cases whose repeated runs all gave the same class. Only cases with 2+ runs count.
 * @param {string[][]} predictionsPerCase
 */
export function consistency(predictionsPerCase) {
  const repeated = predictionsPerCase.filter((runs) => runs.length > 1);
  const stable = repeated.filter((runs) => runs.every((p) => p === runs[0])).length;
  return { cases: repeated.length, stable, rate: ratio(stable, repeated.length) };
}

export const CONFIDENCE_BUCKETS = [
  { label: '<70', min: -Infinity, max: 70 },
  { label: '70–84', min: 70, max: 85 },
  { label: '85–94', min: 85, max: 95 },
  { label: '≥95', min: 95, max: Infinity },
];

export const bucketOf = (confidence) =>
  CONFIDENCE_BUCKETS.find((b) => confidence >= b.min && confidence < b.max)?.label ?? '<70';

/**
 * Accuracy per stated-confidence bucket: does "92% confident" mean right 92% of the time?
 * @param {Array<{ confidence: number, correct: boolean }>} predictions
 */
export function calibration(predictions) {
  return CONFIDENCE_BUCKETS.map(({ label }) => {
    const inBucket = predictions.filter((p) => bucketOf(Number(p.confidence) || 0) === label);
    const correct = inBucket.filter((p) => p.correct).length;
    const meanConfidence = inBucket.length
      ? inBucket.reduce((sum, p) => sum + (Number(p.confidence) || 0), 0) / inBucket.length
      : null;
    return {
      bucket: label,
      count: inBucket.length,
      correct,
      accuracy: ratio(correct, inBucket.length),
      meanConfidence,
    };
  });
}

/** Nearest-rank percentile; null for an empty list. */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(Math.ceil(p * sorted.length) - 1, 0)];
}

/** Share of results that asked Gemini but were answered by the heuristic fallback. */
export function fallbackRate(results) {
  const fellBack = results.filter((r) => r.source === 'heuristic').length;
  return { calls: results.length, fellBack, rate: ratio(fellBack, results.length) };
}
