import type { RateLimiter, RateLimiterCheck } from './rate-limiter.interface';

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, WindowEntry>();

  check(
    key: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): RateLimiterCheck {
    const compositeKey = `${action}:${key}`;
    const now = Date.now();
    const entry = this.store.get(compositeKey);

    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(compositeKey, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxAttempts - 1, resetAt: new Date(now + windowMs) };
    }

    entry.count += 1;

    if (entry.count > maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.windowStart + windowMs),
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - entry.count,
      resetAt: new Date(entry.windowStart + windowMs),
    };
  }

  peek(
    key: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): RateLimiterCheck {
    const compositeKey = `${action}:${key}`;
    const now = Date.now();
    const entry = this.store.get(compositeKey);

    if (!entry || now - entry.windowStart >= windowMs) {
      return { allowed: true, remaining: maxAttempts, resetAt: new Date(now + windowMs) };
    }

    if (entry.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.windowStart + windowMs),
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - entry.count,
      resetAt: new Date(entry.windowStart + windowMs),
    };
  }

  record(
    key: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): RateLimiterCheck {
    return this.check(key, action, maxAttempts, windowMs);
  }

  reset(): void {
    this.store.clear();
  }
}