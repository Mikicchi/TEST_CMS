import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CameraOff, Loader2, Minus, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanCard, saveScanSession } from "@/lib/collection.functions";

export const Route = createFileRoute("/_authenticated/escaner")({
  head: () => ({
    meta: [
      { title: "Escanear cartas · Cardtrack" },
      {
        name: "description",
        content:
          "Enciende la cámara y Cardtrack reconoce tus cartas una tras otra en una lista de sesión.",
      },
      { property: "og:title", content: "Escanear cartas · Cardtrack" },
      {
        property: "og:description",
        content:
          "Enciende la cámara y Cardtrack reconoce tus cartas una tras otra en una lista de sesión.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScannerPage,
});

type Recognised = {
  name: string;
  game: string;
  expansion: string | null;
  confidence: number | null;
  searchUrl: string;
};

type SessionItem = Recognised & { quantity: number };

const keyOf = (r: { name: string; game: string }) => `${r.game}|${r.name.toLowerCase().trim()}`;

function ScannerPage() {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  const [active, setActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Recognised | null>(null);
  const [track, setTrack] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      toast.error("No he podido abrir la cámara. Revisa los permisos del navegador.");
    }
  };

  const addToSession = useCallback((r: Recognised, extra = 1) => {
    setItems((prev) => {
      const k = keyOf(r);
      const found = prev.find((i) => keyOf(i) === k);
      if (found) {
        return prev.map((i) => (keyOf(i) === k ? { ...i, quantity: i.quantity + extra } : i));
      }
      return [...prev, { ...r, quantity: extra }];
    });
    setLastKey(keyOf(r));
  }, []);

  const handleResult = useCallback(
    (r: Recognised) => {
      if (lastKey && keyOf(r) === lastKey) {
        // Puede ser la misma carta reescaneada: preguntamos antes de sumar.
        setDuplicate(r);
        return;
      }
      addToSession(r);
      toast.success(`${r.name} añadida a la sesión`);
    },
    [addToSession, lastKey],
  );

  const captureAndScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current) return;
    if (!video.videoWidth) return;
    busyRef.current = true;
    setScanning(true);
    try {
      const canvas = document.createElement("canvas");
      const width = Math.min(video.videoWidth, 1024);
      const scale = width / video.videoWidth;
      canvas.width = width;
      canvas.height = video.videoHeight * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.8);
      const r = (await scanCard({ data: { image } })) as Recognised;
      handleResult(r);
    } catch {
      /* fotograma sin carta reconocible: seguimos escaneando */
    } finally {
      busyRef.current = false;
      setScanning(false);
    }
  }, [handleResult]);

  // Escaneo automático mientras la cámara está encendida y no hay pregunta pendiente.
  useEffect(() => {
    if (!active || duplicate) return;
    const id = setInterval(() => {
      void captureAndScan();
    }, 4000);
    return () => clearInterval(id);
  }, [active, duplicate, captureAndScan]);

  const save = useMutation({
    mutationFn: () =>
      saveScanSession({
        data: {
          rows: items.map((i) => ({
            name: i.name,
            game: i.game,
            expansion: i.expansion,
            card_url: i.searchUrl,
            quantity: i.quantity,
          })),
          track,
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.added} cartas nuevas y ${r.updated} actualizadas en tu colección`);
      setItems([]);
      setLastKey(null);
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeQty = (key: string, delta: number) =>
    setItems((prev) =>
      prev
        .map((i) => (keyOf(i) === key ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );

  const total = items.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Escanear cartas</h1>
        <p className="text-sm text-muted-foreground">
          Enciende la cámara y ve pasando cartas: se reconocen solas y se acumulan en la lista de
          esta sesión. Al terminar, guárdalas en tu colección.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="relative aspect-[4/3] bg-black/50">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`size-full object-cover ${active ? "" : "hidden"}`}
            />
            {!active && (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                La cámara está apagada
              </div>
            )}
            {active && scanning && (
              <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs">
                <Loader2 className="size-3 animate-spin" />
                Reconociendo…
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {!active ? (
              <Button onClick={start}>
                <Camera className="size-4" />
                Encender cámara
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => void captureAndScan()}>
                  <Camera className="size-4" />
                  Escanear ahora
                </Button>
                <Button variant="ghost" onClick={stop}>
                  <CameraOff className="size-4" />
                  Apagar
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="panel flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Sesión de escaneo</h2>
            <span className="text-sm text-muted-foreground">{total} unidades</span>
          </div>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Todavía no has escaneado ninguna carta.
              </p>
            )}
            {items.map((i) => (
              <div
                key={keyOf(i)}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[i.game, i.expansion].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => changeQty(keyOf(i), -1)}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{i.quantity}</span>
                  <Button size="icon" variant="ghost" onClick={() => changeQty(keyOf(i), 1)}>
                    <Plus className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => changeQty(keyOf(i), -i.quantity)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={track}
              onChange={(e) => setTrack(e.target.checked)}
              className="size-4 accent-primary"
            />
            Seguir también sus precios
          </label>

          <Button
            className="mt-3"
            disabled={items.length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            <Save className="size-4" />
            Guardar en mi colección
          </Button>
        </div>
      </div>

      {duplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="panel w-full max-w-md space-y-4 p-6">
            <div>
              <h3 className="font-display text-lg font-semibold">¿Otra copia de {duplicate.name}?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Acabo de reconocer la misma carta. Si es una copia distinta, sumo una unidad; si es
                la misma que ya escaneaste, la ignoro.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  addToSession(duplicate);
                  setDuplicate(null);
                  toast.success(`Una unidad más de ${duplicate.name}`);
                }}
              >
                Sí, suma una unidad
              </Button>
              <Button variant="secondary" onClick={() => setDuplicate(null)}>
                No, es la misma
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
