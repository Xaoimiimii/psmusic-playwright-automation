import { test, type Page } from '@playwright/test';

/**
 * Reports a page-object action as one Allure / Playwright step named for what the
 * user does ("Log in as \"pwqa_…\""), instead of the low-level clicks and fills
 * inside it. The step is boxed: a failure points at the line in the test that
 * called the action.
 *
 * Use it on actions only. Queries read inside `expect.poll` (e.g. `audioVolume()`)
 * would add one step per poll. A title built from arguments must never include a
 * password or a token.
 *
 * @example
 *   @step((credentials: Credentials) => `Log in as "${credentials.username}"`)
 *   async login(credentials: Credentials): Promise<void> { ... }
 */
export function step<This, Args extends unknown[], Return>(title: string | ((...args: Args) => string)) {
  return function decorate(
    target: (this: This, ...args: Args) => Promise<Return>,
    _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
  ) {
    return function reported(this: This, ...args: Args): Promise<Return> {
      const name = typeof title === 'function' ? title(...args) : title;
      return test.step(name, () => target.apply(this, args), { box: true });
    };
  };
}

/**
 * Attaches a screenshot of the visible page at a checkpoint worth seeing in the
 * report. Playwright already attaches one on failure; use this only where the
 * page state itself is evidence. Shows whatever the page shows: test accounts only.
 */
export async function attachScreenshot(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}
