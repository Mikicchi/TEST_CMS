import { createFileRoute, Link } from "@tanstack/react-router";
import { Spade, LineChart, Network, BellRing, ArrowRight, Users, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      { property: "og:description", content: "Seguimiento automático de precios de cartas con rotación de proxies y avisos." },
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

const stats = [
  { icon: Users, label: "Usuarios activos", value: "2.4K+", color: "text-primary" },
  { icon: TrendingUp, label: "Cartas rastreadas", value: "150K+", color: "text-emerald-400" },
  { icon: Shield, label: "Uptime", value: "99.9%", color: "text-amber-400" },
  { icon: LineChart, label: "Actualizaciones/día", value: "50K+", color: "text-blue-400" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Spade className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Cardtrack</span>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Empezar gratis</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
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
              <Link to="/auth">Empezar gratis <ArrowRight className="ml-2 size-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="panel">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 font-display text-3xl font-bold {stat.color}">{stat.value}</p>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <stat.icon className="size-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="panel">
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <f.icon className="size-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="panel p-8 md:p-12 text-center">
          <h2 className="font-display text-3xl font-bold">¿Listo para controlar tus precios?</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Únete a miles de coleccionistas que ya usan Cardtrack para no perderse ninguna oportunidad.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Crear cuenta gratis</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          <p>Cardtrack no está afiliado a Cardmarket ni a Wizards of the Coast.</p>
        </div>
      </footer>
    </div>
  );
}