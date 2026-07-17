// Traduz mensagens de erro do Supabase Auth / Postgres para português.
const map: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email ou senha incorretos. Se acabou de criar a conta, confirme seu email antes de entrar."],
  [/email not confirmed/i, "Confirme seu email antes de entrar."],
  [/user already registered|already registered|already exists/i, "Este email já está cadastrado."],
  [/password should be at least/i, "A senha deve ter pelo menos 6 caracteres."],
  [/rate limit|too many requests/i, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
  [/network|failed to fetch/i, "Falha de conexão. Verifique sua internet."],
  [/unable to validate email address|invalid email/i, "Email inválido."],
  [/new password should be different/i, "A nova senha deve ser diferente da atual."],
  [/token has expired|invalid.*token/i, "Link expirado ou inválido. Solicite um novo email."],
  [/user not found/i, "Usuário não encontrado."],
  [/session.*expired|jwt expired/i, "Sessão expirada. Entre novamente."],
  [/permission denied for function has_role/i, "Erro de permissão no servidor. Atualize a página e tente novamente."],
  [/permission denied/i, "Você não tem permissão para essa ação."],
  [/duplicate key|unique constraint/i, "Este registro já existe."],
  [/violates foreign key/i, "Não é possível concluir: há dados relacionados."],
  [/violates check constraint/i, "Valor inválido."],
  [/not authorized/i, "Ação não autorizada."],
];

export function translateAuthError(err: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  const msg =
    (err as { message?: string } | null)?.message ??
    (typeof err === "string" ? err : "");
  if (!msg) return fallback;
  for (const [re, pt] of map) if (re.test(msg)) return pt;
  return msg;
}
