import { Connection, Client } from '@temporalio/client';
import { config } from '../config';

/**
 * Lazily-created, shared Temporal client. If the first connection attempt
 * fails (e.g. the Temporal server is still starting), the cached promise is
 * cleared so the next caller can retry.
 */
let clientPromise: Promise<Client> | null = null;

async function createClient(): Promise<Client> {
  const connection = await Connection.connect({
    address: config.temporalAddress,
    connectTimeout: '5s',
  });
  return new Client({ connection, namespace: config.temporalNamespace });
}

export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
