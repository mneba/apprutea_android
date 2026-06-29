import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { LiquidacaoDiaria } from '../types';
import { useAuth } from './AuthContext';
// FASE 2.0 — carga e tipos vêm do repositório compartilhado
import {
  ClienteRotaDia,
  getClientesDia,
  PagamentoParcela,
} from '../services/clientesLiquidacaoRepo';

export type Language = 'pt-BR' | 'es';

interface LiquidacaoContextType {
  // Liquidação atual (ABERTA/REABERTA)
  liquidacaoAtual: LiquidacaoDiaria | null;
  setLiquidacaoAtual: (l: LiquidacaoDiaria | null) => void;
  temLiquidacaoAberta: boolean;
  recarregarLiquidacao: () => Promise<void>;
  loadingLiquidacao: boolean;

  // ─── Clientes pré-carregados da liquidação (FASE 1) ───────────────────────
  clientesRaw: ClienteRotaDia[];
  pagasSet: Set<string>;
  pagMap: Map<string, PagamentoParcela>;
  clientesPagosNaLiq: Set<string>;
  ordemRotaMap: Map<string, number>;
  carregandoClientes: boolean;
  clientesUpdatedAt: number;
  recarregarClientes: (force?: boolean) => Promise<void>;
  recarregarTudo: () => Promise<void>;

  // Modo visualização (existente)
  modoVisualizacao: boolean;
  setModoVisualizacao: (v: boolean) => void;
  dataVisualizacao: string | null;
  setDataVisualizacao: (d: string | null) => void;
  liquidacaoIdVisualizacao: string | null;
  setLiquidacaoIdVisualizacao: (id: string | null) => void;

  // Idioma global
  language: Language;
  setLanguage: (lang: Language) => void;

  // ⭐ Sinal para resetar filtro de breadcrumb (após reset de cliente)
  resetFiltroSinal: number;
  dispararResetFiltro: () => void;
}

const LiquidacaoContext = createContext<LiquidacaoContextType>({
  liquidacaoAtual: null,
  setLiquidacaoAtual: () => {},
  temLiquidacaoAberta: false,
  recarregarLiquidacao: async () => {},
  loadingLiquidacao: false,

  clientesRaw: [],
  pagasSet: new Set(),
  pagMap: new Map(),
  clientesPagosNaLiq: new Set(),
  ordemRotaMap: new Map(),
  carregandoClientes: false,
  clientesUpdatedAt: 0,
  recarregarClientes: async () => {},
  recarregarTudo: async () => {},

  modoVisualizacao: false,
  setModoVisualizacao: () => {},
  dataVisualizacao: null,
  setDataVisualizacao: () => {},
  liquidacaoIdVisualizacao: null,
  setLiquidacaoIdVisualizacao: () => {},

  language: 'pt-BR',
  setLanguage: () => {},

  resetFiltroSinal: 0,
  dispararResetFiltro: () => {},
});

