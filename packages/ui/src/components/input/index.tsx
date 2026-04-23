import * as React from "react";
import { CurrencyInput } from "@workspace/ui/components/input/currency";
import { NumberInput } from "@workspace/ui/components/input/number";
import { cn } from "@workspace/ui/lib/utils";

export type InputVariant = "default" | "ghost";

function Input({
  className,
  type,
  variant,
  size,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  variant?: InputVariant;
  size?: "xs" | "sm" | "default" | "md" | "lg";
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 border border-transparent border-b-input bg-transparent px-0 py-1 text-base transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-b-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive md:text-sm dark:aria-invalid:border-b-destructive/50",
        className
      )}
      {...props}
    />
  );
}

Input.displayName = "Input";

// Compound component pattern
const InputWithCompound = Input as typeof Input & {
  Currency: typeof CurrencyInput;
  Number: typeof NumberInput;
};

InputWithCompound.Currency = CurrencyInput;
InputWithCompound.Number = NumberInput;

export { InputWithCompound as Input };
