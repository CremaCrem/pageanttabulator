import { test, expect, type Page } from '@playwright/test';

// src/App.tsx picks the admin shell only when window.isTauri is set, so a plain browser
// is always a judge. Setting the flag is the only way to reach admin pages from here.
const asAdmin = (page: Page) =>
  page.addInitScript(() => Object.assign(window, { isTauri: true }));

const CANDIDATE_NAME = 'Smoke Test Candidate';

test.describe.configure({ mode: 'serial' });

test('admin creates the event, one candidate and one judge slot', async ({ page }) => {
  await asAdmin(page);
  await page.goto('/');

  await page.locator('input[name="name"]').fill('Smoke Test Pageant');
  await page.locator('input[name="venue"]').fill('Smoke Test Gymnasium');
  await page.locator('input[name="judgeCount"]').fill('1');
  await page.getByRole('button', { name: 'Initialize Event' }).click();
  await expect(page.getByRole('button', { name: 'Update Event Details' })).toBeVisible();

  await page.goto('/candidates');
  await page.getByPlaceholder('e.g. 01').fill('01');
  await page.getByPlaceholder('Juan dela Cruz').fill(CANDIDATE_NAME);
  await page.getByPlaceholder('CAS').fill('CAS');
  await page.getByRole('button', { name: 'Add Candidate' }).click();

  await expect(page.getByRole('cell', { name: CANDIDATE_NAME })).toBeVisible();
});

test('judge submits a score through the on-screen form', async ({ page, request }) => {
  const opened = await request.post('/api/rounds/open', {
    data: { segmentId: 'production_number' },
  });
  expect(opened.ok()).toBeTruthy();

  await page.goto('/');
  // judgeCount was set to 1 in the setup flow, so exactly one slot is offered.
  await expect(page.getByRole('button', { name: 'Judge 2' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Judge 1' }).click();
  await expect(page).toHaveURL(/\/score$/);

  for (const criterion of ['Stage Presence', 'Energy', 'Audience Engagement', 'Overall Appeal']) {
    await page.getByLabel(criterion).fill('85');
  }
  await page.getByRole('button', { name: 'Submit Score' }).click();
  await expect(page.getByText('Scores successfully submitted.')).toBeVisible();

  // The on-screen confirmation is client state; confirm the server actually stored it.
  const stored = await (await request.get('/api/scores/judge/J1')).json();
  expect(stored).toHaveLength(1);
  expect(stored[0].segmentId).toBe('production_number');
});
