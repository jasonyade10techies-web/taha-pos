import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "./dialog";
import { AppSelect } from "./app-select";
import { Button } from "./button";
import "./searchable-controls.css";

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : null;
const shopToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function DatePicker({
  value,
  onChange,
  label = "Date",
  min,
  max,
  disabled = false,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(
      () => parse(value) ?? parse(shopToday()) ?? new Date(),
    ),
    [focusDay, setFocusDay] = useState(value || shopToday());
  const grid = useRef<HTMLDivElement>(null),
    wrapper = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, focusDay]);
  const available = (date: string) =>
    (!min || date >= min) && (!max || date <= max);
  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const move = (next: Date) => {
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setFocusDay(iso(next));
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${iso(next)}"]`)
        ?.focus(),
    );
  };
  const start = new Date(month.getFullYear(), month.getMonth(), 1),
    offset = start.getDay(),
    count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <div className="custom-date-picker" ref={wrapper}>
      {required&&<input className="app-select-native" tabIndex={-1} aria-hidden required value={value} onChange={()=>{}} onInvalid={event=>{event.preventDefault();wrapper.current?.querySelector('button')?.focus();setOpen(true);}}/>}
      <Button
        disabled={disabled}
        className="date-picker-trigger input"
        aria-label={`${label}: ${value || "No date"}. Open calendar`}
        aria-haspopup="dialog"
        onClick={() => {
          setMonth(parse(value) ?? parse(shopToday()) ?? new Date());
          setFocusDay(value || shopToday());
          setOpen(true);
        }}
      >
        <CalendarDays size={16} />
        <span>
          {parse(value)?.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }) ?? "Choose date"}
        </span>
      </Button>
      <small className="date-format-guidance">DD MMM YYYY · Karachi</small>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Choose ${label}`}
        onCloseAutoFocus={()=>wrapper.current?.querySelector<HTMLButtonElement>('.date-picker-trigger')?.focus()}
        description="Use arrow keys for days; Page Up/Down for months; Shift + Page Up/Down for years."
        className="calendar-dialog"
      >
        <div className="calendar-heading">
          <Button
            aria-label="Previous month"
            onClick={() =>
              move(
                new Date(
                  month.getFullYear(),
                  month.getMonth() - 1,
                  Math.min(parse(focusDay)?.getDate() ?? 1, 28),
                ),
              )
            }
          >
            <ChevronLeft size={16} />
          </Button>
          <AppSelect
            aria-label="Calendar month"
            value={month.getMonth()}
            onChange={(e) =>
              move(new Date(month.getFullYear(), Number(e.target.value), 1))
            }
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option value={i} key={i}>
                {new Date(2026, i, 1).toLocaleDateString("en", {
                  month: "long",
                })}
              </option>
            ))}
          </AppSelect>
          <input
            className="input calendar-year"
            aria-label="Calendar year"
            type="number"
            min="1900"
            max="2200"
            value={month.getFullYear()}
            onChange={(e) => {
              const year = Number(e.target.value);
              if (year >= 1900 && year <= 2200)
                move(new Date(year, month.getMonth(), 1));
            }}
          />
          <Button
            aria-label="Next month"
            onClick={() =>
              move(
                new Date(
                  month.getFullYear(),
                  month.getMonth() + 1,
                  Math.min(parse(focusDay)?.getDate() ?? 1, 28),
                ),
              )
            }
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <h3 id={id} className="calendar-month-label" aria-live="polite">
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <div
          ref={grid}
          role="grid"
          aria-labelledby={id}
          className="calendar-grid"
        >
          <div role="row" className="calendar-week">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span role="columnheader" key={day}>
                {day}
              </span>
            ))}
          </div>
          {Array.from(
            { length: Math.ceil((offset + count) / 7) },
            (_, week) => (
              <div role="row" className="calendar-week" key={week}>
                {Array.from({ length: 7 }, (_, column) => {
                  const day = week * 7 + column - offset + 1;
                  if (day < 1 || day > count)
                    return <span role="gridcell" key={column} />;
                  const date = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      day,
                    ),
                    key = iso(date);
                  return (
                    <span
                      role="gridcell"
                      aria-selected={key === value}
                      key={column}
                    >
                      <button
                        type="button"
                        data-day={key}
                        tabIndex={
                          key === focusDay ||
                          (!focusDay.startsWith(iso(start).slice(0, 7)) &&
                            day === 1)
                            ? 0
                            : -1
                        }
                        aria-label={date.toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        aria-current={key === shopToday() ? "date" : undefined}
                        aria-disabled={!available(key)}
                        className={key === value ? "selected" : ""}
                        onClick={() => {
                          if (available(key)) select(key);
                        }}
                        onKeyDown={(event) => {
                          let next: Date | undefined;
                          const delta: Record<string, number> = {
                            ArrowLeft: -1,
                            ArrowRight: 1,
                            ArrowUp: -7,
                            ArrowDown: 7,
                          };
                          if (delta[event.key])
                            next = new Date(
                              date.getFullYear(),
                              date.getMonth(),
                              date.getDate() + delta[event.key],
                            );
                          else if (
                            event.key === "PageUp" ||
                            event.key === "PageDown"
                          )
                            next = new Date(
                              date.getFullYear() +
                                (event.shiftKey
                                  ? event.key === "PageUp"
                                    ? -1
                                    : 1
                                  : 0),
                              date.getMonth() +
                                (!event.shiftKey
                                  ? event.key === "PageUp"
                                    ? -1
                                    : 1
                                  : 0),
                              Math.min(day, 28),
                            );
                          else if (event.key === "Home")
                            next = new Date(
                              date.getFullYear(),
                              date.getMonth(),
                              day - date.getDay(),
                            );
                          else if (event.key === "End")
                            next = new Date(
                              date.getFullYear(),
                              date.getMonth(),
                              day + 6 - date.getDay(),
                            );
                          if (next) {
                            event.preventDefault();
                            move(next);
                          }
                        }}
                      >
                        {day}
                      </button>
                    </span>
                  );
                })}
              </div>
            ),
          )}
        </div>
        <div className="calendar-actions">
          <Button
            disabled={!available(shopToday())}
            onClick={() => select(shopToday())}
          >
            Today
          </Button>
          <Button onClick={() => select("")}>Clear</Button>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
}
