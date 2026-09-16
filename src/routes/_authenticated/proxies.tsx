import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Gauge } from "lucide-react";
import { listProxies, refreshProxies, testProxies } from "@/lib/tracker.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/proxies")({
  head: () => ({
    meta: [
      { title: "Proxies — Cardtrack" },
      {
        name: "description",
        content: "Lista de proxies gratuitos, estado de cada uno y rotación automática.",
      },
      { property: "og:title", content: "Proxies — Cardtrack" },
      { property: "og:description", content: "Estado y rotación de la lista de proxies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProxiesPage,
});

const statusLabel: Record<string, string> = {
  alive: "Funciona",
  slow: "Lento",
  dead: "Caído",
  banned: "Bloqueado",
  unknown: "Sin probar",
};

function ProxiesPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listProxies);
  const refresh = useServerFn(refreshProxies);
  const test = useServerFn(testProxies);

  const { data: proxies = [], isLoading } = useQuery({
    queryKey: ["proxies"],
    queryFn: () => fetchList(),
  });

  const refreshMutation = useMutation({
    mutationFn: () => refresh({ data: undefined }),
    onSuccess: (r) => {
      toast.success(`${r.imported} proxies descargados.`);
      qc.invalidateQueries({ queryKey: ["proxies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { limit: 20 } }),
    onSuccess: (r) => {
      toast.success(`${r.tested} probados · ${r.alive} funcionan · ${r.dead} caídos`);
      qc.invalidateQueries({ queryKey: ["proxies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = proxies.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Proxies</h1>
          <p className="text-sm text-muted-foreground">
            Lista pública de free-proxy-list.net. Se rota automáticamente al fallar o al detectar un
            bloqueo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
          >
            <Gauge className="size-4" />
            Probar 20
          </Button>
          <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
            <Download className="size-4" />
            Descargar lista
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {["alive", "slow", "unknown", "dead", "banned"].map((s) => (
          <div key={s} className="panel p-4">
            <p className="text-xs text-muted-foreground">{statusLabel[s]}</p>
            <p className="text-2xl font-semibold">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <section className="panel overflow-x-auto">
        {isLoading ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : proxies.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay proxies. Pulsa «Descargar lista».
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Dirección</th>
                <th className="px-4 py-3">País</th>
                <th className="px-4 py-3">Anonimato</th>
                <th className="px-4 py-3">HTTPS</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Latencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proxies.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono text-xs">
                    {p.ip}:{p.port}
                  </td>
                  <td className="px-4 py-2">{p.country_name ?? p.country_code ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.anonymity ?? "—"}</td>
                  <td className="px-4 py-2">{p.supports_https ? "Sí" : "No"}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        p.status === "alive"
                          ? "default"
                          : p.status === "slow"
                            ? "secondary"
                            : p.status === "unknown"
                              ? "outline"
                              : "destructive"
                      }
                    >
                      {statusLabel[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {p.latency_ms ? `${p.latency_ms} ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
