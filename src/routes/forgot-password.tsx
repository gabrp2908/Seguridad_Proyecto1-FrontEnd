import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña — ColapsoLoad" },
      { name: "description", content: "Recupera el acceso a tu cuenta." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <AuthLayout
      title="¿Olvidaste tu contraseña?"
      subtitle="Te enviaremos un enlace para restablecerla."
      footer={
        <>
          ¿Recordaste tu contraseña?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          Si <span className="font-medium text-foreground">{email}</span> está registrado, recibirás un correo con
          instrucciones para restablecer tu contraseña.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground shadow-brand hover:opacity-95">
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
