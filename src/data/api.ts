// Client for the Apps Script Web App (see Code.gs).
// Body is sent as text/plain so the browser does not send a CORS preflight; the token travels in the body, never in the URL.
import type { SyncTable } from './db';
import type { SheetRow } from './mapping';

export interface PullResponse { ok: true; serverTime: string; data: Record<SyncTable, SheetRow[]> }
export interface PushResponse {
  ok: true;
  serverTime: string;
  applied: { table: SyncTable; key: string; updatedAt: string }[];
  conflicts: { table: SyncTable; row: SheetRow }[];
}
export interface ApiErrorBody { ok: false; error: string; message: string }

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ApiConfig { url: string; token: string }

export type Transport = (url: string, body: string, signal: AbortSignal) => Promise<unknown>;

const fetchTransport: Transport = async (url, body, signal) => {
  const res = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal });
  if (!res.ok) throw new ApiError('http_' + res.status, `HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // A login page instead of JSON usually means "Who has access" is not set to Anyone.
    throw new ApiError('not_json', 'not_json');
  }
};

let transport: Transport = fetchTransport;
/** Tests and the in-app demo can swap the network layer. */
export function setTransport(t: Transport | null) {
  transport = t ?? fetchTransport;
}

async function call<T>(cfg: ApiConfig, payload: Record<string, unknown>, timeoutMs = 30000): Promise<T> {
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url) && !cfg.url.startsWith('mock:')) {
    throw new ApiError('bad_url', 'bad_url');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const out = (await transport(cfg.url, JSON.stringify({ token: cfg.token, ...payload }), ctrl.signal)) as { ok?: boolean; error?: string; message?: string } | null;
    if (!out || out.ok !== true) throw new ApiError(out?.error ?? 'unknown', out?.message ?? 'unknown');
    return out as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError('timeout', 'timeout');
    throw new ApiError('network', String((e as Error).message ?? e));
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  ping: (cfg: ApiConfig) => call<{ ok: true; apiVersion: number; serverTime: string }>(cfg, { action: 'ping' }, 15000),
  pull: (cfg: ApiConfig, since?: string) => call<PullResponse>(cfg, { action: 'pull', since }),
  push: (cfg: ApiConfig, changes: { table: SyncTable; row: SheetRow }[]) => call<PushResponse>(cfg, { action: 'push', changes }),
  writeSummary: (cfg: ApiConfig, rows: Record<string, unknown>[]) => call<{ ok: true; written: number }>(cfg, { action: 'writeSummary', rows }),
};
