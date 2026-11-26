import type { TransporteSync } from './syncEngine';
import type { RespuestaPull, RespuestaPush, SolicitudPush } from './protocol';

/** Transporte HTTP con timeout. `token` = credencial del usuario en el sistema de la empresa. */
export function transporteHttp(baseUrl: string, token: string | null, timeoutMs = 20000): TransporteSync {
  const req = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init, signal: ctrl.signal,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as T;
    } finally { clearTimeout(to); }
  };
  return {
    push: (s: SolicitudPush) => req<RespuestaPush>('/push', { method: 'POST', body: JSON.stringify(s) }),
    pull: (desde: number) => req<RespuestaPull>(`/pull?desde=${desde}`),
  };
}
