import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSettings, saveSettings } from "@/lib/tracker.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes de rastreo — Cardtrack" },
      {
        name: "description",
        content: "Configura el ritmo de actualización, el uso de proxies y los avisos.",
      },
      { property: "og:title", content: "Ajustes de rastreo — Cardtrack" },
      { property: "og:description", content: "Ritmo de consultas, proxies y notificaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

type Form = {
  refresh_interval_minutes: number;
  requests_per_minute: number;
  jitter_seconds: number;
  max_retries_per_card: number;
  use_proxies: boolean;
  fallback_scraper: boolean;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_chat_id: string | null;
};

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const save = useServerFn(saveSettings);

  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        refresh_interval_minutes: data.refresh_interval_minutes,
        requests_per_minute: data.requests_per_minute,
        jitter_seconds: data.jitter_seconds,
        max_retries_per_card: data.max_retries_per_card,
        use_proxies: data.use_proxies,
        fallback_scraper: data.fallback_scraper,
        notify_in_app: data.notify_in_app,
        notify_email: data.notify_email,
        notify_telegram: data.notify_telegram,
        telegram_chat_id: data.telegram_chat_id,
      });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: () => save({ data: form! }),
    onSuccess: () => {
      toast.success("Ajustes guardados.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return <p className="text-sm text-muted-foreground">Cargando ajustes…</p>;

  const num = (key: keyof Form, label: string, hint: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  const toggle = (key: keyof Form, label: string, hint: string) => (
    <div className="flex items-start justify-between gap-6 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={Boolean(form[key])}
        onCheckedChange={(v) => setForm({ ...form, [key]: v })}
      />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Cuanto más despacio consultes, menos probabilidades de que te bloqueen.
        </p>
      </div>

      <section className="panel space-y-5 p-6">
        <h2 className="text-lg font-semibold">Ritmo de consultas</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {num("refresh_interval_minutes", "Cada cuántos minutos actualizar", "Mínimo 5, máximo 1440.")}
          {num("requests_per_minute", "Consultas por minuto", "Recomendado entre 3 y 8.")}
          {num("jitter_seconds", "Pausa aleatoria extra (segundos)", "Evita un patrón regular.")}
          {num("max_retries_per_card", "Reintentos por carta", "Cambia de proxy en cada intento.")}
        </div>
      </section>

      <section className="panel space-y-4 p-6">
        <h2 className="text-lg font-semibold">Conexión</h2>
        {toggle("use_proxies", "Usar proxies", "Rota entre los proxies gratuitos disponibles.")}
        {toggle(
          "fallback_scraper",
          "Servicio de respaldo",
          "Si los proxies fallan, usa un servicio profesional de extracción.",
        )}
      </section>

      <section className="panel space-y-4 p-6">
        <h2 className="text-lg font-semibold">Avisos</h2>
        {toggle("notify_in_app", "Dentro de la app", "Aparecen en tu panel.")}
        {toggle("notify_email", "Por correo", "Requiere configurar el envío de correos.")}
        {toggle("notify_telegram", "Por Telegram", "Requiere conectar el bot de Telegram.")}
        {form.notify_telegram && (
          <div className="space-y-2">
            <Label htmlFor="chat">Identificador de chat de Telegram</Label>
            <Input
              id="chat"
              value={form.telegram_chat_id ?? ""}
              onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="123456789"
            />
          </div>
        )}
      </section>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        Guardar ajustes
      </Button>
    </div>
  );
}