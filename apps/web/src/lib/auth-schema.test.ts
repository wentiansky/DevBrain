import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from './auth-schema';

describe('auth schemas', () => {
  describe('loginSchema', () => {
    it('should accept valid email and password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password123' });
      expect(result.success).toBe(true);
    });

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'password123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('请输入邮箱');
      }
    });

    it('should reject invalid email format', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('邮箱格式无效');
      }
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('请输入密码');
      }
    });

    it('should reject missing fields', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should accept valid email and password (>= 8 chars)', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({ email: 'user@example.com', password: '1234567' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('密码至少 8 个字符');
      }
    });

    it('should reject password longer than 128 characters', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'a'.repeat(129),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('密码最多 128 个字符');
      }
    });

    it('should accept password exactly 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: '12345678',
      });
      expect(result.success).toBe(true);
    });

    it('should accept password exactly 128 characters', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        password: 'a'.repeat(128),
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = registerSchema.safeParse({ email: 'invalid', password: 'SecurePass123!' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('邮箱格式无效');
      }
    });
  });
});