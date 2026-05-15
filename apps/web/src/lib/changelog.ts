export interface ChangelogEntry {
  date: string;
  title: string;
  bullets: string[];
  tag?: "new" | "improved" | "fixed";
}

/**
 * Update this list when shipping user-visible changes.
 * The newest version's `date` doubles as the "unread badge" key.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-14",
    title: "UX bundle: command palette, dark mode, shortcuts, more",
    tag: "new",
    bullets: [
      "Command palette (⌘K / Ctrl+K) — jump to any page, search employees & documents",
      "Dark mode + system theme detection",
      "Keyboard shortcuts: press ? to view the cheat sheet",
      "Profile photo (with initials fallback) and a unified app header",
      "Org chart (department-grouped) and a team PTO calendar",
      "Undo toasts on destructive actions (6-second grace window)",
      "Skeleton loaders and empty-state CTAs on Dashboard, PTO, and Documents",
    ],
  },
  {
    date: "2026-04-01",
    title: "Phase 1 foundation",
    tag: "new",
    bullets: [
      "Multi-tenant auth with Argon2id + TOTP MFA",
      "Employees, PTO, shifts, documents, audit modules",
      "Ghana DPA / NDPR / GDPR compliance scaffolding",
    ],
  },
];

const LAST_SEEN_KEY = "picshift.changelog.lastSeen";

export function lastSeenDate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SEEN_KEY);
}

export function markChangelogSeen(): void {
  if (typeof window === "undefined") return;
  const latest = CHANGELOG[0]?.date;
  if (latest) localStorage.setItem(LAST_SEEN_KEY, latest);
  window.dispatchEvent(new CustomEvent("picshift:changelog-seen"));
}

export function hasUnreadChangelog(): boolean {
  const latest = CHANGELOG[0]?.date;
  if (!latest) return false;
  return lastSeenDate() !== latest;
}
