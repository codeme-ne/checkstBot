import '@testing-library/jest-dom';

jest.mock('react-pdf', () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: {
    version: '5.3.93',
    GlobalWorkerOptions: {
      workerSrc: '',
    },
  },
}));

describe('PDFViewer', () => {
  it('configures a bundled PDF.js worker asset instead of the deleted API route', () => {
    let workerSrc = '';

    jest.isolateModules(() => {
      const { pdfjs } = require('react-pdf');
      require('../../components/PDFViewer');
      workerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
    });

    expect(workerSrc).toContain('pdf.worker.min.mjs');
    expect(workerSrc).not.toContain('/api/pdf-worker');
  });
});
