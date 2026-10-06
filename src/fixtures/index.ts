import { test as base } from '@playwright/test';
import { App } from '../app.js';

type AppFixtures = {
  /**
   * Custom fixture that automatically opens the web app at baseURL
   * before passing the App instance to the test.
   */
  app: App;
};

export const test = base.extend<AppFixtures>({
  app: async ({ page }, use) => {
    const app = new App(page);

    await app.open();

    await use(app);

    await app.close();
  },
});

export const expect = test.expect;

export function step<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
  return function replacementMethod(this: This, ...args: Args): Return {
    // Map arguments to strings and join them safely
    const stringifiedArgs = args
      .map((arg: unknown) => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return '[Object]';
          }
        }
        return String(arg);
      })
      .join(', ');

    const name = `${(this as object).constructor.name}.${context.name as string}(${stringifiedArgs})`;

    return test.step(name, async () => {
      return await target.call(this, ...args);
    }) as Return;
  };
}
