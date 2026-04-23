import { cn } from "@workspace/ui/lib/utils";
import React, { type FocusEventHandler, useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@workspace/ui/components/input";
import { NumericFormat } from "react-number-format";

type InputVariant = "default" | "ghost";

export interface NumberInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "size" | "placeholder" | "onChange" | "onBlur" | "onFocus" | "value" | "type" | "defaultValue"
  > {
  value?: number;
  initialValue?: number | string;
  placeholder?: number | string;
  onFocus?: FocusEventHandler<React.ElementRef<"input">>;
  onChange?: (value: number | undefined) => void;
  onBlur?: (value: number) => void;
  enabled?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  allowNegativeValue?: boolean;
  align?: "left" | "center" | "right";
  variant?: InputVariant;
  size?: "xs" | "sm" | "default" | "md" | "lg";
}

const NumberInput = React.forwardRef<React.ElementRef<"input">, NumberInputProps>(
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
      min,
      max,
      allowNegativeValue = false,
      align = "left",
      className,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState<string>("");
    const [hasFocus, setHasFocus] = useState(false);
    const inputRef = useRef<React.ElementRef<"input"> | null>(null);

    const getDisplayValue = useCallback(() => {
      const valueToUse = value ?? initialValue;
      if (valueToUse !== undefined && valueToUse !== null && !isNaN(Number(valueToUse))) {
        return String(valueToUse);
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
      (values: { value: string; floatValue?: number }) => {
        const rawValue = values.value;

        if (rawValue === "") {
          setInternalValue("");
          onChange?.(undefined);
          return;
        }

        if (allowNegativeValue && rawValue === "-") {
          setInternalValue(rawValue);
          onChange?.(undefined);
          return;
        }

        if (values.floatValue === undefined || isNaN(values.floatValue)) {
          setInternalValue("");
          onChange?.(undefined);
          return;
        }

        // Preserve in-progress text (e.g. "1.") while typing.
        setInternalValue(rawValue);
        onChange?.(values.floatValue);
      },
      [allowNegativeValue, onChange]
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
          setInternalValue("0");
          onChange?.(0);
          onBlur?.(0);
          return;
        }

        let numericValue = Number(rawValue);

        // If invalid, set to 0 on blur
        if (isNaN(numericValue)) {
          setInternalValue("0");
          onChange?.(0);
          onBlur?.(0);
          return;
        }

        // Apply min/max constraints - ensure value is within bounds
        if (min !== undefined && numericValue < min) {
          numericValue = min;
          setInternalValue(String(min));
        } else if (max !== undefined && numericValue > max) {
          numericValue = max;
          setInternalValue(String(max));
        } else {
          setInternalValue(String(numericValue));
        }

        onChange?.(numericValue);
        onBlur?.(numericValue);
      },
      [internalValue, min, max, onChange, onBlur]
    );

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
          return "text-left";
      }
    };

    const inputClassName = cn(getAlignmentClass(), className);
    const inputValue = hasFocus ? internalValue : getDisplayValue();

    return (
      <NumericFormat
        getInputRef={setMergedRef}
        customInput={Input}
        value={inputValue}
        allowNegative={allowNegativeValue}
        thousandSeparator={!hasFocus}
        valueIsNumericString
        onValueChange={handleValueChange}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        readOnly={!enabled}
        disabled={isDisabled}
        placeholder={placeholder !== undefined ? String(placeholder) : undefined}
        onFocus={enabled ? handleFocus : undefined}
        onBlur={handleBlur}
        className={inputClassName}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
