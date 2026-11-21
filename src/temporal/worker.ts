import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { config } from '../config';

/** Retry connecting to the Temporal server until it becomes available. */
async function connectWithRetry(): Promise<NativeConnection> {
  const maxAttempts = 60;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await NativeConnection.connect({ address: config.temporalAddress });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(
        `[worker] Temporal not ready (attempt ${attempt}/${maxAttempts}): ${String(err)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`Could not connect to Temporal at ${config.temporalAddress}`);
}

async function run(): Promise<void> {
  const connection = await connectWithRetry();

  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.temporalTaskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  // eslint-disable-next-line no-console
  console.log(`[worker] polling task queue "${config.temporalTaskQueue}"`);
  await worker.run();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
