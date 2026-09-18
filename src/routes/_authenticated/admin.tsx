import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminStats, getMe, listUsers, saveAppSettings, setUserRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración · Cardtrack" },
      { name: "description", content: "Controla el scraping, los permisos y los usuarios de Cardtrack." },
      { property: "og:title", content: "Administración · Cardtrack" },
      { property: "og:description", content: "Controla el scraping, los permisos y los usuarios de Cardtrack." },
    ],
  }),
  component: AdminPage,
});

type AppSettings = {
  debug_mode: boolean;
  allow_direct_fetch: boolean;
  allow_fallback_scraper: boolean;
  scraping_enabled: boolean;
  allow_scanner: boolean;
  max_cards_per_user: number;
  min_refresh_interval_minutes: number;
  max_requests_per_minute: number;
};

function AdminPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const isAdmin = me.data?.isAdmin ?? false;

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminStats(),
    enabled: isAdmin,
  });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: isAdmin,
  });

  const [form, setForm] = useState<AppSettings | null>(null);
  useEffect(() => {
    if (me.data?.app && !form) {
      const a = me.data.app;
      setForm({
        debug_mode: a.debug_mode,
        allow_direct_fetch: a.allow_direct_fetch,
        allow_fallback_scraper: a.allow_fallback_scraper,
        scraping_enabled: a.scraping_enabled,
        allow_scanner: a.allow_scanner,
        max_cards_per_user: a.max_cards_per_user,
        min_refresh_interval_minutes: a.min_refresh_interval_minutes,
        max_requests_per_minute: a.max_requests_per_minute,
      });
    }
  }, [me.data, form]);

  const save = useMutation({
    mutationFn: (values: AppSettings) => saveAppSettings({ data: values }),
    onSuccess: () => {
      toast.success("Ajustes globales guardados");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const role = useMutation({
    mutationFn: (v: { userId: string; admin: boolean }) => setUserRole({ data: v }),
    onSuccess: () => {
      toast.success("Permisos actualizados");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (me.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="panel mx-auto max-w-md p-8 text-center">
          <ShieldOff className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-semibold">Zona restringida</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Solo los administradores pueden ver esta página.
          </p>
        </div>
      </AppShell>
    );
  }

  const s = stats.data;

  return (
    <AppShell>
      <div className="space-y-8">
        <header>
          <h1 className="font-display text-2xl font-semibold">Administración</h1>
          <p className="text-sm text-muted-foreground">
            Controla qué se permite hacer en la aplicación y quién puede hacerlo.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Consultas (24 h)", value: s?.last24h.total ?? "—" },
            { label: "Con éxito", value: s?.last24h.ok ?? "—" },
            { label: "Bloqueadas", value: s?.last24h.blocked ?? "—" },
            { label: "Proxies vivos", value: s ? `${s.proxies.alive}/${s.proxies.total}` : "—" },
          ].map((c) => (
            <div key={c.label} className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
            </div>
          ))}
        </section>

        {form && (
          <section className="panel space-y-5 p-6">
            <h2 className="font-display text-lg font-semibold">Permisos del motor</h2>

            <Toggle
              label="Consultas de precios activas"
              hint="Si lo desactivas, nadie puede lanzar consultas a Cardmarket."
              checked={form.scraping_enabled}
              onChange={(v) => setForm({ ...form, scraping_enabled: v })}
            />
            <Toggle
              label="Modo depuración"
              hint="Necesario para habilitar el acceso directo sin proxy."
              checked={form.debug_mode}
              onChange={(v) => setForm({ ...form, debug_mode: v })}
            />
            <Toggle
              label="Acceso directo sin proxy"
              hint="Solo funciona para administradores y con el modo depuración activo. Expone tu IP real."
              checked={form.allow_direct_fetch}
              onChange={(v) => setForm({ ...form, allow_direct_fetch: v })}
            />
            <Toggle
              label="Servicio de respaldo"
              hint="Permite usar el extractor externo cuando los proxies fallan."
              checked={form.allow_fallback_scraper}
              onChange={(v) => setForm({ ...form, allow_fallback_scraper: v })}
            />
            <Toggle
              label="Escáner con cámara"
              checked={form.allow_scanner}
              onChange={(v) => setForm({ ...form, allow_scanner: v })}
            />

            {form.allow_direct_fetch && form.debug_mode && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                El acceso directo revela la dirección del servidor a Cardmarket. Úsalo solo para
                comprobar fallos y desactívalo después.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Máx. cartas por usuario"
                value={form.max_cards_per_user}
                onChange={(v) => setForm({ ...form, max_cards_per_user: v })}
              />
              <NumberField
                label="Intervalo mínimo (min)"
                value={form.min_refresh_interval_minutes}
                onChange={(v) => setForm({ ...form, min_refresh_interval_minutes: v })}
              />
              <NumberField
                label="Máx. consultas / minuto"
                value={form.max_requests_per_minute}
                onChange={(v) => setForm({ ...form, max_requests_per_minute: v })}
              />
            </div>

            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar ajustes globales"}
            </Button>
          </section>
        )}

        <section className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Usuarios</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Correo</th>
                  <th className="py-2">Cartas</th>
                  <th className="py-2">Permiso</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => {
                  const admin = u.roles.includes("admin");
                  return (
                    <tr key={u.id} className="border-t border-border/60">
                      <td className="py-2">{u.email ?? u.display_name ?? u.id.slice(0, 8)}</td>
                      <td className="py-2">{u.cardCount}</td>
                      <td className="py-2">
                        <span
                          className={
                            admin
                              ? "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {admin && <ShieldCheck className="size-3" />}
                          {admin ? "Administrador" : "Usuario"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant={admin ? "ghost" : "secondary"}
                          disabled={role.isPending}
                          onClick={() => role.mutate({ userId: u.id, admin: !admin })}
                        >
                          {admin ? "Quitar admin" : "Hacer admin"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(users.data ?? []).length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Todavía no hay usuarios.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
