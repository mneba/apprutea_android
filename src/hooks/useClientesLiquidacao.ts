import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { supabase } from '../services/supabase';

// ─── Types (re-exportados do repo) ──────────────────────────────────────────

export interface ClienteRotaDia {
  cliente_id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  foto_url: string | null;
  latitude: number | null; longitude: number | null;
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  numero_parcelas: number; status_emprestimo: string; rota_id: string;
  frequencia_pagamento: string; parcela_id: string; numero_parcela: number;
  valor_parcela: number; valor_pago_parcela: number; saldo_parcela: number;
  status_parcela: string; data_vencimento: string; ordem_visita_dia: number | null;
  liquidacao_id: string | null; tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  permite_emprestimo_adicional: boolean; is_parcela_atrasada?: boolean;
  data_emprestimo?: string; cliente_created_at?: string;
}

export interface PagamentoParcela {
  parcela_id: string; cliente_id: string; valor_pago_atual: number;
  valor_credito_gerado: number; valor_parcela: number; data_pagamento: string;
  created_at?: string; liquidacao_id?: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────
// Wrapper fino sobre o LiquidacaoContext.
// NÃO faz queries próprias — espelha os dados do contexto e expõe setters
// para atualizações otimistas (pagamento, estorno).

interface UseClientesLiquidacaoParams {
  rotaId: string | null | undefined;
  dataLiq: string;
  liqId: string | null;
}

export default function useClientesLiquidacao({ rotaId, dataLiq, liqId }: UseClientesLiquidacaoParams) {
  const ctx = useLiquidacaoContext();

  // Estado local — espelha o contexto, mas permite atualizações otimistas
  const [raw, setRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(new Set());
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ref para evitar loop: marca quando dados vieram do contexto
  const lastCtxUpdate = useRef(0);

  // ═══════════════════════════════════════════════════════════════════════
  // Sincronizar contexto → estado local (quando contexto atualiza)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (ctx.clientesUpdatedAt > 0 && ctx.clientesUpdatedAt !== lastCtxUpdate.current) {
      lastCtxUpdate.current = ctx.clientesUpdatedAt;
      console.log('⚡ Clientes espelhados do contexto (updatedAt=' + ctx.clientesUpdatedAt + ')');
      setRaw(ctx.clientesRaw as ClienteRotaDia[]);
      setPagasSet(new Set(ctx.pagasSet));
      setPagMap(new Map(ctx.pagMap as Map<string, PagamentoParcela>));
      setClientesPagosNaLiq(new Set(ctx.clientesPagosNaLiq));
      if (ctx.ordemRotaMap.size > 0) setOrdemRotaMap(new Map(ctx.ordemRotaMap));
      setLoading(false);
      setRefreshing(false);
    }
  }, [ctx.clientesUpdatedAt]);

  // Se o contexto ainda está carregando na montagem, refletir no loading
  useEffect(() => {
    if (ctx.carregandoClientes) setLoading(true);
  }, [ctx.carregandoClientes]);

  // ═══════════════════════════════════════════════════════════════════════
  // loadLiq: delega ao contexto (sem queries próprias)
  // ═══════════════════════════════════════════════════════════════════════
  const loadLiq = useCallback(async () => {
    if (!rotaId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    await ctx.recarregarClientes(true);
    setRefreshing(false);
  }, [rotaId, ctx.recarregarClientes]);

  // Atualiza saldo do empréstimo localmente após pagamento — sem recarregar tudo
  const atualizarSaldoLocal = useCallback(async (emprestimoId: string) => {
    if (!emprestimoId) return;
    const { data } = await supabase
      .from('emprestimos')
      .select('id, valor_saldo, status')
      .eq('id', emprestimoId)
      .single();
    if (!data) return;
    const novoSaldo = data.valor_saldo ?? 0;
    setRaw(prev => prev.map(r =>
      r.emprestimo_id === emprestimoId
        ? { ...r, saldo_emprestimo: novoSaldo }
        : r
    ));
  }, []);

  return {
    raw,
    setRaw,
    pagasSet,
    setPagasSet,
    pagMap,
    setPagMap,
    clientesPagosNaLiq,
    setClientesPagosNaLiq,
    ordemRotaMap,
    setOrdemRotaMap,
    loading,
    setLoading,
    refreshing,
    setRefreshing,
    loadLiq,
    atualizarSaldoLocalLiq: atualizarSaldoLocal,
  };
}