export function LiquidacaoProvider({ children }: { children: ReactNode }) {
  // idioma vem do AuthContext — única fonte de verdade, persiste no AsyncStorage
  const { vendedor, idioma, setIdioma } = useAuth();

  // Liquidação atual
  const [liquidacaoAtual, setLiquidacaoAtual] = useState<LiquidacaoDiaria | null>(null);
  const [loadingLiquidacao, setLoadingLiquidacao] = useState(false);

  // ─── Estado de clientes pré-carregados (FASE 1) ───────────────────────────
  const [clientesRaw, setClientesRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(new Set());
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(new Map());
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [clientesUpdatedAt, setClientesUpdatedAt] = useState(0);
  // Guard de concorrência — ignora recargas simultâneas
  const recarregandoClientesRef = useRef(false);

  // Modo visualização (existente)
  const [modoVisualizacao, setModoVisualizacao] = useState(false);
  const [dataVisualizacao, setDataVisualizacao] = useState<string | null>(null);
  const [liquidacaoIdVisualizacao, setLiquidacaoIdVisualizacao] = useState<string | null>(null);

  // Computed
  const temLiquidacaoAberta = !!(
    liquidacaoAtual?.id && 
    (liquidacaoAtual.status === 'ABERTO' || liquidacaoAtual.status === 'ABERTA' || liquidacaoAtual.status === 'REABERTO')
  );

  // Buscar liquidação aberta ao montar o contexto
  const recarregarLiquidacao = useCallback(async () => {
    if (!vendedor?.rota_id) return;

    setLoadingLiquidacao(true);
    try {
      const { data, error } = await supabase
        .from('liquidacoes_diarias')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .in('status', ['ABERTO', 'ABERTA', 'REABERTO'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) {
        setLiquidacaoAtual(data || null);
      }
    } catch (err) {
      console.error('Erro ao carregar liquidação:', err);
    } finally {
      setLoadingLiquidacao(false);
    }
  }, [vendedor?.rota_id]);

  // ─── Pré-carga de clientes (FASE 1 + 2.0) ─────────────────────────────────
  // Casca fina: deriva os params da liquidação ABERTA e delega ao repositório.
  const recarregarClientes = useCallback(async (force = false) => {
    const rotaId = vendedor?.rota_id;
    const liqId = liquidacaoAtual?.id ?? null;
    // data_liquidacao é date ('YYYY-MM-DD') — usar string crua (sem new Date, evita bug de timezone)
    const dataLiq = (liquidacaoAtual as any)?.data_liquidacao as string | undefined;

    if (!rotaId || !liqId || !dataLiq) {
      console.log('❌ [Ctx] recarregarClientes: faltam params', { rotaId, liqId, dataLiq });
      setClientesRaw([]);
      setPagasSet(new Set());
      setPagMap(new Map());
      setClientesPagosNaLiq(new Set());
      setOrdemRotaMap(new Map());
      return;
    }

    if (recarregandoClientesRef.current && !force) {
      console.log('⏭️ [Ctx] recarregarClientes: já em andamento, ignorando');
      return;
    }
    recarregandoClientesRef.current = true;
    setCarregandoClientes(true);
    try {
      const res = await getClientesDia({ rotaId, dataLiq, liqId });
      setClientesRaw(res.raw);
      setPagMap(res.pagMap);
      setPagasSet(res.pagasSet);
      setClientesPagosNaLiq(res.clientesPagosNaLiq);
      if (res.ordemRotaMap) setOrdemRotaMap(res.ordemRotaMap);
      setClientesUpdatedAt(Date.now());
    } catch (e) {
      console.error('Erro [Ctx] recarregarClientes:', e);
    } finally {
      setCarregandoClientes(false);
      recarregandoClientesRef.current = false;
    }
  }, [vendedor?.rota_id, liquidacaoAtual?.id, (liquidacaoAtual as any)?.data_liquidacao]);

  // Recarrega liquidação + clientes
  const recarregarTudo = useCallback(async () => {
    await recarregarLiquidacao();
    await recarregarClientes();
  }, [recarregarLiquidacao, recarregarClientes]);

  // Carregar liquidação ao montar e quando vendedor mudar
  useEffect(() => {
    if (vendedor?.rota_id) {
      recarregarLiquidacao();
    }
  }, [vendedor?.rota_id, recarregarLiquidacao]);

  // Pré-carga de clientes — dispara quando a liquidação atual muda (fire-and-forget)
  useEffect(() => {
    if (liquidacaoAtual?.id) {
      recarregarClientes();
    } else {
      // sem liquidação aberta — limpa cache
      setClientesRaw([]);
      setPagasSet(new Set());
      setPagMap(new Map());
      setClientesPagosNaLiq(new Set());
      setOrdemRotaMap(new Map());
      setClientesUpdatedAt(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidacaoAtual?.id]);

  // ⭐ Sinal para forçar reset de filtro de breadcrumb na ClientesScreen
  const [resetFiltroSinal, setResetFiltroSinal] = useState(0);
  const dispararResetFiltro = useCallback(() => {
    setResetFiltroSinal(prev => prev + 1);
  }, []);

  return (
    <LiquidacaoContext.Provider value={{
      liquidacaoAtual,
      setLiquidacaoAtual,
      temLiquidacaoAberta,
      recarregarLiquidacao,
      loadingLiquidacao,

      clientesRaw,
      pagasSet,
      pagMap,
      clientesPagosNaLiq,
      ordemRotaMap,
      carregandoClientes,
      clientesUpdatedAt,
      recarregarClientes,
      recarregarTudo,

      modoVisualizacao,
      setModoVisualizacao,
      dataVisualizacao,
      setDataVisualizacao,
      liquidacaoIdVisualizacao,
      setLiquidacaoIdVisualizacao,

      // Bridge com AuthContext — persiste no AsyncStorage e propaga para todas as telas
      language: idioma,
      setLanguage: setIdioma,

      resetFiltroSinal,
      dispararResetFiltro,
    }}>
      {children}
    </LiquidacaoContext.Provider>
  );
}

export function useLiquidacaoContext() {
  return useContext(LiquidacaoContext);
}