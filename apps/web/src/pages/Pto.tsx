import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton-list";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { undoableAction } from "@/lib/undo";

interface Policy { id: string; name: string; category: string; defaultDaysPerYear: number; }
interface PtoReq { id: string; status: string; startDate: string; endDate: string; daysRequested: number; reason: string | null; }

export default function PtoPage() {
  const { hasAnyRole } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyId, setPolicyId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<PtoReq[] | null>(null);
  const isApprover = hasAnyRole(["manager", "hr_admin", "org_owner", "payroll_admin"]);

  useEffect(() => {
    api.pto.policies().then((r) => setPolicies(r.policies as Policy[])).catch(() => {});
    if (isApprover) {
      api.pto
        .list({ status: "pending" })
        .then((r) => setRequests((r.requests as PtoReq[]) ?? []))
        .catch(() => setRequests([]));
    }
  }, [isApprover]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyId || !startDate || !endDate || !employeeId) {
      toast.error("All fields required");
      return;
    }
    try {
      await api.pto.request({ employeeId, policyId, startDate, endDate, ...(reason ? { reason } : {}) });
      toast.success("PTO request submitted");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  };

  const decide = (id: string, decision: "approve" | "reject") => {
    const target = requests?.find((r) => r.id === id);
    if (!target) return;
    setRequests((cur) => (cur ?? []).filter((r) => r.id !== id));
    undoableAction({
      label: decision === "approve" ? "Request approved" : "Request rejected",
      description: "Undo within a few seconds to revert.",
      commit: () => api.pto.decide(id, { decision }),
      onUndo: () => setRequests((cur) => [target, ...(cur ?? [])]),
      onCommitError: () => setRequests((cur) => [target, ...(cur ?? [])]),
    });
  };

  return (
    <AppShell title="Time off (PTO)" backTo="/dashboard" description="Request leave or approve your team's requests.">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Request leave</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Employee ID</Label>
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="cuid of the employee profile" />
              </div>
              <div className="space-y-2">
                <Label>Policy</Label>
                <Select value={policyId} onValueChange={setPolicyId}>
                  <SelectTrigger><SelectValue placeholder="Select a policy" /></SelectTrigger>
                  <SelectContent>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button type="submit" className="md:col-span-2">Submit request</Button>
            </form>
          </CardContent>
        </Card>

        {isApprover && (
          <Card>
            <CardHeader><CardTitle>Pending approvals</CardTitle></CardHeader>
            <CardContent>
              {requests === null ? (
                <SkeletonList rows={3} />
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="Inbox zero"
                  description="No pending PTO requests right now. Nice."
                />
              ) : (
                <ul className="divide-y">
                  {requests.map((r) => (
                    <li key={r.id} className="py-3 flex justify-between items-center gap-4">
                      <div>
                        <p className="font-medium">
                          {new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}{" "}
                          ({r.daysRequested} day{r.daysRequested === 1 ? "" : "s"})
                        </p>
                        {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(r.id, "approve")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "reject")}>Reject</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
