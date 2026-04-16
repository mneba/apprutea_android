import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClienteRotaDia {
  cliente_id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
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
}

// ─── Helper ─────────────────────────────────────────────────────────────────

const buscarCreditoMap = async (empIds: string[]): Promise<Map<string, number>> => {
  if (empIds.length === 0) return new Map();
  const { data } = await supabase
    .from('emprestimo_parcelas')
    .select('emprestimo_id, saldo_excedente')
    .in('emprestimo_id', empIds)
    .gt('saldo_excedente', 0);
  const creditoMap = new Map<string, number>();
  (data || []).forEach((p: any) => {
    const atual = creditoMap.get(p.emprestimo_id) || 0;
    creditoMap.set(p.emprestimo_id, atual + parseFloat(p.saldo_excedente || 0));
  });
  return creditoMap;
};

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseClientesLiquidacaoParams {
  rotaId: string | null | undefined;
  dataLiq: string;
  liqId: string | null;
}

export default function useClientesLiquidacao({ rotaId, dataLiq, liqId }: UseClientesLiquidacaoParams) {
  const [raw, setRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(new Set());
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLiq = useCallback(async () => {
    if (!rotaId) {
      console.log('❌ loadLiq: rotaId não definido');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    console.log('🔍 loadLiq: Buscando clientes...', { rotaId, dataLiq, liqId });
    try {
      // 1. Busca clientes para a liquidação do dia via function
      const { data, error } = await supabase
        .rpc('fn_clientes_liquidacao_dia', {
          p_rota_id: rotaId,
          p_data_referencia: dataLiq
        });

      if (error) throw error;

      let allData = ((data || []) as any[]).map(r => ({
        ...r,
        codigo_cliente: r.codigo_cliente ?? r.consecutivo ?? null,
      })) as ClienteRotaDia[];
      const existingParcelaIds = new Set(allData.map(r => r.parcela_id));

      // Enriquecer com data_emprestimo (RPC não retorna esse campo)
      const empIdsUnicos = [...new Set(allData.map(r => r.emprestimo_id).filter(Boolean))];
      if (empIdsUnicos.length > 0) {
        const { data: empsData } = await supabase
          .from('emprestimos')
          .select('id, data_emprestimo')
          .in('id', empIdsUnicos);
        if (empsData && empsData.length > 0) {
          const empDataMap = new Map((empsData as any[]).map(e => [e.id, e.data_emprestimo]));
          allData = allData.map(r => ({ ...r, data_emprestimo: empDataMap.get(r.emprestimo_id) || null }));
        }

        // Descontar crédito acumulado do saldo do empréstimo
        const creditoMap = await buscarCreditoMap(empIdsUnicos);
        if (creditoMap.size > 0) {
          allData = allData.map(r => ({
            ...r,
            saldo_emprestimo: Math.max(0, (r.saldo_emprestimo || 0) - (creditoMap.get(r.emprestimo_id) || 0)),
          }));
        }
      }

      // 2. Busca parcelas que foram pagas NA liquidação atual (para mostrar como "pagas")
      if (liqId) {
        console.log('🔍 Buscando parcelas pagas na liquidação:', liqId);

        const { data: pagamentos, error: errPag } = await supabase
          .from('pagamentos_parcelas')
          .select('parcela_id, cliente_id, emprestimo_id, liquidacao_id, numero_parcela, valor_parcela, valor_pago_atual, valor_credito_gerado, estornado')
          .eq('liquidacao_id', liqId)
          .eq('estornado', false);

        console.log('📦 Pagamentos na liquidação:', { count: pagamentos?.length, error: errPag?.message });

        if (pagamentos && pagamentos.length > 0) {
          const pagamentosNovos = pagamentos.filter(p => !existingParcelaIds.has(p.parcela_id));
          console.log('📋 Pagamentos não listados:', pagamentosNovos.length);

          if (pagamentosNovos.length > 0) {
            const clienteIds = [...new Set(pagamentosNovos.map(p => p.cliente_id))];
            const { data: clientes } = await supabase
              .from('clientes')
              .select('id, nome, telefone_celular, endereco, latitude, longitude, codigo_cliente')
              .in('id', clienteIds);
            const cliMap = new Map((clientes || []).map(c => [c.id, c]));

            const empIds = [...new Set(pagamentosNovos.map(p => p.emprestimo_id))];
            const { data: emps } = await supabase
              .from('emprestimos')
              .select('id, valor_principal, valor_saldo, numero_parcelas, status, frequencia_pagamento, rota_id, data_emprestimo')
              .in('id', empIds);
            const empMap = new Map((emps || []).map(e => [e.id, e]));

            const parcIds = pagamentosNovos.map(p => p.parcela_id);
            const { data: parcs } = await supabase
              .from('emprestimo_parcelas')
              .select('id, data_vencimento, status')
              .in('id', parcIds);
            const parcMap = new Map((parcs || []).map(p => [p.id, p]));

            pagamentosNovos.forEach(pag => {
              const cli = cliMap.get(pag.cliente_id);
              const emp = empMap.get(pag.emprestimo_id);
              const parc = parcMap.get(pag.parcela_id);
              if (!cli || !emp) return;

              const pagaRow: ClienteRotaDia = {
                cliente_id: cli.id,
                nome: cli.nome,
                telefone_celular: cli.telefone_celular,
                endereco: cli.endereco,
                latitude: cli.latitude,
                longitude: cli.longitude,
                codigo_cliente: cli.codigo_cliente,
                emprestimo_id: emp.id,
                saldo_emprestimo: emp.valor_saldo,
                valor_principal: emp.valor_principal,
                numero_parcelas: emp.numero_parcelas,
                status_emprestimo: emp.status,
                rota_id: emp.rota_id,
                frequencia_pagamento: emp.frequencia_pagamento,
                parcela_id: pag.parcela_id,
                numero_parcela: pag.numero_parcela,
                valor_parcela: pag.valor_parcela,
                valor_pago_parcela: pag.valor_pago_atual,
                saldo_parcela: 0,
                status_parcela: parc?.status || 'PAGO',
                data_vencimento: parc?.data_vencimento || new Date().toISOString(),
                ordem_visita_dia: null,
                liquidacao_id: pag.liquidacao_id,
                tem_parcelas_vencidas: false,
                total_parcelas_vencidas: 0,
                valor_total_vencido: 0,
                status_dia: 'PAGO',
                permite_emprestimo_adicional: false,
                is_parcela_atrasada: false,
                data_emprestimo: (emp as any).data_emprestimo || null,
              };
              allData.push(pagaRow);
              existingParcelaIds.add(pag.parcela_id);
              console.log('✅ Adicionado cliente pago:', cli.nome, 'parcela:', pag.numero_parcela);
            });
          }
        }
      }

      console.log('📊 loadLiq resultado:', {
        countOriginal: data?.length || 0,
        countTotal: allData.length,
        rotaId,
        dataLiq,
        liqId
      });

      setRaw(allData);
      const ids = allData.map((r: any) => r.parcela_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: pags } = await supabase
          .from('pagamentos_parcelas')
          .select('parcela_id, cliente_id, valor_pago_atual, valor_credito_gerado, valor_parcela, data_pagamento, liquidacao_id')
          .in('parcela_id', ids)
          .eq('estornado', false);

        const m = new Map<string, PagamentoParcela>();
        const s = new Set<string>();
        const cliPagos = new Set<string>();

        (pags || []).forEach((p: any) => {
          m.set(p.parcela_id, p);
          if (p.valor_pago_atual >= p.valor_parcela) s.add(p.parcela_id);
          if (liqId && p.liquidacao_id === liqId) {
            cliPagos.add(p.cliente_id);
          }
        });

        if (liqId) {
          const { data: todosPagLiq } = await supabase
            .from('pagamentos_parcelas')
            .select('cliente_id')
            .eq('liquidacao_id', liqId)
            .eq('estornado', false);
          (todosPagLiq || []).forEach((p: any) => cliPagos.add(p.cliente_id));
        }

        allData.forEach((r: any) => {
          if (r.status_dia === 'PAGO' || r.status_parcela === 'PAGO') {
            s.add(r.parcela_id);
          }
        });

        console.log('📋 PagasSet:', { total: s.size, ids: Array.from(s).slice(0, 5) });
        console.log('📋 ClientesPagosNaLiq:', { total: cliPagos.size, ids: Array.from(cliPagos).slice(0, 5) });
        setPagMap(m);
        setPagasSet(s);
        setClientesPagosNaLiq(cliPagos);
      } else {
        setPagMap(new Map());
        setPagasSet(new Set());
        setClientesPagosNaLiq(new Set());
      }

      // Carregar ordem da rota para aba Liquidação
      if (rotaId) {
        const clienteIds = [...new Set(allData.map(r => r.cliente_id))];
        if (clienteIds.length > 0) {
          const { data: ordens } = await supabase
            .from('ordem_rota_cliente')
            .select('cliente_id, ordem')
            .eq('rota_id', rotaId)
            .in('cliente_id', clienteIds);
          if (ordens && ordens.length > 0) {
            const m = new Map<string, number>();
            (ordens as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
            setOrdemRotaMap(m);
          }
        }
      }
    } catch (e) {
      console.error('Erro loadLiq:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rotaId, dataLiq, liqId]);

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

  // Carga inicial
  useEffect(() => { loadLiq(); }, [loadLiq]);

  return {
    raw,
    setRaw,
    pagasSet,
    pagMap,
    clientesPagosNaLiq,
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