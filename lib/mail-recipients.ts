/** Bare addresses, separated by commas, semicolons or line breaks. Never drop a typo silently. */
export function inspectMailRecipients(value: string) {
  const items = value.split(/[;,\r\n]+/).map(item => item.trim()).filter(Boolean);
  const valid: string[] = [], invalid: string[] = [];
  for (const item of items) {
    if (/^[^\s<>:@\x00-\x1f]+@[^\s<>:@\x00-\x1f]+\.[^\s<>:@\x00-\x1f]+$/.test(item)) {
      if (!valid.some(address => address.toLowerCase() === item.toLowerCase())) valid.push(item);
    } else invalid.push(item);
  }
  return { valid, invalid };
}
