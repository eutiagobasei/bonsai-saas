import * as net from 'net';
import { Logger } from '@nestjs/common';

const logger = new Logger('PortUtil');

/**
 * Check if a port is available
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '0.0.0.0');
  });
}

/**
 * Find an available port starting from the given port
 * @param startPort - Port to start searching from
 * @param maxAttempts - Maximum number of ports to try (default: 10)
 * @returns Available port number
 */
export async function findAvailablePort(
  startPort: number,
  maxAttempts = 10,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);

    if (available) {
      if (port !== startPort) {
        logger.warn(
          `Port ${startPort} is in use, using port ${port} instead`,
        );
      }
      return port;
    }
  }

  throw new Error(
    `No available port found between ${startPort} and ${startPort + maxAttempts - 1}`,
  );
}
