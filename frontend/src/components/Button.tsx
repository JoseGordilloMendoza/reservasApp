import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ink" | "plain";

const BASE =
  "press inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-box " +
  "border-[3px] border-line px-5 py-3 font-display text-lg font-bold leading-none shadow-hard " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const VARIANTS: Record<Variant, string> = {
  // The business accent: the loudest thing on the screen.
  primary: "bg-accent text-on-accent",
  // Inverts with the theme: dark on light pages, light on dark ones.
  ink: "bg-line text-paper",
  plain: "bg-surface text-text",
};

export function buttonClass(variant: Variant = "primary", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** An external link that looks like a button. For in-app navigation use <Link className={buttonClass()}>. */
export function ButtonLink({ variant = "primary", className, ...props }: ButtonLinkProps) {
  return <a className={buttonClass(variant, className)} {...props} />;
}
