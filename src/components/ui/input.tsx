import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, inputMode, enterKeyHint, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      enterKeyHint={enterKeyHint ?? (type === "search" ? "search" : undefined)}
      inputMode={inputMode ?? (type === "number" ? "numeric" : undefined)}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md glass-control border px-3 py-1 text-base shadow-xs transition-none outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
