import * as React from "react";
import { cn } from "@/lib/utils";

function normalizeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") return "7" + digits.slice(1);
  if (digits[0] === "9" && digits.length <= 10) return "7" + digits;
  return digits;
}

function formatRussian(local10: string): string {
  let result = "+7";
  if (!local10) return result;
  result += " (" + local10.slice(0, 3);
  if (local10.length < 3) return result;
  result += ") " + local10.slice(3, 6);
  if (local10.length < 6) return result;
  result += "-" + local10.slice(6, 8);
  if (local10.length < 8) return result;
  result += "-" + local10.slice(8, 10);
  return result;
}

function formatPhone(raw: string): string {
  const norm = normalizeDigits(raw);
  if (!norm) return "";

  if (norm[0] === "7") {
    return formatRussian(norm.slice(1, 11));
  }

  const d = norm.slice(0, 15);
  if (d.length <= 3) return "+" + d;
  if (d.length <= 6) return "+" + d.slice(0, 3) + " " + d.slice(3);
  if (d.length <= 9)
    return "+" + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6);
  return (
    "+" +
    d.slice(0, 3) +
    " " +
    d.slice(3, 6) +
    " " +
    d.slice(6, 9) +
    " " +
    d.slice(9)
  );
}

function toE164(raw: string): string {
  const norm = normalizeDigits(raw);
  if (!norm) return "";
  return "+" + norm;
}

interface PhoneInputProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "value"
> {
  value?: string;
  onChange?: (e164: string) => void;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = "", onChange, ...props }, ref) => {
    const [display, setDisplay] = React.useState(
      value ? formatPhone(value) : "",
    );

    React.useEffect(() => {
      setDisplay(value ? formatPhone(value) : "");
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      const formatted = formatPhone(raw);
      setDisplay(formatted);
      onChange?.(raw.replace(/\D/g, "") ? toE164(raw) : "");
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Backspace" && display) {
        e.preventDefault();
        const stripped = display.replace(/[\s\-()+]+$/, "").slice(0, -1);
        const formatted = formatPhone(stripped);
        setDisplay(formatted);
        onChange?.(stripped.replace(/\D/g, "") ? toE164(stripped) : "");
      }
    }

    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type="tel"
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="+7 (999) 999-99-99"
          className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-base shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm tracking-wide",
            className,
          )}
        />
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
