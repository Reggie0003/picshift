import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton-list";

interface Entry { id: string; createdAt: string; action: string; entityType: string; actorId: string | null; ipAddress: string | null; }

export default function AuditPage() {
  const [items, setItems] = useState<Entry[] | null>(null);
  useEffect(() => {
    api.audit
      .list({ pageSize: 100 })
      .then((r) => setItems((r.items as Entry[]) ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <AppShell
      title="Audit log"
      backTo="/dashboard"
      description="Immutable record of every privileged action. Required for SOC 2, Ghana DPA, and NDPR compliance."
    >
      <Card>
        <CardHeader><CardTitle>Most recent events</CardTitle></CardHeader>
        <CardContent>
          {items === null ? (
            <SkeletonList rows={6} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" />}
              title="No audit entries yet"
              description="Every privileged action is logged here. Once events occur they cannot be edited or deleted."
            />
          ) : (
            <div className="text-xs font-mono divide-y">
              {items.map((i) => (
                <div key={i.id} className="py-2 grid grid-cols-5 gap-2">
                  <span>{new Date(i.createdAt).toLocaleString()}</span>
                  <span>{i.action}</span>
                  <span>{i.entityType}</span>
                  <span className="truncate">{i.actorId ?? "system"}</span>
                  <span>{i.ipAddress ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
