/**
 * Section schema type definitions.
 *
 * Shared by section-schemas-data.ts (the SECTION_SCHEMAS data table) and
 * section-schemas.ts (helper functions + public barrel).
 */

export type FieldType = 'text' | 'textarea' | 'image' | 'video' | 'url' | 'select' | 'number' | 'array' | 'boolean' | 'product-picker';

/** Shape of a single sub-field inside an array item (e.g. title, description inside a feature) */
export interface ArrayItemField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'image' | 'select' | 'icon';
  default: string | number;
  options?: string[];
  placeholder?: string;
}

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  default: string | number;
  options?: string[]; // For 'select' type
  placeholder?: string;
  /** For 'array' type: defines the shape of each item in the array */
  itemFields?: ArrayItemField[];
  /** For 'array' type: label for the "Add" button, e.g. "Add Feature" */
  itemLabel?: string;
}

export interface SectionSchema {
  label: string;
  category: 'hero' | 'cta' | 'content' | 'navigation' | 'footer';
  description: string;
  fields: FieldSchema[];
}
