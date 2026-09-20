import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies a password against its own hash', async () => {
    const hash = await service.hash('correct horse battery staple');

    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(service.verify('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(service.verify('Correct horse battery staple', hash)).resolves.toBe(false);
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([
      service.hash('a-long-enough-password'),
      service.hash('a-long-enough-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('normalises unicode so an equivalent password still verifies', async () => {
    // "é" as a single code point versus "e" plus a combining accent.
    const hash = await service.hash('passéword-long');
    await expect(service.verify('passéword-long', hash)).resolves.toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(service.verify('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(service.verify('anything', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
    await expect(service.verify('anything', '')).resolves.toBe(false);
  });

  it('flags a hash made with weaker parameters for rehashing', async () => {
    const current = await service.hash('a-long-enough-password');
    expect(service.needsRehash(current)).toBe(false);
    expect(service.needsRehash('scrypt$1024$8$1$aabb$ccdd')).toBe(true);
    expect(service.needsRehash('garbage')).toBe(true);
  });
}, 30_000);
