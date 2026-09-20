import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCollection, importCards, updateCard } from "@/lib/collection.functions";

export const Route = createFileRoute("/_authenticated/coleccion")({
  head: () => ({
    meta: [
      { title: "Mi colección · Cardtrack" },
      {
        name: "description",
        content: "Valor total de tu colección, ganancias y chollos detectados por Cardtrack.",
      },
      { property: "og:title", content: "Mi colección · Cardtrack" },
      {
        property: "og:description",
        content: "Valor total de tu colección, ganancias y chollos detectados por Cardtrack.",
      },
    ],
  }),
  component: CollectionPage,
});

const eur = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

function CollectionPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [condition, setCondition] = useState("");
  const [language, setLanguage] = useState("");

  const collection = useQuery({ queryKey: ["collection"], queryFn: () => getCollection() });

  const update = useMutation({
    mutationFn: (v: {
      id: string;
      quantity?: number;
      purchase_price?: number | null;
      is_tracked?: boolean;
    }) => updateCard({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const importer = useMutation({
    mutationFn: (rows: { card_url: string }[]) => importCards({ data: { rows } }),
    onSuccess: (r) => {
      toast.success(`${r.imported} cartas importadas (${r.skipped} omitidas)`);
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = collection.data?.items ?? [];
  const totals = collection.data?.totals;

  const conditions = useMemo(
    () => [...new Set(items.map((i) => i.condition).filter(Boolean))] as string[],
    [items],
  );
  const languages = useMemo(
    () => [...new Set(items.map((i) => i.language).filter(Boolean))] as string[],
    [items],
  );

  const visible = items.filter(
    (i) =>
      (!onlyDeals || i.isDeal) &&
      (!condition || i.condition === condition) &&
      (!language || i.language === language),
  );

  const onFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0]?.toLowerCase() ?? "";
    const body = header.includes("url") ? lines.slice(1) : lines;
    const rows = body
      .map((line) => {
        const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
        const url = cells.find((c) => c.startsWith("http"));
        if (!url) return null;
        const qty = cells.map(Number).find((n) => Number.isInteger(n) && n > 0 && n < 1000);
        const price = cells
          .map((c) => Number(c.replace(",", ".")))
          .find((n) => Number.isFinite(n) && !Number.isInteger(n));
        return {
          card_url: url,
          quantity: qty ?? 1,
          purchase_price: price ?? null,
        };
      })
      .filter(Boolean) as { card_url: string }[];
    if (rows.length === 0) {
      toast.error("No he encontrado direcciones de Cardmarket en el archivo");
      return;
    }
    importer.mutate(rows);
  };

  return (
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Mi colección</h1>
            <p className="text-sm text-muted-foreground">
              Las cartas que tienes. El seguimiento de precios es aparte: activa «Seguir» en las
              que quieras vigilar y aparecerán en el Panel.
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Valor actual" value={eur(totals?.value ?? null)} />
          <Stat label="Coste de compra" value={eur(totals?.cost ?? null)} />
          <Stat
            label="Ganancia / pérdida"
            value={eur(totals?.pnl ?? null)}
            tone={(totals?.pnl ?? 0) >= 0 ? "up" : "down"}
            {...(typeof totals?.pnlPct === "number" ? { hint: `${totals.pnlPct.toFixed(1)}%` } : {})}
          />
          <Stat label="Chollos detectados" value={String(totals?.deals ?? 0)} />
        </section>

        <section className="panel p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant={onlyDeals ? "default" : "secondary"}
              onClick={() => setOnlyDeals((v) => !v)}
            >
              <Sparkles className="size-4" />
              Solo chollos
            </Button>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos los estados</option>
              {conditions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos los idiomas</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Carta</th>
                  <th className="py-2">Uds.</th>
                  <th className="py-2">Pagado</th>
                  <th className="py-2">Precio hoy</th>
                  <th className="py-2">Media</th>
                  <th className="py-2">Precio objetivo</th>
                  <th className="py-2">Ganancia</th>
                  <th className="py-2">Seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id} className="border-t border-border/60">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{i.name}</span>
                        {i.isDeal && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase text-primary">
                            chollo
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {[i.game, i.expansion, i.condition, i.language].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        defaultValue={i.quantity}
                        className="h-8 w-16"
                        onBlur={(e) =>
                          update.mutate({ id: i.id, quantity: Number(e.target.value) || 1 })
                        }
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={i.purchase_price ?? ""}
                        placeholder="—"
                        className="h-8 w-24"
                        onBlur={(e) =>
                          update.mutate({
                            id: i.id,
                            purchase_price: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td className="py-2">{eur(i.price)}</td>
                    <td className="py-2 text-muted-foreground">{eur(i.mean)}</td>
                    <td className="py-2 text-primary">{eur(i.suggested)}</td>
                    <td className="py-2">
                      {i.pnl === null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            i.pnl >= 0 ? "text-emerald-400" : "text-destructive"
                          }
                        >
                          {eur(i.pnl)}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant={i.is_tracked ? "default" : "secondary"}
                        onClick={() => update.mutate({ id: i.id, is_tracked: !i.is_tracked })}
                      >
                        {i.is_tracked ? "Siguiendo" : "Seguir"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay cartas que mostrar con estos filtros.
              </p>
            )}
          </div>
        </section>
      </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "up" | "down" | undefined;
}) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          tone === "up" ? "text-emerald-400" : tone === "down" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {tone === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {hint}
        </p>
      )}
    </div>
  );
}
