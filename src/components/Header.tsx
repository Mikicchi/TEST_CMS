import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Bell, User, Spade } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export function Header({ onSidebarToggle }: { onSidebarToggle: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
      <header className="flex h-14 items-center justify-between border-b border-border/70 glass-panel px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarToggle}
          className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-4" />
        </Button>
        <Link to="/panel" className="flex items-center gap-2 overflow-hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Spade className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Cardtrack
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className="relative h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-4" />
          {/* Badge placeholder */}
          {false && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              3
            </span>
          )}
        </Button>

        {/* User Menu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="relative h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {me.data ? (
            <img
              src={me.data.avatar_url || "/default-avatar.png"}
              alt="User avatar"
              className="size-6 rounded-full object-cover"
            />
          ) : (
            <User className="size-5" />
          )}
        </Button>

        {/* User Menu Dropdown */}
        {userMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-popover p-1 shadow-lg border border-border/50 z-50">
            <div className="py-1">
              {me.data ? (
                <>
                  <div className="flex items-center gap-3 px-2 text-sm">
                    <img
                      src={me.data.avatar_url || "/default-avatar.png"}
                      alt="User"
                      className="size-6 rounded-full"
                    />
                    <div>
                      <div className="font-medium">{me.data.name || me.data.email}</div>
                      <div className="text-xs text-muted-foreground">{me.data.role || "User"}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-2 text-sm text-muted-foreground">Cargando...</div>
              )}
            </div>
            <div className="divider"></div>
            <Button
              variant="ghost"
              onClick={signOut}
              className="w-full justify-start px-3 text-sm text-destructive"
            >
              Salir
            </Button>
          </div>
        )}

        {/* Notifications Dropdown */}
        {notificationsOpen && (
          <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-md bg-popover p-1 shadow-lg border border-border/50 z-50">
            <div className="py-1">
              <div className="px-2 text-sm font-medium">Notificaciones</div>
              <div className="divider"></div>
              {/* Placeholder for notifications */}
              <div className="px-2 py-1 text-sm text-muted-foreground">
                No hay notificaciones
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}