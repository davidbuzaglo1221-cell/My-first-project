import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover",
  secondary: "bg-bg text-text border border-border-input hover:bg-surface active:bg-surface-2",
  soft: "bg-accent-soft text-accent-ink hover:brightness-95 active:brightness-90",
  ghost: "bg-transparent text-accent hover:bg-surface active:bg-surface-2",
  danger: "bg-danger text-on-danger hover:brightness-95 active:brightness-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-sm",
  md: "h-11 px-4 text-base gap-2 rounded-md",
  lg: "h-13 px-5 text-lg gap-2 rounded-md",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** Icon before the label (on the right, in RTL). */
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, fullWidth, icon, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap",
        "transition-[background-color,filter,transform] duration-(--motion-fast) active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-[1.1em] animate-spin" /> : icon}
      {/* The label stays while loading, so screen readers still know what the button does. */}
      <span className={cn(loading && "opacity-80")}>{children}</span>
    </button>
  );
});

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: icon-only buttons need a spoken name. */
  label: string;
  variant?: "ghost" | "soft" | "secondary" | "primary";
  size?: "md" | "lg";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill transition-colors duration-(--motion-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "size-11" : "size-13",
        variant === "ghost" && "text-text-muted hover:bg-surface active:bg-surface-2",
        variant === "soft" && "bg-accent-soft text-accent-ink",
        variant === "secondary" && "border border-border-input text-text hover:bg-surface",
        variant === "primary" && "bg-accent text-on-accent hover:bg-accent-hover",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/** The floating + button. Sits at the end side (left in RTL), above the tab bar. */
export function Fab({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "fixed end-4 z-30 inline-flex size-14 items-center justify-center rounded-pill",
        "bottom-[calc(var(--layout-tabbar-height)+1rem+env(safe-area-inset-bottom))]",
        "bg-accent text-on-accent shadow-pop transition-transform duration-(--motion-fast) active:scale-95",
      )}
    >
      {children}
    </button>
  );
}
