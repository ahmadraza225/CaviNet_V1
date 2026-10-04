import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type Tone = "error" | "success" | "info" | "warning";

const toneClasses: Record<Tone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-brand-100 bg-brand-50 text-brand-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-sm ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}

/** A loading message, announced to screen readers, with a small spinner. */
export function Loading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p role="status" className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
      />
      {children}
    </p>
  );
}

const fieldClasses =
  "mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

interface FieldProps {
  label: string;
  id: string;
  hint?: string;
  /** Validation message shown under the field; marks the field invalid. */
  error?: string;
}

/** aria attributes linking a field to its hint and error message. */
function describe(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean);
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": ids.length ? ids.join(" ") : undefined,
  };
}

function borderFor(error?: string) {
  return error ? "border-red-400" : "border-slate-300";
}

function FieldText({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </>
  );
}

export function TextField({
  label,
  id,
  hint,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        {...describe(id, hint, error)}
        {...input}
        className={`${fieldClasses} ${borderFor(error)}`}
      />
      <FieldText id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({
  label,
  id,
  hint,
  error,
  ...textarea
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        {...describe(id, hint, error)}
        {...textarea}
        className={`${fieldClasses} ${borderFor(error)}`}
      />
      <FieldText id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  label,
  id,
  hint,
  error,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        {...describe(id, hint, error)}
        {...select}
        className={`${fieldClasses} ${borderFor(error)} bg-white`}
      >
        {children}
      </select>
      <FieldText id={id} hint={hint} error={error} />
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-400",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      type="button"
      {...button}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}
