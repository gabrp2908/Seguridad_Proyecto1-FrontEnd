import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, ApiError } from "@/lib/api";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — ColapsoLoad" },
      { name: "description", content: "Crea tu cuenta en ColapsoLoad." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await authApi.register(form.name, form.email, form.password);
      // Auto-login after register
      const user = await authApi.login(form.email, form.password);
      sessionStorage.setItem("user", JSON.stringify(user));
      navigate({ to: "/files" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a almacenar y compartir archivos en segundos."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre completo</Label>
          <Input id="name" required placeholder="Tu nombre" {...field("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" required placeholder="tu@correo.com" {...field("email")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required placeholder="••••••••" {...field("password")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar</Label>
            <Input id="confirm" type="password" required placeholder="••••••••" {...field("confirm")} />
          </div>
        </div>
        {error && (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-gradient text-primary-foreground shadow-brand hover:opacity-95"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
