import { useCallback, useEffect, useState } from 'react';
import {
  ClienteRotaDia,
  getClientesDia,
  PagamentoParcela,
} from '../services/clientesLiquidacaoRepo';
import { supabase } from '../services/supabase';

// Re-exporta os tipos para manter compatibilidade com quem importa daqui
export type { ClienteRotaDia, PagamentoParcela } from '../services/clientesLiquidacaoRepo';

// ─── Hook ───────────────────────────────────────────────────────────────────

// Espelho do cache do LiquidacaoContext (FASE 2.1).
// updatedAt > 0 = cache pronto. Enquanto 0, o hook mostra loading e aguarda.
export interface SeedClientesLiquidacao {
  raw: ClienteRotaDia[];
  pagasSet: Set<string>;
  pagMap: Map<string, PagamentoParcela>;
  clientesPagosNaLiq: Set<string>;
  ordemRotaMap: Map<string, number>;
  updatedAt: number;
}

interface UseClientesLiquidacaoParams {
  rotaId: string | null | undefined;
  dataLiq: string;
  liqId: string | null;
  // enabled=false → o CONTEXTO é a fonte; o hook NÃO busca sozinho, só espelha.
  // Default true → comportamento autônomo (viz/route-param).
  enabled?: boolean;
  seed?: SeedClientesLiquidacao;
  // Usado quando enabled=false: delega a recarga ao contexto (fonte única)
  onReload?: (force?: boolean) => Promise<void>;
}

export default function useClientesLiquidacao({
  rotaId, dataLiq, liqId, enabled = true, seed, onReload,
}: UseClientesLiquidacaoParams) {
  const usandoContexto = enabled === false;

  // Inicialização lazy: se o cache já está quente, começa com os dados (instantâneo)
  const [raw, setRaw] = useState<ClienteRotaDia[]>(() => seed?.raw ?? []);
  const [pagasSet, setPagasSet] = useState<Set<string>>(() => seed?.pagasSet ?? new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(() => seed?.pagMap ?? new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(() => seed?.clientesPagosNaLiq ?? new Set());
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(() => seed?.ordemRotaMap ?? new Map());
  // loading: se está usando contexto e o cache ainda não chegou (updatedAt=0), mostra loading
  const [loading, setLoading] = useState<boolean>(() =>
    usandoContexto ? !(seed && seed.updatedAt > 0) : true
  );
  const [refreshing, setRefreshing] = useState(false);

  const loadLiq = useCallback(async (force = false) => {
    // Modo contexto: delega a recarga ao contexto (uma fonte só). O espelho
    // abaixo sincroniza o estado local quando o contexto terminar.
    if (usandoContexto) {
      if (onReload) {
        setRefreshing(true);
        try { await onReload(force); } finally { setRefreshing(false); }
      }
      return;
    }
    // Modo autônomo (viz/route-param): busca direto do repositório
    if (!rotaId) {
      console.log('❌ loadLiq: rotaId não definido');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await getClientesDia({ rotaId, dataLiq, liqId });
      setRaw(res.raw);
      setPagMap(res.pagMap);
      setPagasSet(res.pagasSet);
      setClientesPagosNaLiq(res.clientesPagosNaLiq);
      if (res.ordemRotaMap) setOrdemRotaMap(res.ordemRotaMap);
    } catch (e) {
      console.error('Erro loadLiq:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usandoContexto, onReload, rotaId, dataLiq, liqId]);

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

  // ESPELHO — modo contexto: sincroniza o estado local sempre que o cache do
  // contexto for atualizado (resolve a corrida da montagem do app).
  useEffect(() => {
    if (!usandoContexto || !seed) return;
    if (seed.updatedAt > 0) {
      setRaw(seed.raw);
      setPagMap(seed.pagMap);
      setPagasSet(seed.pagasSet);
      setClientesPagosNaLiq(seed.clientesPagosNaLiq);
      setOrdemRotaMap(seed.ordemRotaMap);
      setLoading(false);
      console.log('⚡ Clientes espelhados do contexto (updatedAt=' + seed.updatedAt + ')');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usandoContexto, seed?.updatedAt]);

  // CARGA INICIAL — só busca sozinho no modo autônomo. No modo contexto, o
  // espelho acima cuida (sem busca duplicada).
  useEffect(() => {
    if (usandoContexto) return;
    loadLiq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLiq, usandoContexto]);

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