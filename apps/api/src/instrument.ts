import { config } from 'dotenv';
import * as path from 'node:path';
import * as Sentry from '@sentry/nestjs';
import {
  sanitizeSentryEvent,
  shouldDropSentryEvent,
} from './observability/sentry';

if (process.env.NODE_ENV !== 'production') {
  config({ path: path.resolve(__dirname, '../../../.env') });
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  beforeSend(event, hint) {
    if (shouldDropSentryEvent(event, hint)) {
      return null;
    }
    return sanitizeSentryEvent(event);
  },
});
