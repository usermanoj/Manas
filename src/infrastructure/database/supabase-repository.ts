/**
 * Case conversion utilities for mapping between:
 *   - camelCase (TypeScript domain entities)
 *   - snake_case (PostgreSQL columns)
 */

/**
 * Convert a single camelCase key to snake_case.
 */
function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Convert a single snake_case key to camelCase.
 */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Convert an object's keys from camelCase to snake_case.
 * Handles arrays of objects recursively.
 */
export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown>;
export function toSnakeCase(obj: Record<string, unknown>[]): Record<string, unknown>[];
export function toSnakeCase(
  obj: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown> | Record<string, unknown>[] {
  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item) as Record<string, unknown>);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Convert an object's keys from snake_case to camelCase.
 * Handles arrays of objects recursively.
 */
export function toCamelCase(obj: Record<string, unknown>): Record<string, unknown>;
export function toCamelCase(obj: Record<string, unknown>[]): Record<string, unknown>[];
export function toCamelCase(
  obj: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown> | Record<string, unknown>[] {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item) as Record<string, unknown>);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    result[camelKey] = value;
  }
  return result;
}
