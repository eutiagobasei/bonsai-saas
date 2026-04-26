import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Secrets management service that supports multiple providers.
 *
 * In production: Uses Infisical SDK to fetch secrets from vault
 * In development: Falls back to environment variables
 *
 * Setup Infisical:
 * 1. npm install @infisical/sdk
 * 2. Set INFISICAL_TOKEN environment variable
 * 3. Optional: Set INFISICAL_SITE_URL for self-hosted
 *
 * Critical secrets to migrate:
 * - JWT_SECRET
 * - JWT_REFRESH_SECRET
 * - DATABASE_URL
 * - REDIS_URL
 * - Third-party API keys
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private secrets: Map<string, string> = new Map();
  private readonly useVault: boolean;

  constructor(private readonly configService: ConfigService) {
    // Use vault if INFISICAL_TOKEN is present
    this.useVault = !!this.configService.get<string>('INFISICAL_TOKEN');
  }

  async onModuleInit() {
    if (this.useVault) {
      await this.loadFromVault();
    } else {
      this.logger.warn(
        'INFISICAL_TOKEN not set - using environment variables directly. ' +
          'This is acceptable for development but NOT recommended for production.',
      );
    }
  }

  /**
   * Get a secret value.
   * Priority: Vault > Environment Variable
   */
  get(key: string): string | undefined {
    // First check vault secrets
    const vaultValue = this.secrets.get(key);
    if (vaultValue) {
      return vaultValue;
    }

    // Fall back to environment variable
    return this.configService.get<string>(key);
  }

  /**
   * Get a required secret value.
   * Throws if not found in vault or environment.
   */
  getOrThrow(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(
        `Required secret '${key}' not found in vault or environment variables`,
      );
    }
    return value;
  }

  /**
   * Check if running with vault secrets (production mode).
   */
  isUsingVault(): boolean {
    return this.useVault && this.secrets.size > 0;
  }

  private async loadFromVault(): Promise<void> {
    try {
      // Dynamic import to avoid bundling the SDK when not using vault
      // The SDK is optional - install when deploying to production
      const { InfisicalClient } = await import('@infisical/sdk').catch(() => {
        throw new Error('@infisical/sdk not installed');
      });

      const client = new InfisicalClient({
        siteUrl: this.configService.get<string>(
          'INFISICAL_SITE_URL',
          'https://app.infisical.com',
        ),
      });

      const token = this.configService.get<string>('INFISICAL_TOKEN');
      const environment = this.configService.get<string>(
        'INFISICAL_ENVIRONMENT',
        'prod',
      );
      const projectId = this.configService.get<string>('INFISICAL_PROJECT_ID');

      if (!token || !projectId) {
        this.logger.warn(
          'INFISICAL_TOKEN or INFISICAL_PROJECT_ID not set - using env vars',
        );
        return;
      }

      const secretsList = await client.listSecrets({
        environment,
        projectId,
        path: '/',
        attachToProcessEnv: false,
      });

      for (const secret of secretsList) {
        this.secrets.set(secret.secretKey, secret.secretValue);
      }

      this.logger.log(
        `Loaded ${this.secrets.size} secrets from Infisical vault`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load secrets from vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.warn('Falling back to environment variables');
    }
  }
}
