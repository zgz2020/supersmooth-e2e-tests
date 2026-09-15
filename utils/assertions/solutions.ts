import { expect } from '@playwright/test';

type ExpectStatusCodeProps = {
  actual: number;
  expected: number;
};

export const expectStatusCode = async ({ actual, expected }: ExpectStatusCodeProps) => {
  expect(actual, `Should have ${expected} status code`).toBe(expected);
};
