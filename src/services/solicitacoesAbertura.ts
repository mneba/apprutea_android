// =====================================================================
// SOLICITAÇÕES DE ABERTURA — conflito com o dia que se vai abrir
// Arquivo: src/services/solicitacoesAbertura.ts
// =====================================================================
//
// Um pedido de abrir dia passado nasce justamente quando NÃO há liquidação
// aberta. Toda a limpeza de solicitações pendentes está pendurada no
// FECHAMENTO da liquidação, então um pedido desses não tem a que se prender e
// ficava PENDENTE para sempre.
//
// O momento de resolver é a ABERTURA de outro dia: ali o pedido vira
// contradição. Chame `buscarConflitos` antes de abrir; se vier alguma coisa,
// pergunte ao vendedor antes de seguir.
//
// SQL: sql/2026-09-21_solicitacao_abertura_conflito.sql

import { supabase } from './supabase';

export interface ConflitoAbertura {
  id: string;
  tipo_solicitacao: string;
  /** Dia que o vendedor pediu para abrir, `YYYY-MM-DD`. */
  data_solicitada: string | null;
  motivo_solicitacao: string | null;
  created_at: string;
  expira_em: string | null;
  vencida: boolean;
  vendedor_nome: string | null;
}

/**
 * Pedidos de abertura pendentes da rota para um dia DIFERENTE de `dataAlvo`.
 *
 * `dataAlvo` nulo = abrindo o próximo dia natural; o servidor resolve qual é
 * pela `fn_data_hoje_rota`, não pelo relógio do aparelho.
 *
 * Nunca lança: falha aqui não pode impedir o vendedor de abrir o dia. O pior
 * caso é o pedido continuar pendente até a próxima abertura.
 */
export async function buscarConflitos(
  rotaId: string,
  dataAlvo?: string | null,
): Promise<ConflitoAbertura[]> {
  try {
    const { data, error } = await supabase.rpc('fn_solicitacoes_abertura_pendentes', {
      p_rota_id: rotaId,
      p_data_alvo: dataAlvo || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? (data as ConflitoAbertura[]) : [];
  } catch (e) {
    console.error('❌ Conflitos de abertura:', e);
    return [];
  }
}

/** Encerra os pedidos — o vendedor desistiu ao abrir outro dia. */
export async function encerrarConflitos(
  conflitos: ConflitoAbertura[],
  userId: string | null,
  motivo = 'Cancelada pelo vendedor ao abrir outro dia',
): Promise<void> {
  for (const c of conflitos) {
    try {
      await supabase.rpc('fn_encerrar_solicitacao_abertura', {
        p_solicitacao_id: c.id,
        p_user_id: userId,
        p_motivo: motivo,
      });
    } catch (e) {
      console.error('❌ Encerrar solicitação:', e);
    }
  }
}

/** `YYYY-MM-DD` → `DD/MM`. Só para o texto do aviso. */
export const diaCurto = (iso?: string | null) => {
  if (!iso) return '—';
  const [, m, d] = String(iso).substring(0, 10).split('-');
  return m && d ? `${d}/${m}` : '—';
};
