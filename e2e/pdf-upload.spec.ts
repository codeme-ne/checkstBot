import path from 'path';
import { expect, test } from '@playwright/test';

const pdfFixturePath = path.join(process.cwd(), '__tests__', 'fixtures', 'sample.pdf');
const forbiddenConsolePatterns = [
  /pdf-worker/i,
  /fake worker/i,
  /mime-typ/i,
  /mime type/i,
  /fkgroteskneue/i,
  /content-security-policy/i,
];

test('uploads a PDF, renders it, and explains a text selection without PDF regressions', async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  let summaryRequestBody = '';

  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') {
      consoleMessages.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.route('**/api/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        document: {
          id: 'sample-pdf',
          title: 'sample.pdf',
          content:
            'This PDF explains gravity and motion. It also includes a longer section about inertia, force, and page structure so the summary endpoint has enough material to process.',
        },
      }),
    });
  });

  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response:
          '### Einfache Erklaerung\nDie markierte Stelle beschreibt Gravitation und Bewegung.',
        sources: ['sample.pdf (Abschnitt 1)'],
      }),
    });
  });

  await page.route('**/api/summary', async (route) => {
    summaryRequestBody = route.request().postData() || '';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary:
          '## PDF als Industriestandard\n- Adobe entwickelte PDF als portables Austauschformat.\n- Seit 2008 ist PDF ISO-standardisiert.\n\n## Technische Merkmale\n- Texte, Bilder und Schriften bleiben layoutstabil.',
        generatedAt: '2026-03-10T10:00:00.000Z',
      }),
    });
  });

  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles(pdfFixturePath);

  await expect(page.getByRole('heading', { name: 'sample.pdf' })).toBeVisible();
  await expect(page.getByTestId('pdf-viewer')).toBeVisible();
  await expect(page.getByTestId('pdf-load-error')).toHaveCount(0);
  await expect(page.getByText('This PDF explains gravity and motion clearly.')).toBeVisible();

  await page.getByRole('button', { name: 'Summary' }).click();

  await expect(page.getByTestId('document-summary')).toBeVisible();
  await expect(page.getByText('Original Summary')).toBeVisible();
  expect(summaryRequestBody).toContain('"documentId":"sample-pdf"');

  await page.getByRole('button', { name: 'Content' }).click();
  await expect(page.getByTestId('pdf-viewer')).toBeVisible();
  await expect(page.getByText('This PDF explains gravity and motion clearly.')).toBeVisible();

  await page.getByRole('button', { name: /Vergroessern/i }).click();
  await expect(page.getByRole('button', { name: '115%' })).toBeVisible();
  await page.getByRole('button', { name: '115%' }).click();
  await expect(page.getByRole('button', { name: '100%' })).toBeVisible();

  await page.getByTestId('pdf-search-input').fill('motion');
  await expect(page.getByTestId('pdf-search-count')).toHaveText(/1 \/ [1-9]/);

  const forbiddenMessages = [...consoleMessages, ...pageErrors].filter((message) =>
    forbiddenConsolePatterns.some((pattern) => pattern.test(message)),
  );

  expect(forbiddenMessages, forbiddenMessages.join('\n')).toEqual([]);
});
