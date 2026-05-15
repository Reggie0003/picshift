import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Image as ImageIcon, LogOut, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChangelogDrawer } from "@/components/changelog-drawer";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsModal } from "@/components/shortcuts-modal";
import { UserAvatar, getStoredPhoto, setStoredPhoto } from "@/components/user-avatar";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

const MAX_PHOTO_BYTES = 500_000; // ~500KB after base64 encode is fine for localStorage

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AppShell({
  children,
  title,
  backTo,
  description,
}: {
  children: ReactNode;
  title?: string;
  backTo?: string;
  description?: string;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(() => getStoredPhoto());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setPhoto(getStoredPhoto());
    window.addEventListener("picshift:photo-changed", refresh);
    return () => window.removeEventListener("picshift:photo-changed", refresh);
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useGlobalShortcuts({ onOpenPalette: openPalette, onOpenShortcuts: openShortcuts });

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 4_000_000) {
      // We resize via canvas before storing.
    }
    try {
      const raw = await readFileAsDataUrl(file);
      const resized = await downscaleImage(raw, 256);
      if (resized.length > MAX_PHOTO_BYTES) {
        const smaller = await downscaleImage(raw, 192);
        setStoredPhoto(smaller);
      } else {
        setStoredPhoto(resized);
      }
    } catch {
      // ignore
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const userSeed = user ? `${user.id}-${user.org}` : "PS";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <header className="border-b bg-card/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          {backTo ? (
            <Button variant="ghost" size="icon" asChild className="-ml-2">
              <Link to={backTo} aria-label="Back">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : null}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Pic Shift
            </span>
          </Link>

          <button
            type="button"
            onClick={openPalette}
            className="hidden md:flex items-center gap-2 ml-4 flex-1 max-w-md rounded-md border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-background transition-colors"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span>Search people, docs, or jump anywhere…</span>
            <kbd className="ml-auto hidden lg:inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={openPalette} aria-label="Search">
              <Search className="h-[1.1rem] w-[1.1rem]" />
            </Button>
            <ChangelogDrawer />
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                    <UserAvatar seed={userSeed} photoUrl={photo} className="h-8 w-8" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate">{user.org}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.roles.join(", ")}{user.mfa ? " • MFA" : ""}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); fileRef.current?.click(); }}>
                    <ImageIcon className="h-4 w-4 mr-2" /> Change photo
                  </DropdownMenuItem>
                  {photo ? (
                    <DropdownMenuItem onSelect={() => setStoredPhoto(null)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remove photo
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/settings/security")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Security & MFA
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      void logout().then(() => navigate("/auth"));
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickPhoto(e)}
            />
          </div>
        </div>
        {title ? (
          <div className="container mx-auto px-4 pb-4">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
          </div>
        ) : null}
      </header>

      <main className="container mx-auto px-4 py-6">{children}</main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onOpenShortcuts={openShortcuts} />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

async function downscaleImage(dataUrl: string, maxDim: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
