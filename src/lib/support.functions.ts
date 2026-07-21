import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPPORT_SYSTEM = `Você é o assistente de suporte da LUUD — uma plataforma de inteligência financeira para restaurantes e delivery.
Seu papel é responder dúvidas simples e comuns do usuário sobre a plataforma de forma rápida, amigável e em português do Brasil.

Regras:
- Responda apenas se tiver certeza da resposta com base no conhecimento sobre a LUUD abaixo.
- Se a dúvida for muito específica, envolver dados do restaurante, cobrança, bug técnico, alteração de plano manual, integração customizada, ou qualquer coisa que exija ação humana — responda EXATAMENTE: "ESCALAR_HUMANO".
- Nunca invente funcionalidades. Nunca prometa prazos.
- Máximo 6 linhas. Markdown simples. Sem cabeçalhos, sem tabelas.
- Sempre encerre indicando que, se não resolver, um humano responde em até 12h.

Conhecimento da LUUD:
- Planos: Básico (grátis), Pro (recursos avançados: CMV, Calculadora de Preço, Lucro por Plataforma, Fornecedores, Histórico de Preços, Simulador, Relatórios) e Premium (inclui o Assistente IA financeiro).
- Trial: novos usuários ganham 7 dias de Premium automaticamente.
- Login: e-mail/senha ou Google. Se der erro no Google, o usuário deve tentar de novo — o broker atualiza o token.
- Restaurante: cada conta cadastra 1 restaurante em Configurações (nome, CNPJ, cidade, estado, WhatsApp, foto).
- Foto do restaurante: trocada em Configurações > Trocar foto (também acessível pelo avatar no rodapé do menu lateral).
- Tema: claro/escuro em Configurações > Aparência.
- Refazer tutorial: Configurações > Aparência > "Refazer tour".
- Movimentações: registra entradas e saídas manualmente.
- Importações: importa planilhas do iFood.
- Metas: define objetivos de faturamento.
- Assistente IA (Premium): responde perguntas sobre o próprio restaurante.
- Suporte humano responde em até 12 horas.`;

interface AutoReplyInput {
  ticketId: string;
  userMessage: string;
}

export const autoReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as AutoReplyInput;
    if (!d?.ticketId || !d?.userMessage) throw new Error("ticketId e userMessage obrigatórios");
    return d;
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { skipped: true, reason: "no_api_key" };

    const { supabase, userId } = context as any;

    // Confirm the caller owns the ticket
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (tErr || !ticket || ticket.user_id !== userId) {
      return { skipped: true, reason: "not_owner" };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: SUPPORT_SYSTEM },
          { role: "user", content: `Assunto do ticket: ${ticket.subject}\n\nMensagem: ${data.userMessage}` },
        ],
      }),
    });

    if (!res.ok) return { skipped: true, reason: `status_${res.status}` };
    const json = (await res.json()) as any;
    const content: string = (json.choices?.[0]?.message?.content ?? "").trim();

    if (!content || content.includes("ESCALAR_HUMANO")) {
      return { skipped: true, reason: "escalate" };
    }

    const finalContent = `${content}\n\n_Resposta automática. Se não resolveu, nossa equipe humana responde em até 12h._`;

    const { error: insErr } = await supabase.from("support_messages").insert({
      ticket_id: data.ticketId,
      author_id: null,
      author_role: "ai",
      body: finalContent,
      attachments: [],
    });
    if (insErr) return { skipped: true, reason: "insert_failed" };

    return { skipped: false };
  });
