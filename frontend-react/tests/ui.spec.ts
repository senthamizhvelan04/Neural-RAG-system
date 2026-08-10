import { test, expect } from '@playwright/test';

test('Welcome screen logo is not clipped', async ({ page }) => {
  // Go to the local dev server
  await page.goto('http://localhost:5173');
  
  // Wait for the brain logo container to appear
  const logo = page.locator('.w-20.h-20.bg-\\[var\\(--color-accent-soft\\)\\].rounded-2xl');
  await logo.waitFor({ state: 'visible' });

  // Get its bounding box
  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  
  if (box) {
    console.log(`Logo Bounding Box: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);
    // It should not be clipped at the top (y >= 0)
    expect(box.y).toBeGreaterThanOrEqual(0);
  }
});
