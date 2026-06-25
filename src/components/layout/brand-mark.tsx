import Image from "next/image";

/** VIP TUNING brand lockup used in the sidebar and mobile header. */
export function BrandMark() {
  return (
    <Image
      src="/vip-tuning-logo.png"
      alt="VIP TUNING"
      width={1416}
      height={246}
      priority
      className="h-8 w-auto"
    />
  );
}
