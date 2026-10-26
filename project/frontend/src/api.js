export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, /password|token|authorization/i.test(key) ? '[redacted]' : redact(item),
    ]));
  }
  return value;
}

export async function request(path, { method = 'GET', body, token, onComplete, timeout = 15000, responseType = 'json' } = {}) {
  if (!/^\/(auth|users|admin|credits|bills|emissions)(\/|\?|$)/.test(path) || path.includes('://') || path.includes('..')) {
    throw new Error('Use a supported backend endpoint.');
  }
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let status = 0;
  let data;
  let responseHeaders = {};
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    status = response.status;
    responseHeaders = Object.fromEntries(response.headers.entries());
    if (responseType === 'blob' && response.ok) {
      data = await response.blob();
    } else {
      const text = await response.text();
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    }
    if (!response.ok) {
      const detail = data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((error) => `${error.loc.join('.')}: ${error.msg}`).join('; ')
        : typeof detail === 'string' ? detail : `Request failed (${status})`;
      throw new ApiError(message, status, data);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    data = { error: error.name === 'AbortError' ? `Request timed out after ${Math.round(timeout / 1000)} seconds.` : 'Cannot reach the backend. Check that FastAPI and the frontend proxy are running.' };
    throw new ApiError(data.error, status, data);
  } finally {
    clearTimeout(timer);
    onComplete?.({
      id: crypto.randomUUID(), method, path, status,
      duration: Math.round(performance.now() - started),
      time: new Date().toISOString(), body: redact(body), data: redact(data),
      headers: redact(responseHeaders), authenticated: Boolean(token),
    });
  }
}
