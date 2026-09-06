/** Total quantity across order or cart lines. */
export function countItems(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** "1 item", "3 items". */
export function pluralItems(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
