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
  /**
   * Carimbo que muda a cada evento em `solicitacoes_autorizacao` da rota.
   * As telas observam este número para se recarregarem sozinhas quando o
   * admin aprova algo — sem cada uma abrir a própria subscription.
   */
  solicitacoesUpdatedAt: number;
  /**
   * Momento em que os dados de cliente ficaram obsoletos por uma ação do
   * próprio app — venda, renegociação, renovação.
   *
   * A ClientesScreen só recarrega ao ganhar foco se os dados tiverem mais de
   * 30s, para não refazer a consulta a cada ida e volta de tela. Mas quem
   * acabou de criar um empréstimo volta em menos de 30s, cai dentro da janela
   * e vê a lista velha — foi o "demorou para atualizar" relatado no campo.
   *
   * Este carimbo é o furo controlado nessa regra: se a invalidação for mais
   * recente que a última carga, recarrega mesmo dentro dos 30s.
   */
  clientesInvalidadosEm: number;
  /** Marca os dados de cliente como obsoletos. Chame após criar/alterar empréstimo. */
  invalidarClientes: () => void;
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
  solicitacoesUpdatedAt: 0,
  clientesInvalidadosEm: 0,
  invalidarClientes: () => {},
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
  const [solicitacoesUpdatedAt, setSolicitacoesUpdatedAt] = useState(0);
  const [clientesInvalidadosEm, setClientesInvalidadosEm] = useState(0);
  const invalidarClientes = useCallback(() => setClientesInvalidadosEm(Date.now()), []);

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
  // Pedido de recarga chegado enquanto outra estava em voo. Atendido uma vez
  // ao final, em vez de abrir uma segunda requisição em paralelo.
  const recargaPendenteRef = useRef(false);
  // Auto-referência: o `finally` precisa reinvocar a própria função.
  const recarregarClientesRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  // Quando a própria app iniciou/terminou uma recarga. Base da janela de eco
  // do Realtime (ver bloco REALTIME).
  const ultimaRecargaLocalRef = useRef(0);

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

    // Uma carga já em voo vai trazer o estado atual de qualquer forma. Abrir
    // outra em paralelo apenas duplica o payload mais pesado do app — era
    // exatamente o que o `force` fazia, e a origem da lentidão pós-pagamento:
    // o `reqId` descartava a resposta obsoleta, mas só depois de baixá-la.
    // Em vez de furar o guard, agendamos a repetição para o fim. O frescor que
    // o `force` garantia continua garantido, sem a requisição dobrada.
    if (recarregandoClientesRef.current) {
      if (force) {
        console.log('⏳ [Ctx] recarregarClientes: carga em voo, repetição agendada');
        recargaPendenteRef.current = true;
      } else {
        console.log('⏭️ [Ctx] recarregarClientes: já em andamento, ignorando');
      }
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
        ultimaRecargaLocalRef.current = Date.now();
        // Alguém pediu recarga enquanto esta rodava — atende agora, uma vez.
        // A flag é limpa ANTES de reinvocar: no máximo uma repetição por rajada.
        if (recargaPendenteRef.current) {
          recargaPendenteRef.current = false;
          // Sem `liqOverride`: a esta altura o setState já propagou e
          // `liquidacaoAtualRef` está atualizado.
          recarregarClientesRef.current?.(true);
        }
      }
    }
  }, [vendedor?.rota_id, limparCacheClientes]);

  recarregarClientesRef.current = recarregarClientes;

  // ─── Recarrega liquidação + clientes ──────────────────────────────────────
  // A liquidação recém-buscada é repassada DIRETO para recarregarClientes.
  // Antes, `recarregarClientes()` era chamado sem argumento e lia a closure
  // antiga: ao ABRIR uma liquidação, a closure ainda tinha `null`, o early
  // return limpava o cache e a lista piscava vazia até o useEffect consertar.
  const recarregarTudo = useCallback(async () => {
    // Marca no início E no fim (o `finally` de recarregarClientes): a janela de
    // eco do Realtime precisa cobrir tanto a carga em voo quanto a recém-concluída.
    ultimaRecargaLocalRef.current = Date.now();
    const liq = await recarregarLiquidacao();
    await recarregarClientes(true, liq);
  }, [recarregarLiquidacao, recarregarClientes]);

  // ═══════════════════════════════════════════════════════════════════════
  // REALTIME — um canal por rota, para toda a aplicação
  //
  // Sem isto, mudanças feitas pelo admin (reabrir, fechar, aprovar uma
  // autorização) só chegavam quando o cobrador puxava a tela ou esperava o
  // polling. O canal é único e mora aqui: cada tela abrir a sua multiplicaria
  // conexões e sairia de sincronia.
  //
  // ⚠️ O Realtime NÃO reenvia o que passou enquanto o app esteve desconectado.
  // Por isso, ao (re)assinar, disparamos uma recarga completa antes de confiar
  // nos eventos incrementais — é o "catch-up" da reconexão.
  // ═══════════════════════════════════════════════════════════════════════
  //
  // ⚠️ NEM TODO EVENTO MERECE UMA RECARGA COMPLETA.
  //
  // `liquidacoes_diarias` é escrita por praticamente toda operação do dia:
  // cada pagamento atualiza valor_recebido_dia / valor_dinheiro / caixa_final,
  // e o fechamento grava várias vezes. O canal não distingue quem escreveu,
  // então o próprio aparelho recebe de volta o eco do que acabou de gravar —
  // e disparava uma segunda `fn_liquidacao_dia_completa` em cima da que a tela
  // já havia pedido. Era a lentidão pós-pagamento e no fechamento.
  //
  // A separação que importa:
  //   • mudou o STATUS (admin fechou, reabriu, abriu outro dia) → recarrega já,
  //     sem debounce nem janela: é o evento que não pode atrasar.
  //   • mudaram só os TOTAIS → debounce (rajada vira uma recarga) + janela de
  //     eco (se acabamos de recarregar, esse estado já está na tela).
  //
  const recarregarTudoRef = useRef(recarregarTudo);
  recarregarTudoRef.current = recarregarTudo;

  // Rajada de UPDATEs (fechamento grava mais de uma vez) vira uma recarga só.
  const DEBOUNCE_REALTIME_MS = 1200;
  // Evento que chega até 4s de uma recarga nossa é tratado como eco dela.
  const JANELA_ECO_MS = 4000;

  useEffect(() => {
    const rotaId = vendedor?.rota_id;
    if (!rotaId) return;

    let debounceId: ReturnType<typeof setTimeout> | null = null;

    const canal = supabase
      .channel(`rota-${rotaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liquidacoes_diarias', filter: `rota_id=eq.${rotaId}` },
        (payload) => {
          const statusNovo = (payload.new as any)?.status;
          const statusAtual = liquidacaoAtualRef.current?.status;
          const mudouStatus =
            payload.eventType !== 'UPDATE' || (!!statusNovo && statusNovo !== statusAtual);

          if (mudouStatus) {
            console.log('📡 [Realtime] liquidacoes_diarias: status →', statusNovo ?? payload.eventType);
            if (debounceId) { clearTimeout(debounceId); debounceId = null; }
            recarregarTudoRef.current();
            return;
          }

          if (debounceId) clearTimeout(debounceId);
          debounceId = setTimeout(() => {
            debounceId = null;
            const desdeRecargaLocal = Date.now() - ultimaRecargaLocalRef.current;
            if (desdeRecargaLocal < JANELA_ECO_MS) {
              console.log('🔇 [Realtime] eco da própria gravação, ignorado');
              return;
            }
            console.log('📡 [Realtime] liquidacoes_diarias: totais, recarregando');
            recarregarTudoRef.current();
          }, DEBOUNCE_REALTIME_MS);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_autorizacao', filter: `rota_id=eq.${rotaId}` },
        (payload) => {
          console.log('📡 [Realtime] solicitacoes_autorizacao:', payload.eventType);
          setSolicitacoesUpdatedAt(Date.now());
        },
      )
      .subscribe((status) => {
        console.log('📡 [Realtime] canal rota-' + rotaId + ':', status);
        if (status === 'SUBSCRIBED') {
          recarregarTudoRef.current();
          setSolicitacoesUpdatedAt(Date.now());
        }
      });

    return () => {
      if (debounceId) clearTimeout(debounceId);
      supabase.removeChannel(canal);
    };
  }, [vendedor?.rota_id]);

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
    solicitacoesUpdatedAt,
    clientesInvalidadosEm,
    invalidarClientes,
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
    solicitacoesUpdatedAt,
    clientesInvalidadosEm,
    invalidarClientes,
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