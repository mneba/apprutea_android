import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────
// Origem única dos tipos. O hook useClientesLiquidacao re-exporta para manter
// compatibilidade com quem importa de lá.

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
}

export interface ClientesDiaParams {
  rotaId: string | null | undefined;
  dataLiq: string;
  liqId: string | null;
}

export interface ClientesDiaResult {
  raw: ClienteRotaDia[];
  pagasSet: Set<string>;
  pagMap: Map<string, PagamentoParcela>;
  clientesPagosNaLiq: Set<string>;
  // null = não há ordem para aplicar; o chamador NÃO deve sobrescrever o map atual
  ordemRotaMap: Map<string, number> | null;
}

const RESULTADO_VAZIO: ClientesDiaResult = {
  raw: [],
  pagasSet: new Set(),
  pagMap: new Map(),
  clientesPagosNaLiq: new Set(),
  ordemRotaMap: null,
};

// ─── Helper interno ───────────────────────────────────────────────────────────

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

// ─── Função principal de leitura ──────────────────────────────────────────────
//
// COSTURA OFFLINE: hoje esta função lê direto do Supabase (online).
// No futuro (Track 2 — offline), é AQUI que entra a lógica "ler do store local
// primeiro, sincronizar com a rede em background". As telas e o contexto não
// precisam saber a origem dos dados — só chamam getClientesDia.
//
export async function getClientesDia(
  { rotaId, dataLiq, liqId }: ClientesDiaParams
): Promise<ClientesDiaResult> {
  if (!rotaId) {
    console.log('❌ getClientesDia: rotaId não definido');
    return RESULTADO_VAZIO;
  }
  console.log('🔍 getClientesDia:', { rotaId, dataLiq, liqId });

  // 1. Busca clientes para a liquidação do dia via function
  const { data, error } = await supabase
    .rpc('fn_clientes_liquidacao_dia', {
      p_rota_id: rotaId,
      p_data_referencia: dataLiq,
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

  // Enriquecer com foto_url dos clientes
  const clienteIdsUnicos = [...new Set(allData.map(r => r.cliente_id).filter(Boolean))];
  if (clienteIdsUnicos.length > 0) {
    const { data: fotosData } = await supabase
      .from('clientes')
      .select('id, foto_url')
      .in('id', clienteIdsUnicos)
      .not('foto_url', 'is', null);
    if (fotosData && fotosData.length > 0) {
      const fotoMap = new Map((fotosData as any[]).map(c => [c.id, c.foto_url]));
      allData = allData.map(r => ({ ...r, foto_url: fotoMap.get(r.cliente_id) || null }));
    }
  }

  // 2. Busca parcelas que foram pagas NA liquidação atual (para mostrar como "pagas")
  if (liqId) {
    const { data: pagamentos } = await supabase
      .from('pagamentos_parcelas')
      .select('parcela_id, cliente_id, emprestimo_id, liquidacao_id, numero_parcela, valor_parcela, valor_pago_atual, valor_credito_gerado, estornado')
      .eq('liquidacao_id', liqId)
      .eq('estornado', false);

    if (pagamentos && pagamentos.length > 0) {
      const pagamentosNovos = pagamentos.filter(p => !existingParcelaIds.has(p.parcela_id));

      if (pagamentosNovos.length > 0) {
        const clienteIds = [...new Set(pagamentosNovos.map(p => p.cliente_id))];
        const { data: clientes } = await supabase
          .from('clientes')
          .select('id, nome, telefone_celular, endereco, latitude, longitude, codigo_cliente, foto_url')
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
            foto_url: cli.foto_url || null,
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
        });
      }
    }
  }

  console.log('📊 getClientesDia resultado:', {
    countOriginal: data?.length || 0,
    countTotal: allData.length,
    rotaId, dataLiq, liqId,
  });

  // 3. Monta pagasSet / pagMap / clientesPagosNaLiq
  let pagasSet = new Set<string>();
  let pagMap = new Map<string, PagamentoParcela>();
  let clientesPagosNaLiq = new Set<string>();

  const ids = allData.map((r: any) => r.parcela_id).filter(Boolean);
  if (ids.length > 0) {
    const { data: pags } = await supabase
      .from('pagamentos_parcelas')
      .select('parcela_id, cliente_id, valor_pago_atual, valor_credito_gerado, valor_parcela, data_pagamento, liquidacao_id')
      .in('parcela_id', ids)
      .eq('estornado', false);

    (pags || []).forEach((p: any) => {
      pagMap.set(p.parcela_id, p);
      if (p.valor_pago_atual >= p.valor_parcela) pagasSet.add(p.parcela_id);
      if (liqId && p.liquidacao_id === liqId) {
        clientesPagosNaLiq.add(p.cliente_id);
      }
    });

    if (liqId) {
      const { data: todosPagLiq } = await supabase
        .from('pagamentos_parcelas')
        .select('cliente_id')
        .eq('liquidacao_id', liqId)
        .eq('estornado', false);
      (todosPagLiq || []).forEach((p: any) => clientesPagosNaLiq.add(p.cliente_id));
    }

    allData.forEach((r: any) => {
      if (r.status_dia === 'PAGO' || r.status_parcela === 'PAGO') {
        pagasSet.add(r.parcela_id);
      }
    });
  }

  // 4. Carregar ordem da rota para aba Liquidação
  //    Retorna null quando não há ordem cadastrada — chamador não sobrescreve.
  let ordemRotaMap: Map<string, number> | null = null;
  const clienteIdsOrdem = [...new Set(allData.map(r => r.cliente_id))];
  if (clienteIdsOrdem.length > 0) {
    const { data: ordens } = await supabase
      .from('ordem_rota_cliente')
      .select('cliente_id, ordem')
      .eq('rota_id', rotaId)
      .in('cliente_id', clienteIdsOrdem);
    if (ordens && ordens.length > 0) {
      const m = new Map<string, number>();
      (ordens as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
      ordemRotaMap = m;
    }
  }

  return { raw: allData, pagasSet, pagMap, clientesPagosNaLiq, ordemRotaMap };
}