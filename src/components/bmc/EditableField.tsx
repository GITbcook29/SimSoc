"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

type SaveAction = (value: string) => Promise<void>;

function useDebouncedSave(action: SaveAction, delayMs: number) {
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function schedule(value: string) {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDirty(false);
      startTransition(() => action(value));
    }, delayMs);
  }

  function flush(value: string) {
    if (timer.current) clearTimeout(timer.current);
    if (!dirty) return;
    setDirty(false);
    startTransition(() => action(value));
  }

  return { schedule, flush, busy: pending || dirty };
}

/**
 * Dashed-border text input that saves on a debounce and on blur. The `action`
 * is a bound server action, so each call site decides exactly which row and
 * column it may write.
 */
export function EditableText({
  action,
  defaultValue,
  placeholder,
  type = "text",
  className = "",
  ariaLabel,
}: {
  action: SaveAction;
  defaultValue: string | null | undefined;
  placeholder?: string;
  type?: "text" | "date" | "number" | "url" | "email";
  className?: string;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const { schedule, flush, busy } = useDebouncedSave(action, 700);

  return (
    <input
      type={type}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => {
        setValue(e.target.value);
        schedule(e.target.value);
      }}
      onBlur={() => flush(value)}
      className={`field ${busy ? "field-saving" : ""} ${className}`}
    />
  );
}

export function EditableTextarea({
  action,
  defaultValue,
  placeholder,
  rows = 3,
  className = "",
  ariaLabel,
}: {
  action: SaveAction;
  defaultValue: string | null | undefined;
  placeholder?: string;
  rows?: number;
  className?: string;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const { schedule, flush, busy } = useDebouncedSave(action, 900);

  return (
    <textarea
      rows={rows}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => {
        setValue(e.target.value);
        schedule(e.target.value);
      }}
      onBlur={() => flush(value)}
      className={`field resize-y ${busy ? "field-saving" : ""} ${className}`}
    />
  );
}

/** Select that saves immediately on change. */
export function EditableSelect({
  action,
  defaultValue,
  options,
  className = "",
  ariaLabel,
}: {
  action: SaveAction;
  defaultValue: string | null | undefined;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => {
        setValue(e.target.value);
        startTransition(() => action(e.target.value));
      }}
      className={`field ${pending ? "field-saving" : ""} ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Checkbox that saves immediately. Value written is "true" / "false". */
export function EditableCheckbox({
  action,
  defaultChecked,
  label,
}: {
  action: SaveAction;
  defaultChecked: boolean;
  label: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const [pending, startTransition] = useTransition();
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2 text-[13px] cursor-pointer ${
        pending ? "opacity-60" : ""
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          startTransition(() => action(String(e.target.checked)));
        }}
        className="h-3.5 w-3.5"
      />
      <span className={checked ? "line-through text-[var(--muted)]" : ""}>{label}</span>
    </label>
  );
}
