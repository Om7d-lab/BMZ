import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness: the process is up' })
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness: the process can serve traffic',
    description: 'Checks the database. A load balancer should route on this, not on /live.',
  })
  async ready(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }

    return { status: 'ok', database: 'up' };
  }
}
