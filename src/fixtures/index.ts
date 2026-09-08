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
  app: async ({ page, baseURL }, use) => {
    const app = new App(page);
  
    await app.open(baseURL || '/');
  
    await use(app);

    await app.close();
  },
});

export const expect = test.expect;

export function step(target: Function, context: ClassMethodDecoratorContext) {
  return function replacementMethod(this: any, ...args: any) {
    const name = this.constructor.name + '.' + (context.name as string);
    return test.step(name, async () => {
      return await target.call(this, ...args);
    });
  };
}

