import type { ReactNode } from "react";

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
