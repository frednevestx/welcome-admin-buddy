import { useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { supabase } from "@/integrations/supabase/client";

export interface TourStepDef {
  selector: string;
  title: string;
  description: string;
  side?: "left" | "right" | "top" | "bottom";
  align?: "start" | "center" | "end";
}

const STEPS: TourStepDef[] = [
  {
    selector: '[data-tour="brand"]',
    title: "Bem-vindo à LUUD",
    description: "Sua central de inteligência financeira. Você vai encontrar sua marca sempre aqui no topo do menu.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-dashboard"]',
    title: "1. Dashboard",
    description: "Visão geral em tempo real: faturamento, custos, lucro e ticket médio. Seu ponto de partida diário.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-movimentacoes"]',
    title: "2. Movimentações",
    description: "Registre entradas e saídas manualmente. Mantém o caixa 100% preciso.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-importacoes"]',
    title: "3. Importações",
    description: "Importe planilhas do iFood e outros sistemas para consolidar tudo automaticamente.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-metas"]',
    title: "4. Metas",
    description: "Defina objetivos de faturamento e acompanhe o progresso todos os dias.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-cmv"]',
    title: "5. CMV — PRO",
    description: "Custo da Mercadoria Vendida: descubra exatamente quanto cada prato realmente custa.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-calculadora-preco"]',
    title: "6. Calculadora de Preço — PRO",
    description: "Descubra o preço ideal de venda com base em custos, margem e concorrência.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-lucro-plataforma"]',
    title: "7. Lucro por Plataforma — PRO",
    description: "Compare quanto sobra em cada canal: iFood, salão, delivery próprio.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-assistente-ia"]',
    title: "8. Assistente IA — Premium",
    description: "Uma IA que analisa seu restaurante e te diz o que fazer para lucrar mais.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-suporte"]',
    title: "9. Suporte",
    description: "Abra um ticket a qualquer momento. Resposta automática imediata + humano em até 12h.",
    side: "right",
  },
  {
    selector: '[data-tour="menu-configuracoes"]',
    title: "10. Configurações",
    description: "Edite dados do restaurante, foto, tema e cor principal. Você pode refazer este tour aqui.",
    side: "right",
  },
];

async function markTourComplete(restaurantId?: string) {
  if (!restaurantId) return;
  await supabase.from("restaurants").update({ tour_completed: true } as any).eq("id", restaurantId);
}

export function useProductTour() {
  return useCallback((options?: { restaurantId?: string; onDone?: () => void }) => {
    const usableSteps = STEPS
      .map((s) => ({
        ...s,
        element: document.querySelector(s.selector) as HTMLElement | null,
      }))
      .filter((s) => s.element);

    if (usableSteps.length === 0) return;

    const d = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: "rgba(0,0,0,0.6)",
      nextBtnText: "Próximo",
      prevBtnText: "Voltar",
      doneBtnText: "Concluir",
      progressText: "{{current}} de {{total}}",
      onDestroyed: () => {
        markTourComplete(options?.restaurantId).catch(() => undefined);
        options?.onDone?.();
      },
      steps: usableSteps.map((s) => ({
        element: s.selector,
        popover: {
          title: s.title,
          description: s.description,
          side: s.side ?? "right",
          align: s.align ?? "center",
        },
      })),
    });

    d.drive();
  }, []);
}
