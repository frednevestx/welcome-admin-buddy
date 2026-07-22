import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Eye, EyeOff, Sparkles, BrainCircuit, TrendingUp, ShieldCheck } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Entrar na LUUD — IA financeira para restaurantes" },
      { name: "description", content: "Acesse a LUUD, a inteligência artificial que descobre o lucro real do seu restaurante e mostra como aumentar sua margem." },
      { property: "og:title", content: "Entrar na LUUD" },
      { property: "og:description", content: "IA financeira para restaurantes e delivery. Descubra seu lucro real." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Conta criada! Entrando...");
          navigate({ to: "/dashboard" });
          return;
        }
        toast.success("Cadastro iniciado! Confirme seu email pelo link enviado antes de entrar.");
        setMode("signin");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um email com o link para redefinir sua senha.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      toast.error(translateAuthError(err, "Erro ao autenticar."));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        const { data } = await supabase.auth.getUser();
        if (data.user) navigate({ to: "/dashboard" });
        else setGoogleLoading(false);
      }
    } catch (err: unknown) {
      toast.error(translateAuthError(err, "Erro ao entrar com Google."));
      setGoogleLoading(false);
    }
  }

  const title =
    mode === "signin" ? "Entrar na LUUD" : mode === "signup" ? "Criar sua conta LUUD" : "Recuperar senha";
  const subtitle =
    mode === "signin"
      ? "Descubra o lucro real do seu restaurante."
      : mode === "signup"
      ? "Comece grátis por 7 dias — sem cartão."
      : "Enviaremos um link para você redefinir sua senha.";

  const perks = [
    { icon: BrainCircuit, title: "IA financeira 24/7", desc: "Análises e recomendações todos os dias." },
    { icon: TrendingUp, title: "Aumente sua margem", desc: "Descubra onde você está perdendo dinheiro." },
    { icon: ShieldCheck, title: "Sem planilhas, sem burocracia", desc: "Tudo organizado em minutos." },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      {/* Left panel — brand */}
      <aside className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
        <div
          className="absolute inset-0 -z-20 opacity-[0.05]"
          style={{
            backgroundImage: "linear-gradient(oklch(1 0 0 / 0.8) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 70% 60% at 40% 50%, black 40%, transparent 80%)",
          }}
        />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: "var(--gradient-primary)" }} />

        <a href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para o site
        </a>

        <div className="max-w-md">
          <Logo className="mb-8 [&_img]:h-10" />
          <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight leading-[1.05]">
            Descubra o <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">lucro real</span> do seu restaurante.
          </h1>
          <p className="mt-5 text-base xl:text-lg text-muted-foreground">
            Uma inteligência artificial que analisa seu negócio todos os dias e mostra como você pode lucrar mais.
          </p>

          <ul className="mt-10 space-y-4">
            {perks.map((p) => (
              <li key={p.title} className="flex gap-3">
                <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 border border-primary/30 bg-primary/5">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-sm text-muted-foreground">{p.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Mais de 900 restaurantes já descobriram seu lucro com a LUUD.
        </div>
      </aside>

      {/* Right panel — form */}
      <main className="relative flex flex-col items-center justify-center px-4 py-10 lg:py-14">
        <div className="lg:hidden absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />

        <div className="w-full max-w-md">
          <div className="flex lg:hidden flex-col items-center gap-2 mb-8">
            <Logo className="[&_img]:h-9" />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> IA financeira para restaurantes
            </p>
          </div>

          <div
            className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-7 md:p-8"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-6">
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
              )}
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
            </div>

            {mode !== "forgot" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2 font-medium"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                >
                  {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <GoogleIcon className="h-4 w-4" />
                      <span>Continuar com Google</span>
                    </>
                  )}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                    <span className="bg-card px-2 text-muted-foreground">ou com email</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full h-11 font-semibold shadow-[var(--shadow-glow)]" disabled={loading}>
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar minha conta" : "Enviar link de recuperação"}
              </Button>
            </form>

            {mode !== "forgot" && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                {mode === "signin" ? "Ainda não tem conta na LUUD?" : "Já tem uma conta?"}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline font-semibold"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Criar grátis" : "Entrar"}
                </button>
              </p>
            )}
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-5">
            7 dias grátis • sem cartão de crédito • cancele quando quiser
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
