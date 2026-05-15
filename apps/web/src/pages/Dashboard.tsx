import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { Bot, Calendar, CalendarRange, FileText, ListChecks, Loader2, Network, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton-list";

interface Shift {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, hasAnyRole } = useAuth();
  const [shifts, setShifts] = useState<Shift[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;
    api.shifts.list().then(
      (res) => setShifts((res.shifts as Shift[]) ?? []),
      () => setShifts([]),
    );
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = hasAnyRole(["org_owner", "hr_admin", "payroll_admin", "super_admin"]);

  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isAdmin && <NavCard to="/employees" icon={<Users className="h-5 w-5" />} title="Employees" desc="Onboard, edit, and offboard staff" />}
        <NavCard to="/pto" icon={<Calendar className="h-5 w-5" />} title="Time off (PTO)" desc="Request leave, approve team requests" />
        <NavCard to="/team-calendar" icon={<CalendarRange className="h-5 w-5" />} title="Team calendar" desc="See who's off when" />
        <NavCard to="/documents" icon={<FileText className="h-5 w-5" />} title="Documents" desc="Payslips, contracts, tax forms" />
        <NavCard to="/assistant" icon={<Bot className="h-5 w-5" />} title="AI HR assistant" desc="Ask anything about your HR data" />
        {isAdmin && <NavCard to="/org-chart" icon={<Network className="h-5 w-5" />} title="Org chart" desc="People grouped by department" />}
        {isAdmin && <NavCard to="/audit" icon={<ListChecks className="h-5 w-5" />} title="Audit log" desc="Compliance trail (SOC 2 / Ghana DPA)" />}

        <Card className="md:col-span-2 lg:col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Upcoming shifts</CardTitle>
            <CardDescription>Next 30 days of scheduled work</CardDescription>
          </CardHeader>
          <CardContent>
            {shifts === null ? (
              <SkeletonList rows={3} />
            ) : shifts.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No shifts scheduled"
                description="Once shifts are created they'll appear here, ordered by start time."
                action={
                  isAdmin ? (
                    <Link to="/pto">
                      <Button variant="outline" size="sm">Manage schedule</Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y">
                {shifts.slice(0, 8).map((s) => (
                  <li key={s.id} className="py-2 flex justify-between">
                    <span>{s.title}</span>
                    <span className="text-muted-foreground text-sm">{new Date(s.startTime).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

function NavCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-medium transition-all cursor-pointer h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default Dashboard;
