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
