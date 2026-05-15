import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton-list";

interface Doc { id: string; filename: string; category: string; createdAt: string; scanStatus: string; }

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  useEffect(() => {
    api.documents
      .list()
      .then((r) => setDocs((r.documents as Doc[]) ?? []))
      .catch(() => setDocs([]));
  }, []);

  const download = async (id: string) => {
    try {
      const r = await api.documents.download(id);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <AppShell title="Documents" backTo="/dashboard" description="Payslips, contracts, tax forms and other uploads.">
      <Card>
        <CardHeader><CardTitle>Your documents</CardTitle></CardHeader>
        <CardContent>
          {docs === null ? (
            <SkeletonList rows={4} />
          ) : docs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No documents yet"
              description="Documents uploaded for you (payslips, contracts, tax forms) will appear here."
            />
          ) : (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{d.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.category} • {new Date(d.createdAt).toLocaleDateString()} • {d.scanStatus}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void download(d.id)}>Download</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
