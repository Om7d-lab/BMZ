import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request payload against a schema from @bmz/contracts.
 *
 * The same schema is the web app's client-side validator and the source of the
 * OpenAPI document, so the API cannot accept a shape the UI does not know how
 * to send, and neither can drift from the published contract.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (result.success) return result.data;

    // Group failures by field so a form can render each message beside its input.
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '_';
      (details[path] ??= []).push(issue.message);
    }

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details,
    });
  }
}

/** Shorthand so controllers read `@Body(zodBody(createTradeRequest))`. */
export function zodBody<T>(schema: ZodType<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}
