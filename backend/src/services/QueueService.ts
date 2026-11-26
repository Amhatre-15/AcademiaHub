import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BackgroundJob<T = any, R = any> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  progress: number;
  result?: R;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

type JobHandler<T = any, R = any> = (
  job: BackgroundJob<T, R>,
  updateProgress: (progress: number) => void
) => Promise<R>;

class QueueService {
  private jobs = new Map<string, BackgroundJob>();
  private handlers = new Map<string, JobHandler>();
  private queue: string[] = [];
  private isProcessing = false;
  private maxConcurrency = 3;
  private activeWorkers = 0;

  /**
   * Register a worker processor function for a specific task type.
   */
  public registerWorker<T = any, R = any>(type: string, handler: JobHandler<T, R>) {
    this.handlers.set(type, handler);
  }

  /**
   * Enqueue a new background task.
   */
  public async enqueue<T = any, R = any>(
    type: string,
    payload: T
  ): Promise<BackgroundJob<T, R>> {
    const job: BackgroundJob<T, R> = {
      id: uuidv4(),
      type,
      payload,
      status: 'PENDING',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);

    // Trigger queue processor tick
    void this.processNext();

    return job;
  }

  /**
   * Get the current status and output of a background job.
   */
  public getJob<T = any, R = any>(id: string): BackgroundJob<T, R> | null {
    return (this.jobs.get(id) as BackgroundJob<T, R>) || null;
  }

  /**
   * Process items in the queue up to maximum concurrency.
   */
  private async processNext() {
    if (this.activeWorkers >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const jobId = this.queue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'FAILED';
      job.error = `No registered worker handler for task type: ${job.type}`;
      job.completedAt = new Date();
      return;
    }

    this.activeWorkers++;
    job.status = 'PROCESSING';
    job.startedAt = new Date();

    const updateProgress = (pct: number) => {
      job.progress = Math.min(100, Math.max(0, Math.round(pct)));
    };

    try {
      const result = await handler(job, updateProgress);
      job.status = 'COMPLETED';
      job.progress = 100;
      job.result = result;
      job.completedAt = new Date();
    } catch (err: any) {
      job.status = 'FAILED';
      job.error = err.message || 'Background execution failed';
      job.completedAt = new Date();
    } finally {
      this.activeWorkers--;
      // Process remaining items in queue
      void this.processNext();
    }
  }

  /**
   * Clear historical completed/failed jobs older than specified maxAgeMs.
   */
  public pruneOldJobs(maxAgeMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of this.jobs.entries()) {
      if ((job.status === 'COMPLETED' || job.status === 'FAILED') && job.createdAt.getTime() < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}

export const queueService = new QueueService();
