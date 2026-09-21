export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// En producción el frontend (Cloudflare) y el backend (Render) viven en dominios distintos.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${url}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Algo salió mal. Inténtalo de nuevo en un momento.');
  }
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>('GET', url),
  post: <T,>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T,>(url: string, body: unknown) => request<T>('PUT', url, body),
  patch: <T,>(url: string, body: unknown) => request<T>('PATCH', url, body),
};

export const qs = (params: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};
