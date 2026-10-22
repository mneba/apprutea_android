import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────
// Origem única dos tipos. O hook useClientesLiquidacao re-exporta para manter
// compatibilidade com quem importa de lá.

export interface ClienteRotaDia {
  cliente_id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  foto_url: string | null;
  latitude: number | null; longitude: number | null;
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number; valor_total?: number;
  numero_parcelas: number; status_emprestimo: string; rota_id: string;
  frequencia_pagamento: string; parcela_id: string; numero_parcela: number;
  valor_parcela: number; valor_pago_parcela: number; saldo_parcela: number;
  status_parcela: string; data_vencimento: string; dia_referencia?: string | null; ordem_visita_dia: number | null;
  liquidacao_id: string | null; tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  permite_emprestimo_adicional: boolean; is_parcela_atrasada?: boolean;
  data_emprestimo?: string; cliente_created_at?: string;
}

export interface PagamentoParcela {
  parcela_id: string; cliente_id: string; valor_pago_atual: number;
  valor_credito_gerado: number; valor_credito_usado: number; valor_pago_nesta_liq: number; valor_credito_usado_nesta_liq: number; valor_parcela: number; data_pagamento: string;
}

export interface ClientesDiaParams {
  rotaId: string | null | undefined;
  dataLiq: string;
  liqId: string | null;
}

// ─── O resumo contado do dia ─────────────────────────────────────────────────
//
// ⚠ DUAS REGRAS DO NEGÓCIO MORAM AQUI, e as duas foram ditas pelo Mauricio em
// 20 e 21/10/2026 depois de o web mostrar números que não se sustentavam:
//
// 1. A META É SÓ DAS PARCELAS QUE VENCEM NO DIA — "regra pétrea". Os DOIS
//    lados do percentual têm de ser do mesmo universo. O que estava errado:
//    `valor_esperado_dia` conta só as parcelas do dia, mas
//    `valor_recebido_dia` soma TODO pagamento — inclusive de parcela atrasada
//    e de quitação, que paga parcelas futuras. Medido em 20/10/2026 no banco:
//    **391 de 749 liquidações passavam de 100%**, com máximo de 9010%.
//
// 2. CLIENTE SÃO DOIS GRUPOS: os do dia e os vencidos. Não é um total com
//    ressalva — são duas populações, e a lista já as separa no filtro
//    'dia' | 'atrasados' de ClientesScreen.
//
// A régua de "é do dia" é a MESMA de `idsVencDia` em ClientesScreen:
// `data_vencimento` igual à data da liquidação. Está aqui, e não na tela, para
// existir uma definição só — duas divergem, e aí o resumo contradiz a lista.
// Quem mexer em `idsVencDia` tem de mexer aqui, e vice-versa; melhor ainda
// seria ClientesScreen passar a ler `idsDoDia` deste resultado.
export interface ResumoDoDia {
  // os dois grupos de cliente
  doDiaTotal: number;    doDiaPagaram: number;
  vencidosTotal: number; vencidosPagaram: number;
  idsDoDia: Set<string>;

  // o dinheiro, separado pelo VENCIMENTO da parcela que o recebeu.
  // Só `recebidoDoDia` entra na meta.
  recebidoDoDia: number;
  recebidoVencidas: number;
  recebidoFuturas: number;   // vem de quitação: parcela que ainda não venceu

  // parcelas mexidas NESTA liquidação
  parcelasPagas: number;
  parcelasQuitadas: number;
  creditoUsado: number;      // não é dinheiro novo: crédito que o cliente tinha
}

export const RESUMO_DIA_VAZIO: ResumoDoDia = {
  doDiaTotal: 0, doDiaPagaram: 0, vencidosTotal: 0, vencidosPagaram: 0,
  idsDoDia: new Set(),
  recebidoDoDia: 0, recebidoVencidas: 0, recebidoFuturas: 0,
  parcelasPagas: 0, parcelasQuitadas: 0, creditoUsado: 0,
};

export interface ClientesDiaResult {
  raw: ClienteRotaDia[];
  pagasSet: Set<string>;
  pagMap: Map<string, PagamentoParcela>;
  clientesPagosNaLiq: Set<string>;
  // null = não há ordem para aplicar; o chamador NÃO deve sobrescrever o map atual
  ordemRotaMap: Map<string, number> | null;
  resumo: ResumoDoDia;
}

