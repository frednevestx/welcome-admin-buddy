import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestAccessCode, verifyAccessCode } from "@/lib/auth/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/acesso")({
  ssr: false,
  component: AccessPage,
  head: () => ({
    meta: [
      { title: "Entrar com o WhatsApp | LUUD" },
      { name: "description", content: "Receba um código de 6 dígitos no WhatsApp e acesse o painel da LUUD." },
      { property: "og:title", content: "Entrar com o WhatsApp | LUUD" },
      { property: "og:description", content: "Acesso rápido ao painel financeiro da LUUD pelo seu WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AccessPage() {
  const navigate = useNavigate();
  const askCode = useServerFn(requestAccessCode);
  const checkCode = useServerFn(verifyAccessCode);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);

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

  return (
    <main className="min-h-screen grid place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar com o WhatsApp</CardTitle>
          <p className="text-sm text-muted-foreground">
            Grátis para todos. Sem mensalidade.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Seu WhatsApp</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  placeholder="(62) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleSend} disabled={loading || phone.length < 10}>
                {loading ? "Enviando…" : "Enviar código pelo WhatsApp"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Ainda não usa a LUUD? Mande uma mensagem no WhatsApp da LUUD para criar seu acesso.
              </p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Código de 6 dígitos</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button className="w-full" onClick={handleVerify} disabled={loading || code.length !== 6}>
                {loading ? "Validando…" : "Entrar"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("phone")} disabled={loading}>
                Trocar número / reenviar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
