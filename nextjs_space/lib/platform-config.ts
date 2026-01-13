import { prisma } from "./db";
import { decrypt } from "./encryption";

interface PlatformConfig {
  drGreenApiUrl: string | null;
  awsBucketName: string | null;
  awsFolderPrefix: string | null;
  awsRegion: string | null;
  awsAccessKeyId: string | null;
  awsSecretAccessKey: string | null;
  emailServer: string | null;
  emailFrom: string | null;
  redisUrl: string | null;
}

let configCache: PlatformConfig | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Get platform configuration from database with environment variable fallback
 * Results are cached for 1 minute to avoid excessive database queries
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  const now = Date.now();

  // Return cached config if still fresh
  if (configCache && now - lastFetchTime < CACHE_DURATION) {
    return configCache;
  }

  try {
    const dbConfig = await prisma.platform_config.findUnique({
      where: { id: "config" },
    });

    if (dbConfig) {
      // Decrypt sensitive fields with environment variable fallback
      const decryptedConfig: PlatformConfig = {
        drGreenApiUrl:
          dbConfig.drGreenApiUrl || process.env.DRGREEN_API_URL || null,
        awsBucketName:
          dbConfig.awsBucketName || process.env.AWS_BUCKET_NAME || null,
        awsFolderPrefix:
          dbConfig.awsFolderPrefix || process.env.AWS_FOLDER_PREFIX || null,
        awsRegion: dbConfig.awsRegion || process.env.AWS_REGION || null,
        awsAccessKeyId:
          (dbConfig.awsAccessKeyId ? decrypt(dbConfig.awsAccessKeyId) : null) ||
          process.env.AWS_ACCESS_KEY_ID ||
          null,
        awsSecretAccessKey:
          (dbConfig.awsSecretAccessKey
            ? decrypt(dbConfig.awsSecretAccessKey)
            : null) ||
          process.env.AWS_SECRET_ACCESS_KEY ||
          null,
        emailServer:
          (dbConfig.emailServer ? decrypt(dbConfig.emailServer) : null) ||
          process.env.EMAIL_SERVER ||
          null,
        emailFrom: dbConfig.emailFrom || process.env.EMAIL_FROM || null,
        redisUrl:
          (dbConfig.redisUrl ? decrypt(dbConfig.redisUrl) : null) ||
          process.env.REDIS_URL ||
          null,
      };

      configCache = decryptedConfig;
      lastFetchTime = now;
      return decryptedConfig;
    }
  } catch (error) {
    console.error("Error fetching platform config from database:", error);
  }

  // Fallback to environment variables
  const envConfig: PlatformConfig = {
    drGreenApiUrl: process.env.DRGREEN_API_URL || null,
    awsBucketName: process.env.AWS_BUCKET_NAME || null,
    awsFolderPrefix: process.env.AWS_FOLDER_PREFIX || null,
    awsRegion: process.env.AWS_REGION || null,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
    emailServer: process.env.EMAIL_SERVER || null,
    emailFrom: process.env.EMAIL_FROM || null,
    redisUrl: process.env.REDIS_URL || null,
  };

  configCache = envConfig;
  lastFetchTime = now;
  return envConfig;
}

/**
 * Clear the config cache (useful after updates)
 */
export function clearConfigCache() {
  configCache = null;
  lastFetchTime = 0;
}
