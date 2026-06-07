export const ENVIRONMENT_NAMES = {
  development: 'development',
  test: 'test',
  production: 'production',
} as const;

export const CONFIG_KEYS = {
  nodeEnv: 'NODE_ENV',
  publicWebUrl: 'PUBLIC_WEB_URL',
  adminWebUrl: 'ADMIN_WEB_URL',
  apiBaseUrl: 'API_BASE_URL',
  apiDevToken: 'API_DEV_TOKEN',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  jobQueuePrefix: 'JOB_QUEUE_PREFIX',
  proofStorageBucket: 'PROOF_STORAGE_BUCKET',
  proofStorageDir: 'PROOF_STORAGE_DIR',
  proofStorageRegion: 'PROOF_STORAGE_REGION',
  proofStorageEndpoint: 'PROOF_STORAGE_ENDPOINT',
  proofMaxBytes: 'PROOF_MAX_BYTES',
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  telegramSellerChatId: 'TELEGRAM_SELLER_CHAT_ID',
  emailFrom: 'EMAIL_FROM',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpSecure: 'SMTP_SECURE',
  smtpUser: 'SMTP_USER',
  smtpPassword: 'SMTP_PASSWORD',
  rateLimitWindowMs: 'RATE_LIMIT_WINDOW_MS',
  rateLimitMaxRequests: 'RATE_LIMIT_MAX_REQUESTS',
} as const;

export type ValueOf<T extends Record<string, unknown>> = T[keyof T];
export type EnvironmentName = ValueOf<typeof ENVIRONMENT_NAMES>;
export type ConfigKey = ValueOf<typeof CONFIG_KEYS>;

export interface ConfigContract {
  readonly environment: EnvironmentName;
  readonly requiredKeys: readonly ConfigKey[];
  readonly secretKeys: readonly ConfigKey[];
}

export const loadConfigContract = (): ConfigContract => ({
  environment: ENVIRONMENT_NAMES.development,
  requiredKeys: Object.values(CONFIG_KEYS),
  secretKeys: [
    CONFIG_KEYS.databaseUrl,
    CONFIG_KEYS.apiDevToken,
    CONFIG_KEYS.redisUrl,
    CONFIG_KEYS.telegramBotToken,
    CONFIG_KEYS.smtpPassword,
  ],
});
