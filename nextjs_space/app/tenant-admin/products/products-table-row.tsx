"use client";

import { Leaf, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { RowPill } from "@/components/admin/shared";
import { cn } from "@/lib/utils";
import type { SortableProductRowProps } from "./products-table-types";

export function SortableProductRow({
  product,
  isSelected,
  onSelectOne,
  getStrainLabel,
  currencySymbol,
}: SortableProductRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-colors hover:bg-bs-card-2",
        isSelected && "bg-bs-card-2/60",
        isDragging && "relative z-50 shadow-bs-card-hover",
      )}
    >
      <td
        className="w-12 cursor-grab active:cursor-grabbing hidden md:table-cell"
        {...attributes}
        {...listeners}
      >
        <GripVertical
          className="h-5 w-5 text-bs-fg-muted hover:text-bs-fg transition-colors"
          aria-hidden="true"
        />
      </td>

      <td className="w-12 hidden sm:table-cell">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) =>
            onSelectOne(product.id, checked === true)
          }
          aria-label={`Select ${product.name}`}
          className="border-bs-border data-[state=checked]:bg-bs-green-soft data-[state=checked]:border-bs-green-soft"
        />
      </td>

      <td className="font-medium text-bs-fg">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-bs-md border border-bs-border-100 bg-bs-card-2 flex items-center justify-center flex-shrink-0">
            <Leaf className="h-4 w-4 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block truncate max-w-[150px] sm:max-w-[200px]">
              {product.name}
            </span>
            <span className="block text-xs font-mono text-bs-fg-muted md:hidden">
              {product.category || "Uncategorized"} • {currencySymbol}
              {typeof product.price === "number"
                ? product.price.toFixed(2)
                : product.price}
            </span>
          </div>
        </div>
      </td>

      <td className="text-bs-fg-muted capitalize hidden md:table-cell">
        {product.category || <span className="text-bs-fg-muted">—</span>}
      </td>

      <td className="hidden lg:table-cell">
        <RowPill tone="gold">{getStrainLabel(product.name)}</RowPill>
      </td>

      <td className="text-center font-mono text-sm text-bs-fg-muted hidden lg:table-cell">
        {product.thcContent != null ? `${product.thcContent}%` : "—"}
      </td>

      <td className="text-center font-mono text-sm text-bs-fg-muted hidden lg:table-cell">
        {product.cbdContent != null ? `${product.cbdContent}%` : "—"}
      </td>

      <td className="text-right font-mono tabular-nums font-medium text-bs-fg hidden sm:table-cell">
        {currencySymbol}
        {typeof product.price === "number"
          ? product.price.toFixed(2)
          : product.price}
      </td>

      <td className="text-center hidden sm:table-cell">
        <RowPill tone={product.stock > 0 ? "emerald" : "red"}>
          {product.stock}
        </RowPill>
      </td>

      <td>
        <RowPill
          tone={product.stock > 0 ? "emerald" : "red"}
          aria-label={`Status: ${product.stock > 0 ? "In Stock" : "Out of Stock"}`}
        >
          {product.stock > 0 ? "In Stock" : "Out of Stock"}
        </RowPill>
      </td>
    </tr>
  );
}
