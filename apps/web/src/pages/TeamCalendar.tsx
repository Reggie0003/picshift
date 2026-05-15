import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface PtoRequest {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  employeeName?: string;
}

const STATUS_COLOR: Record<string, string> = {
  approved: "bg-primary/15 text-primary border-primary/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const s = new Date(from);
  const e = new Date(to);
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  while (cur <= end) {
    out.push(isoDay(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function TeamCalendarPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [requests, setRequests] = useState<PtoRequest[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    Promise.all([
      api.pto.list({ status: "approved" }).then((r) => r.requests as PtoRequest[]).catch(() => []),
      api.pto.list({ status: "pending" }).then((r) => r.requests as PtoRequest[]).catch(() => []),
    ]).then(([a, p]) => setRequests([...a, ...p]));
  }, [user, loading, navigate]);

  const dayMap = useMemo(() => {
    const m = new Map<string, PtoRequest[]>();
    if (!requests) return m;
    for (const r of requests) {
      for (const d of eachDay(r.startDate, r.endDate)) {
        const arr = m.get(d) ?? [];
        arr.push(r);
        m.set(d, arr);
      }
    }
    return m;
  }, [requests]);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayIso = isoDay(new Date());

  return (
    <AppShell title="Team calendar" backTo="/dashboard" description="Approved and pending leave across your team.">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))} className="ml-2">
                Today
              </Button>
            </div>
            <h2 className="text-lg font-semibold">{monthLabel}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Approved</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pending</span>
            </div>
          </div>

          {requests === null ? (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<CalendarRange className="h-5 w-5" />}
              title="No leave scheduled"
              description="Approved and pending PTO will show up here."
            />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-xs text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="px-2 py-1 font-medium">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {grid.map((day) => {
                  const key = isoDay(day.date);
                  const entries = dayMap.get(key) ?? [];
                  return (
                    <div
                      key={key + day.inMonth}
                      className={`min-h-[80px] rounded-md border p-1.5 ${
                        day.inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground"
                      } ${key === todayIso ? "ring-2 ring-primary/50" : ""}`}
                    >
                      <div className="text-[11px] font-medium">{day.date.getDate()}</div>
                      <div className="mt-1 space-y-0.5">
                        {entries.slice(0, 2).map((r) => (
                          <div
                            key={r.id + key}
                            className={`truncate rounded px-1.5 py-0.5 text-[10px] border ${
                              STATUS_COLOR[r.status] ?? "bg-muted text-foreground border-border"
                            }`}
                            title={`${r.employeeName ?? "Employee"} — ${r.status}`}
                          >
                            {r.employeeName ?? "PTO"}
                          </div>
                        ))}
                        {entries.length > 2 ? (
                          <div className="text-[10px] text-muted-foreground px-1">+{entries.length - 2} more</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {requests && requests.length > 0 ? (
        <Card className="mt-6">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">All entries</h3>
            <ul className="divide-y">
              {requests
                .slice()
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm">
                        {new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}{" "}
                        <span className="text-muted-foreground">({r.daysRequested} day{r.daysRequested === 1 ? "" : "s"})</span>
                      </p>
                      {r.reason ? <p className="text-xs text-muted-foreground truncate">{r.reason}</p> : null}
                    </div>
                    <Badge variant="outline" className={STATUS_COLOR[r.status] ?? ""}>{r.status}</Badge>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}

function buildMonthGrid(cursor: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(cursor);
  // Monday-first: 0 (Sun) → 6, 1 (Mon) → 0
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
  }
  return days;
}
