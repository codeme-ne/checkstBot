---
title: "fix: Render uploaded PDFs natively in document viewer instead of raw text"
type: fix
status: completed
date: 2026-03-08
---

# fix: Render uploaded PDFs natively in document viewer instead of raw text

## Overview

When a PDF is uploaded, the document viewer panel shows ugly raw extracted text instead of rendering the PDF natively with page navigation and zoom. The `PDFViewer` component exists and works, but the upload flow loses the `File` object, so `EnhancedDocumentViewer` falls back to plain text display.

## Problem Statement

The data flow has three gaps that combine to produce the bug:

1. **File object lost during upload**: `FileUpload.processFile()` has access to the `File` object but `onUploadComplete` only passes `{id, title}` -- the File reference is discarded.
2. **MIME type overwritten**: `pages/index.tsx:87` hardcodes `type: 'uploaded'` instead of the actual MIME type (`application/pdf`, `text/markdown`, etc.). `EnhancedDocumentViewer.renderDocumentContent()` checks `document.file.type` or `document.type` but gets `'uploaded'`, which matches nothing.
3. **Document interfaces mismatched**: The `Document` interface in `pages/index.tsx` lacks a `file?: File` property, while `EnhancedDocumentViewer.tsx` expects one.

### Current flow (broken)

```
User drops PDF -> FileUpload has File object
  -> sends FormData to /api/upload
  -> API extracts text, returns {id, title, content: "raw text..."}
  -> FileUpload calls onUploadComplete({id, title})   <-- File lost here
  -> index.tsx creates Document{type: 'uploaded'}      <-- MIME lost here
  -> EnhancedDocumentViewer: no document.file, no PDF MIME
  -> falls back to TextViewer with raw extracted text
```

### Desired flow (fixed)

```
User drops PDF -> FileUpload has File object
  -> sends FormData to /api/upload (unchanged)
  -> API returns {id, title, content} (unchanged)
  -> FileUpload calls onUploadComplete({id, title, file})   <-- File preserved
  -> index.tsx creates Document{type: file.type, file}       <-- MIME preserved
  -> EnhancedDocumentViewer: has document.file with type 'application/pdf'
  -> renders PDFViewer natively with zoom, pages, text selection
```

## Proposed Solution

Minimal change: thread the `File` object through the upload callback so `EnhancedDocumentViewer` can pass it to `PDFViewer`.

## Technical Considerations

- **localStorage limitation**: `File` objects cannot be serialized to JSON. After page reload, the native PDF view will be unavailable. This is acceptable -- show a "re-upload to view" message or fall back to extracted text. The RAG chat still works because embeddings persist in Pinecone.
- **Memory**: Keeping `File` refs in React state for typical document sizes (< 4MB limit) is fine. No blob URLs needed since `react-pdf` accepts `File` directly.
- **No backend changes**: The `/api/upload` and `/api/chat` endpoints stay untouched.

## Acceptance Criteria

- [x] Uploaded PDF renders natively via `PDFViewer` (with page navigation, zoom, text selection)
- [x] Uploaded DOCX renders via appropriate viewer (or falls back gracefully)
- [x] Uploaded TXT/MD renders via `TextViewer`/`MarkdownViewer` as before
- [x] After page reload, documents still appear in sidebar (from localStorage) with graceful fallback for the viewer
- [x] No changes to backend API routes
- [x] Existing tests pass (`npm run test`)

## MVP Implementation

### Step 1: Update `FileUpload` callback to include File

`components/FileUpload.tsx`

```typescript
// Change interface
interface FileUploadProps {
  onUploadComplete: (document: { id: string; title: string; file?: File }) => void;
  // ... rest unchanged
}

// In processFile(), pass file to callback:
onUploadComplete({ ...data.document, file });
```

### Step 2: Update Document interface and state in `pages/index.tsx`

```typescript
interface Document {
  id: string;
  title: string;
  content: string;
  type: string;       // actual MIME type, e.g. 'application/pdf'
  uploadDate: string;
  file?: File;         // original File object (session-only, not serializable)
}

// In handleUploadComplete:
const handleUploadComplete = (doc: { id: string; title: string; content?: string; file?: File }) => {
  const newDoc: Document = {
    id: doc.id,
    title: doc.title,
    content: doc.content || '[Content stored in vector database]',
    type: doc.file?.type || 'uploaded',  // use actual MIME type
    uploadDate: new Date().toISOString(),
    file: doc.file,                       // preserve File reference
  };
  // ... rest unchanged
};
```

### Step 3: Verify EnhancedDocumentViewer already handles it

`components/EnhancedDocumentViewer.tsx:170-181` already checks `document.file` and routes to `PDFViewer` for `application/pdf`. No changes needed here -- just confirming the existing logic works once File is provided.

### Step 4: Graceful reload fallback

After page reload, `document.file` will be `undefined` (not serializable). The existing fallback path in `EnhancedDocumentViewer` already handles this:
- If `document.file` is missing but `document.content` exists: shows extracted text
- If content is `'[Content stored in vector database]'`: shows "Dokument bereit fur Chat" message

Optionally enhance with a re-upload prompt: "PDF-Vorschau nicht verfugbar. Laden Sie die Datei erneut hoch oder stellen Sie Fragen im Chat."

## Files to Modify

| File | Change |
|------|--------|
| `components/FileUpload.tsx` | Add `file` to `onUploadComplete` callback type and pass it |
| `pages/index.tsx` | Add `file?: File` to Document interface, use `file.type` as MIME, pass file to EnhancedDocumentViewer |

## Files Unchanged (verified)

| File | Why |
|------|-----|
| `components/EnhancedDocumentViewer.tsx` | Already handles `document.file` correctly |
| `components/PDFViewer.tsx` | Already accepts `file` prop and renders natively |
| `pages/api/upload.ts` | Backend unchanged |
| `pages/api/chat.ts` | Backend unchanged |
| `lib/document-parser.ts` | Backend unchanged |

## Sources & References

- `components/EnhancedDocumentViewer.tsx:170-181` -- existing File-based routing logic
- `components/PDFViewer.tsx:14` -- accepts `file?: File` prop
- `components/FileUpload.tsx:108` -- `processFile(file: File)` has the File object
- `pages/index.tsx:81-101` -- `handleUploadComplete` creates Document without File
