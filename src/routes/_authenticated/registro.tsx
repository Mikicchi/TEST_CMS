import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLogs } from "@/lib/tracker.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/registro")({
  head: () => ({
    meta: [
      { title: "Registro de consultas — Cardtrack" },
      {
        name: "description",
        content: "Historial de consultas a Cardmarket: proxy usado, resultado y errores.",
      },
      { property: "og:title", content: "Registro de consultas — Cardtrack" },
      { property: "og:description", content: "Qué se consultó, con qué proxy y si funcionó." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogsPage,
});

const methodLabel: Record<string, string> = {
  proxy: "Proxy",
  direct: "Directo",
  fallback: "Respaldo",
};

function LogsPage() {
  const fetchLogs = useServerFn(listLogs);
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["logs"], queryFn: () => fetchLogs() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Registro</h1>
        <p className="text-sm text-muted-foreground">Últimas 100 consultas realizadas.</p>
      </div>

      <section className="panel overflow-x-auto">
        {isLoading ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : logs.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aún no se ha consultado nada.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Vía</th>
                <th className="px-4 py-3">Proxy</th>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("es-ES")}
                  </td>
                  <td className="px-4 py-2">{methodLabel[l.method] ?? l.method}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.proxy_label ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        l.status === "ok"
                          ? "default"
                          : l.status === "blocked"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {l.status === "ok" ? "Correcto" : l.status === "blocked" ? "Bloqueo" : "Error"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {l.duration_ms ? `${l.duration_ms} ms` : "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">
                    {l.message ?? "—"}
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
