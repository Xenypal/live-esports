import { test, expect } from '@playwright/test';

test('serves app icons from the icons folder', async ({ page, request }) => {
  await page.goto('/');

  const iconPaths = await page.evaluate(() => {
    const selectors = [
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"][sizes="32x32"]',
      'link[rel="icon"][sizes="16x16"]',
    ];

    return selectors.map((selector) => {
      const element = document.querySelector<HTMLLinkElement>(selector);
      return {
        selector,
        href: element?.getAttribute('href') ?? '',
      };
    });
  });

  expect(iconPaths).toEqual([
    { selector: 'link[rel="apple-touch-icon"]', href: 'icons/apple-touch-icon.png' },
    { selector: 'link[rel="icon"][sizes="32x32"]', href: 'icons/favicon-32x32.png' },
    { selector: 'link[rel="icon"][sizes="16x16"]', href: 'icons/favicon-16x16.png' },
  ]);

  for (const icon of iconPaths) {
    const response = await request.get(`/${icon.href}`);
    expect(response.ok(), `${icon.selector} should resolve`).toBeTruthy();
  }
});
