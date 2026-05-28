export interface RateLimiterCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  check(
    key: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): RateLimiterCheck;

  peek(
    key: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): RateLimiterCheck;

  record(
    key: string,
    action: string,
    maxAttempts: number,
    windowMs: number,
  ): RateLimiterCheck;

  reset(): void;
}