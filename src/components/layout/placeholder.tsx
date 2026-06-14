import { Construction } from "lucide-react";

/** Empty-state placeholder for pages whose feature arrives in a later block. */
export function Placeholder({ block }: { block: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
          <Construction className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">Not built yet</p>
        <p className="text-sm text-muted-foreground">
          This area is planned for <span className="text-foreground">{block}</span>.
          The application shell is in place and ready for it.
        </p>
      </div>
    </div>
  );
}
