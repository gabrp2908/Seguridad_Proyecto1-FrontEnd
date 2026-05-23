import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // AQUÍ ESTABA EL FALLO: faltaba la llamada real a la API
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError("Hubo un error al procesar tu solicitud. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input 
              id="email" 
              type="email" 
              required 
              value={email} 
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
