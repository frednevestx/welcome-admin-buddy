/**
 * A LUUD é gratuita: não existe mais bloqueio por plano.
 * Este componente foi neutralizado de propósito — ele apenas renderiza o
 * conteúdo. Mantido para não quebrar as páginas que ainda o envolvem.
 */
export function PlanGate({ children }: { min?: string; featureName?: string; description?: string; children: React.ReactNode }) {
  return <>{children}</>;
}
