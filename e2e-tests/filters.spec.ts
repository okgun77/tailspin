import { test, expect } from '@playwright/test';

test.describe('Game Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-filters')).toBeVisible();
  });

  test('should filter games by category', async ({ page }) => {
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');
    const total = await cards.count();
    const checkbox = page.locator('[data-testid^="filter-category-"]').first();
    const categoryId = (await checkbox.getAttribute('data-testid'))!.replace('filter-category-', '');

    await test.step('Select a category', async () => {
      await checkbox.check();
    });

    await test.step('Only matching games remain visible', async () => {
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(total);
      for (const card of await cards.all()) {
        await expect(card).toHaveAttribute('data-category-id', categoryId);
      }
      await expect(page.getByTestId('filter-count')).toHaveText(`Showing ${count} of ${total} games`);
      expect(page.url()).toContain(`category=${categoryId}`);
    });
  });

  test('should combine multiple categories with OR', async ({ page }) => {
    const boxes = page.locator('[data-testid^="filter-category-"]');
    test.skip((await boxes.count()) < 2, 'needs at least two categories');
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');

    await boxes.nth(0).check();
    const first = await cards.count();
    await boxes.nth(1).check();
    expect(await cards.count()).toBeGreaterThan(first);
  });

  test('should filter by publisher and combine with category', async ({ page }) => {
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');
    const select = page.getByTestId('filter-publisher');

    await test.step('Filter by publisher', async () => {
      await select.selectOption({ index: 1 });
      const publisherId = await select.inputValue();
      expect(await cards.count()).toBeGreaterThan(0);
      for (const card of await cards.all()) {
        await expect(card).toHaveAttribute('data-publisher-id', publisherId);
      }
    });

    await test.step('Adding a category narrows the results (AND)', async () => {
      const before = await cards.count();
      const firstCard = cards.first();
      const categoryId = await firstCard.getAttribute('data-category-id');
      await page.getByTestId(`filter-category-${categoryId}`).check();
      const after = await cards.count();
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  test('should clear filters and restore all games', async ({ page }) => {
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');
    const total = await cards.count();

    await page.locator('[data-testid^="filter-category-"]').first().check();
    await page.getByTestId('filter-clear').click();

    await expect(cards).toHaveCount(total);
    expect(page.url()).not.toContain('category=');
  });

  test('should restore filters from the URL', async ({ page }) => {
    const checkbox = page.locator('[data-testid^="filter-category-"]').first();
    const categoryId = (await checkbox.getAttribute('data-testid'))!.replace('filter-category-', '');

    await page.goto(`/?category=${categoryId}`);

    await expect(page.getByTestId(`filter-category-${categoryId}`)).toBeChecked();
    for (const card of await page.locator('[data-testid="game-card"]:not([hidden])').all()) {
      await expect(card).toHaveAttribute('data-category-id', categoryId);
    }
  });

  test('should be operable with the keyboard', async ({ page }) => {
    const checkbox = page.locator('[data-testid^="filter-category-"]').first();
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
  });
});
