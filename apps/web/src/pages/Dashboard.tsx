import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { Loader2, LogOut, Users, Calendar, FileText, ShieldCheck, Bot, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Shift {
  id: string; title: string; startTime: string; endTime: string; status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, logout, hasAnyRole } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);

  useEffect(() => {
    if (!loading && !user) { navigate("/auth"); return; }
    if (!user) return;
    api.shifts.list().then(
      (res) => { setShifts((res.shifts as Shift[]) ?? []); setLoadingShifts(false); },
      () => setLoadingShifts(false),
    );
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isAdmin = hasAnyRole(["org_owner", "hr_admin", "payroll_admin", "super_admin"]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Pic Shift</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.roles.join(", ")} {user.mfa ? "• MFA" : ""}</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings/security")}><ShieldCheck className="h-4 w-4 mr-1" /> Security</Button>
            <Button variant="outline" size="sm" onClick={() => { void logout().then(() => navigate("/auth")); }}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isAdmin && <NavCard to="/employees" icon={<Users className="h-5 w-5" />} title="Employees" desc="Onboard, edit, and offboard staff" />}
        <NavCard to="/pto" icon={<Calendar className="h-5 w-5" />} title="Time off (PTO)" desc="Request leave, approve team requests" />
        <NavCard to="/documents" icon={<FileText className="h-5 w-5" />} title="Documents" desc="Payslips, contracts, tax forms" />
        <NavCard to="/assistant" icon={<Bot className="h-5 w-5" />} title="AI HR assistant" desc="Ask anything about your HR data" />
        {isAdmin && <NavCard to="/audit" icon={<ListChecks className="h-5 w-5" />} title="Audit log" desc="Compliance trail (SOC 2 / Ghana DPA)" />}

        <Card className="md:col-span-2 lg:col-span-3 shadow-soft">
          <CardHeader>
            <CardTitle>Upcoming shifts</CardTitle>
            <CardDescription>Next 30 days of scheduled work</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingShifts ? <Loader2 className="h-5 w-5 animate-spin" />
              : shifts.length === 0 ? <p className="text-muted-foreground">No shifts scheduled.</p>
              : <ul className="divide-y">{shifts.slice(0, 8).map((s) => (
                  <li key={s.id} className="py-2 flex justify-between">
                    <span>{s.title}</span>
                    <span className="text-muted-foreground text-sm">{new Date(s.startTime).toLocaleString()}</span>
                  </li>
                ))}</ul>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

function NavCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-medium transition-all cursor-pointer h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default Dashboard;
