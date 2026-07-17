import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { PERIOD_OPTIONS, type Period, type PeriodKey, periodFromKey } from "@/lib/period";
import { cn } from "@/lib/utils";
import { formatDate, isoDate } from "@/lib/format";

export function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(new Date(period.from + "T00:00:00"));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date(period.to + "T00:00:00"));

  function select(key: PeriodKey) {
    if (key === "custom") {
      if (customFrom && customTo) {
        onChange(periodFromKey("custom", { from: isoDate(customFrom), to: isoDate(customTo) }));
      }
    } else {
      onChange(periodFromKey(key));
    }
    setOpen(false);
  }

  const currentLabel = period.key === "custom"
    ? `${formatDate(period.from)} — ${formatDate(period.to)}`
    : PERIOD_OPTIONS.find((o) => o.key === period.key)?.label ?? period.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          <span>{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="p-2 border-r border-border w-44 flex flex-col gap-1">
            {PERIOD_OPTIONS.map((o) => (
              <Button
                key={o.key}
                variant="ghost"
                size="sm"
                className={cn("justify-start", period.key === o.key && "bg-accent")}
                onClick={() => select(o.key)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <div className="text-xs text-muted-foreground mb-2">Personalizado</div>
            <div className="flex gap-2">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                className="pointer-events-auto"
              />
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                className="pointer-events-auto"
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={() => select("custom")} disabled={!customFrom || !customTo}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
