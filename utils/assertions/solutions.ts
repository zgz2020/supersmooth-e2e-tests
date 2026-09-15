import test, { expect } from '@playwright/test';

type ExpectStatusCodeProps = {
  actual: number;
  expected: number;
};

export const expectStatusCode = async (
  propsOrActual: ExpectStatusCodeProps | number,
  expectedVal?: number,
) => {
  const actual = typeof propsOrActual === 'number' ? propsOrActual : propsOrActual.actual;
  const expected = typeof propsOrActual === 'number' ? expectedVal! : propsOrActual.expected;

  await test.step(`Should have ${expected} status code`, async () => {
    expect(actual).toBe(expected);
  });
};
