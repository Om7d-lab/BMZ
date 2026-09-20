import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Turns every failure into the one error shape the contracts package
 * describes, and keeps internal detail out of the response body.
 *
 * Prisma errors are translated here rather than in each service: a unique
 * constraint is a 409 wherever it happens, and letting the driver's message
 * reach the client would leak column and table names.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const { status, body } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private describe(exception: unknown): { status: number; body: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'object' && payload !== null) {
        return {
          status,
          body: { statusCode: status, error: exception.name, ...payload },
        };
      }

      return {
        status,
        body: { statusCode: status, error: exception.name, message: String(payload) },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            body: {
              statusCode: HttpStatus.CONFLICT,
              error: 'Conflict',
              message: 'That already exists',
            },
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            body: {
              statusCode: HttpStatus.NOT_FOUND,
              error: 'Not Found',
              message: 'Not found',
            },
          };
        case 'P2003':
          return {
            status: HttpStatus.BAD_REQUEST,
            body: {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'Bad Request',
              message: 'That references something which does not exist',
            },
          };
        default:
          break;
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Something went wrong',
      },
    };
  }
}
