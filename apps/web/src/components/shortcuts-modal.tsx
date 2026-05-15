import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["Ctrl", "K"], label: "Open command palette (Windows / Linux)" },
  { keys: ["?"], label: "Show this cheat sheet" },
  { keys: ["G", "D"], label: "Go to Dashboard" },
  { keys: ["G", "P"], label: "Go to PTO" },
  { keys: ["G", "T"], label: "Go to Team calendar" },
  { keys: ["G", "F"], label: "Go to Documents" },
  { keys: ["G", "A"], label: "Go to AI assistant" },
  { keys: ["G", "O"], label: "Go to Org chart" },
  { keys: ["G", "S"], label: "Go to Security" },
  { keys: ["Esc"], label: "Close dialog / palette" },
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded border bg-muted text-muted-foreground text-[11px] font-medium">
      {children}
    </kbd>
  );
}

export function ShortcutsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Tap two keys in sequence for &ldquo;G&rdquo; combos.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between py-2">
              <span className="text-sm">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <Key key={i}>{k}</Key>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
