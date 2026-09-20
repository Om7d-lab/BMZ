import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * promisify() picks scrypt's three-argument overload, which drops the options
 * form we need for the cost parameters. Wrapping it directly keeps them.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing.
 *
 * scrypt from node:crypto is used rather than a native argon2 binding: it is
 * memory-hard, ships with the runtime, and needs no build toolchain in CI or
 * in a container. The parameters and the stored format are versioned, so
 * moving to argon2id later is a matter of adding a branch to `verify` and
 * rehashing on next sign-in — no password reset for anybody.
 *
 * Stored format: `scrypt$N$r$p$saltHex$hashHex`
 */
@Injectable()
export class PasswordService {
  /** ~64 MB and roughly 100 ms on a modern core. */
  private readonly cost = 2 ** 16;
  private readonly blockSize = 8;
  private readonly parallelization = 1;
  private readonly keyLength = 64;
  private readonly saltLength = 16;

  async hash(plaintext: string): Promise<string> {
    const salt = randomBytes(this.saltLength);
    const derived = await this.derive(plaintext, salt);

    return [
      'scrypt',
      this.cost,
      this.blockSize,
      this.parallelization,
      salt.toString('hex'),
      derived.toString('hex'),
    ].join('$');
  }

  async verify(plaintext: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, costRaw, blockSizeRaw, parallelizationRaw, saltHex, hashHex] = parts;
    const cost = Number(costRaw);
    const blockSize = Number(blockSizeRaw);
    const parallelization = Number(parallelizationRaw);

    if (
      !Number.isInteger(cost) ||
      !Number.isInteger(blockSize) ||
      !Number.isInteger(parallelization)
    ) {
      return false;
    }

    let expected: Buffer;
    try {
      expected = Buffer.from(hashHex!, 'hex');
    } catch {
      return false;
    }

    const derived = await scrypt(
      plaintext.normalize('NFKC'),
      Buffer.from(saltHex!, 'hex'),
      expected.length,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        // scrypt's memory ceiling is 32 MB by default, below what N = 2^16 needs.
        maxmem: 256 * 1024 * 1024,
      },
    );

    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }

  /** True when a stored hash uses parameters weaker than the current policy. */
  needsRehash(stored: string): boolean {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return true;
    return Number(parts[1]) < this.cost;
  }

  private async derive(plaintext: string, salt: Buffer): Promise<Buffer> {
    // NFKC so a password typed with combining marks or full-width characters
    // hashes the same on every platform the app runs on.
    return scrypt(plaintext.normalize('NFKC'), salt, this.keyLength, {
      N: this.cost,
      r: this.blockSize,
      p: this.parallelization,
      maxmem: 256 * 1024 * 1024,
    });
  }
}
