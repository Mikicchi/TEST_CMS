import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Network, ScrollText, Settings2, LogOut, Spade } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/proxies", label: "Proxies", icon: Network },
  { to: "/registro", label: "Registro", icon: ScrollText },
  { to: "/ajustes", label: "Ajustes", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <Link to="/panel" className="mr-4 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Spade className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Cardtrack</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" />
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
