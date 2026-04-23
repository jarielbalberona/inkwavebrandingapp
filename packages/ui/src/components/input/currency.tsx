import { cn } from "@workspace/ui/lib/utils";
import { displayAmount, type Currency } from "@workspace/ui/lib/number";
import React, { type FocusEventHandler, useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@workspace/ui/components/input";
import { CurrencyInput as CurrencyField } from "react-currency-input-field";

type InputVariant = "default" | "ghost";

export interface CurrencyInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "size" | "placeholder" | "onChange" | "onBlur" | "onFocus" | "value" | "defaultValue" | "step"
  > {
  value?: number;
  initialValue?: number | string;
  placeholder?: number | string;
  onFocus?: FocusEventHandler<React.ElementRef<"input">>;
  onChange?: (value: number | undefined) => void;
  onBlur?: (value: number) => void;
  enabled?: boolean;
  disabled?: boolean;
  maxValue?: number;
  allowNegativeValue?: boolean;
  align?: "left" | "center" | "right";
  variant?: InputVariant;
  size?: "xs" | "sm" | "default" | "md" | "lg";
  currency?: Currency; // Optional currency prop (defaults to PHP for backward compatibility)
}

const CurrencyInput = React.forwardRef<React.ElementRef<"input">, CurrencyInputProps>(
  (
    {
      value,
      initialValue,
      placeholder,
      onFocus,
      onChange,
      onBlur,
      enabled = true,
      disabled = false,
      maxValue,
      allowNegativeValue = false,
      align = "left",
      variant: _variant,
      size: _size,
      className,
      currency = "PHP", // Default to PHP for backward compatibility
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState<string>("");
    const [hasFocus, setHasFocus] = useState(false);
    const inputRef = useRef<React.ElementRef<"input"> | null>(null);

    const getDisplayValue = useCallback(() => {
      const valueToUse = value ?? initialValue;
      if (valueToUse !== undefined && !isNaN(Number(valueToUse))) {
        const numericValue = Math.round(Number(valueToUse) * 100) / 100;
        return numericValue.toFixed(2);
      }
      return "";
    }, [value, initialValue]);

    const setMergedRef = useCallback(
      (node: React.ElementRef<"input"> | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<React.ElementRef<"input"> | null>).current = node;
        }
      },
      [ref]
    );

    const handleValueChange = useCallback(
      (rawValue?: string) => {
        if (rawValue === undefined || rawValue === "") {
          setInternalValue("");
          onChange?.(undefined);
          return;
        }

        const parsedValue = Number(rawValue);
        // Preserve in-progress text (e.g. "1.") while typing.
        setInternalValue(rawValue);
        if (isNaN(parsedValue)) {
          onChange?.(undefined);
          return;
        }

        const normalizedValue = Math.round(parsedValue * 100) / 100;
        onChange?.(normalizedValue);
      },
      [onChange]
    );

    const handleFocus = useCallback(
      (e: React.FocusEvent<React.ElementRef<"input">>) => {
        setHasFocus(true);
        setInternalValue(getDisplayValue());
        e.target.select();
        onFocus?.(e);
      },
      [getDisplayValue, onFocus]
    );

    const handleBlur = useCallback(
      (_e: React.FocusEvent<React.ElementRef<"input">>) => {
        setHasFocus(false);

        const rawValue = internalValue;

        // If empty, return 0 on blur
        if (rawValue === "" || rawValue === undefined) {
          setInternalValue("0.00");
          onChange?.(0);
          onBlur?.(0);
          return;
        }

        let result = Math.round(Number(rawValue) * 100) / 100;

        if (isNaN(result)) {
          // Invalid input, set to 0
          setInternalValue("0.00");
          result = 0;
        } else {
          if (maxValue !== undefined && result > maxValue) {
            result = maxValue;
          }

          // Set the internal value to the formatted value for display
          setInternalValue(result.toFixed(2));
        }

        onChange?.(result);
        onBlur?.(result);
      },
      [internalValue, maxValue, onChange, onBlur]
    );

    const formatPlaceholder = useCallback((): string | undefined => {
      if (hasFocus || !placeholder) {
        return placeholder as string | undefined;
      }

      // If placeholder contains digits, format it as currency
      if (/\d/.test(String(placeholder))) {
        return displayAmount(placeholder, false, currency);
      }

      return placeholder as string | undefined;
    }, [hasFocus, placeholder, currency]);

    useEffect(() => {
      if (hasFocus) {
        inputRef.current?.select();
      }
    }, [hasFocus]);

    const isDisabled = disabled || !enabled;

    const getAlignmentClass = () => {
      switch (align) {
        case "left":
          return "text-left";
        case "center":
          return "text-center";
        case "right":
          return "text-right";
        default:
          return "text-right";
      }
    };

    const inputClassName = cn(getAlignmentClass(), className);
    const inputValue = hasFocus ? internalValue : getDisplayValue();

    const locale = currency === "PHP" ? "en-PH" : "en-US";
    const intlConfig = { locale, currency };

    return (
      <CurrencyField
        ref={setMergedRef}
        customInput={Input}
        intlConfig={intlConfig}
        decimalsLimit={2}
        decimalScale={hasFocus ? undefined : 2}
        fixedDecimalLength={hasFocus ? undefined : 2}
        disableAbbreviations
        allowNegativeValue={allowNegativeValue}
        value={inputValue}
        onValueChange={handleValueChange}
        onFocus={enabled ? handleFocus : undefined}
        onBlur={handleBlur}
        inputMode="decimal"
        autoComplete="off"
        readOnly={!enabled}
        disabled={isDisabled}
        placeholder={formatPlaceholder()}
        className={inputClassName}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
