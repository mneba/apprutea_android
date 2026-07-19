import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Retorna a liquidação encontrada — permite encadear sem esperar o state. */
  recarregarLiquidacao: () => Promise<LiquidacaoDiaria | null>;
  loadingLiquidacao: boolean;

  // ─── Clientes pré-carregados da liquidação (FASE 1) ───────────────────────
  clientesRaw: ClienteRotaDia[];
  pagasSet: Set<string>;
  pagMap: Map<string, PagamentoParcela>;
  clientesPagosNaLiq: Set<string>;
  ordemRotaMap: Map<string, number>;
  carregandoClientes: boolean;
  clientesUpdatedAt: number;
  /** `liqOverride` evita depender do state já ter propagado (ver recarregarTudo). */
  recarregarClientes: (force?: boolean, liqOverride?: LiquidacaoDiaria | null) => Promise<void>;
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
  recarregarLiquidacao: async () => null,
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

  // Espelho em ref, atualizado no corpo do render (portanto ANTES de qualquer
  // efeito rodar). Permite que recarregarClientes leia sempre o valor atual
  // sem colocar `liquidacaoAtual` nas suas dependências — o que faria a função
  // trocar de identidade a cada mudança e derrubar o useMemo do value.
  const liquidacaoAtualRef = useRef<LiquidacaoDiaria | null>(null);
  liquidacaoAtualRef.current = liquidacaoAtual;

  // ─── Estado de clientes pré-carregados (FASE 1) ───────────────────────────
  const [clientesRaw, setClientesRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(new Set());
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(new Map());
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [clientesUpdatedAt, setClientesUpdatedAt] = useState(0);

  // Dedupe de chamadas NÃO forçadas (evita rajada de requisições iguais)
  const recarregandoClientesRef = useRef(false);
  // ⭐ Request-id: só a resposta MAIS RECENTE pode escrever no state.
  //    Antes, `force = true` furava o guard booleano e duas cargas corriam em
  //    paralelo; a primeira a terminar liberava o ref e desligava o loading
  //    enquanto a outra ainda rodava — o último a responder ganhava, podendo
  //    ser o mais ANTIGO. Com request-id, respostas obsoletas são descartadas.
  const reqIdRef = useRef(0);
  // Chave `liqId|data_liquidacao` da última carga concluída — evita que o
  // useEffect refaça o trabalho que recarregarTudo acabou de executar.
  const chaveCarregadaRef = useRef<string | null>(null);

  // Modo visualização (existente)
  const [modoVisualizacao, setModoVisualizacao] = useState(false);
  const [dataVisualizacao, setDataVisualizacao] = useState<string | null>(null);
  const [liquidacaoIdVisualizacao, setLiquidacaoIdVisualizacao] = useState<string | null>(null);

  // ⭐ Sinal para forçar reset de filtro de breadcrumb na ClientesScreen
  const [resetFiltroSinal, setResetFiltroSinal] = useState(0);
  const dispararResetFiltro = useCallback(() => {
    setResetFiltroSinal(prev => prev + 1);
  }, []);

  // Computed
  const temLiquidacaoAberta = !!(
    liquidacaoAtual?.id &&
    (liquidacaoAtual.status === 'ABERTO' || liquidacaoAtual.status === 'ABERTA' || liquidacaoAtual.status === 'REABERTO')
  );

  const limparCacheClientes = useCallback(() => {
    setClientesRaw([]);
    setPagasSet(new Set());
    setPagMap(new Map());
    setClientesPagosNaLiq(new Set());
    setOrdemRotaMap(new Map());
    chaveCarregadaRef.current = null;
  }, []);

  // ─── Buscar liquidação aberta ─────────────────────────────────────────────
  // Retorna o registro encontrado para permitir encadeamento imediato, sem
  // depender do setState ter propagado (ver recarregarTudo).
  const recarregarLiquidacao = useCallback(async (): Promise<LiquidacaoDiaria | null> => {
    if (!vendedor?.rota_id) return null;

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

      if (error) return null;

      const liq = (data || null) as LiquidacaoDiaria | null;
      setLiquidacaoAtual(liq);
      return liq;
    } catch (err) {
      console.error('Erro ao carregar liquidação:', err);
      return null;
    } finally {
      setLoadingLiquidacao(false);
    }
  }, [vendedor?.rota_id]);

  // ─── Pré-carga de clientes (FASE 1 + 2.0) ─────────────────────────────────
  // Casca fina: deriva os params da liquidação ABERTA e delega ao repositório.
  //
  // `liqOverride` permite passar uma liquidação recém-buscada explicitamente,
  // em vez de ler `liquidacaoAtual` da closure — que pode estar desatualizada.
  const recarregarClientes = useCallback(async (
    force = false,
    liqOverride?: LiquidacaoDiaria | null,
  ) => {
    // `undefined` = sem override; `null` = override explícito "não há liquidação"
    const liq = liqOverride !== undefined ? liqOverride : liquidacaoAtualRef.current;

    const rotaId = vendedor?.rota_id;
    const liqId = liq?.id ?? null;
    // data_liquidacao é date ('YYYY-MM-DD') — usar string crua (sem new Date, evita bug de timezone)
    const dataLiq = (liq as any)?.data_liquidacao as string | undefined;

    if (!rotaId || !liqId || !dataLiq) {
      console.log('❌ [Ctx] recarregarClientes: faltam params', { rotaId, liqId, dataLiq });
      limparCacheClientes();
      return;
    }

    if (recarregandoClientesRef.current && !force) {
      console.log('⏭️ [Ctx] recarregarClientes: já em andamento, ignorando');
      return;
    }

    const reqId = ++reqIdRef.current;
    recarregandoClientesRef.current = true;
    setCarregandoClientes(true);
    try {
      const res = await getClientesDia({ rotaId, dataLiq, liqId });

      // Resposta obsoleta — uma carga mais recente já assumiu. Descarta.
      if (reqId !== reqIdRef.current) {
        console.log('⏮️ [Ctx] recarregarClientes: resposta obsoleta descartada');
        return;
      }

      setClientesRaw(res.raw);
      setPagMap(res.pagMap);
      setPagasSet(res.pagasSet);
      setClientesPagosNaLiq(res.clientesPagosNaLiq);
      if (res.ordemRotaMap) setOrdemRotaMap(res.ordemRotaMap);
      setClientesUpdatedAt(Date.now());
      chaveCarregadaRef.current = `${liqId}|${dataLiq}`;
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      console.error('Erro [Ctx] recarregarClientes:', e);
    } finally {
      // Só a requisição vigente pode desligar o loading / liberar o guard.
      if (reqId === reqIdRef.current) {
        setCarregandoClientes(false);
        recarregandoClientesRef.current = false;
      }
    }
  }, [vendedor?.rota_id, limparCacheClientes]);

  // ─── Recarrega liquidação + clientes ──────────────────────────────────────
  // A liquidação recém-buscada é repassada DIRETO para recarregarClientes.
  // Antes, `recarregarClientes()` era chamado sem argumento e lia a closure
  // antiga: ao ABRIR uma liquidação, a closure ainda tinha `null`, o early
  // return limpava o cache e a lista piscava vazia até o useEffect consertar.
  const recarregarTudo = useCallback(async () => {
    const liq = await recarregarLiquidacao();
    await recarregarClientes(true, liq);
  }, [recarregarLiquidacao, recarregarClientes]);

  // Carregar liquidação ao montar e quando vendedor mudar
  useEffect(() => {
    if (vendedor?.rota_id) {
      recarregarLiquidacao();
    }
  }, [vendedor?.rota_id, recarregarLiquidacao]);

  // Pré-carga de clientes — dispara quando a liquidação atual muda.
  // Observa também `data_liquidacao`: o mesmo id pode ter a data corrigida
  // (reabertura / ajuste operacional) e antes isso não recarregava nada.
  const dataLiqAtual = (liquidacaoAtual as any)?.data_liquidacao as string | undefined;
  useEffect(() => {
    const id = liquidacaoAtual?.id;

    if (!id || !dataLiqAtual) {
      // sem liquidação aberta — limpa cache
      limparCacheClientes();
      setClientesUpdatedAt(0);
      return;
    }

    // Já carregado para esta chave (ex.: recarregarTudo acabou de fazer)
    if (chaveCarregadaRef.current === `${id}|${dataLiqAtual}`) return;

    recarregarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidacaoAtual?.id, dataLiqAtual]);

  // ═══════════════════════════════════════════════════════════════════════
  // ⭐ value memoizado
  //    Sem useMemo, o objeto literal ganhava identidade nova a cada render do
  //    provider e TODOS os consumidores re-renderizavam junto — inclusive as
  //    listas de clientes. Regressão de merge: o useMemo já existiu aqui.
  // ═══════════════════════════════════════════════════════════════════════
  const value = useMemo<LiquidacaoContextType>(() => ({
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
  }), [
    liquidacaoAtual,
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
    dataVisualizacao,
    liquidacaoIdVisualizacao,
    idioma,
    setIdioma,
    resetFiltroSinal,
    dispararResetFiltro,
  ]);

  return (
    <LiquidacaoContext.Provider value={value}>
      {children}
    </LiquidacaoContext.Provider>
  );
}

export function useLiquidacaoContext() {
  return useContext(LiquidacaoContext);
}