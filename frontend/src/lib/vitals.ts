import type { Metric } from 'web-vitals';
import { addWebVitalBreadcrumb } from './sentry';

const GOOD: Record<string, number> = {
  CLS: 0.1, INP: 200, LCP: 2500, FCP: 1800, TTFB: 800,
};

function rate(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = GOOD[name];
  if (!threshold) return 'good';
  return value <= threshold ? 'good' : value <= threshold * 2.5 ? 'needs-improvement' : 'poor';
}

function onMetric(metric: Metric) {
  const rating = rate(metric.name, metric.value);
  const rounded = metric.name === 'CLS' ? metric.value.toFixed(4) : `${Math.round(metric.value)}ms`;

  if (import.meta.env.DEV) {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
    console.debug(`[WebVitals] ${emoji} ${metric.name}: ${rounded} (${rating})`);
  }

  addWebVitalBreadcrumb({
    name: metric.name,
    value: metric.value,
    rating,
    id: metric.id,
    rounded,
  });
}

export function reportWebVitals() {
  // Dynamic import keeps web-vitals out of the critical JS path
  import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    onCLS(onMetric);
    onINP(onMetric);
    onLCP(onMetric);
    onFCP(onMetric);
    onTTFB(onMetric);
  });
}
