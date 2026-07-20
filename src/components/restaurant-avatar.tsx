import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function RestaurantAvatar({
  name,
  avatarUrl,
  className,
  size = 36,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  size?: number;
}) {
  const label = name?.trim() || "LUUD";
  const hue = hashHue(label);
  const bg = `linear-gradient(135deg, oklch(0.72 0.16 ${hue}), oklch(0.55 0.18 ${(hue + 40) % 360}))`;

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ring-1 ring-border/60 text-primary-foreground font-semibold select-none",
        className,
      )}
      style={{ width: size, height: size, background: avatarUrl ? undefined : bg, fontSize: size * 0.38 }}
      aria-label={label}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(label)}</span>
      )}
    </span>
  );
}
