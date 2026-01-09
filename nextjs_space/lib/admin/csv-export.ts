/**
 * CSV Export Utility
 *
 * Provides functions for exporting table data to CSV format with proper escaping,
 * browser download, and filename formatting.
 *
 * @module lib/admin/csv-export
 */

/**
 * Escapes a CSV field value by wrapping in quotes if it contains special characters
 * and escaping any quotes within the value.
 */
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quotes, or newlines, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Converts an array of objects to CSV format
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) {
    return headers.map(h => escapeCsvField(h.label)).join(',');
  }

  // Create header row
  const headerRow = headers.map(h => escapeCsvField(h.label)).join(',');

  // Create data rows
  const dataRows = data.map(row => {
    return headers
      .map(header => escapeCsvField(row[header.key]))
      .join(',');
  }).join('\n');

  return `${headerRow}\n${dataRows}`;
}

/**
 * Triggers a browser download of CSV content
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create blob with UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link and trigger click
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL
  URL.revokeObjectURL(url);
}

/**
 * Generates a filename for CSV export with current date
 * Format: {entity}-export-YYYY-MM-DD.csv
 */
export function generateCSVFilename(entityName: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${entityName}-export-${year}-${month}-${day}.csv`;
}

/**
 * Calculates approximate file size in KB for display
 */
export function calculateFileSize(csvContent: string): string {
  const bytes = new Blob([csvContent]).size;
  const kb = bytes / 1024;

  if (kb < 1) {
    return `${bytes} bytes`;
  } else if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  } else {
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }
}

/**
 * Main export function that handles the complete export flow
 */
export async function exportToCSV<T extends Record<string, any>>(
  data: T[],
  headers: { key: keyof T; label: string }[],
  entityName: string,
  onStart?: () => void,
  onComplete?: (recordCount: number, fileSize: string) => void,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    onStart?.();

    // Simulate brief processing time for better UX (shows loading state)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Generate CSV content
    const csvContent = convertToCSV(data, headers);

    // Calculate file size
    const fileSize = calculateFileSize(csvContent);

    // Generate filename
    const filename = generateCSVFilename(entityName);

    // Trigger download
    downloadCSV(csvContent, filename);

    // Notify completion
    onComplete?.(data.length, fileSize);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Export failed'));
  }
}
