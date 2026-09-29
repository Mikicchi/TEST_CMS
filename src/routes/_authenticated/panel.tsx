import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { addCard, deleteCard, listCards, runScrape } from "@/lib/tracker.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel de precios — Cardtrack" },
      {
        name: "description",
        content: "Tendencias, cartas seguidas y las diez más baratas de tu colección.",
      },
      { property: "og:title", content: "Panel de precios — Cardtrack" },
      { property: "og:description", content: "Tendencias y precios de tus cartas de Cardmarket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Panel,
});

const GAMES = ["Magic", "Riftbound"];

function eur(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(2)} €`;
}

function Panel() {
  const qc = useQueryClient();
  const fetchCards = useServerFn(listCards);
  const add = useServerFn(addCard);
  const remove = useServerFn(deleteCard);
  const run = useServerFn(runScrape);


  const [url, setUrl] = useState("");
  const [game, setGame] = useState(GAMES[0]!);
  const [target, setTarget] = useState("");
  const [gameFilter, setGameFilter] = useState("todos");
  const [expansionFilter, setExpansionFilter] = useState("todas");


  const cardsQuery = useQuery({ queryKey: ["cards"], queryFn: () => fetchCards() });
  const cards = cardsQuery.data ?? [];


  const addMutation = useMutation({
    mutationFn: () =>
      add({
        data: {
          card_url: url.trim(),
          game,
          target_price: target ? Number(target) : null,
        },
      }),
    onSuccess: () => {
      setUrl("");
      setTarget("");
      toast.success("Carta añadida. Pulsa «Actualizar precios» para leerla.");
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const runMutation = useMutation({
    mutationFn: () => run({ data: { cardId: null } }),
    onSuccess: (res) => {
      const ok = res.results.filter((r) => r.ok).length;
      const failed = res.results.length - ok;
      if (res.results.length === 0) toast.info("No hay cartas activas que actualizar.");
      else if (failed === 0) toast.success(`${ok} cartas actualizadas.`);
      else toast.warning(`${ok} actualizadas, ${failed} fallaron. Mira el registro.`);
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] });
  });


  const expansions = useMemo(
    () => Array.from(new Set(cards.map((c) => c.expansion).filter(Boolean))) as string[],
    [cards],
  );


  const filtered = cards.filter(
    (c) =>
      (gameFilter === "todos" || c.game === gameFilter) &&
      (expansionFilter === "todas" || c.expansion === expansionFilter),
  );


  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const card of filtered.slice(0, 5)) {
      for (const p of card.points) {
        const day = new Date(p.captured_at).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        });
        const row = byDate.get(day) ?? { day };
        if (p.price_from !== null) row[card.name.slice(0, 22)] = Number(p.price_from);
        byDate.set(day, row);
      }
    }
    return Array.from(byDate.values());
  }, [filtered]);


  const series = filtered.slice(0, 5).map((c) => c.name.slice(0, 22));
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];


  const cheapest = [...filtered]
    .filter((c) => c.latest?.price_from !== null && c.latest?.price_from !== undefined)
    .sort((a, b) => Number(a.latest!.price_from) - Number(b.latest!.price_from))
    .slice(0, 10);


  const watchlist = [...filtered]
    .filter((c) => c.changePct !== null)
    .sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))
    .slice(0, 5);


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Panel</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} cartas en seguimiento · Magic y Riftbound
          </p>
        </div>
        <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          <RefreshCw className={runMutation.isPending ? "size-4 animate-spin" : "size-4"} />
          Actualizar precios
        </Button>
      </div>

      <section className="panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Añadir carta</h2>
        <form
          className="grid gap-4 md:grid-cols-[1fr_180px_160px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="url">Dirección en Cardmarket</Label>
            <Input
              id="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.cardmarket.com/es/Magic/Products/Singles/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Juego</Label>
            <Select value={game} onValueChange={setGame}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAMES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="target">Precio objetivo</Label>
            <Input
              id="target"
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="12.50"
            />
          </div>
          <Button type="submit" className="self-end" disabled={addMutation.isPending}>
            <Plus className="size-4" />
            Añadir
          </Button>
        </form>
      </section>

      <div className="flex flex-wrap gap-3">
        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Juego" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los juegos</SelectItem>
            {GAMES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={expansionFilter} onValueChange={setExpansionFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Expansión" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las expansiones</SelectItem>
            {expansions.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Evolución de precios</h2>
          {chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Todavía no hay histórico. Añade cartas y pulsa «Actualizar precios».
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} unit=" €" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    color: "var(--popover-foreground)",
                  }}
                />
                {series.map((s, i) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    stroke={colors[i % colors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="mb-4 text-lg font-semibold">Top 10 más baratas</h2>
          {cheapest.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin precios todavía.</p>
          ) : (
            <ol className="space-y-3">
              {cheapest.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-medium text-primary">{eur(c.latest?.price_from)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {watchlist.length > 0 && (
        <section className="panel p-6">
          <h2 className="mb-4 text-lg font-semibold">Cartas a seguir</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {watchlist.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.expansion ?? c.game}</p>
                <p
                  className={
                    c.direction === "up"
                      ? "mt-2 text-lg font-semibold text-destructive"
                      : c.direction === "down"
                        ? "mt-2 text-lg font-semibold text-success"
                        : "mt-2 text-lg font-semibold"
                  }
                >
                  {c.changePct! > 0 ? "+" : ""}
                  {c.changePct!.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel overflow-hidden">
        <h2 className="border-b border-border px-6 py-4 text-lg font-semibold">Mis cartas</h2>
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No hay cartas con estos filtros.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <a
                    href={c.card_url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium hover:text-primary"
                  >
                    {c.name}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {c.game}
                    {c.expansion ? ` · ${c.expansion}` : ""}
                    {c.last_error ? ` · ${c.last_error}` : ""}
                  </p>
                </div>
                <Badge variant="outline">{eur(c.latest?.price_from)}</Badge>
                <span className="flex items-center gap-1 text-sm">
                  {c.direction === "up" ? (
                    <ArrowUpRight className="size-4 text-destructive" />
                  ) : c.direction === "down" ? (
                    <ArrowDownRight className="size-4 text-success" />
                  ) : (
                    <ArrowRight className="size-4 text-muted-foreground" />
                  )}
                  {c.changePct === null ? "sin datos" : `${c.changePct.toFixed(1)}%`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(c.id)}
                  aria-label={`Eliminar ${c.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}