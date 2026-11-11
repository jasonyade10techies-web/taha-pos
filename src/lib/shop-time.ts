export const shopTimeZone = "Asia/Karachi";
export function shopDay(value: string | number | Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: shopTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function shopTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time not recorded";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return (
      new Intl.DateTimeFormat("en-PK", {
        timeZone: shopTimeZone,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date) + " · Time not recorded"
    );
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: shopTimeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}
