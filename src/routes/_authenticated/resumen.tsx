import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWeeklyDigest, listDigests } from "@/lib/collection.functions";

export const Route = createFileRoute("/_authenticated/resumen")({
  head: () => ({
    meta: [
      { title: "Resumen semanal · Cardtrack" },
      {
        name: "description",
        content: "Las cartas que más han subido y bajado en la última semana en Cardtrack.",
      },
      { property: "og:title", content: "Resumen semanal · Cardtrack" },
      {
        property: "og:description",
        content: "Las cartas que más han subido y bajado en la última semana en Cardtrack.",
      },
    ],
  }),
  component: DigestPage,
});

type Move = { name: string; from: number; to: number; pct: number };
type Summary = { cards: number; checks: number; risers: Move[]; fallers: Move[] };

function DigestPage() {
  const qc = useQueryClient();
  const digests = useQuery({ queryKey: ["digests"], queryFn: () => listDigests() });

  const build = useMutation({
    mutationFn: () => buildWeeklyDigest(),
    onSuccess: () => {
      toast.success("Resumen generado");
      qc.invalidateQueries({ queryKey: ["digests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = digests.data?.[0];
  const summary = latest ? (latest.summary as unknown as Summary) : null;

  return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Resumen semanal</h1>
            <p className="text-sm text-muted-foreground">
              Los movimientos más importantes de tus cartas en los últimos siete días.
            </p>
          </div>
          <Button onClick={() => build.mutate()} disabled={build.isPending}>
            <RefreshCw className={`size-4 ${build.isPending ? "animate-spin" : ""}`} />
            Generar resumen
          </Button>
        </header>

        {!summary && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Todavía no hay ningún resumen. Genera el primero cuando tengas varios días de precios
            guardados.
          </div>
        )}

        {summary && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="panel p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cartas seguidas</p>
                <p className="mt-1 font-display text-2xl font-semibold">{summary.cards}</p>
              </div>
              <div className="panel p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Consultas guardadas</p>
                <p className="mt-1 font-display text-2xl font-semibold">{summary.checks}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MoveList title="Más suben" moves={summary.risers} tone="up" />
              <MoveList title="Más bajan" moves={summary.fallers} tone="down" />
            </div>

            <p className="text-xs text-muted-foreground">
              Para recibir este resumen por correo hace falta conectar un servicio de envío de
              emails. Dímelo y lo dejamos listo.
            </p>
          </>
        )}
      </div>
  );
}

function MoveList({ title, moves, tone }: { title: string; moves: Move[]; tone: "up" | "down" }) {
  const Icon = tone === "up" ? ArrowUpRight : ArrowDownRight;
  const color = tone === "up" ? "text-emerald-400" : "text-destructive";
  return (
    <div className="panel p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {moves.length === 0 && (
          <li className="text-sm text-muted-foreground">Sin movimientos destacados.</li>
        )}
        {moves.map((m) => (
          <li key={m.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{m.name}</span>
            <span className={`flex shrink-0 items-center gap-1 ${color}`}>
              <Icon className="size-4" />
              {m.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
