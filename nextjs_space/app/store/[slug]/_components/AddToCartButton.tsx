"use client";

import { useState } from "react";
import { useCart } from "../_contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddToCartButtonProps {
  strainId: string;
  strainName: string;
  className?: string;
}

export function AddToCartButton({
  strainId,
  strainName,
  className,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<number>(5); // Default to 5g
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addToCart(strainId, quantity, size);

      // Show success state
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert(error instanceof Error ? error.message : "Failed to add to cart");
    } finally {
      setIsAdding(false);
    }
  };

  if (showSuccess) {
    return (
      <Button disabled className={className}>
        <Check className="mr-2 h-4 w-4" />
        Added to Cart!
      </Button>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      {/* Size Selector */}
      <Select
        value={size.toString()}
        onValueChange={(val) => setSize(parseInt(val))}
      >
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2">2g</SelectItem>
          <SelectItem value="5">5g</SelectItem>
          <SelectItem value="10">10g</SelectItem>
        </SelectContent>
      </Select>

      {/* Quantity Selector */}
      <div className="flex items-center border rounded-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={isAdding || quantity <= 1}
          className="rounded-r-none"
        >
          -
        </Button>
        <span className="px-4 font-medium min-w-[3rem] text-center">
          {quantity}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQuantity(quantity + 1)}
          disabled={isAdding}
          className="rounded-l-none"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Add to Cart Button */}
      <Button onClick={handleAddToCart} disabled={isAdding} className="flex-1">
        <ShoppingCart className="mr-2 h-4 w-4" />
        {isAdding ? "Adding..." : "Add to Cart"}
      </Button>
    </div>
  );
}
