import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface Entry { id: string; createdAt: string; action: string; entityType: string; actorId: string | null; ipAddress: string | null; }

export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  useEffect(() => { api.audit.list({ pageSize: 100 }).then((r) => setItems(r.items as Entry[])).catch(() => {}); }, []);
  return (
    <div className="min-h-screen container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Audit log</h1>
        <Link to="/dashboard"><Button variant="outline">Back</Button></Link>
      </div>
      <p className="text-sm text-muted-foreground">Immutable record of every privileged action. Required for SOC 2 + Ghana DPA + NDPR compliance.</p>
      <Card>
        <CardHeader><CardTitle>Most recent events</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xs font-mono divide-y">
            {items.map((i) => (
              <div key={i.id} className="py-2 grid grid-cols-5 gap-2">
                <span>{new Date(i.createdAt).toLocaleString()}</span>
                <span>{i.action}</span>
                <span>{i.entityType}</span>
                <span>{i.actorId ?? "system"}</span>
                <span>{i.ipAddress ?? ""}</span>
              </div>
            ))}
            {items.length === 0 && <p className="text-muted-foreground py-3">No audit entries yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
