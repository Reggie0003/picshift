import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Network, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCards } from "@/components/skeleton-list";
import { UserAvatar, initialsFor } from "@/components/user-avatar";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
}

export default function OrgChartPage() {
  const navigate = useNavigate();
  const { user, loading, hasAnyRole } = useAuth();
  const [items, setItems] = useState<EmployeeRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    if (!hasAnyRole(["org_owner", "hr_admin", "manager", "super_admin"])) {
      navigate("/dashboard");
      return;
    }
    api.employees
      .list({ pageSize: 200 })
      .then((r) => setItems((r.items as EmployeeRow[]) ?? []))
      .catch(() => setItems([]));
  }, [user, loading, navigate, hasAnyRole]);

  const grouped = useMemo(() => {
    if (!items) return null;
    const lc = query.trim().toLowerCase();
    const filtered = lc
      ? items.filter(
          (e) =>
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(lc) ||
            (e.jobTitle ?? "").toLowerCase().includes(lc) ||
            (e.department ?? "").toLowerCase().includes(lc),
        )
      : items;

    const map = new Map<string, EmployeeRow[]>();
    for (const e of filtered) {
      const key = e.department ?? "Unassigned";
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, query]);

  return (
    <AppShell
      title="Org chart"
      backTo="/dashboard"
      description="People grouped by department. Manager hierarchy will appear once managerId is exposed by the API."
    >
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, role, or department"
          className="pl-9"
        />
      </div>

      {items === null ? (
        <SkeletonCards count={6} />
      ) : grouped && grouped.length === 0 ? (
        <EmptyState
          icon={<Network className="h-5 w-5" />}
          title={query ? "No matches" : "No employees yet"}
          description={
            query
              ? "Try a different name, role, or department."
              : "Add employees via the API or admin interface to populate the org chart."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grouped?.map(([dept, members]) => (
            <Card key={dept}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{dept}</CardTitle>
                <Badge variant="secondary">{members.length}</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {members.map((m) => {
                    const fullName = `${m.firstName} ${m.lastName}`.trim();
                    return (
                      <li key={m.id} className="flex items-center gap-3">
                        <UserAvatar seed={fullName || initialsFor(m.id)} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{fullName || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.jobTitle ?? "—"}
                            {m.status && m.status !== "active" ? ` • ${m.status}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
