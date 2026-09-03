import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestAccessCode, verifyAccessCode } from "@/lib/auth/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { translateAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail } from "lucide-react";

export const Route = createFileRoute("/acesso")({
  ssr: false,
  component: AccessPage,
  head: () => ({
    meta: [
      { title: "Entrar na LUUD — WhatsApp ou e-mail" },
      { name: "description", content: "Receba um código de 6 dígitos no WhatsApp ou entre com e-mail e senha para acessar o painel da LUUD." },
      { property: "og:title", content: "Entrar na LUUD — WhatsApp ou e-mail" },
      { property: "og:description", content: "Acesso rápido ao painel financeiro da LUUD pelo WhatsApp ou por e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Method = "whatsapp" | "email";

function AccessPage() {
  const navigate = useNavigate();
  const askCode = useServerFn(requestAccessCode);
  const checkCode = useServerFn(verifyAccessCode);

  const [method, setMethod] = useState<Method>("whatsapp");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSend() {
    setLoading(true);
    try {
      const r = await askCode({ data: { phone } });
      if (!r.ok) return toast.error(r.error ?? "Não foi possível enviar o código.");
      setStep("code");
      toast.success("Código enviado pelo WhatsApp. Ele vale por 10 minutos.");
    } catch {
      toast.error("Falha ao enviar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      const r = await checkCode({ data: { phone, code } });
      if (!r.ok || !r.tokenHash) return toast.error(r.error ?? "Código inválido.");
      const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
      if (error) return toast.error("Não foi possível abrir sua sessão. Tente novamente.");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Falha ao validar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      toast.error(translateAuthError(err, "Não foi possível entrar com e-mail e senha."));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) return toast.error("Informe seu e-mail para receber o link.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um e-mail com o link para redefinir sua senha.");
    } catch (err: unknown) {
      toast.error(translateAuthError(err, "Não foi possível enviar o link."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-warm min-h-screen bg-background text-foreground">
      <main className="relative grid min-h-screen place-items-center px-5 py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(36,27,22,0.10) 1px, transparent 1px), radial-gradient(60% 50% at 50% 0%, rgba(184,148,82,0.14), transparent 70%)",
            backgroundSize: "22px 22px, 100% 100%",
          }}
        />
        <div className="relative w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex rounded-xl bg-walnut px-3 py-2">
              <Logo />
            </span>
            <p className="text-xs text-muted-foreground">
              Grátis para começar. Sem mensalidade.
            </p>
          </div>

          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="font-display text-xl">
                {method === "whatsapp" ? "Entrar com o WhatsApp" : "Entrar com e-mail"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {method === "whatsapp"
                  ? "Enviamos um código de 6 dígitos para o seu WhatsApp."
                  : "Use o e-mail e a senha da sua conta LUUD."}
              </p>
            </CardHeader>

            <CardContent className="space-y-5">
              {method === "whatsapp" ? (
                <>
                  {step === "phone" ? (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => { e.preventDefault(); void handleSend(); }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="phone">Seu WhatsApp</Label>
                        <Input
                          id="phone"
                          name="phone"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="(62) 99999-9999"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || phone.length < 10}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <><WhatsAppIcon className="mr-2 h-4 w-4" /> Enviar código pelo WhatsApp</>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Ainda não usa a LUUD? Mande uma mensagem no WhatsApp da LUUD para criar seu acesso.
                      </p>
                    </form>
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => { e.preventDefault(); void handleVerify(); }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="code">Código de 6 dígitos</Label>
                        <Input
                          id="code"
                          name="code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || code.length !== 6}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                      </Button>
                      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")} disabled={loading}>
                        Trocar número / reenviar
                      </Button>
                    </form>
                  )}

                  <div className="border-t border-border pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setMethod("email")}
                      aria-label="Alternar para o login com e-mail e senha"
                      className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Mail className="h-3.5 w-3.5" /> Prefere entrar com e-mail?
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <form className="space-y-4" onSubmit={handleEmailSignIn}>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <button
                          type="button"
                          onClick={handleForgot}
                          className="rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          required
                          minLength={6}
                          className="pr-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          tabIndex={-1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                    </Button>
                  </form>

                  <div className="border-t border-border pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setMethod("whatsapp")}
                      aria-label="Alternar para o login por código no WhatsApp"
                      className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" /> Prefere entrar pelo WhatsApp?
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Grátis para começar • sem mensalidade • sem cartão
          </p>
        </div>
      </main>
    </div>
  );
}
