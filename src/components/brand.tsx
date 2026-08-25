import { cn } from "./ui";

export function BrandMark({
  size = 40,
  className,
  alt = "GST Registry",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand mark, sized by caller
    <img
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={cn("select-none rounded-[22%] bg-[#0a0b0e] object-cover", className)}
    />
  );
}
