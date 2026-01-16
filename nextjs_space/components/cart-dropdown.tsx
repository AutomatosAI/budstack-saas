
'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingCart, X, Plus, Minus, ShoppingBag } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';

export function CartDropdown() {
  const { items, removeItem, updateQuantity, getTotalItems, getTotalPrice } = useCartStore();
  const totalItems = getTotalItems();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {totalItems === 0
              ? 'Your cart is empty'
              : `You have ${totalItems} item${totalItems > 1 ? 's' : ''} in your cart`}
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <ShoppingBag className="h-24 w-24 text-gray-300" />
            <p className="text-gray-500 text-center">Your cart is empty</p>
            <Link href="/products">
              <Button>Browse Products</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col space-y-4 mt-6 max-h-[calc(100vh-300px)] overflow-y-auto">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  {item.image && (
                    <div className="relative w-20 h-20 flex-shrink-0 bg-white rounded-md overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.currency || '€'}{item.price.toFixed(2)}
                    </p>
                    {(item.thcContent || item.cbdContent) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {item.thcContent && `THC: ${item.thcContent}%`}
                        {item.thcContent && item.cbdContent && ' | '}
                        {item.cbdContent && `CBD: ${item.cbdContent}%`}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => removeItem(item.productId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span>{items[0]?.currency || '€'}{getTotalPrice().toFixed(2)}</span>
              </div>

              <Link href="/checkout" className="block">
                <Button className="w-full" size="lg">
                  Proceed to Checkout
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
