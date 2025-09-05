import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisService } from './redis/redis.service';
import { Reflector } from '@nestjs/core';
import { Http_CacheInterceptor } from './interceptors/http-cache.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const redisService = app.get(RedisService);
  const reflector = app.get(Reflector);

  // global interceptor
  app.useGlobalInterceptors(new Http_CacheInterceptor(redisService, reflector));

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true
  }))

  // Stripe webhook raw body support
  app.use('/webhook/stripe', express.raw({ type: 'application/json' }));

  // Connect Kafka microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'nestjs-kafka-client',
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'nestjs-consumer-group-' + Math.random().toString(36).slice(2),
      },
    },
  });

  // Start Kafka consumer
  await app.startAllMicroservices()
    .then(() => logger.log('Kafka Microservice connected'))
    .catch(err => {
      logger.error('Kafka connection failed', err);
    });

  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  await app.listen(Number(process.env.PORT ?? 3000));
}

bootstrap();