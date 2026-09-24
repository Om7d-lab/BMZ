import { z } from 'zod';

/**
 * Environment is validated once, at boot, and the process refuses to start if
 * anything required is missing or malformed. A misconfigured secret should
 * stop a deploy, not surface as a 500 the first time someone signs in.
 */
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_URL: z.url().default('http://localhost:4000'),
  API_CORS_ORIGINS: z.string().default('http://localhost:3000'),
  WEB_URL: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Long enough that a brute force is pointless. The default values shipped in
  // .env.example are placeholders and are rejected outside development.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('bmz-trade-lab'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),

  // Google sign-in (OAuth 2.0 / OpenID Connect). Both optional: without them
  // the app runs and the Google button explains that sign-in is unavailable.
  // The secret is only ever read here on the server.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Must match an "Authorized redirect URI" in Google Cloud Console exactly.
  // Defaults to the web origin, because the browser reaches the API through
  // the web app's /api rewrite — that keeps the session cookies first-party.
  // A blank line in .env means unset, not an invalid URL.
  GOOGLE_REDIRECT_URI: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
  // Leave unset in production. Exists so tests can point discovery at a local
  // OpenID provider instead of Google.
  GOOGLE_OIDC_ISSUER: z.url().default('https://accounts.google.com'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Implicit TLS (port 465). Providers on 587 use STARTTLS, which nodemailer
  // negotiates on its own, so this stays false there.
  //
  // Parsed the same way as AUTH_COOKIE_SECURE rather than with
  // z.coerce.boolean(), which reads the string "false" as true.
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  MAIL_FROM: z.string().default('BMZ Trade Lab <no-reply@bmztradelab.com>'),

  // Everything below stays off until its credentials are supplied. The flags
  // are read at module registration so a disabled module is never constructed.
  BILLING_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  BROKER_SYNC_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  MARKET_DATA_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  AI_ASSISTANT_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
});

export type Environment = z.infer<typeof environmentSchema>;

const PLACEHOLDER_SECRETS = [
  'replace-me-with-a-long-random-string',
  'replace-me-with-a-different-long-random-string',
];

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(raw);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const env = result.data;

  if (env.NODE_ENV === 'production') {
    for (const secret of [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET]) {
      if (PLACEHOLDER_SECRETS.includes(secret)) {
        throw new Error(
          'Refusing to start in production with the placeholder JWT secrets from .env.example',
        );
      }
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
  }

  return env;
}

/** Splits the configured origin list. CORS with credentials needs exact origins. */
export function corsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
