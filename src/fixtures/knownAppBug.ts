import { test } from '@playwright/test';

/**
 * Marks the current test as an expected failure caused by a known app bug.
 *
 * - The test keeps running: it is reported as passed while the bug reproduces, and turns
 *   red ("expected to fail, but passed") once the app is fixed, signalling that this
 *   marker and its row in docs/known-app-bugs.md must be removed.
 * - The issue link is attached as a Playwright annotation, so it shows in the HTML report.
 *
 * Call it as the first statement of the test body.
 */
export function knownAppBug(issueUrl: string, reason: string): void {
  test.info().annotations.push({ type: 'issue', description: issueUrl });
  test.fail(true, `Known app bug (${issueUrl}): ${reason}`);
}

/** An open app bug that makes one variant of a data-driven test fail. */
export type KnownAppBug = { issue: string; reason: string };

/**
 * {@link knownAppBug} for data-driven tests, where only some variants hit the bug: marks the test
 * when `bug` is set and does nothing otherwise. Call it as the first statement of the test body.
 */
export function knownAppBugIf(bug: KnownAppBug | undefined): void {
  if (bug) knownAppBug(bug.issue, bug.reason);
}
