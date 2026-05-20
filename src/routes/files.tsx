import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  CloudUpload,
  Download,
  File as FileIcon,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  LogOut,
  Music,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Mis archivos — ColapsoLoad" },
      { name: "description", content: "Explora, sube y descarga tus archivos." },
    ],
  }),
  component: FilesPage,
});

type Item = {
  id: string;
  name: string;
  type: "folder" | "image" | "video" | "audio" | "doc" | "file";
  size?: string;
  modified: string;
  owner: string;
};

const SEED: Item[] = [
  { id: "1", name: "Proyectos", type: "folder", modified: "Hoy, 10:14", owner: "Tú" },
  { id: "2", name: "Fotos 2026", type: "folder", modified: "Ayer", owner: "Tú" },
  { id: "3", name: "Compartidos", type: "folder", modified: "12 may", owner: "Equipo" },
  { id: "4", name: "Propuesta-cliente.pdf", type: "doc", size: "1.2 MB", modified: "Hoy, 09:02", owner: "Tú" },
  { id: "5", name: "logo-final.png", type: "image", size: "340 KB", modified: "15 may", owner: "Tú" },
  { id: "6", name: "demo-app.mp4", type: "video", size: "84 MB", modified: "14 may", owner: "Ana R." },
  { id: "7", name: "podcast-ep12.mp3", type: "audio", size: "22 MB", modified: "10 may", owner: "Carlos M." },
  { id: "8", name: "notas.txt", type: "file", size: "4 KB", modified: "08 may", owner: "Tú" },
];

const ICONS = {
  folder: Folder,
  image: ImageIcon,
  video: Film,
  audio: Music,
  doc: FileText,
  file: FileIcon,
} as const;

function FilesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>(SEED);
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2 | 3>(1);

  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );

  const stats = useMemo(() => {
    const folders = items.filter((i) => i.type === "folder").length;
    const files = items.length - folders;
    return { folders, files };
  }, [items]);

  function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const now = new Date().toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const mapped: Item[] = Array.from(files).map((f, idx) => ({
      id: `${Date.now()}-${idx}`,
      name: f.name,
      type: f.type.startsWith("image")
        ? "image"
        : f.type.startsWith("video")
          ? "video"
          : f.type.startsWith("audio")
            ? "audio"
            : f.type.includes("pdf") || f.type.includes("word")
              ? "doc"
              : "file",
      size: `${(f.size / 1024).toFixed(0)} KB`,
      modified: now,
      owner: "Tú",
    }));
    setItems((p) => [...mapped, ...p]);
  }

  function addFolder() {
    const name = prompt("Nombre de la carpeta");
    if (!name) return;
    setItems((p) => [
      { id: `${Date.now()}`, name, type: "folder", modified: "Ahora", owner: "Tú" },
      ...p,
    ]);
  }

  function askDelete(item: Item) {
    setPendingDelete(item);
    setConfirmStep(1);
  }

  function closeDialog() {
    setPendingDelete(null);
    setConfirmStep(1);
  }

  function confirmFirst() {
    setConfirmStep(2);
  }

  function confirmSecond() {
    setConfirmStep(3);
  }

  function confirmFinal() {
    if (pendingDelete) {
      setItems((p) => p.filter((i) => i.id !== pendingDelete.id));
    }
    closeDialog();
  }

  const isFolder = pendingDelete?.type === "folder";
  const label = isFolder ? "carpeta" : "archivo";

  return (
    <div className="min-h-screen bg-surface-gradient text-foreground">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/files" className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient shadow-brand">
              <CloudUpload className="h-5 w-5 text-primary-foreground" />
            </span>
            ColapsoLoad
          </Link>
          <Button onClick={() => navigate({ to: "/login" })} variant="ghost" size="icon" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 md:p-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Mis archivos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.folders} carpetas · {stats.files} archivos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-64 pl-9 bg-[var(--sidebar)] text-primary-foreground"
              />
            </div>
            <Button variant="outline" onClick={addFolder}>
              <Plus className="mr-2 h-4 w-4" /> Carpeta
            </Button>
            <Button
              onClick={() => fileInput.current?.click()}
              className="bg-brand-gradient text-primary-foreground shadow-brand hover:opacity-95"
            >
              <Upload className="mr-2 h-4 w-4" /> Subir archivos
            </Button>
          </div>
        </div>

        <DropZone onFiles={(f) => handleUpload(f)} onPick={() => fileInput.current?.click()} />
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        <section className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Nombre</span>
            <span>Propietario</span>
            <span>Modificado</span>
            <span className="text-right">Acciones</span>
          </div>
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            filtered.map((item) => {
              const Icon = ICONS[item.type];
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-4 border-b border-border/60 px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent/10"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                        item.type === "folder" ? "bg-brand-gradient text-primary-foreground" : "bg-muted text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{item.name}</p>
                      {item.size ? <p className="text-xs text-muted-foreground">{item.size}</p> : null}
                    </div>
                  </div>
                  <span className="text-muted-foreground">{item.owner}</span>
                  <span className="text-muted-foreground">{item.modified}</span>
                  <div className="flex justify-end gap-1">
                    {item.type !== "folder" && (
                      <Button size="icon" variant="ghost" aria-label="Descargar">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => askDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <AlertDialogContent>
          {confirmStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Estás a punto de eliminar {label}{" "}
                  <span className="font-medium text-foreground">{pendingDelete?.name}</span>. ¿Deseas continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmFirst}>Sí, eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : confirmStep === 2 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Segunda confirmación</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta es una confirmación adicional antes de eliminar {label}{" "}
                  <span className="font-medium text-foreground">{pendingDelete?.name}</span>. ¿Estás seguro?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={confirmSecond}>Sí, continuar</AlertDialogAction>
                <AlertDialogCancel onClick={closeDialog}>Cancelar</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmación final</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. ¿Confirmas eliminar definitivamente {label}{" "}
                  <span className="font-medium text-foreground">{pendingDelete?.name}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmFinal}>Sí, eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DropZone({ onFiles, onPick }: { onFiles: (f: FileList) => void; onPick: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      onClick={onPick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
        over ? "border-primary bg-primary/10 shadow-brand" : "border-border bg-card/40 hover:border-primary/60"
      }`}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient shadow-brand">
        <Upload className="h-5 w-5 text-primary-foreground" />
      </span>
      <p className="text-sm font-medium">Arrastra archivos aquí o haz clic para subir</p>
      <p className="text-xs text-muted-foreground">Hasta 2 GB por archivo</p>
    </div>
  );
}
