import { app } from '../server';
import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  // Restore original path if rewritten by Vercel
  const queryParam = req.query?.__path || (req.query as any)?.[0] || req.query?.path;
  const queryPath = Array.isArray(queryParam) ? queryParam.join('/') : (queryParam as string | undefined);

  const headerMatchedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-vercel-matched-path'] as string);

  const originalUrl = (req as any).originalUrl as string | undefined;

  if (queryPath) {
    const cleanSubPath = queryPath.replace(/^\/+/, '');
    req.url = cleanSubPath.startsWith('api/') ? `/${cleanSubPath}` : `/api/${cleanSubPath}`;
  } else if (
    headerMatchedPath &&
    headerMatchedPath.startsWith('/api/') &&
    (req.url === '/api' || req.url === '/' || !req.url.startsWith('/api/'))
  ) {
    req.url = headerMatchedPath;
  } else if (
    originalUrl &&
    originalUrl.startsWith('/api/') &&
    (req.url === '/api' || req.url === '/' || !req.url.startsWith('/api/'))
  ) {
    req.url = originalUrl;
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
}


