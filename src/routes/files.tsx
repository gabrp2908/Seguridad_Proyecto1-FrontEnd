import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  CloudUpload, Download, File as FileIcon, FileText, Film, Folder,
  Globe, Image as ImageIcon, Link2, Lock, LogOut, Music, Pencil, Plus,
  Search, Trash2, Upload, MoveRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { authApi, dirApi, fileApi, downloadBlob, ApiError, API_BASE } from "@/lib/api";
import type { ArchiveDto, DirectoryDto, UserDto } from "@/lib/api";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Mis archivos — ColapsoLoad" },
      { name: "description", content: "Explora, sube y descarga tus archivos." },
    ],
  }),
  component: FilesPage,
});

// ── Icon helpers ──────────────────────────────────────────────────────────────
function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return ImageIcon;
  if (["mp4","mov","avi","mkv","webm"].includes(ext)) return Film;
  if (["mp3","wav","ogg","flac"].includes(ext)) return Music;
  if (["pdf","doc","docx","txt","md"].includes(ext)) return FileText;
  return FileIcon;
}

// ── Main Component ────────────────────────────────────────────────────────────
async function downloadBlobShared(token: string) {
  if (!token) return;
  const res = await fileApi.downloadShared(token);
  if (!res.ok) throw new ApiError("Download failed", res.status);

  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") ?? "";
  let filename = "download";
  const utf8Match = disp.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = disp.match(/filename="?([^";\n]+)"?/i);
  if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
  else if (asciiMatch) filename = asciiMatch[1];

  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
    style: "display:none",
  });
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

function copySharedLink(token: string) {
  if (!token) return;
  const shareUrl = `${API_BASE}/file/download/shared/${token}`;
  void navigator.clipboard.writeText(shareUrl);
  alert("Enlace público copiado al portapapeles.");
}

function FilesPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDto | null>(null);

  // Directory navigation
  const [crumbs, setCrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Inicio" },
  ]);
  const [dirs, setDirs] = useState<DirectoryDto[]>([]);
  const [files, setFiles] = useState<ArchiveDto[]>([]);
  const [allDirs, setAllDirs] = useState<DirectoryDto[]>([]);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; isDir: boolean } | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2 | 3>(1);

  // Rename / new-folder dialog
  const [nameDialog, setNameDialog] = useState<{
    open: boolean; title: string; value: string;
    onConfirm: (val: string) => Promise<void>;
  }>({ open: false, title: "", value: "", onConfirm: async () => {} });

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<{
    open: boolean; fileId: string; destId: string;
  }>({ open: false, fileId: "", destId: "root" });

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (!stored) { navigate({ to: "/login" }); return; }
    setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (user) loadCurrentDir();
  }, [user, crumbs]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const currentDirId = crumbs[crumbs.length - 1].id;

  async function loadCurrentDir() {
    setLoading(true);
    try {
      const [dirsRes, filesRes] = await Promise.all([
        currentDirId ? dirApi.listChildren(currentDirId) : dirApi.listRoot(),
        fileApi.list(currentDirId),
      ]);
      setDirs(dirsRes);
      setFiles(filesRes);
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function loadAllDirs(parentId: string | null = null, prefix = "") {
    const res = parentId ? await dirApi.listChildren(parentId) : await dirApi.listRoot();
    for (const d of res) {
      setAllDirs(prev => [...prev, { ...d, directory_name: prefix + d.directory_name }]);
      await loadAllDirs(d.directory_id, prefix + d.directory_name + " / ");
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  function navTo(idx: number) {
    setCrumbs(c => c.slice(0, idx + 1));
  }
  function openDir(d: DirectoryDto) {
    setCrumbs(c => [...c, { id: d.directory_id, name: d.directory_name }]);
  }

  // ── Create folder ───────────────────────────────────────────────────────────
  function openNewFolder() {
    setNameDialog({
      open: true, title: "Nueva carpeta", value: "",
      onConfirm: async (name) => {
        await dirApi.create(name, currentDirId);
        await loadCurrentDir();
      },
    });
  }

  // ── Rename ──────────────────────────────────────────────────────────────────
  function openRenameDir(d: DirectoryDto) {
    setNameDialog({
      open: true, title: "Renombrar carpeta", value: d.directory_name,
      onConfirm: async (name) => {
        await dirApi.rename(d.directory_id, name);
        await loadCurrentDir();
      },
    });
  }
  function openRenameFile(f: ArchiveDto) {
    setNameDialog({
      open: true, title: "Renombrar archivo", value: f.archive_na,
      onConfirm: async (name) => {
        await fileApi.rename(f.archive_id, name);
        await loadCurrentDir();
      },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  function askDelete(id: string, name: string, isDir: boolean) {
    setPendingDelete({ id, name, isDir });
    setConfirmStep(1);
  }
  async function confirmFinal() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.isDir) await dirApi.delete(pendingDelete.id);
      else await fileApi.delete(pendingDelete.id);
      await loadCurrentDir();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error al eliminar");
    } finally {
      setPendingDelete(null);
      setConfirmStep(1);
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(fileList)) {
        await fileApi.upload(f, currentDirId);
      }
      await loadCurrentDir();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error al subir");
    } finally { setUploading(false); }
  }

  // ── Move ────────────────────────────────────────────────────────────────────
  async function openMove(f: ArchiveDto) {
    setAllDirs([]);
    await loadAllDirs();
    setMoveDialog({ open: true, fileId: f.archive_id, destId: f.directory_id ?? "root" });
  }
  async function confirmMove() {
    const dest = moveDialog.destId === "root" ? null : moveDialog.destId;
    await fileApi.move(moveDialog.fileId, dest);
    await loadCurrentDir();
    setMoveDialog(d => ({ ...d, open: false }));
  }

  // ── Visibility toggle ────────────────────────────────────────────────────────
  async function toggleVisibility(f: ArchiveDto) {
    await fileApi.setVisibility(f.archive_id, !f.is_public);
    await loadCurrentDir();
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filteredDirs = dirs.filter(d => d.directory_name.toLowerCase().includes(query.toLowerCase()));
  const filteredFiles = files.filter(f => f.archive_na.toLowerCase().includes(query.toLowerCase()));

  // ── Logout ──────────────────────────────────────────────────────────────────
  async function logout() {
    try { await authApi.logout(); } catch (_) {}
    sessionStorage.removeItem("user");
    navigate({ to: "/login" });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-gradient text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/files" className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient shadow-brand">
              <CloudUpload className="h-5 w-5 text-primary-foreground" />
            </span>
            ColapsoLoad
          </Link>
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.user_na}
          </span>
          <Button onClick={logout} variant="ghost" size="icon" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 md:p-10">
        <Tabs defaultValue="my-files">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Mis archivos</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {dirs.length} carpetas · {files.length} archivos
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="my-files">Mis archivos</TabsTrigger>
            </TabsList>
          </div>

          {/* ── My Files Tab ── */}
          <TabsContent value="my-files">
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Breadcrumb */}
              <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground">/</span>}
                    <button
                      onClick={() => navTo(i)}
                      className={`rounded px-2 py-0.5 transition-colors hover:bg-accent/20 ${
                        i === crumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {i === 0 ? "🏠 Inicio" : c.name}
                    </button>
                  </span>
                ))}
              </nav>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-52 pl-9 bg-[var(--sidebar)] text-primary-foreground"
                />
              </div>
              <Button variant="outline" size="sm" onClick={openNewFolder}>
                <Plus className="mr-1 h-4 w-4" /> Carpeta
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-brand-gradient text-primary-foreground shadow-brand hover:opacity-95"
              >
                <Upload className="mr-1 h-4 w-4" />
                {uploading ? "Subiendo…" : "Subir archivos"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>

            {/* Drop zone */}
            <DropZone onFiles={handleUpload} onPick={() => fileInputRef.current?.click()} />

            {/* File table */}
            <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Nombre</span>
                <span>Visibilidad</span>
                <span>Tipo</span>
                <span className="text-right">Acciones</span>
              </div>

              {loading ? (
                <p className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando…</p>
              ) : filteredDirs.length === 0 && filteredFiles.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {query ? "Sin resultados." : "Esta carpeta está vacía."}
                </p>
              ) : (
                <>
                  {filteredDirs.map((d) => (
                    <div
                      key={d.directory_id}
                      className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-4 border-b border-border/60 px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent/10"
                    >
                      <button
                        onClick={() => openDir(d)}
                        className="flex min-w-0 items-center gap-3 text-left"
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-primary-foreground">
                          <Folder className="h-4 w-4" />
                        </span>
                        <p className="truncate font-medium text-foreground">{d.directory_name}</p>
                      </button>
                      <span className="text-muted-foreground text-xs">—</span>
                      <span className="text-muted-foreground text-xs">Carpeta</span>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Renombrar" onClick={() => openRenameDir(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Eliminar" onClick={() => askDelete(d.directory_id, d.directory_name, true)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {filteredFiles.map((f) => {
                    const Icon = fileIcon(f.archive_na);
                    return (
                      <div
                        key={f.archive_id}
                        className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-4 border-b border-border/60 px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-accent/10"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <p className="truncate font-medium text-foreground">{f.archive_na}</p>
                        </div>

                        {/* Visibility badge / toggle */}
                        <button
                          onClick={() => toggleVisibility(f)}
                          title="Click para cambiar visibilidad"
                          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${
                            f.is_public
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {f.is_public ? (
                            <><Globe className="h-3 w-3" /> Público</>
                          ) : (
                            <><Lock className="h-3 w-3" /> Privado</>
                          )}
                        </button>

                        <span className="text-muted-foreground text-xs">Archivo</span>

                        <div className="flex justify-end gap-1 items-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" title="Acciones de archivo">
                                <Download className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => downloadBlob(f.archive_id)}>
                                <Download className="h-4 w-4" />
                                Descargar archivo
                              </DropdownMenuItem>
                              {f.is_public && f.share_token ? (
                                <DropdownMenuItem onSelect={() => copySharedLink(f.share_token)}>
                                  <Link2 className="h-4 w-4" />
                                  Copiar enlace público
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button size="icon" variant="ghost" title="Renombrar" onClick={() => openRenameFile(f)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Mover" onClick={() => openMove(f)}>
                            <MoveRight className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Eliminar" onClick={() => askDelete(f.archive_id, f.archive_na, false)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Delete Confirm Dialog ── */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setConfirmStep(1);
          }
        }}>
        <AlertDialogContent>
          {confirmStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {pendingDelete?.isDir ? "carpeta" : "archivo"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Estás a punto de eliminar <span className="font-medium text-foreground">{pendingDelete?.name}</span>.
                  {pendingDelete?.isDir && " Se eliminarán todos sus contenidos."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
                <Button className="bg-brand-gradient text-primary-foreground" onClick={() => setConfirmStep(2)}>
                  Sí, eliminar
                </Button>
              </AlertDialogFooter>
            </>
          ) : confirmStep === 2 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Segunda confirmación</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de eliminar <span className="font-medium text-foreground">{pendingDelete?.name}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
                <Button className="bg-brand-gradient text-primary-foreground" onClick={() => setConfirmStep(3)}>
                  Sí, continuar
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmación final</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. ¿Confirmas eliminar definitivamente{" "}
                  <span className="font-medium text-foreground">{pendingDelete?.name}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
                <Button className="bg-destructive text-primary-foreground" onClick={confirmFinal}>
                  Eliminar definitivamente
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rename / New Folder Dialog ── */}
      <Dialog open={nameDialog.open} onOpenChange={(open) => setNameDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{nameDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={nameDialog.value}
              onChange={(e) => setNameDialog(d => ({ ...d, value: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && nameDialog.value && nameDialog.onConfirm(nameDialog.value).then(() => setNameDialog(d => ({ ...d, open: false })))}
              placeholder="Escribe un nombre…"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialog(d => ({ ...d, open: false }))}>
              Cancelar
            </Button>
            <Button
              className="bg-brand-gradient text-primary-foreground"
              disabled={!nameDialog.value.trim()}
              onClick={async () => {
                await nameDialog.onConfirm(nameDialog.value.trim());
                setNameDialog(d => ({ ...d, open: false }));
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move File Dialog ── */}
      <Dialog open={moveDialog.open} onOpenChange={(open) => setMoveDialog(d => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Destino</Label>
            <Select value={moveDialog.destId} onValueChange={(v) => setMoveDialog(d => ({ ...d, destId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona carpeta…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">🏠 Raíz (sin carpeta)</SelectItem>
                {allDirs.map(d => (
                  <SelectItem key={d.directory_id} value={d.directory_id}>
                    📁 {d.directory_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialog(d => ({ ...d, open: false }))}>
              Cancelar
            </Button>
            <Button className="bg-brand-gradient text-primary-foreground" onClick={confirmMove}>
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── DropZone ─────────────────────────────────────────────────────────────────
function DropZone({ onFiles, onPick }: { onFiles: (f: FileList) => void; onPick: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
      onClick={onPick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
        over ? "border-primary bg-primary/10 shadow-brand" : "border-border bg-card/40 hover:border-primary/60"
      }`}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient shadow-brand">
        <Upload className="h-5 w-5 text-primary-foreground" />
      </span>
      <p className="text-sm font-medium">Arrastra archivos aquí o haz clic para subir</p>
      <p className="text-xs text-muted-foreground">Cifrado AES-256-GCM · Hasta 2 GB por archivo</p>
    </div>
  );
}
