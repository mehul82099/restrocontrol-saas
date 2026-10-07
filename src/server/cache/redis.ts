import Redis from 'ioredis';

class CacheService {
  private client: Redis | null = null;
  private isConnected = false;

  constructor() {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) return;
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't hang if disconnected
        lazyConnect: true,
      });

      this.client.connect().then(() => {
        this.isConnected = true;
      }).catch(() => {
        this.isConnected = false;
      });

      this.client.on('error', () => {
        this.isConnected = false;
      });
    } catch {
      this.client = null;
      this.isConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // ignore cache failure
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // ignore
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // ignore
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.isConnected = false;
    }
  }
}

export const cache = new CacheService();
