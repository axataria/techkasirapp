export function comparisonPeriods(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const previousEnd = new Date(Date.UTC(year, month - 1, 0));
  const previousMonth = previousEnd.toISOString().slice(0, 7);
  return {
    current: { from: `${date.slice(0, 7)}-01`, to: date },
    previous: { from: `${previousMonth}-01`, to: `${previousMonth}-${String(Math.min(day, previousEnd.getUTCDate())).padStart(2, "0")}` },
  };
}

export function metricChange(current: string | number | bigint, previous: string | number | bigint) {
  const delta = BigInt(current) - BigInt(previous);
  return { direction: delta > 0n ? "up" : delta < 0n ? "down" : "flat", amount: delta < 0n ? -delta : delta } as const;
}
