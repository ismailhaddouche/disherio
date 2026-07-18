export function parseDurationToMs(duration: string, defaultMs: number = 15 * 60 * 1000): number {
  const match = duration.match(/^(\d+)([hHdDmMsS])?$/);
  if (!match) return defaultMs;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] ?? multipliers.m);
}

export function parseDurationSeconds(duration: string, defaultSeconds: number = 15 * 60): number {
  const match = duration.match(/^(\d+)([hHdDmMsS])?$/);
  if (!match) return defaultSeconds;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return value * (multipliers[unit] ?? multipliers.m);
}
