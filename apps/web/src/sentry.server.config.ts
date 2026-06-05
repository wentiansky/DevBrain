import * as Sentry from '@sentry/nextjs';
import { sanitizeEvent } from './lib/sentry';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: 0.1,

  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,

  beforeSend(event) {
    return sanitizeEvent(event);
  },
});
