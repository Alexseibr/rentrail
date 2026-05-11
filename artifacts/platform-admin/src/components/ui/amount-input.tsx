import * as React from "react";
import { cn } from "@/lib/utils";

function formatAmount(raw: string): string {
  const clean = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = clean.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  if (parts.length > 1) {
    return intPart + "," + parts[1].slice(0, 2);
  }
  return intPart;
}

function parseAmount(formatted: string): string {
  return formatted.replace(/[\u00a0\s]/g, "").replace(",", ".");
}

interface AmountInputProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "value"
> {
  value?: string;
  onChange?: (raw: string) => void;
  currency?: string;
  showCurrency?: boolean;
}

const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      className,
      value = "",
      onChange,
      currency = "₽",
      showCurrency = true,
      ...props
    },
    ref,
  ) => {
    const [display, setDisplay] = React.useState(
      value ? formatAmount(value) : "",
    );

    React.useEffect(() => {
      setDisplay(value ? formatAmount(value) : "");
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      const formatted = formatAmount(raw);
      setDisplay(formatted);
      onChange?.(parseAmount(formatted));
    }

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      e.target.select();
    }

    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-card py-2 text-base shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm tabular-nums",
            showCurrency ? "pl-4 pr-8" : "px-4",
            className,
          )}
        />
        {showCurrency && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
            {currency}
          </span>
        )}
      </div>
    );
  },
);
AmountInput.displayName = "AmountInput";

export { AmountInput };
