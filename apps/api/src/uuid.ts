const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared because the SSE route interpolates the id into a Valkey channel name.
 * An unvalidated id there would let a caller subscribe to whatever channel they
 * like, so both routes must apply the same check.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
