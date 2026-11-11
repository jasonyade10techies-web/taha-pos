import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { AppSelect } from "./app-select";
import { shopDay, shopTimestamp } from "../../lib/shop-time";
import "./date-time-input.css";
/** Explicit shop time: Pakistan does not observe daylight saving time. */
export function DateTimeInput({
  value,
  onChange,
  label = "Due date and time",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const button = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false),
    [date, setDate] = useState(""),
    [hour, setHour] = useState("18"),
    [minute, setMinute] = useState("00"),
    [month, setMonth] = useState(new Date());
  const begin = () => {
    const day = value ? shopDay(value) : shopDay();
    setDate(day);
    setMonth(new Date(day + "T12:00:00Z"));
    if (value.length > 10) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(value));
      setHour(parts.find((p) => p.type === "hour")?.value ?? "18");
      setMinute(parts.find((p) => p.type === "minute")?.value ?? "00");
    }
    setOpen(true);
  };
  const first = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
    ).getUTCDay(),
    days = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const shift = (amount: number) =>
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1, 12),
      ),
    );
  return (
    <div className="date-time-input">
      <input
        className="app-select-native"
        tabIndex={-1}
        aria-hidden
        required={required}
        value={value}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          button.current?.focus();
        }}
      />
      <Button
        ref={button}
        onClick={begin}
        aria-label={label}
        aria-haspopup="dialog"
      >
        <CalendarDays size={16} />
        <span>{value ? shopTimestamp(value) : "Choose date and time"}</span>
      </Button>
      {value && !required && (
        <button
          type="button"
          className="date-time-clear"
          aria-label={"Clear " + label}
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="Choose a date and time in Pakistan Standard Time (UTC+05:00)."
      >
        <div className="calendar-heading">
          <Button aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </Button>
          <strong>
            {month.toLocaleDateString("en", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </strong>
          <Button aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="range-calendar">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <span key={day}>{day}</span>
          ))}
          {Array.from({ length: first }, (_, i) => (
            <span key={"empty" + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button
                type="button"
                key={day}
                aria-label={day}
                aria-pressed={day === date}
                onClick={() => setDate(day)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="shop-time-select">
          <label>
            Hour (24-hour)
            <AppSelect
              className="input"
              aria-label="Hour"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
            >
              {Array.from({ length: 24 }, (_, n) =>
                String(n).padStart(2, "0"),
              ).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </AppSelect>
          </label>
          <span>:</span>
          <label>
            Minute
            <AppSelect
              className="input"
              aria-label="Minute"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
            >
              {Array.from({ length: 60 }, (_, n) =>
                String(n).padStart(2, "0"),
              ).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </AppSelect>
          </label>
        </div>
        <p className="text-muted text-sm">
          {date} · {hour}:{minute} Pakistan time
        </p>
        <div className="dialog-actions">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onChange(
                new Date(
                  date + "T" + hour + ":" + minute + ":00+05:00",
                ).toISOString(),
              );
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
