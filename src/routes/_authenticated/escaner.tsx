import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CameraOff, ExternalLink, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { scanCard } from "@/lib/collection.functions";
import { addCard } from "@/lib/tracker.functions";

export const Route = createFileRoute("/_authenticated/escaner")({
  head: () => ({
    meta: [
      { title: "Escanear carta · Cardtrack" },
      {
        name: "description",
        content: "Enfoca una carta con la cámara y Cardtrack la reconoce y la añade a tu colección.",
      },
      { property: "og:title", content: "Escanear carta · Cardtrack" },
      {
        property: "og:description",
        content: "Enfoca una carta con la cámara y Cardtrack la reconoce y la añade a tu colección.",
      },
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

function ScannerPage() {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [result, setResult] = useState<Recognised | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const scan = useMutation({
    mutationFn: (image: string) => scanCard({ data: { image } }),
    onSuccess: (r) => setResult(r as Recognised),
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: (v: { card_url: string; game: string; name: string }) => addCard({ data: v }),
    onSuccess: () => {
      toast.success("Carta añadida a tu seguimiento");
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["collection"] });
      setResult(null);
      setShot(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const width = Math.min(video.videoWidth || 1024, 1024);
    const scale = width / (video.videoWidth || width);
    canvas.width = width;
    canvas.height = (video.videoHeight || width) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.85);
    setShot(image);
    setResult(null);
    scan.mutate(image);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold">Escanear carta</h1>
          <p className="text-sm text-muted-foreground">
            Enfoca la carta con la cámara, haz la foto y te digo cuál es para añadirla.
          </p>
        </header>

        <div className="panel overflow-hidden">
          <div className="relative aspect-[4/3] bg-black/50">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`size-full object-cover ${active ? "" : "hidden"}`}
            />
            {!active && shot && <img src={shot} alt="Carta capturada" className="size-full object-cover" />}
            {!active && !shot && (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                La cámara está apagada
              </div>
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
                <Button onClick={capture} disabled={scan.isPending}>
                  <Camera className="size-4" />
                  {scan.isPending ? "Reconociendo…" : "Hacer foto"}
                </Button>
                <Button variant="ghost" onClick={stop}>
                  <CameraOff className="size-4" />
                  Apagar
                </Button>
              </>
            )}
          </div>
        </div>

        {result && (
          <div className="panel space-y-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Carta reconocida</p>
              <h2 className="font-display text-xl font-semibold">{result.name}</h2>
              <p className="text-sm text-muted-foreground">
                {[result.game, result.expansion].filter(Boolean).join(" · ")}
                {result.confidence !== null && ` · fiabilidad ${(result.confidence * 100).toFixed(0)}%`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Abre la búsqueda en Cardmarket para confirmar la edición exacta; al añadirla se
              guardará esa búsqueda y se afinará en la primera consulta de precios.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  add.mutate({ card_url: result.searchUrl, game: result.game, name: result.name })
                }
                disabled={add.isPending}
              >
                <Plus className="size-4" />
                Añadir a mi seguimiento
              </Button>
              <a href={result.searchUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="size-4" />
                  Ver en Cardmarket
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
