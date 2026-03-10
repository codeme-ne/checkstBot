import { RAGSystem } from '../../lib/rag';

describe('RAGSystem.summarizeDocumentContent', () => {
  it('uses chunk-and-synthesis summarization for long documents', async () => {
    const createCompletion = jest.fn().mockImplementation(async (payload: any) => {
      const userPrompt = payload.messages[1].content as string;
      const isSynthesisCall = userPrompt.includes('Partial summaries:');

      return {
        choices: [{
          message: {
            content: isSynthesisCall
              ? '## Finale Zusammenfassung\n- Konsolidierter Punkt'
              : '## Abschnitt\n- Punkt eins\n- Punkt zwei\n- Punkt drei',
          },
        }],
      };
    });

    const ragSystem = new RAGSystem({} as any);
    (ragSystem as any).openai = {
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    };

    const longContent = Array.from({ length: 48 }, (_, index) =>
      `Absatz ${index}: ${'Das Dokument enthaelt viele Details und technische Hintergruende. '.repeat(18)}`,
    ).join('\n\n');

    const summary = await ragSystem.summarizeDocumentContent('Langdokument', longContent);

    expect(summary).toContain('## Finale Zusammenfassung');
    expect(createCompletion.mock.calls.length).toBeGreaterThan(2);
    const synthesisCall = createCompletion.mock.calls.find((call) =>
      (call[0].messages[1].content as string).includes('Partial summaries:'),
    );
    expect(synthesisCall).toBeDefined();
  });
});
