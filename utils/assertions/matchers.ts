import { expect, type APIResponse } from '@playwright/test';

expect.extend({
  async toHaveStatusCode(response: APIResponse, expected: number) {
    const actual = response.status();
    const pass = actual === expected;

    if (pass) {
      return {
        message: () => `Expected status code not to be ${expected}, but got ${actual}`,
        pass: true,
      };
    }

    const body = await response.text().catch(() => '<unable to read response body>');
    return {
      message: () => `Expected status code ${expected} but got ${actual}.\nResponse body:\n${body}`,
      pass: false,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveStatusCode(expected: number): Promise<R>;
    }
  }
}
