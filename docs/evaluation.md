# checkstBot Evaluation Snapshot

Date: 2026-02-21

## Retrieval Quality

Current qualitative signals from local review:
- Document ingestion supports PDF, DOCX, TXT, and Markdown.
- Retrieval pipeline returns context for chat answers with source-aware flow.
- Architecture supports deterministic hardening via threshold tuning and chunking strategy.

## Known Failure Cases

- Ambiguous user questions can return partially relevant chunks.
- Very large documents may require chunk-size tuning for better precision.
- Hallucination risk remains when retrieval confidence is low.
- Missing/invalid API keys break critical runtime paths (OpenAI/Pinecone).

## Next Hardening Steps

1. Add evaluation dataset with labeled Q&A expectations.
2. Track precision/recall@k for retrieval changes.
3. Add confidence thresholding and fallback responses for low-relevance contexts.
4. Add automated regression tests for source-grounding behavior.
5. Add observability around retrieval latency and failed index operations.

## Suggested Metrics to Track

| Metric | Baseline | Target |
|---|---:|---:|
| Retrieval relevance (manual rubric) | TBD | >= 4/5 |
| Answer-with-citation rate | TBD | >= 90% |
| Critical failure count per release | TBD | 0 |
| Median response latency | TBD | < 3s |
