import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PHOTO_KEY = "picshift.profile.photo";

export function getStoredPhoto(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PHOTO_KEY);
}

export function setStoredPhoto(dataUrl: string | null): void {
  if (typeof window === "undefined") return;
  if (dataUrl === null) {
    localStorage.removeItem(PHOTO_KEY);
  } else {
    localStorage.setItem(PHOTO_KEY, dataUrl);
  }
  window.dispatchEvent(new CustomEvent("picshift:photo-changed"));
}

export function initialsFor(seed: string | null | undefined): string {
  if (!seed) return "PS";
  const parts = seed.replace(/[^a-zA-Z0-9\s@.-]/g, " ").trim().split(/\s+/);
  if (parts.length === 1) {
    const p = parts[0].replace(/[^a-zA-Z]/g, "");
    return p.slice(0, 2).toUpperCase() || "PS";
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  seed,
  photoUrl,
  className,
}: {
  seed?: string | null;
  photoUrl?: string | null;
  className?: string;
}) {
  const src = photoUrl ?? getStoredPhoto();
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold">
        {initialsFor(seed)}
      </AvatarFallback>
    </Avatar>
  );
}
