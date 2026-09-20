import { applyDecorators, type Type } from '@nestjs/common';
import { ApiBody, ApiResponse, type ApiResponseOptions } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

/**
 * Publishes the contracts package's Zod schemas as OpenAPI.
 *
 * Nest's decorators normally document a class-based DTO, which would mean
 * maintaining the same shape twice — once for validation, once for the docs —
 * and the two would drift. Zod 4 emits JSON Schema directly, so the schema
 * that validates the request is also the schema in the published document.
 */
function toOpenApiSchema(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, {
    target: 'draft-7',
    // OpenAPI 3.0 has no $ref target for reused definitions here, so shared
    // sub-schemas are inlined rather than hoisted.
    io: 'input',
    reused: 'inline',
    unrepresentable: 'any',
  }) as Record<string, unknown>;
}

export function ApiZodBody(schema: ZodType, description?: string) {
  return ApiBody({
    schema: toOpenApiSchema(schema) as never,
    ...(description ? { description } : {}),
  });
}

export function ApiZodResponse(
  status: number,
  schema: ZodType,
  options: Omit<ApiResponseOptions, 'status' | 'schema'> = {},
) {
  return ApiResponse({ status, schema: toOpenApiSchema(schema) as never, ...options });
}

/** The error responses every authenticated endpoint can return. */
export function ApiStandardErrors(...extra: Array<{ status: number; description: string }>) {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'The request failed validation' }),
    ApiResponse({ status: 401, description: 'Not signed in, or the session expired' }),
    ApiResponse({ status: 403, description: 'No access to this workspace' }),
    ...extra.map((error) => ApiResponse(error)),
  );
}

export type { Type };
