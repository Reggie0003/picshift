import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const G_MAP: Record<string, string> = {
  d: "/dashboard",
  p: "/pto",
  t: "/team-calendar",
  f: "/documents",
  a: "/assistant",
  o: "/org-chart",
  s: "/settings/security",
};

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function useGlobalShortcuts({
  onOpenPalette,
  onOpenShortcuts,
}: {
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}): void {
  const navigate = useNavigate();

  useEffect(() => {
    let gArmed = false;
    let gTimer: number | null = null;

    const disarmG = () => {
      gArmed = false;
      if (gTimer !== null) {
        window.clearTimeout(gTimer);
        gTimer = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      if (isEditable(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ? — cheat sheet
      if (e.key === "?") {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // G prefix
      if (!gArmed && e.key.toLowerCase() === "g") {
        gArmed = true;
        gTimer = window.setTimeout(disarmG, 1200);
        return;
      }
      if (gArmed) {
        const target = G_MAP[e.key.toLowerCase()];
        disarmG();
        if (target) {
          e.preventDefault();
          navigate(target);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      disarmG();
    };
  }, [navigate, onOpenPalette, onOpenShortcuts]);
}
