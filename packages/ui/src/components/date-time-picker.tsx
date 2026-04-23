import { format } from "date-fns";
import { CalendarDaysIcon, ChevronDownIcon, Clock3Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

const DEFAULT_TIME = "09:00";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getTimeString(value?: Date): string {
  if (!value) {
    return DEFAULT_TIME;
  }

  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function mergeDateAndTime(date: Date, time: string): Date {
  const [hoursString, minutesString] = time.split(":");
  const hours = Number(hoursString);
  const minutes = Number(minutesString);
  const next = new Date(date);

  next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function DateTimePicker({
  placeholder,
  value,
  disablePastDates = false,
  disabled = false,
  onSelect,
}: {
  placeholder?: string;
  value?: Date;
  disablePastDates?: boolean;
  disabled?: boolean;
  onSelect: (date?: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [timeValue, setTimeValue] = useState(getTimeString(value));

  useEffect(() => {
    setTimeValue(getTimeString(value));
  }, [value]);

  const disabledDays = useMemo(
    () => (disablePastDates ? { before: startOfToday() } : undefined),
    [disablePastDates]
  );

  const handleDateSelect = (date?: Date) => {
    if (!date) {
      onSelect(undefined);
      return;
    }

    onSelect(mergeDateAndTime(date, timeValue));
  };

  const handleTimeChange = (nextTime: string) => {
    setTimeValue(nextTime);

    if (value) {
      onSelect(mergeDateAndTime(value, nextTime));
    }
  };

  return (
    <Popover modal open={open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className="data-[empty=true]:text-muted-foreground w-full justify-between text-left font-normal"
        >
          <span className="flex items-center gap-2">
            <CalendarDaysIcon className="h-4 w-4 text-muted-foreground" />
            {value ? format(value, "PPP p") : <span>{placeholder ?? "Pick a date and time"}</span>}
          </span>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-50 w-auto border-none p-0" align="start" side="bottom">
        <div className="rounded-lg border bg-background p-3 shadow-sm">
          <Calendar mode="single" selected={value} onSelect={handleDateSelect} disabled={disabledDays} />

          <div className="mt-3 border-t pt-3">
            <Label htmlFor="date-time-picker-time" className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3Icon className="h-4 w-4" />
              Time
            </Label>
            <Input
              id="date-time-picker-time"
              type="time"
              step={60}
              value={timeValue}
              disabled={disabled}
              onChange={(event) => handleTimeChange(event.target.value)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DateTimePicker };
