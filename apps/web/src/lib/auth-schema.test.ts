import { describe, it, expect } from 'vitest';
import { validateLogin, validateRegister } from './auth-schema';

describe('auth validation', () => {
  describe('validateLogin', () => {
    it('有效邮箱和密码应通过', () => {
      const result = validateLogin({ email: 'user@example.com', password: 'password123' });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('空邮箱应拒绝', () => {
      const result = validateLogin({ email: '', password: 'password123' });
      expect(result.email).toBe('请输入邮箱');
    });

    it('无效邮箱格式应拒绝', () => {
      const result = validateLogin({ email: 'not-an-email', password: 'password123' });
      expect(result.email).toBe('邮箱格式无效');
    });

    it('空密码应拒绝', () => {
      const result = validateLogin({ email: 'user@example.com', password: '' });
      expect(result.password).toBe('请输入密码');
    });
  });

  describe('validateRegister', () => {
    it('有效邮箱和密码 (≥8 字符) 应通过', () => {
      const result = validateRegister({
        email: 'user@example.com',
        password: 'SecurePass123!',
      });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('密码少于 8 字符应拒绝', () => {
      const result = validateRegister({ email: 'user@example.com', password: '1234567' });
      expect(result.password).toBe('密码至少 8 个字符');
    });

    it('密码超过 128 字符应拒绝', () => {
      const result = validateRegister({
        email: 'user@example.com',
        password: 'a'.repeat(129),
      });
      expect(result.password).toBe('密码最多 128 个字符');
    });

    it('密码恰好 8 字符应通过', () => {
      const result = validateRegister({
        email: 'user@example.com',
        password: '12345678',
      });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('密码恰好 128 字符应通过', () => {
      const result = validateRegister({
        email: 'user@example.com',
        password: 'a'.repeat(128),
      });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('无效邮箱格式应拒绝', () => {
      const result = validateRegister({ email: 'invalid', password: 'SecurePass123!' });
      expect(result.email).toBe('邮箱格式无效');
    });
  });
});