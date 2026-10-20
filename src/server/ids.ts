const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value from a URL could be one of our ids. Anything else simply isn't found. */
export function isId(value: string): boolean {
  return uuidPattern.test(value);
}
