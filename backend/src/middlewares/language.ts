import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      lang?: string;
    }
  }
}

export function languageMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const lang = (req.headers['accept-language'] || 'es').split(',')[0].split('-')[0];
  req.lang = ['es', 'en', 'fr'].includes(lang) ? lang : 'es';
  next();
}
