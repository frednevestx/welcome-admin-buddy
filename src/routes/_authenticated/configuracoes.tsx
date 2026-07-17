import { translateAuthError } from "@/lib/auth-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme, type Accent, type Mode } from "@/hooks/use-theme";
import { Sun, Moon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

function SettingsPage() {
  const { restaurant, profile, refetch } = useRestaurant();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { mode, accent, setMode, setAccent } = useTheme();

  useEffect(() => { if (restaurant) setName(restaurant.name); }, [restaurant]);

  const save = useMutation({
    mutationFn: async () => {
      if (!restaurant) return;
      const { error } = await supabase.from("restaurants").update({ name }).eq("id", restaurant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvo"); refetch(); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(translateAuthError(e, "Erro")),
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados do restaurante e aparência.</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-semibold">Restaurante</h2>
        <div className="space-y-2">
          <Label>Nome do restaurante</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email da conta</Label>
          <Input value={profile?.email ?? ""} disabled />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
          {save.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Tema</h2>
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
          <Label>Cor principal</Label>
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

