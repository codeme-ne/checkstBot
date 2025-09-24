// Client-side CSRF token management
export function getCSRFTokenFromCookie(): string {
  if (typeof document === 'undefined') return '';

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token-client') {
      return decodeURIComponent(value);
    }
  }
  return '';
}

export async function fetchCSRFToken(): Promise<string> {
  try {
    await fetch('/api/csrf', {
      method: 'GET',
      credentials: 'same-origin'
    });
    // Token is now in cookie
    return getCSRFTokenFromCookie();
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return '';
  }
}