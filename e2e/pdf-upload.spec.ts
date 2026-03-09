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
  let explainMessage = '';

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
          content: 'This PDF explains gravity and motion.',
        },
      }),
    });
  });

  await page.route('**/api/chat', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    explainMessage = payload.message || '';

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

  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles(pdfFixturePath);

  await expect(page.getByRole('heading', { name: 'sample.pdf' })).toBeVisible();
  await expect(page.getByTestId('pdf-viewer')).toBeVisible();
  await expect(page.getByTestId('pdf-load-error')).toHaveCount(0);
  await expect(page.locator('.react-pdf__Page__textContent')).toBeVisible();

  const selectedText = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('.react-pdf__Page__textContent span')).filter(
      (element) => element.textContent?.trim(),
    );

    if (spans.length === 0) {
      throw new Error('No PDF text spans found');
    }

    const firstNode = spans[0].firstChild;
    const lastNode = spans[Math.min(spans.length - 1, 3)].firstChild;

    if (!firstNode || !lastNode) {
      throw new Error('No text nodes found inside PDF text layer');
    }

    const range = document.createRange();
    range.setStart(firstNode, 0);
    range.setEnd(lastNode, lastNode.textContent?.length ?? 0);

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('No selection object available');
    }

    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    return selection.toString();
  });

  expect(selectedText.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(3);

  const selectionDialog = page.getByRole('dialog');
  await expect(selectionDialog).toBeVisible();
  const explainRequestPromise = page.waitForRequest('**/api/chat');
  await selectionDialog
    .getByRole('button', { name: /Erkl/i })
    .evaluate((button: HTMLButtonElement) => button.click());

  const explainRequest = await explainRequestPromise;
  explainMessage = JSON.parse(explainRequest.postData() || '{}').message || '';

  expect(explainMessage).toContain('Bitte erkl');
  expect(explainMessage).toContain(selectedText.trim());
  await expect(
    page.getByText('Die markierte Stelle beschreibt Gravitation und Bewegung.'),
  ).toBeVisible();

  const forbiddenMessages = [...consoleMessages, ...pageErrors].filter((message) =>
    forbiddenConsolePatterns.some((pattern) => pattern.test(message)),
  );

  expect(forbiddenMessages, forbiddenMessages.join('\n')).toEqual([]);
});
