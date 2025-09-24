import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
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

async function uploadHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const form = new IncomingForm({
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);

      if (err.message?.includes('maxFileSize')) {
        res.status(413).json({ error: 'File size exceeds 10MB limit' });
      } else {
        res.status(400).json({ error: 'Invalid form data' });
      }
      return;
    }

    const file = files.file;

    if (!file || !Array.isArray(file) || file.length === 0) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const uploadedFile = file[0];

    try {
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
        res.status(400).json({
          error: 'Invalid file type. Supported formats: PDF, DOCX, TXT, MD. File content does not match allowed types.'
        });
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileContent.length > maxSize) {
        await fs.unlink(uploadedFile.filepath).catch(() => {}); // Clean up
        res.status(400).json({
          error: `File too large. Maximum size is 10MB, your file is ${(fileContent.length / 1024 / 1024).toFixed(2)}MB`
        });
        return;
      }

      // Clean up temp file after reading
      await fs.unlink(uploadedFile.filepath).catch(err => console.error('Failed to delete temp file:', err));

      const result = await ragSystem.processDocument(
        fileContent,
        uploadedFile.originalFilename || 'document',
        uploadedFile.mimetype || 'application/octet-stream'
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          document: {
            id: result.documentId || 'doc-' + Date.now(),
            title: uploadedFile.originalFilename || 'document',
            content: result.content || '[Content processed successfully]'
          }
        });
      } else {
        console.error('Document processing failed:', result.message);
        res.status(422).json({ error: result.message || 'Failed to process document' });
      }
    } catch (error) {
      console.error('Error processing file:', error);

      if (error instanceof Error) {
        if (error.message.includes('vector')) {
          res.status(503).json({ error: 'Vector database unavailable. Please try again later.' });
        } else if (error.message.includes('parse')) {
          res.status(422).json({ error: 'Unable to parse document content' });
        } else {
          res.status(500).json({ error: 'Error processing document' });
        }
      } else {
        res.status(500).json({ error: 'Unexpected error occurred' });
      }
    }
  });
}

// Apply rate limiting (5 uploads per 5 minutes) and CSRF protection
const handler = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 uploads per 5 minutes
  message: 'Too many uploads. Please wait before uploading another document.'
})(uploadHandler);

export default withCSRFProtection(handler);
