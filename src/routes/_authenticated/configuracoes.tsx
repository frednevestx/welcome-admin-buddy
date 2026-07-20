import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTheme, type Accent, type Mode } from "@/hooks/use-theme";
import { Sun, Moon, Check, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RestaurantAvatar } from "@/components/restaurant-avatar";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
});

const ACCENT_OPTIONS: { key: Accent; label: string; color: string }[] = [
  { key: "green",  label: "Verde",   color: "oklch(0.72 0.18 148)" },
  { key: "blue",   label: "Azul",    color: "oklch(0.68 0.17 245)" },
  { key: "orange", label: "Laranja", color: "oklch(0.72 0.19 55)"  },
  { key: "yellow", label: "Amarelo", color: "oklch(0.82 0.17 90)"  },
  { key: "purple", label: "Roxo",    color: "oklch(0.68 0.2 300)"  },
];

interface FormState {
  name: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  estado: string;
  whatsapp: string;
  email: string;
}

const EMPTY: FormState = { name: "", razao_social: "", cnpj: "", cidade: "", estado: "", whatsapp: "", email: "" };

function SettingsPage() {
  const { restaurant, profile, refetch } = useRestaurant();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const { mode, accent, setMode, setAccent } = useTheme();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setForm({
      name: restaurant.name ?? "",
      razao_social: restaurant.razao_social ?? "",
      cnpj: restaurant.cnpj ?? "",
      cidade: restaurant.cidade ?? "",
      estado: restaurant.estado ?? "",
      whatsapp: restaurant.whatsapp ?? "",
      email: restaurant.email ?? "",
    });
  }, [restaurant]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!restaurant) return;
      if (!form.name.trim()) throw new Error("O nome do restaurante é obrigatório");
      const { error } = await supabase.from("restaurants").update({
        name: form.name.trim(),
        razao_social: form.razao_social.trim() || null,
        cnpj: form.cnpj.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
      }).eq("id", restaurant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alterações salvas"); refetch(); qc.invalidateQueries(); },
    onError: (e: unknown) => toast.error(translateAuthError(e, "Erro ao salvar")),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !restaurant?.id) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${restaurant.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("restaurant-avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("restaurant-avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      const { error: updErr } = await supabase.from("restaurants").update({ avatar_url: signed.signedUrl }).eq("id", restaurant.id);
      if (updErr) throw updErr;
      toast.success("Foto atualizada!");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados do restaurante, foto e aparência.</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group"
            disabled={uploading || !restaurant?.id}
            title="Trocar foto"
          >
            <RestaurantAvatar name={form.name || restaurant?.name} avatarUrl={restaurant?.avatar_url} size={72} />
            <span className="absolute inset-0 rounded-full grid place-items-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{form.name || "Seu restaurante"}</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-primary hover:underline"
              disabled={uploading || !restaurant?.id}
            >
              {uploading ? "Enviando..." : "Trocar foto"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do restaurante <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Razão social</Label>
            <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.estado} onChange={(e) => set("estado", e.target.value)} placeholder="Ex: SP" maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 90000-0000" />
          </div>
          <div className="space-y-2">
            <Label>E-mail de contato</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@seurestaurante.com" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>E-mail da conta</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Aparência</h2>
          <p className="text-xs text-muted-foreground mt-1">Escolha o modo e a cor principal do sistema.</p>
        </div>

        <div className="space-y-2">
          <Label>Modo</Label>
          <div className="flex gap-2">
            {(["dark", "light"] as Mode[]).map((m) => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m)}
                className="gap-2"
              >
                {m === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {m === "dark" ? "Escuro" : "Claro"}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor principal <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <div className="flex flex-wrap gap-3">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAccent(opt.key)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                  accent === opt.key ? "border-primary bg-secondary/60" : "border-border hover:bg-secondary/40"
                )}
              >
                <span
                  className="relative h-9 w-9 rounded-full ring-1 ring-border"
                  style={{ background: opt.color }}
                >
                  {accent === opt.key && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-background" />
                  )}
                </span>
                <span className="text-xs">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
