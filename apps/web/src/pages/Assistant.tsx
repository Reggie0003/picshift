import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app-shell";

const SAMPLE_QUESTIONS = [
  "How many PTO days do I have left?",
  "What is our maternity leave policy?",
  "Summarise this week's shifts",
];

export default function AssistantPage() {
  const [q, setQ] = useState("");
  const [a, setA] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.ai.ask(text);
      setA(r.answer);
      setModel(r.model);
    } catch (err) {
      setA(err instanceof Error ? err.message : "Assistant unavailable");
      setModel(null);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(q);
  };

  return (
    <AppShell title="AI HR assistant" backTo="/dashboard" description="Ask anything about your HR data, policies, or schedule.">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader><CardTitle>Ask a question</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submit} className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Try: "How many PTO days do I have?"' />
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
              </Button>
            </form>
            {!a ? (
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setQ(s);
                      void ask(s);
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            ) : null}
            {a && (
              <div className="border rounded p-4 bg-muted/30 whitespace-pre-wrap">
                <p>{a}</p>
                {model && <p className="mt-2 text-xs text-muted-foreground">via {model}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
