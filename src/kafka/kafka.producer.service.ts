import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

//kafka producer
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);

  private readonly kafka = new Kafka({
    clientId: 'nestjs-app',
    brokers: ['localhost:9092'],
    retry: {
      retries: 5
    }
  });

  private producer: Producer = this.kafka.producer();

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log('Kafka Producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async triggerEvent(topic: string, data: any) {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(data) }],
    });
  }
}