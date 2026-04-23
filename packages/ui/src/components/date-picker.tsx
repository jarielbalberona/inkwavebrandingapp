import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@workspace/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Button } from "@workspace/ui/components/button";
import { format } from "date-fns";

function DatePicker({
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

  const handleDateSelect = (date?: Date) => {
    onSelect?.(date);
    setOpen(false);
  };

  return (
    <Popover modal open={open} onOpenChange={(open) => !disabled && setOpen(open)}>
      <PopoverTrigger
        render={
          <Button
            variant={"outline"}
            data-empty={!value}
            className="data-[empty=true]:text-muted-foreground w-[212px] justify-between text-left font-normal"
          >
            {value ? format(value, "PPP") : <span>{placeholder ?? "Pick a date"}</span>}
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0 z-50 border-none" align="start" side="bottom">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          disabled={disablePastDates ? { before: new Date() } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
