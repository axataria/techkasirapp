import { TrendUpIcon, TrendDownIcon, MinusIcon } from "@phosphor-icons/react";
import { money } from "@/lib/api";
import { metricChange } from "@/lib/metric-trend";

export function MetricChange({ current, previous }: { current: string | number; previous: string | number }) {
  const { direction, amount } = metricChange(current, previous);
  const Icon = direction === "up" ? TrendUpIcon : direction === "down" ? TrendDownIcon : MinusIcon;
  const label = direction === "up" ? "Naik" : direction === "down" ? "Turun" : "Tetap";
  const color = direction === "up" ? "text-emerald-700 dark:text-emerald-300" : direction === "down" ? "text-destructive" : "text-muted-foreground";
  return <span className={`title-4 money inline-flex min-w-0 items-center gap-1 ${color}`} aria-label={`${label} ${money(amount)}, bulan ini dibanding periode yang sama bulan lalu`}>
    <Icon className="size-4 shrink-0" aria-hidden="true" />
    <span className="wrap-anywhere">{direction === "up" ? "+" : direction === "down" ? "−" : ""}{money(amount)}</span>
  </span>;
}
