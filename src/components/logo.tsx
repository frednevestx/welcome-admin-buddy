import { cn } from "@/lib/utils";
import luudLogo from "@/assets/luud-logo.png.asset.json";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={luudLogo.url}
        alt="LUUD"
        className="h-7 md:h-8 w-auto select-none"
        draggable={false}
      />
      {showText && (
        <span className="sr-only">LUUD — Descubra seu lucro</span>
      )}
    </div>
  );
}
