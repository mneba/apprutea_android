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

// ─── Função principal de leitura ──────────────────────────────────────────────
//
// UMA ONDA. A RPC fn_liquidacao_dia_completa devolve, num único payload, tudo
// que antes exigia 3 idas ao Supabase:
//   • clientes/parcelas do dia            (antiga Onda 1)
//   • foto_url + data_emprestimo          (antiga Onda 2 — embutidas)
//   • estado de pagamento + ordem da rota (antiga Onda 4 — colunas prontas)
//   • parcelas já pagas nesta liquidação  (antiga Onda 3 — braço B do UNION)
//
// COSTURA OFFLINE: continua sendo aqui que, no futuro (Track 2), entra o
// "ler do store local primeiro". As telas/contexto não sabem a origem dos dados.
//
export async function getClientesDia(
  { rotaId, dataLiq, liqId }: ClientesDiaParams
): Promise<ClientesDiaResult> {
  if (!rotaId) {
    console.log('❌ getClientesDia: rotaId não definido');
    return RESULTADO_VAZIO;
  }
  console.log('🔍 getClientesDia:', { rotaId, dataLiq, liqId });

  // ⏱️ INSTRUMENTAÇÃO — comparar com o "antes" (~1100ms, 3 ondas). Remover depois.
  const __t0 = performance.now();

  // ═══════════════════════════════════════════════════════════════════════
  // ÚNICA VIAGEM — RPC completa
  // ═══════════════════════════════════════════════════════════════════════
  const { data, error } = await supabase.rpc('fn_liquidacao_dia_completa', {
    p_rota_id: rotaId,
    p_data_referencia: dataLiq,
    p_liquidacao_id: liqId,
  });
  const __tRede = performance.now();

  if (error) throw error;

  const rows = (data || []) as any[];

  // ═══════════════════════════════════════════════════════════════════════
  // MONTAGEM 100% LOCAL (medido em ~0,1ms com N pequeno)
  // ═══════════════════════════════════════════════════════════════════════
  const raw: ClienteRotaDia[] = [];
  const pagasSet = new Set<string>();
  const pagMap = new Map<string, PagamentoParcela>();
  const clientesPagosNaLiq = new Set<string>();
  const ordemTmp = new Map<string, number>();
  let temAlgumaOrdem = false;

  for (const r of rows) {
    // 1) linha do cliente/parcela (formato ClienteRotaDia)
    raw.push({
      cliente_id: r.cliente_id,
      codigo_cliente: r.codigo_cliente ?? (r.consecutivo != null ? Number(r.consecutivo) : null),
      nome: r.nome,
      telefone_celular: r.telefone_celular,
      endereco: r.endereco,
      foto_url: r.foto_url ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
      emprestimo_id: r.emprestimo_id,
      saldo_emprestimo: r.saldo_emprestimo,
      valor_principal: r.valor_principal,
      numero_parcelas: r.numero_parcelas,
      status_emprestimo: r.status_emprestimo,
      rota_id: r.rota_id,
      frequencia_pagamento: r.frequencia_pagamento,
      parcela_id: r.parcela_id,
      numero_parcela: r.numero_parcela,
      valor_parcela: r.valor_parcela,
      valor_pago_parcela: r.valor_pago_parcela ?? 0,
      saldo_parcela: r.saldo_parcela,
      status_parcela: r.status_parcela,
      data_vencimento: r.data_vencimento,
      ordem_visita_dia: r.ordem_visita_dia ?? null,
      liquidacao_id: r.liquidacao_id ?? null,
      tem_parcelas_vencidas: r.tem_parcelas_vencidas,
      total_parcelas_vencidas: r.total_parcelas_vencidas,
      valor_total_vencido: r.valor_total_vencido,
      status_dia: r.status_dia,
      permite_emprestimo_adicional: r.permite_emprestimo_adicional,
      is_parcela_atrasada: r.is_parcela_atrasada,
      data_emprestimo: r.data_emprestimo ?? null,
    });

    // 2) pagasSet — flag pronta vinda do banco
    if (r.parcela_paga) pagasSet.add(r.parcela_id);

    // 3) pagMap — só para parcelas que tiveram pagamento
    if (r.valor_pago_atual && r.valor_pago_atual > 0) {
      pagMap.set(r.parcela_id, {
        parcela_id: r.parcela_id,
        cliente_id: r.cliente_id,
        valor_pago_atual: r.valor_pago_atual,
        valor_credito_gerado: r.valor_credito_gerado ?? 0,
        valor_parcela: r.valor_parcela,
        data_pagamento: r.data_pagamento,
      });
    }

    // 4) clientesPagosNaLiq — flag pronta vinda do banco
    if (r.pago_nesta_liq) clientesPagosNaLiq.add(r.cliente_id);

    // 5) ordem da rota — só marca se houver valor
    if (r.ordem_visita_dia != null) {
      ordemTmp.set(r.cliente_id, Number(r.ordem_visita_dia));
      temAlgumaOrdem = true;
    }
  }

  // null = sem ordem para aplicar (o contexto não deve sobrescrever o map atual)
  const ordemRotaMap: Map<string, number> | null = temAlgumaOrdem ? ordemTmp : null;

  const __total = +(performance.now() - __t0).toFixed(1);
  const __rede = +(__tRede - __t0).toFixed(1);
  console.log(
    `⏱️ getClientesDia [RPC única] — TOTAL ${__total}ms · REDE ${__rede}ms (1 onda) · JS ${+(__total - __rede).toFixed(1)}ms\n` +
    `   → clientes: ${raw.length}`
  );

  return { raw, pagasSet, pagMap, clientesPagosNaLiq, ordemRotaMap };
}