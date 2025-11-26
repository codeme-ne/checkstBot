# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email us at: **lukas@zangerlcoachingdynamics.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

## Scope

### In Scope

- Vulnerabilities in the checkstBot codebase
- Authentication and authorization issues
- Injection vulnerabilities (XSS, SQL injection, command injection)
- CSRF bypass
- Rate limiting bypass
- Information disclosure
- Insecure direct object references

### Out of Scope

- Vulnerabilities in third-party dependencies (report to upstream maintainers)
- Social engineering attacks
- Physical security
- Denial of service attacks
- Issues requiring physical access

## AI/RAG-Specific Security Considerations

As an AI-powered document processing application, checkstBot has unique security considerations:

### Document Handling

- **User Responsibility**: Users are responsible for the documents they upload
- **No PII Logging**: The application does not log document contents or user queries to external services
- **Vector Storage**: Document embeddings are stored in Pinecone; users should configure their own Pinecone namespace
- **Temporary Files**: Uploaded files are deleted after processing

### API Keys & Secrets

- **Never Commit Secrets**: API keys must be stored in environment variables, never in code
- **Least Privilege**: Use API keys with minimal required permissions
- **Key Rotation**: Rotate API keys regularly

### Data Privacy

- **No Training Data**: User documents are not used to train AI models
- **GDPR/HIPAA**: Deployers are responsible for compliance with data protection regulations
- **Data Retention**: Document chunks persist in Pinecone until explicitly deleted

### Known Limitations

This application does NOT protect against:
- Prompt injection attacks (users should validate AI responses)
- Hallucinated responses from LLMs
- Misuse of AI-generated content
- Legal compliance for sensitive document types

## Security Best Practices for Deployers

1. **Environment Variables**: Never expose `.env.local` or API keys
2. **HTTPS Only**: Always deploy with HTTPS enabled
3. **Rate Limiting**: The application includes rate limiting; configure thresholds appropriately
4. **CSRF Protection**: CSRF protection is enabled by default; do not disable
5. **Content Security Policy**: Review and adjust CSP headers for your deployment
6. **Pinecone Namespace**: Use isolated namespaces for different environments (dev/staging/prod)
7. **Monitoring**: Monitor for unusual API usage patterns

## Security Features

checkstBot includes the following security measures:

- **CSRF Protection**: Token-based CSRF validation on all state-changing operations
- **Rate Limiting**: Configurable request throttling
- **Security Headers**: Comprehensive HTTP security headers via Vercel
- **Input Validation**: Sanitization on all user inputs
- **File Type Validation**: Content-based MIME type checking for uploads
- **Error Handling**: Secure error messages that don't leak sensitive information

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with permission).
