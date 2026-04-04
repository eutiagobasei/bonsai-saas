import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

export interface TenantContextData {
  tenantId: string;
  tenantSchema: string;
  userId?: string;
}

/**
 * Singleton service that provides tenant context using AsyncLocalStorage.
 * This allows us to pass tenant information through the entire request lifecycle
 * without explicitly passing it through every function call.
 */
@Injectable()
export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantContextData>();

  /**
   * Run a function within a tenant context
   */
  static run<T>(context: TenantContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Run an async function within a tenant context
   */
  static async runAsync<T>(
    context: TenantContextData,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * Get the current tenant context
   * @returns The current tenant context or undefined if not in a tenant context
   */
  static getContext(): TenantContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current tenant ID
   * @throws Error if not in a tenant context
   */
  static getTenantId(): string {
    const context = this.getContext();
    if (!context) {
      throw new Error('No tenant context available');
    }
    return context.tenantId;
  }

  /**
   * Get the current tenant schema name
   * @throws Error if not in a tenant context
   */
  static getTenantSchema(): string {
    const context = this.getContext();
    if (!context) {
      throw new Error('No tenant context available');
    }
    return context.tenantSchema;
  }

  /**
   * Check if we're currently in a tenant context
   */
  static hasTenantContext(): boolean {
    return this.getContext() !== undefined;
  }
}
