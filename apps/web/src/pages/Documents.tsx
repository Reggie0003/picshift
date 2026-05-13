import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface Doc { id: string; filename: string; category: string; createdAt: string; scanStatus: string; }

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => { api.documents.list().then((r) => setDocs(r.documents as Doc[])).catch(() => {}); }, []);

  const download = async (id: string) => {
    try {
      const r = await api.documents.download(id);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="min-h-screen container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Link to="/dashboard"><Button variant="outline">Back</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Your documents</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? <p className="text-muted-foreground">No documents.</p>
            : <ul className="divide-y">{docs.map((d) => (
                <li key={d.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{d.filename}</p>
                    <p className="text-sm text-muted-foreground">{d.category} • {new Date(d.createdAt).toLocaleDateString()} • {d.scanStatus}</p>
                  </div>
                  <Button size="sm" onClick={() => void download(d.id)}>Download</Button>
                </li>
              ))}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}
