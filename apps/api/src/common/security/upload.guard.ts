import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as path from 'path';

// Decorator metadata keys
export const UPLOAD_CONFIG_KEY = 'upload_config';

export interface UploadConfig {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

// Default configuration
const DEFAULT_CONFIG: Required<UploadConfig> = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  allowedExtensions: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.pdf',
    '.csv',
    '.xls',
    '.xlsx',
  ],
};

// Dangerous extensions that should never be allowed
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.js',
  '.mjs',
  '.py',
  '.rb',
  '.pl',
  '.ps1',
  '.vbs',
  '.jar',
  '.dll',
  '.so',
  '.app',
];

// Magic bytes for common file types
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

/**
 * Upload Decorator
 *
 * Usage:
 * @Upload({ maxSize: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg'] })
 * @Post('upload')
 */
export function Upload(config: UploadConfig = {}) {
  return (target: object, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(UPLOAD_CONFIG_KEY, config, descriptor.value);
    return descriptor;
  };
}

/**
 * Upload Security Guard
 *
 * Features:
 * - MIME type validation (Content-Type header)
 * - Magic bytes validation (actual file content)
 * - Extension validation
 * - Size limits
 * - Dangerous file blocking
 */
@Injectable()
export class UploadGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip if not a file upload
    if (!request.headers['content-type']?.includes('multipart/form-data')) {
      return true;
    }

    // Get upload config from decorator or use defaults
    const handler = context.getHandler();
    const config: UploadConfig =
      this.reflector.get(UPLOAD_CONFIG_KEY, handler) || {};

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Check content-length
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    if (contentLength > mergedConfig.maxSize) {
      throw new PayloadTooLargeException(
        `File too large. Maximum size is ${this.formatBytes(mergedConfig.maxSize)}`,
      );
    }

    return true;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

/**
 * Validate uploaded file
 * Call this after file is received (e.g., in service)
 */
export function validateUploadedFile(
  file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  },
  config: UploadConfig = {},
): void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Check size
  if (file.size > mergedConfig.maxSize) {
    throw new BadRequestException(
      `File too large. Maximum size is ${(mergedConfig.maxSize / (1024 * 1024)).toFixed(1)} MB`,
    );
  }

  // Check extension
  const ext = path.extname(file.originalname).toLowerCase();

  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    throw new BadRequestException('File type not allowed for security reasons');
  }

  if (!mergedConfig.allowedExtensions.includes(ext)) {
    throw new BadRequestException(
      `File extension ${ext} not allowed. Allowed: ${mergedConfig.allowedExtensions.join(', ')}`,
    );
  }

  // Check MIME type
  if (!mergedConfig.allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(
      `File type ${file.mimetype} not allowed`,
    );
  }

  // Validate magic bytes (actual file content)
  const expectedMagicBytes = MAGIC_BYTES[file.mimetype];
  if (expectedMagicBytes) {
    const actualMagicBytes = Array.from(file.buffer.subarray(0, expectedMagicBytes.length));
    const matches = expectedMagicBytes.every((byte, i) => byte === actualMagicBytes[i]);

    if (!matches) {
      throw new BadRequestException(
        'File content does not match declared type',
      );
    }
  }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  const basename = path.basename(filename);

  // Remove special characters, keep alphanumeric, dash, underscore, dot
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prevent double extensions
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }

  return sanitized;
}
