import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps {
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  onEnter?: (value: string) => void;
  defaultValue?: string | null;
  onFocus?: () => void;
  id?: string;
  className?: string;
  decimal?: boolean;
  maxDecimalPlaces?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      onChange,
      onBlur,
      onEnter,
      id,
      defaultValue = "",
      onFocus: externalOnFocus,
      className = "",
      decimal = false,
      maxDecimalPlaces = 2,
      placeholder = "0",
      min,
      max,
      disabled = false,
      onKeyDown,
      autoFocus = false,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const isTypingRef = useRef(false);

    useImperativeHandle(ref, () => inputRef.current!);

    const getRegexPattern = () => {
      if (!decimal) {
        return /^\d*$/;
      } else {
        return new RegExp(`^\\d*\\.?\\d{0,${maxDecimalPlaces}}$`);
      }
    };

    const formatNumber = (val: string | null) => {
      if (!val) return "";
      const num = parseFloat(val);
      if (isNaN(num)) return "";

      let constrainedValue = num;
      if (min !== undefined && num < min) constrainedValue = min;
      if (max !== undefined && num > max) constrainedValue = max;

      if (decimal) {
        return constrainedValue.toFixed(maxDecimalPlaces);
      } else {
        return Math.round(constrainedValue).toString();
      }
    };

    const [value, setValue] = useState(defaultValue || "");
    const [previousValue, setPreviousValue] = useState(defaultValue || "");

    useEffect(() => {
      const input = inputRef.current;
      if (!input || disabled) return;

      const handleNativeFocus = () => {
        input.select();
        isTypingRef.current = true;
        externalOnFocus?.();
      };

      input.addEventListener("focus", handleNativeFocus);

      return () => {
        input.removeEventListener("focus", handleNativeFocus);
      };
    }, [externalOnFocus, disabled]);

    useEffect(() => {
      if (!isTypingRef.current && defaultValue === null) {
        setValue("");
        setPreviousValue("");
      } else if (!isTypingRef.current && defaultValue !== undefined) {
        setValue(defaultValue);
        setPreviousValue(defaultValue);
      }
    }, [defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      isTypingRef.current = true;
      const newValue = e.target.value;

      if (decimal && (newValue === "." || newValue === "0.")) {
        setValue(newValue);
        onChange?.(newValue);
        return;
      }

      if (newValue === "") {
        setValue("");
        onChange?.("");
        return;
      }

      if (getRegexPattern().test(newValue)) {
        if (
          max !== undefined &&
          !isNaN(parseFloat(newValue)) &&
          parseFloat(newValue) > max
        ) {
          const maxValue = decimal
            ? max.toFixed(maxDecimalPlaces)
            : Math.floor(max).toString();
          setValue(maxValue);
          onChange?.(maxValue);
        } else {
          setValue(newValue);
          onChange?.(newValue);
        }
      }
    };

    const handleBlur = () => {
      isTypingRef.current = false;

      if (value) {
        const formattedValue = formatNumber(value);
        setValue(formattedValue);
        setPreviousValue(formattedValue);
        onBlur?.(formattedValue);
      } else {
        if (min !== undefined) {
          const minValue = decimal
            ? min.toFixed(maxDecimalPlaces)
            : min.toString();
          setValue(minValue);
          setPreviousValue(minValue);
          onBlur?.(minValue);
        } else {
          onBlur?.("");
        }
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isTypingRef.current = true;
      setPreviousValue(value);
      externalOnFocus?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (["e", "E", "+", "-"].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "Enter") {
        // NEW: Call onEnter with current value before blurring
        if (onEnter) {
          if (value) {
            const numericValue = parseFloat(value);
            if (!isNaN(numericValue)) {
              let constrainedValue = numericValue;
              if (min !== undefined && numericValue < min)
                constrainedValue = min;
              if (max !== undefined && numericValue > max)
                constrainedValue = max;

              const finalValue = decimal
                ? constrainedValue.toFixed(maxDecimalPlaces)
                : Math.round(constrainedValue).toString();

              onEnter(finalValue);
            } else {
              onEnter(value);
            }
          } else {
            onEnter("");
          }
        }

        inputRef.current?.blur();
      }

      onKeyDown?.(e);
    };

    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={className}
        autoComplete="off"
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        id={id}
      />
    );
  },
);

NumberInput.displayName = "NumberInput";

export default NumberInput;
