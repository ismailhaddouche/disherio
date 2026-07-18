export function applyTax(amount: number, taxRate: number): number {
  return parseFloat((amount * (1 + taxRate / 100)).toFixed(2));
}

export function extractTax(totalWithTax: number, taxRate: number): number {
  return parseFloat((totalWithTax - totalWithTax / (1 + taxRate / 100)).toFixed(2));
}

export function splitAmount(total: number, parts: number): number[] {
  const base = parseFloat((total / parts).toFixed(2));
  const result = Array(parts).fill(base);
  const diff = parseFloat((total - base * parts).toFixed(2));
  if (diff !== 0) result[0] = parseFloat((result[0] + diff).toFixed(2));
  return result;
}
