import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { BadgeTone } from "../../lib/status";
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
