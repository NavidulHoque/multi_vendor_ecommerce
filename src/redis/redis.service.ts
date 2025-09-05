import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client: RedisClient;
  private readonly redis_host: string;
  private readonly redis_port: number;
  private readonly redis_db: number;

  constructor(private readonly config: ConfigService) {
    this.redis_host = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redis_port = this.config.get<number>('REDIS_PORT', 6385);
    this.redis_db = this.config.get<number>('REDIS_DB', 0);
  }

  async onModuleInit() {
    this.client = new Redis({
      host: this.redis_host,
      port: this.redis_port,
      db: this.redis_db,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log(`Redis Connected to ${this.redis_host}:${this.redis_port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error:', err.message);
    });

    await this.client.connect()
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('[Redis] Connection closed gracefully');
      } catch {
        this.client.disconnect();
      }
    }
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  getClient(): RedisClient {
    return this.client;
  }

  async incr(key: string) {
    return this.client.incr(key);
  }

  async pttl(key: string) {
    return this.client.pttl(key); 
  }

  async setNxPx(key: string, value: string, ttlMs: number) {
    const res = await this.client.set(key, value, 'PX', ttlMs, 'NX');
    return res === 'OK';
  }

  async pexpire(key: string, ttlMs: number) {
    return this.client.pexpire(key, ttlMs);
  }
}