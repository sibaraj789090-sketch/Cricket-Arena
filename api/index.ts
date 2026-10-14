import { app } from '../server.ts';
import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  // Support pre-parsed bodies from Vercel serverless functions (JSON object, string, or Buffer)
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
      (req as any)._body = true;
    } catch {}
  } else if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
      (req as any)._body = true;
    } catch {}
  } else if (req.body && typeof req.body === 'object') {
    (req as any)._body = true;
  }

  // Restore original path if rewritten or routed by Vercel
  const queryParam =
    req.query?.__path ||
    (req.query as any)?.[0] ||
    req.query?.path ||
    (req.query as any)?.all;
  const queryPath = Array.isArray(queryParam) ? queryParam.join('/') : (queryParam as string | undefined);

  const headerMatchedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-vercel-matched-path'] as string);

  const originalUrl = (req as any).originalUrl as string | undefined;

  let targetPath = '';
  if (queryPath) {
    const cleanSubPath = queryPath.replace(/^\/+/, '');
    targetPath = cleanSubPath.startsWith('api/') ? `/${cleanSubPath}` : `/api/${cleanSubPath}`;
  } else if (
    headerMatchedPath &&
    headerMatchedPath.startsWith('/api/') &&
    !headerMatchedPath.includes('[...') &&
    (req.url === '/api' || req.url === '/' || !req.url.startsWith('/api/'))
  ) {
    targetPath = headerMatchedPath;
  } else if (
    originalUrl &&
    originalUrl.startsWith('/api/') &&
    !originalUrl.includes('[...') &&
    (req.url === '/api' || req.url === '/' || !req.url.startsWith('/api/'))
  ) {
    targetPath = originalUrl;
  } else if (req.url && !req.url.startsWith('/api')) {
    targetPath = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  } else {
    targetPath = req.url || '/api';
  }

  // Preserve query string when reconstructing req.url (e.g. tableId, userId)
  const queryEntries = Object.entries(req.query || {}).filter(
    ([k]) => k !== '__path' && k !== 'path' && k !== 'all' && k !== '0'
  );
  const rawPath = targetPath.split('?')[0];
  const queryString = queryEntries.length > 0
    ? '?' + new URLSearchParams(queryEntries.map(([k, v]) => [k, String(Array.isArray(v) ? v[0] : (typeof v === 'object' && v ? JSON.stringify(v) : v ?? ''))])).toString()
    : (targetPath.includes('?') ? '?' + targetPath.split('?')[1] : '');

  req.url = `${rawPath}${queryString}`;

  return app(req, res);
}


