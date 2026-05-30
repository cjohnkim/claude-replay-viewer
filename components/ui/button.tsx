"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "ghost" | "outline" | "subtle" | "accent";
type Size = "sm" | "md" | "icon";

const base = "inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60";

const variants: Record<Variant, string> = {
  default: "bg-bg-subtle text-ink border border-line hover:bg-bg-hover",
  ghost:   "text-ink-muted hover:text-ink hover:bg-bg-subtle",
  outline: "border border-line text-ink-muted hover:text-ink hover:bg-bg-subtle",
  subtle:  "bg-bg-panel text-ink-muted hover:text-ink",
  accent:  "bg-accent/15 text-accent-glow border border-accent/40 hover:bg-accent/25",
};

const sizes: Record<Size, string> = {
  sm:   "text-[11.5px] h-7 px-2.5",
  md:   "text-[12.5px] h-8 px-3",
  icon: "text-[12.5px] h-7 w-7",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  )
);
Button.displayName = "Button";
