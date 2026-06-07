import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // no-op in local dev without DSN configured

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Performance tracing off by default — enable once baseline is stable
    tracesSampleRate: 0,
    // Only send errors, not replays
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      // Don't send cancelled request errors to Sentry
      if (event.exception?.values?.some((v) => v.type === 'CanceledError')) {
        return null;
      }
      return event;
    },
  });
}

/** Capture an exception with optional extra context. */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Attach a Core Web Vitals measurement to the next error report. */
export function addWebVitalBreadcrumb(metric: {
  name: string;
  value: number;
  rating: string;
  id: string;
  rounded: string;
}) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${metric.name}: ${metric.rounded}`,
    data: { value: metric.value, rating: metric.rating, id: metric.id },
    level: metric.rating === 'good' ? 'info' : metric.rating === 'needs-improvement' ? 'warning' : 'error',
  });
}

/** Set the authenticated user context so errors are tagged with who triggered them. */
export function setSentryUser(user: { id: string; email: string; name: string } | null) {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, username: user.name });
  } else {
    Sentry.setUser(null);
  }
}
