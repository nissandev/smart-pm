import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async check() {
    const mongoState = this.connection.readyState;
    if (mongoState !== 1) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        mongo: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    await this.connection.db.admin().ping();

    return {
      status: 'ok',
      mongo: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
