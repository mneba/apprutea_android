// =====================================================================
// O LOG DETALHADO DO APP — DESLIGADO POR PADRÃO
// Arquivo: src/services/auditoriaApp.ts
// =====================================================================
//
// POR QUE ELE NASCE DESLIGADO
// Log que registra todo passo do vendedor incha e custa escrita no caminho
// mais quente do sistema. Este projeto já desligou um mecanismo assim: o
// gatilho que reescrevia `clientes` 133 vezes por registro, escrito por cinco
// funções e lido por nenhuma (ver CLAUDE.md). A chave aqui é
// `configuracoes_vendedor.ativar_auditoria_movel`, por vendedor, hoje
// desligada para todos — o uso que ela serve é "ligar para o vendedor X por
// uma semana porque tem algo errado", não arquivo permanente.
//
// Até 13/10/2026 essa coluna existia e NÃO ERA LIDA POR NADA: botão na tela
// do cadastro, ligado a fio nenhum. Este módulo é o fio.
//
// O QUE VALE A PENA REGISTRAR, E O QUE NÃO
// Pagamento, estorno, venda, abertura e fechamento JÁ deixam rastro próprio —
// `pagamentos_parcelas.user_id`, `estornado_por` + `data_estorno`,
// `criado_por_user_id`, `aberto_por`, `fechado_por`. Gravá-los aqui seria
// repetir o que o banco já sabe, com custo e sem informação nova.
//
// O que as tabelas NÃO conseguem contar é o que não chegou a acontecer:
// pagamento que falhou, ação recusada, sessão que caiu no meio. É o que
// responde "o vendedor jura que registrou e não saiu" — e é raro por
// natureza, o que mantém o volume baixo pela origem e não por filtro.
//
// NUNCA DERRUBA A OPERAÇÃO. Toda falha aqui é engolida: um log que quebra o
// pagamento é pior do que log nenhum.

import { supabase } from './supabase';

/** `acao` nasce com este prefixo para o expurgo saber o que é descartável. */
const PREFIXO = 'APP_';

export type AcaoApp =
  | 'PAGAMENTO_FALHOU'
  | 'ESTORNO_FALHOU'
  | 'VENDA_FALHOU'
  | 'SESSAO_RECUPERADA'
  | 'ACAO_RECUSADA';

// `null` = ainda não perguntamos. Depois da primeira pergunta, fica decidido
// para a sessão inteira: a configuração não muda no meio da rota, e consultar
// de novo a cada evento anularia o ponto de ter uma chave.
let ativa: boolean | null = null;
let vendedorDaConsulta: string | null = null;

async function estaAtiva(vendedorId: string): Promise<boolean> {
  if (ativa !== null && vendedorDaConsulta === vendedorId) return ativa;

  try {
    const { data } = await supabase
      .from('configuracoes_vendedor')
      .select('ativar_auditoria_movel')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    // Ausente é DESLIGADO. É o oposto do `permitir_exclusao_parcelas`, e de
    // propósito: configuração que não existe não pode ligar escrita sozinha.
    ativa = (data as any)?.ativar_auditoria_movel === true;
  } catch {
    ativa = false;
  }

  vendedorDaConsulta = vendedorId;
  return ativa;
}

/** Chamado ao trocar de sessão: a chave do próximo vendedor pode ser outra. */
export function esquecerAuditoria() {
  ativa = null;
  vendedorDaConsulta = null;
}

export interface ContextoAcao {
  vendedorId: string;
  /** Id do que a ação tentava mexer: parcela, empréstimo, liquidação. */
  registroId?: string | null;
  /** O que aconteceu, em texto legível por quem investiga. */
  detalhe?: string | null;
  /** Qualquer dado que ajude a entender — valores, códigos de erro. */
  dados?: Record<string, unknown>;
}

/**
 * Registra uma ação, se a chave estiver ligada.
 *
 * Não é esperado com `await` nos pontos de chamada: o vendedor não pode ficar
 * olhando a tela parada porque um log está sendo gravado. Devolve a promessa
 * para quem quiser aguardar em teste.
 */
export async function registrarAcao(acao: AcaoApp, ctx: ContextoAcao): Promise<void> {
  try {
    if (!ctx.vendedorId) return;
    if (!(await estaAtiva(ctx.vendedorId))) return;

    await supabase.from('audit_logs').insert({
      tabela: 'app_vendedor',
      registro_id: ctx.registroId || null,
      acao: PREFIXO + acao,
      dados_novos: {
        detalhe: ctx.detalhe || null,
        vendedor_id: ctx.vendedorId,
        ...(ctx.dados || {}),
      },
      usuario_id: null,
    });
  } catch (e) {
    // Engolido de propósito. Ver o aviso do topo.
    console.log('[auditoria] não registrou:', e);
  }
}
