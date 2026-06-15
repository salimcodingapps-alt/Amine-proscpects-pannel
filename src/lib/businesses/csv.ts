/**
 * Client-side CSV parsing for the business import flow (Block 6). Wraps
 * papaparse to return a simple { headers, rows } shape and enforce the row cap.
 * Pure-ish: no Supabase / Next / server logic — used only in the browser.
 */

import Papa from "papaparse";

import { MAX_IMPORT_ROWS } from "@/lib/businesses/types";

export interface ParsedCsv {
  /** Column headers from the first row, trimmed. */
  headers: string[];
  /** Data rows as header->cell maps (cells trimmed). */
  rows: Record<string, string>[];
}

export interface CsvParseResult {
  data?: ParsedCsv;
  error?: string;
}

/**
 * Parse a CSV File using its header row. Blank lines are skipped. Rejects files
 * with no headers, no data rows, or more than MAX_IMPORT_ROWS data rows.
 */
export function parseBusinessCsv(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      transform: (v) => (typeof v === "string" ? v.trim() : v),
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter((h) => h !== "");
        if (headers.length === 0) {
          resolve({ error: "Could not read any column headers from the file." });
          return;
        }

        const rows = (results.data ?? []).filter((row) =>
          // Drop rows where every cell is empty.
          Object.values(row).some((v) => (v ?? "").toString().trim() !== "")
        );

        if (rows.length === 0) {
          resolve({ error: "The file has headers but no data rows." });
          return;
        }
        if (rows.length > MAX_IMPORT_ROWS) {
          resolve({
            error: `Too many rows: ${rows.length}. Please split the file — the limit is ${MAX_IMPORT_ROWS} rows per import.`,
          });
          return;
        }

        resolve({ data: { headers, rows } });
      },
      error: (err) => {
        resolve({ error: `Could not parse the CSV: ${err.message}` });
      },
    });
  });
}
