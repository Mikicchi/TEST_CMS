import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Network,
  ScrollText,
  Settings2,
  LogOut,
  Spade,
  Wallet,
  ScanLine,
  CalendarRange,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/coleccion", label: "Colección", icon: Wallet },
  { to: "/escaner", label: "Escáner", icon: ScanLine },
  { to: "/resumen", label: "Resumen", icon: CalendarRange },
  { to: "/proxies", label: "Proxies", icon: Network },
  { to: "/registro", label: "Registro", icon: ScrollText },
  { to: "/ajustes", label: "Ajustes", icon: Settings2 },
] as const;

export function Sidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-border/70 bg-sidebar/95 backdrop-blur transition-transform duration-300 ease-in-out glass-panel",
          open ? "w-64" : "w-20",
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link to="/panel" className="flex items-center gap-2 overflow-hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Spade className="size-4" />
          </span>
          <span
            className={cn(
              "font-display text-lg font-semibold tracking-tight text-sidebar-foreground transition-opacity",
              !open && "opacity-0",
            )}
          >
            Cardtrack
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(!open)}
          className="ml-auto h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {nav.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span
                className={cn(
                  "truncate transition-opacity",
                  !open && "opacity-0",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {me.data?.isAdmin && (
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              location.pathname === "/admin"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-primary hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            <ShieldCheck className="size-5 shrink-0" />
            <span
              className={cn(
                "truncate transition-opacity",
                !open && "opacity-0",
              )}
            >
              Admin
            </span>
          </Link>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start gap-3 px-3 text-sm font-medium text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <LogOut className="size-5 shrink-0" />
          <span className={cn("transition-opacity", !open && "opacity-0")}>Salir</span>
        </Button>
      </div>
    </aside>
  );
}