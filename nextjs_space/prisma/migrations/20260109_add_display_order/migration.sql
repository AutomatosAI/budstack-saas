-- Add displayOrder field to products table for drag-and-drop ordering
ALTER TABLE "products" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
