const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
let csrfTokenValue = null;
let csrfRequest = null;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = undefined } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function getCsrfToken(forceRefresh = false) {
  if (forceRefresh) {
    csrfTokenValue = null;
    csrfRequest = null;
  }
  if (csrfTokenValue) return csrfTokenValue;
  if (!csrfRequest) {
    csrfRequest = fetch(`${apiBase}/auth/csrf`, { credentials: 'include' })
      .then(async (response) => {
        const payload = await readJson(response);
        if (!response.ok || !payload.data?.csrfToken) {
          throw new ApiError(payload.error?.message || 'Could not start a secure session.', {
            status: response.status,
            code: payload.error?.code || 'CSRF_UNAVAILABLE',
          });
        }
        csrfTokenValue = payload.data.csrfToken;
        return csrfTokenValue;
      })
      .catch((error) => {
        csrfRequest = null;
        if (error instanceof ApiError) throw error;
        throw new ApiError('Could not reach QueueSaathi. Check that the API is running.');
      });
  }
  return csrfRequest;
}

async function sendRequest(path, options, csrfToken) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: options.body === undefined || typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Could not reach QueueSaathi. Check your connection and try again.');
  }
  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(payload.error?.message || 'The request could not be completed.', {
      status: response.status,
      code: payload.error?.code || 'REQUEST_FAILED',
      details: payload.error?.details,
    });
  }
  return payload.data ?? payload;
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (!needsCsrf) return sendRequest(path, { ...options, method }, null);

  let token = await getCsrfToken();
  try {
    return await sendRequest(path, { ...options, method }, token);
  } catch (error) {
    // Recover after logout/session expiry clears the double-submit cookie.
    if (error.code !== 'CSRF_INVALID') throw error;
    token = await getCsrfToken(true);
    return sendRequest(path, { ...options, method }, token);
  }
}

export function resetCsrfToken() {
  csrfTokenValue = null;
  csrfRequest = null;
}
