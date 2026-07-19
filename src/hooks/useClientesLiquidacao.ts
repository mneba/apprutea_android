import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { getClientesDia } from '../services/clientesLiquidacaoRepo';
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

// Formato do cache do contexto repassado pela tela quando ela decide que o
// CONTEXTO é a fonte única (liquidação aberta). Ver `usarCacheCtx` na tela.
export interface ClientesLiquidacaoSeed {
  raw: ClienteRotaDia[];
  pagasSet: Set<string>;
  pagMap: Map<string, PagamentoParcela>;
  clientesPagosNaLiq: Set<string>;
  ordemRotaMap: Map<string, number>;
  updatedAt: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────
//
// DOIS MODOS DE OPERAÇÃO
//
// 1) MODO ESPELHO  (enabled = false, seed presente)
//    A tela está na liquidação ABERTA. O contexto já carregou tudo; o hook
//    apenas espelha o `seed` no estado local e expõe setters para atualizações
//    otimistas (pagamento, estorno). ZERO queries — sem busca duplicada.
//
// 2) MODO AUTÔNOMO (enabled = true)
//    Visualização de liquidação passada/fechada, ou navegação por route-param
//    (liquidacaoId / dataLiquidacao). O contexto NÃO tem esses dados, então o
//    hook busca sozinho via repositório. Antes esse modo não existia: o hook
//    ignorava os params e sempre devolvia os dados da liquidação aberta.
//
// GARANTIA DE LOADING
//    `loading` sempre resolve. Três saídas:
//      a) seed.updatedAt > 0            → sincroniza e resolve
//      b) sem liqId + liq. já resolvida → estado vazio explícito, resolve
//      c) modo autônomo                 → resolve no fim do fetch (ok ou erro)
//    O bug anterior: `setLoading(false)` só existia dentro do efeito de sync,
//    que exigia `clientesUpdatedAt > 0`. Sem liquidação aberta o contexto zera
//    esse campo → o efeito nunca rodava → tela presa em "Carregando...".

interface UseClientesLiquidacaoParams {
  rotaId: string | null | undefined;
  dataLiq: string;
  liqId: string | null;
  /** true = busca própria (autônomo). false/undefined = espelha o `seed`. */
  enabled?: boolean;
  /** Cache do contexto (modo espelho). */
  seed?: ClientesLiquidacaoSeed;
  /** Recarga delegada ao contexto (modo espelho). */
  onReload?: (force?: boolean) => Promise<void>;
}

export default function useClientesLiquidacao({
  rotaId,
  dataLiq,
  liqId,
  enabled,
  seed,
  onReload,
}: UseClientesLiquidacaoParams) {
  const ctx = useLiquidacaoContext();

  // Default seguro: sem `seed` não há o que espelhar → autônomo.
  const autonomo = enabled ?? !seed;

  // Estado local — espelha o contexto, mas permite atualizações otimistas
  const [raw, setRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(new Set());
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ref para evitar loop: marca qual updatedAt do seed já foi absorvido
  const lastSeedUpdate = useRef(0);
  // Ref de concorrência do modo autônomo: só a resposta mais recente vale
  const reqIdRef = useRef(0);

  const limparEstado = useCallback(() => {
    setRaw([]);
    setPagasSet(new Set());
    setPagMap(new Map());
    setClientesPagosNaLiq(new Set());
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // MODO ESPELHO — sincronizar seed (contexto) → estado local
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (autonomo) return;

    const upd = seed?.updatedAt ?? 0;

    // (a) Contexto entregou dados novos → absorve
    if (upd > 0 && upd !== lastSeedUpdate.current) {
      lastSeedUpdate.current = upd;
      setRaw((seed!.raw || []) as ClienteRotaDia[]);
      setPagasSet(new Set(seed!.pagasSet));
      setPagMap(new Map(seed!.pagMap));
      setClientesPagosNaLiq(new Set(seed!.clientesPagosNaLiq));
      if (seed!.ordemRotaMap && seed!.ordemRotaMap.size > 0) {
        setOrdemRotaMap(new Map(seed!.ordemRotaMap));
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // (b) Não há liquidação e o contexto já terminou de decidir isso
    //     → estado vazio EXPLÍCITO. Sem isso, `loading` ficava preso em true.
    if (upd === 0 && !liqId && !ctx.loadingLiquidacao && !ctx.carregandoClientes) {
      lastSeedUpdate.current = 0;
      limparEstado();
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // (c) Há liqId mas os dados ainda não vieram → mantém spinner.
    //     Evita o flash de "nenhum cliente" na janela entre o contexto achar a
    //     liquidação e efetivamente começar a buscar os clientes.
    if (upd === 0 && liqId) {
      setLoading(true);
    }
  }, [
    autonomo,
    seed?.updatedAt,
    liqId,
    ctx.loadingLiquidacao,
    ctx.carregandoClientes,
    limparEstado,
  ]);

  // Modo espelho: refletir o loading do contexto enquanto ele busca
  useEffect(() => {
    if (autonomo) return;
    if (ctx.carregandoClientes) setLoading(true);
  }, [autonomo, ctx.carregandoClientes]);

  // ═══════════════════════════════════════════════════════════════════════
  // MODO AUTÔNOMO — busca própria via repositório
  // ═══════════════════════════════════════════════════════════════════════
  const buscarAutonomo = useCallback(async () => {
    if (!rotaId || !dataLiq) {
      limparEstado();
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const res = await getClientesDia({ rotaId, dataLiq, liqId });
      // Resposta obsoleta (params mudaram no meio do caminho) → descarta
      if (reqId !== reqIdRef.current) return;

      setRaw(res.raw as ClienteRotaDia[]);
      setPagasSet(res.pagasSet);
      setPagMap(res.pagMap as Map<string, PagamentoParcela>);
      setClientesPagosNaLiq(res.clientesPagosNaLiq);
      if (res.ordemRotaMap) setOrdemRotaMap(res.ordemRotaMap);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      console.error('Erro [hook autônomo] getClientesDia:', e);
      limparEstado();
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [rotaId, dataLiq, liqId, limparEstado]);

  useEffect(() => {
    if (!autonomo) return;
    buscarAutonomo();
  }, [autonomo, buscarAutonomo]);

  // ═══════════════════════════════════════════════════════════════════════
  // loadLiq — recarga sob demanda (pull-to-refresh, pós-pagamento, etc.)
  // ═══════════════════════════════════════════════════════════════════════
  const loadLiq = useCallback(async (force = false) => {
    if (!rotaId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (autonomo) {
      await buscarAutonomo();
      return;
    }

    // Modo espelho: delega ao contexto (fonte única).
    // Passa `true` sempre — comportamento idêntico ao anterior. O guard de
    // concorrência do contexto é furado justamente por esse `force` (item 5
    // do diagnóstico); quando ele for corrigido, este `force` volta a valer.
    const reload = onReload ?? ctx.recarregarClientes;
    await reload(true);
    setRefreshing(false);
  }, [rotaId, autonomo, buscarAutonomo, onReload, ctx.recarregarClientes]);

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