const RESULTADO_VAZIO: ClientesDiaResult = {
  raw: [],
  pagasSet: new Set(),
  pagMap: new Map(),
  clientesPagosNaLiq: new Set(),
  ordemRotaMap: null,
  resumo: RESUMO_DIA_VAZIO,
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

  // acumuladores do resumo — montados na MESMA passada, sem segunda consulta
  const idsDoDia = new Set<string>();
  const todosOsClientes = new Set<string>();
  let recebidoDoDia = 0, recebidoVencidas = 0, recebidoFuturas = 0;
  let parcelasPagas = 0, parcelasQuitadas = 0, creditoUsado = 0;

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
      valor_total: r.valor_total ?? null,
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
      dia_referencia: r.dia_referencia ?? null,
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
        valor_credito_usado: r.valor_credito_usado ?? 0,
        valor_pago_nesta_liq: r.valor_pago_nesta_liq ?? 0,
        valor_credito_usado_nesta_liq: r.valor_credito_usado_nesta_liq ?? 0,
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

    // 6) resumo do dia
    const vencDia = String(r.data_vencimento || '').substring(0, 10);
    todosOsClientes.add(r.cliente_id);
    if (dataLiq && vencDia === dataLiq) idsDoDia.add(r.cliente_id);

    // `valor_pago_nesta_liq` é o que entrou NESTE dia — e não
    // `valor_pago_atual`, que é o acumulado da parcela. Com o acumulado, uma
    // parcela paga em três dias seria contada inteira em cada um deles.
    const pagoNaLiq = Number(r.valor_pago_nesta_liq ?? 0);
    if (pagoNaLiq > 0) {
      parcelasPagas++;
      // `parcela_paga` é a mesma bandeira que alimenta o `pagasSet` usado
      // pelas telas para marcar parcela quitada.
      if (r.parcela_paga) parcelasQuitadas++;

      const credito = Number(r.valor_credito_usado_nesta_liq ?? 0);
      creditoUsado += credito;
      // Crédito usado sai do líquido: não é dinheiro novo, é crédito que o
      // cliente já tinha sendo consumido. Mesma fórmula de
      // `valor_recebido_dia`, para os dois concordarem.
      const liquido = pagoNaLiq - credito;

      // Comparação de 'YYYY-MM-DD' como texto: a ordem lexicográfica é a
      // cronológica, e não há fuso para deslocar nada. Parcela sem vencimento
      // não entra em nenhuma das três gavetas.
      if (!dataLiq || !vencDia) {
        // fora das três
      } else if (vencDia === dataLiq) {
        recebidoDoDia += liquido;
      } else if (vencDia < dataLiq) {
        recebidoVencidas += liquido;
      } else {
        recebidoFuturas += liquido;
      }
    }
  }

  // Os dois grupos, por CLIENTE. O payload vem por parcela, então um cliente
  // com três empréstimos aparece três vezes — agrupar antes de contar não é
  // otimização, é correção.
  let doDiaTotal = 0, doDiaPagaram = 0, vencidosTotal = 0, vencidosPagaram = 0;
  todosOsClientes.forEach((id) => {
    // Sem data de liquidação não há "do dia" que signifique algo, e
    // `ehDoDiaCli` de ClientesScreen devolve true para todos nesse caso —
    // aqui vale o mesmo, para os dois não divergirem.
    const doDia = !dataLiq || idsDoDia.has(id);
    const pagou = clientesPagosNaLiq.has(id);
    if (doDia) { doDiaTotal++; if (pagou) doDiaPagaram++; }
    else { vencidosTotal++; if (pagou) vencidosPagaram++; }
  });

  const resumo: ResumoDoDia = {
    doDiaTotal, doDiaPagaram, vencidosTotal, vencidosPagaram, idsDoDia,
    recebidoDoDia, recebidoVencidas, recebidoFuturas,
    parcelasPagas, parcelasQuitadas, creditoUsado,
  };

  // null = sem ordem para aplicar (o contexto não deve sobrescrever o map atual)
  const ordemRotaMap: Map<string, number> | null = temAlgumaOrdem ? ordemTmp : null;

  const __total = +(performance.now() - __t0).toFixed(1);
  const __rede = +(__tRede - __t0).toFixed(1);
  console.log(
    `⏱️ getClientesDia [RPC única] — TOTAL ${__total}ms · REDE ${__rede}ms (1 onda) · JS ${+(__total - __rede).toFixed(1)}ms\n` +
    `   → clientes: ${raw.length}`
  );

  return { raw, pagasSet, pagMap, clientesPagosNaLiq, ordemRotaMap, resumo };
}