import { useEffect, useState } from "react";
import { Bell, Sparkles, Wrench, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG, hasUnreadChangelog, markChangelogSeen } from "@/lib/changelog";

function TagIcon({ tag }: { tag?: "new" | "improved" | "fixed" }) {
  if (tag === "improved") return <Wrench className="h-3.5 w-3.5" />;
  if (tag === "fixed") return <Bug className="h-3.5 w-3.5" />;
  return <Sparkles className="h-3.5 w-3.5" />;
}

export function ChangelogDrawer() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(hasUnreadChangelog());

  useEffect(() => {
    const refresh = () => setUnread(hasUnreadChangelog());
    window.addEventListener("picshift:changelog-seen", refresh);
    return () => window.removeEventListener("picshift:changelog-seen", refresh);
  }, []);

  useEffect(() => {
    if (open && unread) {
      markChangelogSeen();
      setUnread(false);
    }
  }, [open, unread]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="What's new" className="relative">
          <Bell className="h-[1.1rem] w-[1.1rem]" />
          {unread ? (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>What&rsquo;s new</SheetTitle>
          <SheetDescription>Recent product updates in Pic Shift.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {CHANGELOG.map((entry) => (
            <article key={entry.date} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1">
                  <TagIcon tag={entry.tag} />
                  {entry.tag ?? "new"}
                </Badge>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <h3 className="font-semibold">{entry.title}</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {entry.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
