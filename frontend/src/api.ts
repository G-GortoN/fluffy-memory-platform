export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const message = details?.detail || details?.message;
    const fallback = response.status >= 500 ? '服务暂时不可用，请稍后重试。' : '操作未完成，请检查输入后重试。';
    throw new ApiError(response.status, typeof message === 'string' ? message : fallback);
  }
  if (response.status === 204 || response.headers.get('Content-Length') === '0') return undefined as T;
  if (!response.headers.get('Content-Type')?.includes('json')) {
    throw new ApiError(502, '服务暂时不可用，请稍后重试。');
  }
  return await response.json() as T;
}

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  const isForm = data instanceof FormData;
  if (data !== undefined && !isForm) headers.set('Content-Type', 'application/json');
  if (method !== 'GET') {
    const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    const { token } = await parseResponse<{ token: string }>(response);
    headers.set('X-CSRF-TOKEN', token);
  }
  return parseResponse<T>(await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? data : data === undefined ? undefined : JSON.stringify(data),
    credentials: 'same-origin',
    cache: 'no-store',
  }));
}

export async function uploadPhoto(file: File) {
  const formData = new FormData();
  formData.set('file', file);
  return api<{ id: string; url: string }>('/media', 'POST', formData);
}
