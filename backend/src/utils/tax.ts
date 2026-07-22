export function extractTax(totalWithTax: number, taxRate: number): number {
  return parseFloat((totalWithTax - totalWithTax / (1 + taxRate / 100)).toFixed(2));
}

export function splitAmount(total: number, parts: number): number[] {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(parts) || parts < 1) {
    throw new Error('INVALID_SPLIT_AMOUNT');
  }
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  return Array.from(
    { length: parts },
    (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100
  );
}
