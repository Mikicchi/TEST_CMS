import { createFileRoute, Link } from "@tanstack/react-router";
import { Spade, LineChart, Network, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardtrack — Sigue los precios de tus cartas en Cardmarket" },
      {
        name: "description",
        content:
          "Añade tus cartas, detecta si suben o bajan de precio, consulta tendencias por expansión y recibe avisos cuando toque comprar.",
      },
      { property: "og:title", content: "Cardtrack — Precios de Cardmarket bajo control" },
      {
        property: "og:description",
        content: "Seguimiento automático de precios de cartas con rotación de proxies y avisos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Network,
    title: "Proxies rotativos",
    text: "Lista de proxies gratuitos que se comprueba y se cambia sola cuando uno cae o nos bloquean.",
  },
  {
    icon: LineChart,
    title: "Tendencias reales",
    text: "Histórico de precios por carta, con gráfica y la lista de las diez más baratas.",
  },
  {
    icon: BellRing,
    title: "Avisos de compra",
    text: "Te avisamos cuando una carta baja del precio que tú marques.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Spade className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Cardtrack</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center">
        <p className="mb-4 inline-flex rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
          Magic: The Gathering · Riftbound
        </p>
        <h1 className="text-balance text-5xl font-bold leading-tight sm:text-6xl">
          Tus cartas, <span className="text-gradient-gold">al precio justo</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
          Cardtrack vigila los precios de tus cartas en Cardmarket, guarda el histórico y te dice
          cuáles están subiendo, bajando o quietas.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Empezar gratis</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <article key={f.title} className="panel p-6">
            <f.icon className="mb-4 size-6 text-primary" />
            <h2 className="text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
