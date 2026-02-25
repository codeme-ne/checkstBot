import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files, File } from 'formidable';
import fs from 'fs/promises';
import { ragSystem } from '../../lib/rag';
import { withCSRFProtection } from '../../lib/csrf';
import { rateLimit } from '../../lib/rate-limit';
import { fileTypeFromBuffer } from 'file-type';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to wrap formidable's callback API in a Promise
function parseForm(req: NextApiRequest): Promise<{ fields: Fields; files: Files }> {
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '4194304', 10); // 4MB default for Vercel
  const form = new IncomingForm({
    maxFileSize,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

async function uploadHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { files } = await parseForm(req);
    const file = files.file;

    if (!file || !Array.isArray(file) || file.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile: File = file[0];

    // Read file content
    const fileContent = await fs.readFile(uploadedFile.filepath);

    // Validate MIME type using file content, not just extension
    const allowedMimeTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    // Check actual file content type
    const fileTypeResult = await fileTypeFromBuffer(fileContent);

    // For text files, file-type may not detect them, so fallback to checking extension
    const fileExtension = uploadedFile.originalFilename?.split('.').pop()?.toLowerCase();
    const textExtensions = ['txt', 'md'];

    let isValidType = false;

    if (fileTypeResult && allowedMimeTypes.includes(fileTypeResult.mime)) {
      isValidType = true;
    } else if (textExtensions.includes(fileExtension || '') &&
               (uploadedFile.mimetype?.startsWith('text/') || !fileTypeResult)) {
      // Allow text files that may not be detected by file-type
      isValidType = true;
    }

    if (!isValidType) {
      await fs.unlink(uploadedFile.filepath).catch(() => {}); // Clean up
      return res.status(400).json({
        error: 'Invalid file type. Supported formats: PDF, DOCX, TXT, MD. File content does not match allowed types.'
      });
    }

    // Validate file size (default max 4MB for Vercel Hobby request limits)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '4194304', 10);
    if (fileContent.length > maxSize) {
      await fs.unlink(uploadedFile.filepath).catch(() => {}); // Clean up
      return res.status(400).json({
        error: `File too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(1)}MB, your file is ${(fileContent.length / 1024 / 1024).toFixed(2)}MB`
      });
    }

    // Clean up temp file after reading
    await fs.unlink(uploadedFile.filepath).catch(err => console.error('Failed to delete temp file:', err));

    const result = await ragSystem.processDocument(
      fileContent,
      uploadedFile.originalFilename || 'document',
      uploadedFile.mimetype || 'application/octet-stream'
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        document: {
          id: result.documentId || 'doc-' + Date.now(),
          title: uploadedFile.originalFilename || 'document',
          content: result.content || '[Content processed successfully]'
        }
      });
    } else {
      console.error('Document processing failed:', result.message);
      return res.status(422).json({ error: result.message || 'Failed to process document' });
    }
  } catch (err: unknown) {
    console.error('Error processing file upload:', err);

    const error = err instanceof Error ? err : new Error('Unknown error');

    if (error.message?.includes('maxFileSize')) {
      const maxSize = parseInt(process.env.MAX_FILE_SIZE || '4194304', 10);
      return res.status(413).json({ error: `File size exceeds ${(maxSize / 1024 / 1024).toFixed(1)}MB limit` });
    } else if (error.message?.includes('vector')) {
      return res.status(503).json({ error: 'Vector database unavailable. Please try again later.' });
    } else if (error.message?.includes('parse')) {
      return res.status(422).json({ error: 'Unable to parse document content' });
    } else {
      return res.status(500).json({ error: 'Error processing document' });
    }
  }
}

// Apply rate limiting (5 uploads per 5 minutes) and CSRF protection
const handler = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 uploads per 5 minutes
  message: 'Too many uploads. Please wait before uploading another document.'
})(uploadHandler);

export default withCSRFProtection(handler);
