import handler from '../../../pages/api/summary';
import { ragSystem } from '../../../lib/rag';

jest.mock('../../../lib/rag', () => ({
  ragSystem: {
    summarizeDocumentContent: jest.fn(),
  },
}));

type MockRequestOptions = {
  method?: string;
  body?: Record<string, unknown>;
  remoteAddress?: string;
};

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader: jest.Mock<void, [string, string]>;
  status: jest.Mock<MockResponse, [number]>;
  json: jest.Mock<MockResponse, [unknown]>;
};

const createMockRequest = ({
  method = 'POST',
  body = {},
  remoteAddress = '127.0.0.1',
}: MockRequestOptions = {}) => ({
  method,
  body,
  headers: {
    'x-csrf-token': 'csrf-token',
  },
  cookies: {
    'csrf-token': 'csrf-token',
  },
  socket: {
    remoteAddress,
  },
}) as any;

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader: jest.fn((name: string, value: string) => {
      response.headers[name] = value;
    }),
    status: jest.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: jest.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
  };

  return response;
};

describe('/api/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns structured markdown and a generated timestamp', async () => {
    (ragSystem.summarizeDocumentContent as jest.Mock).mockResolvedValue(
      '## PDF als Industriestandard\n- Adobe entwickelte das Format.\n- Seit 2008 ISO-Standard.',
    );

    const req = createMockRequest({
      remoteAddress: '127.0.0.2',
      body: {
        documentId: 'pdf-grundlagen',
        title: 'PDF Grundlagen',
        content: 'Dieses Dokument beschreibt die Entwicklung des PDF-Formats in mehreren Abschnitten.',
      },
    });
    const res = createMockResponse();

    await handler(req, res as any);

    expect(ragSystem.summarizeDocumentContent).toHaveBeenCalledWith(
      'PDF Grundlagen',
      'Dieses Dokument beschreibt die Entwicklung des PDF-Formats in mehreren Abschnitten.',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      summary: expect.stringContaining('## PDF als Industriestandard'),
      generatedAt: expect.any(String),
    });
  });

  it('rejects too-short document content before calling the summary helper', async () => {
    const req = createMockRequest({
      remoteAddress: '127.0.0.3',
      body: {
        documentId: 'short-doc',
        title: 'Kurzes Dokument',
        content: 'Zu kurz.',
      },
    });
    const res = createMockResponse();

    await handler(req, res as any);

    expect(ragSystem.summarizeDocumentContent).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      error: 'Document content is too short for a structured summary',
    });
  });
});
