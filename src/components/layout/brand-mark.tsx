import { Gauge } from "lucide-react";

/** Premium automotive wordmark used in the sidebar and mobile header. */
export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Gauge className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Automotive BI CRM
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Supplier Intelligence
        </span>
      </div>
    </div>
  );
}
