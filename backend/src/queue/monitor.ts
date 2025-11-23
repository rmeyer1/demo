import { Queue, QueueEvents } from "bullmq";
import { logger } from "../config/logger";

export interface QueueMonitorOptions {
  intervalMs?: number;
}

export function startQueueMonitoring(queues: Queue[], options: QueueMonitorOptions = {}) {
  const intervalMs = options.intervalMs ?? 30000;

  for (const q of queues) {
    const events = new QueueEvents(q.name, { connection: q.opts.connection });

    events.on("stalled", ({ jobId }) => {
      logger.warn(`Queue ${q.name} stalled job ${jobId}`);
    });

    events.on("failed", ({ jobId, failedReason }) => {
      logger.error(`Queue ${q.name} job ${jobId} failed: ${failedReason}`);
    });

    events.on("waiting", ({ jobId }) => {
      logger.debug(`Queue ${q.name} waiting job ${jobId}`);
    });
  }

  const timer = setInterval(async () => {
    for (const q of queues) {
      try {
        const counts = await q.getJobCounts("waiting", "active", "delayed", "failed");
        logger.info(
          `Queue ${q.name} counts waiting=${counts.waiting} active=${counts.active} delayed=${counts.delayed} failed=${counts.failed}`
        );
      } catch (err) {
        logger.error(`Failed to collect metrics for ${q.name}`, err);
      }
    }
  }, intervalMs);

  timer.unref();
}
