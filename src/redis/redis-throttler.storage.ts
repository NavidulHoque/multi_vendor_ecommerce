import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    // ttl is in ms
    const created = await this.redis.setNxPx(key, '1', ttl);
    if (created) {
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const totalHits = Number(await this.redis.incr(key));
    let pttl = Number(await this.redis.pttl(key));

    if (pttl < 0) {
      await this.redis.pexpire(key, ttl);
      pttl = Number(await this.redis.pttl(key));
    }

    const isBlocked = totalHits > limit;
    const timeToBlockExpire = isBlocked ? blockDuration : 0;

    return {
      totalHits,
      timeToExpire: Math.max(pttl, 0),
      isBlocked,
      timeToBlockExpire,
    };
  }
}