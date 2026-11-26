import { cacheService } from '../../services/CacheService';
import { queueService } from '../../services/QueueService';

describe('Phase 20: Performance, Caching & Asynchronous Queue', () => {
  describe('CacheService (High-Speed In-Memory & Redis Fallback)', () => {
    beforeEach(async () => {
      await cacheService.delPattern('test:*');
    });

    it('stores and retrieves cached data with exact serialization', async () => {
      const payload = { branchId: 'b-101', name: 'Computer Science', active: true };
      await cacheService.set('test:branch:101', payload, 60);

      const cached = await cacheService.get<typeof payload>('test:branch:101');
      expect(cached).toEqual(payload);
    });

    it('returns null for non-existent or deleted keys', async () => {
      await cacheService.set('test:temp', 'val', 60);
      await cacheService.del('test:temp');

      const result = await cacheService.get('test:temp');
      expect(result).toBeNull();
    });

    it('invalidates multiple keys matching a pattern wildcard', async () => {
      await cacheService.set('test:academic:branches', ['CS', 'IT'], 60);
      await cacheService.set('test:academic:subjects', ['OS', 'DBMS'], 60);
      await cacheService.set('test:user:profile', { id: 'u-1' }, 60);

      await cacheService.delPattern('test:academic:*');

      expect(await cacheService.get('test:academic:branches')).toBeNull();
      expect(await cacheService.get('test:academic:subjects')).toBeNull();
      expect(await cacheService.get('test:user:profile')).not.toBeNull();
    });

    it('maintains live sorted set rankings for quiz leaderboards', async () => {
      const setKey = 'test:quiz:leaderboard:q1';
      await cacheService.zadd(setKey, 40, 'student-bob');
      await cacheService.zadd(setKey, 95, 'student-alice');
      await cacheService.zadd(setKey, 75, 'student-charlie');

      const top2 = await cacheService.zrevrangeWithScores(setKey, 0, 1);
      expect(top2).toHaveLength(2);
      expect(top2[0]).toEqual({ member: 'student-alice', score: 95 });
      expect(top2[1]).toEqual({ member: 'student-charlie', score: 75 });
    });
  });

  describe('QueueService (Asynchronous Task Workers)', () => {
    it('executes background task with progress tracking and completes successfully', async () => {
      const taskType = 'BULK_IMPORT_SIMULATION';

      queueService.registerWorker(taskType, async (job, updateProgress) => {
        updateProgress(50);
        return { importedCount: job.payload.items.length, status: 'DONE' };
      });

      const job = await queueService.enqueue(taskType, {
        items: ['Student 1', 'Student 2', 'Student 3'],
      });

      expect(['PENDING', 'PROCESSING', 'COMPLETED']).toContain(job.status);

      // Wait a moment for background worker execution
      await new Promise((resolve) => setTimeout(resolve, 80));

      const updated = queueService.getJob(job.id);
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('COMPLETED');
      expect(updated!.progress).toBe(100);
      expect(updated!.result).toEqual({ importedCount: 3, status: 'DONE' });
      expect(updated!.completedAt).toBeDefined();
    });

    it('marks job as FAILED when worker throws error', async () => {
      const taskType = 'FAILING_TASK';

      queueService.registerWorker(taskType, async () => {
        throw new Error('Simulated external service timeout');
      });

      const job = await queueService.enqueue(taskType, {});

      await new Promise((resolve) => setTimeout(resolve, 50));

      const updated = queueService.getJob(job.id);
      expect(updated!.status).toBe('FAILED');
      expect(updated!.error).toContain('Simulated external service timeout');
    });
  });
});
