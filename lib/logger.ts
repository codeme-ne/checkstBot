import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info;

    // Never log sensitive data
    const sanitizedMetadata = sanitizeMetadata(metadata);

    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(sanitizedMetadata).length > 0) {
      msg += ` ${JSON.stringify(sanitizedMetadata)}`;
    }
    return msg;
  })
);

// Sanitize metadata to remove sensitive information
function sanitizeMetadata(metadata: any): any {
  if (typeof metadata !== 'object' || metadata === null) {
    return metadata;
  }

  const sanitized: any = {};

  for (const key in metadata) {
    const lowerKey = key.toLowerCase();

    // Skip sensitive fields
    if (lowerKey.includes('api_key') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof metadata[key] === 'object') {
      sanitized[key] = sanitizeMetadata(metadata[key]);
    } else {
      sanitized[key] = metadata[key];
    }
  }

  return sanitized;
}

// Define which transports to use based on environment
const transports: winston.transport[] = [];
const isServerlessRuntime =
  process.env.VERCEL === '1' ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.LAMBDA_TASK_ROOT);
const useFileLogs =
  process.env.NODE_ENV === 'production' &&
  !isServerlessRuntime &&
  process.env.ENABLE_FILE_LOGS === 'true';

// Always keep console logging available (required for serverless environments).
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production'
      ? format
      : winston.format.combine(
          winston.format.colorize({ all: true }),
          format
        ),
  })
);

if (useFileLogs) {
  // File logs are opt-in and only for writable runtimes.
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  transports,
});

// Create a wrapper that matches console methods
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),

  // Compatibility methods for easier migration from console
  log: (message: string, meta?: any) => logger.info(message, meta),
};

export default logger;
