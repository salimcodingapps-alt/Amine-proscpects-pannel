import Image from "next/image";

/** VIP TUNING brand lockup used in the sidebar and mobile header. */
export function BrandMark() {
  return (
    <div className="flex flex-col gap-1">
      <Image
        src="/vip-tuning-logo.png"
        alt="VIP TUNING"
        width={1416}
        height={246}
        priority
        className="h-8 w-auto"
      />
      <span className="pl-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Automotive BI CRM
      </span>
    </div>
  );
}
