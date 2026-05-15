import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Calendar,
  CalendarRange,
  FileText,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Moon,
  Network,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface EmployeeHit {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
}
interface DocHit {
  id: string;
  filename: string;
  category: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenShortcuts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenShortcuts: () => void;
}) {
  const navigate = useNavigate();
  const { hasAnyRole, logout } = useAuth();
  const { setTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<EmployeeHit[]>([]);
  const [docs, setDocs] = useState<DocHit[]>([]);
  const [searching, setSearching] = useState(false);

  const isAdmin = hasAnyRole(["org_owner", "hr_admin", "payroll_admin", "super_admin"]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setEmployees([]);
      setDocs([]);
    }
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) {
      setEmployees([]);
      setDocs([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const promises: Promise<unknown>[] = [];
        if (isAdmin) {
          promises.push(
            api.employees
              .list({ q: term, pageSize: 5 })
              .then((r) => setEmployees((r.items as EmployeeHit[]) ?? []))
              .catch(() => setEmployees([])),
          );
        }
        promises.push(
          api.documents
            .list()
            .then((r) => {
              const all = (r.documents as DocHit[]) ?? [];
              const lc = term.toLowerCase();
              setDocs(all.filter((d) => d.filename.toLowerCase().includes(lc)).slice(0, 5));
            })
            .catch(() => setDocs([])),
        );
        await Promise.all(promises);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [query, open, isAdmin]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const navItems = useMemo(
    () => [
      { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard /> },
      { label: "Time off (PTO)", path: "/pto", icon: <Calendar /> },
      { label: "Team calendar", path: "/team-calendar", icon: <CalendarRange /> },
      { label: "Documents", path: "/documents", icon: <FileText /> },
      { label: "AI assistant", path: "/assistant", icon: <Bot /> },
      ...(isAdmin
        ? [
            { label: "Org chart", path: "/org-chart", icon: <Network /> },
            { label: "Employees", path: "/employees", icon: <Users /> },
            { label: "Audit log", path: "/audit", icon: <ListChecks /> },
          ]
        : []),
      { label: "Security & MFA", path: "/settings/security", icon: <ShieldCheck /> },
    ],
    [isAdmin],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search people, documents, or jump to a page…" value={query} onValueChange={setQuery} />
      <CommandList>
        {searching && query.length >= 2 ? (
          <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching…
          </div>
        ) : null}

        {!searching && query.length >= 2 && employees.length === 0 && docs.length === 0 ? (
          <CommandEmpty>No matches for &ldquo;{query}&rdquo;.</CommandEmpty>
        ) : null}

        {employees.length > 0 ? (
          <CommandGroup heading="People">
            {employees.map((e) => (
              <CommandItem
                key={e.id}
                value={`emp-${e.id}-${e.firstName} ${e.lastName}`}
                onSelect={() => go(`/employees/${e.id}`)}
              >
                <Users />
                <span className="ml-2">
                  {e.firstName} {e.lastName}
                </span>
                <CommandShortcut>{e.jobTitle ?? e.department ?? ""}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {docs.length > 0 ? (
          <CommandGroup heading="Documents">
            {docs.map((d) => (
              <CommandItem key={d.id} value={`doc-${d.id}-${d.filename}`} onSelect={() => go("/documents")}>
                <FileText />
                <span className="ml-2">{d.filename}</span>
                <CommandShortcut>{d.category}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {(employees.length > 0 || docs.length > 0) ? <CommandSeparator /> : null}

        <CommandGroup heading="Go to">
          {navItems.map((n) => (
            <CommandItem key={n.path} value={`go-${n.label}`} onSelect={() => go(n.path)}>
              {n.icon}
              <span className="ml-2">{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="theme-light" onSelect={() => { setTheme("light"); onOpenChange(false); }}>
            <Sun />
            <span className="ml-2">Light theme</span>
          </CommandItem>
          <CommandItem value="theme-dark" onSelect={() => { setTheme("dark"); onOpenChange(false); }}>
            <Moon />
            <span className="ml-2">Dark theme</span>
          </CommandItem>
          <CommandItem
            value="shortcuts"
            onSelect={() => {
              onOpenChange(false);
              onOpenShortcuts();
            }}
          >
            <Keyboard />
            <span className="ml-2">Keyboard shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="logout"
            onSelect={() => {
              onOpenChange(false);
              void logout().then(() => navigate("/auth"));
            }}
          >
            <LogOut />
            <span className="ml-2">Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
