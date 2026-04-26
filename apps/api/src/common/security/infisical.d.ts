/**
 * Type declarations for @infisical/sdk (optional dependency)
 * Install with: npm install @infisical/sdk
 */
declare module '@infisical/sdk' {
  export interface InfisicalClientConfig {
    siteUrl?: string;
  }

  export interface ListSecretsOptions {
    environment: string;
    projectId: string;
    path?: string;
    attachToProcessEnv?: boolean;
  }

  export interface Secret {
    secretKey: string;
    secretValue: string;
  }

  export class InfisicalClient {
    constructor(config?: InfisicalClientConfig);
    listSecrets(options: ListSecretsOptions): Promise<Secret[]>;
  }
}
