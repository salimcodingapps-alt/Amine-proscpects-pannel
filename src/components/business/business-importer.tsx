"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { importBusinesses } from "@/lib/businesses/actions";
import { parseBusinessCsv, type ParsedCsv } from "@/lib/businesses/csv";
import { buildValues } from "@/lib/businesses/validation";
import {
  IMPORTABLE_FIELDS,
  MAX_IMPORT_ROWS,
  type BusinessImportResult,
  type BusinessInput,
  type BusinessStatus,
  type ImportFieldKey,
} from "@/lib/businesses/types";

const FIELD_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const UNMAPPED = "";

/** Normalize a string for fuzzy header<->field matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Field -> CSV header guess, based on header names. */
function autoMap(headers: string[]): Record<ImportFieldKey, string> {
  const map = {} as Record<ImportFieldKey, string>;
  const used = new Set<string>();
  for (const field of IMPORTABLE_FIELDS) {
    const candidates = [norm(field.key), norm(field.label)];
    const match = headers.find(
      (h) => !used.has(h) && candidates.includes(norm(h))
    );
    if (match) {
      map[field.key] = match;
      used.add(match);
    } else {
      map[field.key] = UNMAPPED;
    }
  }
  return map;
}

/** Build a BusinessInput from one CSV row using the current column mapping. */
function rowToInput(
  row: Record<string, string>,
  mapping: Record<ImportFieldKey, string>
): BusinessInput {
  const get = (k: ImportFieldKey) => {
    const header = mapping[k];
    return header ? (row[header] ?? "") : "";
  };
  const statusCell = get("status").trim().toLowerCase();
  return {
    companyName: get("companyName"),
    contactName: get("contactName"),
    phone: get("phone"),
    email: get("email"),
    website: get("website"),
    address: get("address"),
    city: get("city"),
    wilaya: get("wilaya"),
    country: get("country"),
    businessType: get("businessType"),
    supportedBrands: get("supportedBrands")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
    status: statusCell === "" ? undefined : (statusCell as BusinessStatus),
  };
}

type Step = "upload" | "map" | "review" | "done";

/**
 * Multi-step CSV importer: upload -> map columns -> review/validate -> confirm.
 * Parsing happens in the browser; rows live only in component state (no storage,
 * no staging table). Nothing is written until the user clicks the confirm
 * button, and the server re-validates every row before inserting.
 */
export function BusinessImporter({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, string>>(
    {} as Record<ImportFieldKey, string>
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BusinessImportResult | null>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMapping({} as Record<ImportFieldKey, string>);
    setError(null);
    setResult(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const res = await parseBusinessCsv(file);
    if (res.error || !res.data) {
      setParsed(null);
      setError(res.error ?? "Could not parse the file.");
      return;
    }
    setParsed(res.data);
    setMapping(autoMap(res.data.headers));
    setStep("map");
  }

  // Validate every row against the current mapping for the review step.
  const validation = useMemo(() => {
    if (!parsed) return { valid: [] as BusinessInput[], invalid: [] as { row: number; companyName: string; message: string }[] };
    const valid: BusinessInput[] = [];
    const invalid: { row: number; companyName: string; message: string }[] = [];
    parsed.rows.forEach((row, i) => {
      const input = rowToInput(row, mapping);
      const built = buildValues(input);
      if (built.error || !built.values) {
        invalid.push({
          row: i + 1,
          companyName: input.companyName?.trim() || "(no company name)",
          message: built.error ?? "Invalid row.",
        });
      } else {
        valid.push(input);
      }
    });
    return { valid, invalid };
  }, [parsed, mapping]);

  const companyMapped = Boolean(mapping.companyName);

  function handleImport() {
    if (!parsed) return;
    setError(null);
    // Submit ALL parsed rows in CSV order; the server re-validates and skips
    // invalid rows. Client validation above is a preview, not the gate.
    const inputs = parsed.rows.map((row) => rowToInput(row, mapping));
    startTransition(async () => {
      const res = await importBusinesses(workspaceId, inputs);
      setResult(res);
      if (res.error && res.inserted === 0) {
        setError(res.error);
        return;
      }
      setStep("done");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* STEP 1 — UPLOAD */}
      {step === "upload" ? (
        <Card className="flex flex-col items-start gap-4 p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Upload a CSV file
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Up to {MAX_IMPORT_ROWS} rows. The first row must be column headers.
              Excel files can be exported as CSV. Files are parsed in your
              browser and never stored.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4" />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </Card>
      ) : null}

      {/* STEP 2 — MAP COLUMNS */}
      {step === "map" && parsed ? (
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Map columns
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-foreground">{fileName}</span> —{" "}
              {parsed.rows.length} data row
              {parsed.rows.length === 1 ? "" : "s"}, {parsed.headers.length}{" "}
              column
              {parsed.headers.length === 1 ? "" : "s"}. Match each field to a
              column. Company name is required.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {IMPORTABLE_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`map-${field.key}`}>
                  {field.label}
                  {field.required ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </Label>
                <select
                  id={`map-${field.key}`}
                  value={mapping[field.key] ?? UNMAPPED}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field.key]: e.target.value }))
                  }
                  className={FIELD_CLASS}
                >
                  <option value={UNMAPPED}>— Not mapped —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!companyMapped ? (
            <p className="text-sm text-destructive">
              Map a column to <span className="font-medium">Company name</span>{" "}
              to continue.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!companyMapped}
              onClick={() => setStep("review")}
            >
              Review rows
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Start over
            </Button>
          </div>
        </Card>
      ) : null}

      {/* STEP 3 — REVIEW */}
      {step === "review" && parsed ? (
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Review &amp; confirm
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-success">{validation.valid.length} valid</span>
              {" · "}
              <span
                className={
                  validation.invalid.length > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {validation.invalid.length} invalid
              </span>{" "}
              of {parsed.rows.length}. Only valid rows will be imported; invalid
              rows are skipped.
            </p>
          </div>

          {validation.invalid.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Invalid rows (skipped)
              </p>
              <div className="max-h-60 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.invalid.map((r) => (
                      <tr key={r.row} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                        <td className="px-3 py-2 text-foreground">{r.companyName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {validation.valid.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                Preview (first {Math.min(10, validation.valid.length)} valid)
              </p>
              <div className="max-h-60 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">City / Wilaya</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.valid.slice(0, 10).map((v, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{v.companyName}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[v.city, v.wilaya].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {v.businessType || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {v.status ?? "new"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={pending || validation.valid.length === 0}
              onClick={handleImport}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Import ${validation.valid.length} valid row${
                  validation.valid.length === 1 ? "" : "s"
                }`
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setStep("map")}
            >
              Back to mapping
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={reset}
            >
              Start over
            </Button>
          </div>
        </Card>
      ) : null}

      {/* STEP 4 — DONE */}
      {step === "done" && result ? (
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-5 w-5" />
            Imported {result.inserted} record
            {result.inserted === 1 ? "" : "s"}.
          </p>
          {result.skipped > 0 ? (
            <p className="text-sm text-muted-foreground">
              {result.skipped} row{result.skipped === 1 ? "" : "s"} skipped
              (invalid).
            </p>
          ) : null}
          {result.error ? (
            <p className="text-sm text-destructive">{result.error}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/database">View in database</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Import another file
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
