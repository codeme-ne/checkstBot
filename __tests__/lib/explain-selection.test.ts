import { buildExplainDisplayMessage, extractSelectionContext } from '../../lib/explain-selection';

describe('explain-selection utilities', () => {
  it('extracts a broader context window around the selected text', () => {
    const content = [
      'Intro section.',
      '',
      'What are the largest systematic reviews or meta-analyses on acne vulgaris treatment effectiveness?',
      'Rank the most effective interventions based on study quality and effect size.',
      'Cite specific studies with sample sizes.',
      '',
      'Closing section.'
    ].join('\n');

    const context = extractSelectionContext(
      content,
      'lyses on acne vulgaris treatment effectiveness? Rank the most effective interventions'
    );

    expect(context).toContain(
      'What are the largest systematic reviews or meta-analyses on acne vulgaris treatment effectiveness?'
    );
    expect(context).toContain(
      'Rank the most effective interventions based on study quality and effect size.'
    );
    expect(context).toContain('Cite specific studies with sample sizes.');
  });

  it('builds a user-facing explain message without leaking backend prompt wording', () => {
    const message = buildExplainDisplayMessage(
      'What are the largest systematic reviews or meta-analyses on acne vulgaris treatment effectiveness?'
    );

    expect(message).toMatch(/^Bitte erkläre die markierte Stelle im Dokument: "/);
    expect(message).toContain('…"');
    expect(message).not.toContain('präzise und verständlich');
  });

  it('normalizes whitespace and removes surrounding quotes in explain display messages', () => {
    expect(buildExplainDisplayMessage('  “Line one\n\nLine two\t”  ')).toBe(
      'Bitte erkläre die markierte Stelle im Dokument: "Line one Line two"'
    );
  });
});
