import { Link } from "@tanstack/react-router";
import { CloudUpload } from "lucide-react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-gradient p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-card md:grid-cols-2">
        <aside className="relative hidden flex-col justify-between bg-brand-gradient p-10 text-primary-foreground md:flex">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <CloudUpload className="h-6 w-6" />
            ColapsoLoad
          </Link>
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Tus archivos, en un solo lugar seguro.
            </h2>
            <p className="mt-3 text-sm opacity-90">
              Sube, organiza y comparte. Acceso rápido desde tu escritorio.
            </p>
          </div>
          <p className="text-xs opacity-70"></p>
        </aside>

        <section className="p-8 md:p-10">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </header>
          {children}
          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </section>
      </div>
    </div>
  );
}
