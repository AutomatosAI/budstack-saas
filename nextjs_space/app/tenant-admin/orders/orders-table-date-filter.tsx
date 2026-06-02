"use client";

import { Calendar } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "./orders-table-types";

interface OrdersDateRangeFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRangeFilter: string;
  dateRangeLabel: string;
  onPresetSelect: (preset: DateRangePreset) => void;
  customDateFrom: Date | undefined;
  onCustomDateFromChange: (date: Date | undefined) => void;
  customDateTo: Date | undefined;
  onCustomDateToChange: (date: Date | undefined) => void;
  onApplyCustom: () => void;
}

export function OrdersDateRangeFilter({
  open,
  onOpenChange,
  dateRangeFilter,
  dateRangeLabel,
  onPresetSelect,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  onApplyCustom,
}: OrdersDateRangeFilterProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "bs-btn bs-btn-ghost",
            "w-full xl:w-[180px] justify-start text-left font-normal",
            dateRangeFilter !== "all" && "border-bs-green-soft/50",
          )}
        >
          <Calendar className="mr-2 h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
          <span
            className={cn(
              dateRangeFilter === "all" ? "text-bs-fg-muted" : "text-bs-fg",
            )}
          >
            {dateRangeLabel}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bs-card border border-bs-border rounded-bs-md shadow-bs-card-hover"
        align="start"
      >
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPresetSelect("all")}
              className={cn(
                "bs-btn bs-btn-sm justify-start",
                dateRangeFilter === "all" ? "bs-btn-green" : "bs-btn-ghost",
              )}
            >
              All time
            </button>
            <button
              type="button"
              onClick={() => onPresetSelect("7days")}
              className={cn(
                "bs-btn bs-btn-sm justify-start",
                dateRangeFilter === "7days" ? "bs-btn-green" : "bs-btn-ghost",
              )}
            >
              Last 7 days
            </button>
            <button
              type="button"
              onClick={() => onPresetSelect("30days")}
              className={cn(
                "bs-btn bs-btn-sm justify-start",
                dateRangeFilter === "30days" ? "bs-btn-green" : "bs-btn-ghost",
              )}
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={() => onPresetSelect("90days")}
              className={cn(
                "bs-btn bs-btn-sm justify-start",
                dateRangeFilter === "90days" ? "bs-btn-green" : "bs-btn-ghost",
              )}
            >
              Last 90 days
            </button>
          </div>

          <div className="border-t border-bs-border-100 pt-3">
            <p className="bs-eyebrow mb-2">Custom Range</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <CalendarComponent
                  mode="single"
                  selected={customDateFrom}
                  onSelect={onCustomDateFromChange}
                  disabled={(date) =>
                    date > new Date() ||
                    (customDateTo ? date > customDateTo : false)
                  }
                  initialFocus
                />
              </div>
              <div className="flex-1">
                <CalendarComponent
                  mode="single"
                  selected={customDateTo}
                  onSelect={onCustomDateToChange}
                  disabled={(date) =>
                    date > new Date() ||
                    (customDateFrom ? date < customDateFrom : false)
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className="bs-btn bs-btn-green bs-btn-sm w-full mt-2 disabled:opacity-50"
              onClick={onApplyCustom}
              disabled={!customDateFrom || !customDateTo}
            >
              Apply Custom Range
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
