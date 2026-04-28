import Image from "next/image";

type SandmanLogoProps = {
  className?: string;
  alt?: string;
};

export function SandmanLogo({
  className = "",
  alt = "Sandman Signature",
}: SandmanLogoProps) {
  return (
    <div className={className}>
      <Image
        src="/sandman-signature-hotel-586x390.jpg"
        alt={alt}
        width={586}
        height={390}
        priority
        className="h-auto w-full max-w-[168px] object-contain"
      />
    </div>
  );
}
