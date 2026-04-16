"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Shown while the server action runs (Next.js streams the request). */
  pendingLabel?: string;
};

/**
 * Submit button that reflects {@link useFormStatus} so users see feedback immediately
 * on click instead of a frozen UI until redirect.
 */
export function FormSubmitButton({
  children,
  pendingLabel = "Working…",
  disabled,
  className = "",
  ...props
}: Props) {
  const { pending } = useFormStatus();
  const cls = [className, pending ? "form-submit-btn--pending" : ""].filter(Boolean).join(" ");
  return (
    <button
      type="submit"
      {...props}
      className={cls}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
