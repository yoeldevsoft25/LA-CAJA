export type NoopQueue = {
  name: string;
  add: (..._args: unknown[]) => Promise<null>;
  addBulk: (..._args: unknown[]) => Promise<unknown[]>;
  getWaitingCount: () => Promise<number>;
  getActiveCount: () => Promise<number>;
  getCompletedCount: () => Promise<number>;
  getFailedCount: () => Promise<number>;
  getDelayedCount: () => Promise<number>;
  getFailed: (..._args: unknown[]) => Promise<unknown[]>;
};

export const createNoopQueue = (name: string): NoopQueue => ({
  name,
  add: async () => null,
  addBulk: async () => [],
  getWaitingCount: async () => 0,
  getActiveCount: async () => 0,
  getCompletedCount: async () => 0,
  getFailedCount: async () => 0,
  getDelayedCount: async () => 0,
  getFailed: async () => [],
});
