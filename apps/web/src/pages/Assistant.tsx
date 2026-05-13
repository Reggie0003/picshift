import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export default function AssistantPage() {
  const [q, setQ] = useState("");
  const [a, setA] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await api.ai.ask(q);
      setA(r.answer);
      setModel(r.model);
    } catch (err) {
      setA(err instanceof Error ? err.message : "Assistant unavailable");
      setModel(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen container mx-auto p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI HR assistant</h1>
        <Link to="/dashboard"><Button variant="outline">Back</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Ask a question</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Try: "How many PTO days do I have?"' />
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}</Button>
          </form>
          {a && (
            <div className="border rounded p-4 bg-muted/30 whitespace-pre-wrap">
              <p>{a}</p>
              {model && <p className="mt-2 text-xs text-muted-foreground">via {model}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
