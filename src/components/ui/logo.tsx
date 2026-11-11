import { cn } from "../../lib/utils";

/** Temporary vector monogram. Replace only this component when the final logo arrives. */
export function Logo({
  compact = false,
  dark = false,
}: {
  compact?: boolean;
  dark?: boolean;
}) {
  return (
    <div
      className={cn("brand", dark && "brand-on-dark")}
      aria-label="TAHA MOBILES"
    >
      <span className="brand-monogram" aria-hidden="true">
        TM
        <span />
      </span>
      {!compact && (
        <span className="brand-wordmark">
          <strong>TAHA MOBILES</strong>
          <small>RETAIL WORKSPACE</small>
        </span>
      )}
    </div>
  );
}
