import { Test, TestingModule } from '@nestjs/testing';
import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordHasherService],
    }).compile();

    service = module.get<PasswordHasherService>(PasswordHasherService);
  });

  describe('hash', () => {
    it('应该生成 Argon2id hash（含 $argon2id$ 前缀）', async () => {
      const hash = await service.hash('testPassword123');
      expect(hash).toContain('$argon2id$');
    });

    it('不同密码应生成不同 hash', async () => {
      const hash1 = await service.hash('passwordA');
      const hash2 = await service.hash('passwordB');
      expect(hash1).not.toEqual(hash2);
    });

    it('相同密码应生成不同 hash（salt 随机）', async () => {
      const hash1 = await service.hash('samePassword');
      const hash2 = await service.hash('samePassword');
      expect(hash1).not.toEqual(hash2);
    });
  });

  describe('verify', () => {
    it('正确密码应验证通过', async () => {
      const hash = await service.hash('correctPassword');
      const result = await service.verify(hash, 'correctPassword');
      expect(result).toBe(true);
    });

    it('错误密码应验证失败', async () => {
      const hash = await service.hash('correctPassword');
      const result = await service.verify(hash, 'wrongPassword');
      expect(result).toBe(false);
    });

    it('空密码应验证失败', async () => {
      const hash = await service.hash('somePassword');
      const result = await service.verify(hash, '');
      expect(result).toBe(false);
    });

    it('Argon2id 参数应固定为 memoryCost=65536, timeCost=3, parallelism=4', async () => {
      const hash = await service.hash('testParams');
      const match = hash.match(/^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('65536');
      expect(match![2]).toBe('3');
      expect(match![3]).toBe('4');
    });
  });
});