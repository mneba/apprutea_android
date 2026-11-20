// =====================================================
// MODAIS DE DETALHE DA LIQUIDAÇÃO DIÁRIA
// Arquivo: src/components/LiquidacaoDetalhes.tsx
// =====================================================

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Platform, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from './texto';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { useTrabalhaCredito } from '../hooks/useTrabalhaCredito';
import { supabase } from '../services/supabase';
import { mensagemErro } from '../utils/mensagemErro';
import { moeda, data, dataHora, hora } from '../utils/formato';
import { normalizarBusca } from '../utils';

const { width, height } = Dimensions.get('window');

// =====================================================
// HELPERS
// =====================================================
const fmt = (v: number | null | undefined) =>
  moeda(v ?? 0);

/**
 * Um lançamento pode ter até 5 comprovantes (`comprovantes_urls`), mas os
 * registros anteriores à coluna têm só `foto_url`. Regra única de leitura.
 */
const comprovantesDe = (registro: any): string[] => {
  const lista = registro?.comprovantes_urls;
  if (Array.isArray(lista) && lista.length > 0) return lista.filter(Boolean);
  return registro?.foto_url ? [registro.foto_url] : [];
};

const fmtData = (d: string | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  return data(dt);
};

/** `DD/MM/AAAA HH:MM` de um timestamp do banco.
 *
 *  Mesma correção de `fmtHora`: o Supabase devolve sem `Z`, mas é UTC. Sem o
 *  sufixo, um fechamento às 19h na Colômbia (UTC−5) vira meia-noite do dia
 *  seguinte — o tipo de deslize que o CLAUDE.md documenta em
 *  "A liquidação é a régua do tempo". */
const fmtDataHora = (d: string | null) => {
  if (!d) return '';
  const utcStr = d.endsWith('Z') || d.includes('+') ? d : d + 'Z';
  const dt = new Date(utcStr);
  if (isNaN(dt.getTime())) return '';
  return dataHora(dt);
};

const fmtHora = (d: string | null) => {
  if (!d) return '';
  // Supabase retorna timestamps sem 'Z' mas são UTC — adicionar Z para forçar interpretação correta
  const utcStr = d.endsWith('Z') || d.includes('+') ? d : d + 'Z';
  const dt = new Date(utcStr);
  return hora(dt);
};

// =====================================================
// INTERNACIONALIZAÇÃO DOS MODAIS
// =====================================================
type Lang = 'pt-BR' | 'es';

const i18n: Record<Lang, Record<string, string>> = {
  'pt-BR': {
    extratoDia: 'EXTRATO DO DIA', extratoLiq: 'EXTRATO LIQUIDAÇÃO DIÁRIA',
    caixaInicial: 'CAIXA INICIAL', saidas: '(-) SAÍDAS',
    cobrancas: '(+) COBRANÇAS', caixaFinal: 'CAIXA FINAL',
    movimentacoes: 'MOVIMENTAÇÕES', nenhuma: 'Nenhuma movimentação',
    totalCobrancas: 'TOTAL COBRANÇAS', totalMicroseguros: 'TOTAL MICROSEGUROS', totalOutrasReceitas: 'TOTAL OUTRAS RECEITAS',
    totalSaidas: 'TOTAL SAÍDAS', saldoFinal: 'SALDO FINAL',
    fimExtrato: '*** FIM DO EXTRATO ***', compartilhar: 'Compartilhar PDF',
    reaberturas: 'DIA REABERTO', reaberta: 'Reaberta', fechadaDeNovo: 'Fechada novamente',
    aposReabertura: 'Após a reabertura', semAlteracoes: 'Nenhuma alteração registrada.',
    detalheEntradas: 'DETALHES ENTRADAS', detalheSaidas: 'DETALHES SAÍDAS',
    cobrancasParcelas: 'COBRANÇAS', microsegurosVendas: 'MICROSEGUROS', outrasReceitas: 'OUTRAS RECEITAS',
    resumo: 'RESUMO',
    pagamentos: 'Pagamentos', pagos: 'Clientes pagos', naoPagos: 'Não Pagos',
    recebido: 'Recebido', dinheiro: 'Dinheiro', transferencia: 'Transf/PIX',
    parcela: 'Parcela', credito: 'Crédito', creditoUsado: 'Crédito usado',
    creditoGerado: 'Crédito gerado', semPagamentos: 'Nenhum pagamento registrado',
    vendas: 'Vendas do Dia', receitas: 'Receitas do Dia', despesas: 'Despesas do Dia',
    total: 'Total', quantidade: 'Quantidade', semRegistros: 'Nenhum registro',
    lancamentos: 'lançamentos', microseguro: 'Micro Seguro',
    totalVendido: 'Total Vendido', contratos: 'Contratos',
    semMicroseguro: 'Nenhuma venda de microseguro', emprestimo: 'Empréstimo',
    vendedor: 'Vendedor', cliente: 'Cliente', valor: 'Valor', hora: 'Hora',
    fechar: 'Fechar', nenhumaEntrada: 'Nenhuma entrada', nenhunaSaida: 'Nenhuma saída',
    cuotas: 'parcela(s)', verParcelas: 'ver parcelas', ocultar: 'ocultar',
    vendasTitulo: 'Vendas / Empréstimos', receitasTitulo: 'Receitas', despesasTitulo: 'Despesas',
    empAbrev: 'emp.',
    // Exclusão de movimentação
    excluir: 'Excluir', anular: 'Anular',
    confirmarExclusao: 'Confirmar Exclusão',
    confirmarExclusaoMsg: 'Deseja realmente excluir esta movimentação? O valor será revertido do caixa.',
    motivoExclusao: 'Motivo (opcional)',
    excluindo: 'Excluindo...', sim: 'Sim', nao: 'Não', cancelar: 'Cancelar',
    exclusaoSucesso: 'Movimentação excluída com sucesso!',
    exclusaoErro: 'Erro ao excluir movimentação',
    anulado: 'ANULADO',
    // Cancelamento de empréstimo
    cancelarEmprestimo: 'Cancelar empréstimo',
    cancelarEmprestimoTitulo: 'Cancelar empréstimo?',
    cancelarEmprestimoAviso: 'Esta ação não pode ser desfeita. O valor será revertido do caixa.',
    cancelarEmprestimoMotivo: 'Motivo (opcional)',
    cancelarEmprestimoMotivoPlaceholder: 'Ex.: erro de digitação, cliente desistiu...',
    cancelarConfirmar: 'Confirmar cancelamento',
    cancelarVoltar: 'Voltar',
    cancelando: 'Cancelando...',
    cancelamentoSucesso: 'Empréstimo cancelado com sucesso!',
    cancelamentoErro: 'Erro ao cancelar',
    microseguroCancelado: 'Microseguro:',
    microseguroSeraCancelado: 'também será cancelado',
  },
  'es': {
    extratoDia: 'EXTRACTO DEL DÍA', extratoLiq: 'EXTRACTO LIQUIDACIÓN DIARIA',
    caixaInicial: 'CAJA INICIAL', saidas: '(-) SALIDAS',
    cobrancas: '(+) COBROS', caixaFinal: 'CAJA FINAL',
    movimentacoes: 'MOVIMIENTOS', nenhuma: 'Ningún movimiento',
    totalCobrancas: 'TOTAL COBROS', totalMicroseguros: 'TOTAL MICROSEGUROS', totalOutrasReceitas: 'TOTAL OTROS INGRESOS',
    totalSaidas: 'TOTAL SALIDAS', saldoFinal: 'SALDO FINAL',
    fimExtrato: '*** FIN DEL EXTRACTO ***', compartilhar: 'Compartir PDF',
    reaberturas: 'DÍA REABIERTO', reaberta: 'Reabierta', fechadaDeNovo: 'Cerrada de nuevo',
    aposReabertura: 'Después de la reapertura', semAlteracoes: 'Ningún cambio registrado.',
    detalheEntradas: 'DETALLE ENTRADAS', detalheSaidas: 'DETALLE SALIDAS',
    cobrancasParcelas: 'COBROS', microsegurosVendas: 'MICROSEGUROS', outrasReceitas: 'OTROS INGRESOS',
    resumo: 'RESUMEN',
    pagamentos: 'Pagos', pagos: 'Clientes pagados', naoPagos: 'No Pagados',
    recebido: 'Recibido', dinheiro: 'Efectivo', transferencia: 'Transf/PIX',
    parcela: 'Cuota', credito: 'Crédito', creditoUsado: 'Crédito usado',
    creditoGerado: 'Crédito generado', semPagamentos: 'Ningún pago registrado',
    vendas: 'Ventas del Día', receitas: 'Ingresos del Día', despesas: 'Egresos del Día',
    total: 'Total', quantidade: 'Cantidad', semRegistros: 'Ningún registro',
    lancamentos: 'movimientos', microseguro: 'Micro Seguro',
    totalVendido: 'Total Vendido', contratos: 'Contratos',
    semMicroseguro: 'Ninguna venta de microseguro', emprestimo: 'Préstamo',
    vendedor: 'Vendedor', cliente: 'Cliente', valor: 'Valor', hora: 'Hora',
    fechar: 'Cerrar', nenhumaEntrada: 'Ninguna entrada', nenhunaSaida: 'Ninguna salida',
    cuotas: 'cuota(s)', verParcelas: 'ver cuotas', ocultar: 'ocultar',
    vendasTitulo: 'Ventas / Préstamos', receitasTitulo: 'Ingresos', despesasTitulo: 'Egresos',
    empAbrev: 'prést.',
    // Exclusão de movimentação
    excluir: 'Eliminar', anular: 'Anular',
    confirmarExclusao: 'Confirmar Eliminación',
    confirmarExclusaoMsg: '¿Desea realmente eliminar este movimiento? El valor será revertido de la caja.',
    motivoExclusao: 'Motivo (opcional)',
    excluindo: 'Eliminando...', sim: 'Sí', nao: 'No', cancelar: 'Cancelar',
    exclusaoSucesso: '¡Movimiento eliminado con éxito!',
    exclusaoErro: 'Error al eliminar movimiento',
    anulado: 'ANULADO',
    // Cancelamento de empréstimo
    cancelarEmprestimo: 'Cancelar préstamo',
    cancelarEmprestimoTitulo: '¿Cancelar préstamo?',
    cancelarEmprestimoAviso: 'Esta acción no se puede deshacer. El valor será revertido de la caja.',
    cancelarEmprestimoMotivo: 'Motivo (opcional)',
    cancelarEmprestimoMotivoPlaceholder: 'Ej.: error de digitación, cliente desistió...',
    cancelarConfirmar: 'Confirmar cancelación',
    cancelarVoltar: 'Volver',
    cancelando: 'Cancelando...',
    cancelamentoSucesso: '¡Préstamo cancelado con éxito!',
    cancelamentoErro: 'Error al cancelar',
    microseguroCancelado: 'Microseguro:',
    microseguroSeraCancelado: 'también será cancelado',
  },
};

// =====================================================
// HEADER PADRÃO DOS MODAIS
// =====================================================
const ModalHeader = ({
  titulo,
  icone,
  cor,
  onClose,
}: {
  titulo: string;
  icone: string;
  cor: string;
  onClose: () => void;
}) => (
  <View style={[dStyles.header, { backgroundColor: cor }]}>  
    <View style={dStyles.headerLeft}>
      <Text style={dStyles.headerIcone}>{icone}</Text>
      <Text style={dStyles.headerTitulo}>{titulo}</Text>
    </View>
    <TouchableOpacity onPress={onClose} style={dStyles.headerClose}>
      <Text style={dStyles.headerCloseText}>✕</Text>
    </TouchableOpacity>
  </View>
);

// =====================================================
// 1. MODAL EXTRATO (CAIXA) - ESTILO CUPOM FISCAL
// =====================================================
interface ExtratoProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  caixaInicial: number;
  caixaFinal: number;
  rotaNome?: string;
  vendedorNomeExterno?: string;
  lang?: Lang;
  isLiquidacaoAberta?: boolean;
}

export function ModalExtrato({ visible, onClose, liquidacaoId, caixaInicial: caixaInicialProp, caixaFinal: caixaFinalProp, rotaNome, vendedorNomeExterno, lang = 'pt-BR', isLiquidacaoAberta = false }: ExtratoProps) {
  // Sem crédito à vista, as frases de crédito saem do extrato; o DINHEIRO de
  // cada linha já é líquido dele, então os totais não mudam.
  const mostrarCredito = useTrabalhaCredito();
  const nav = useNavigation<any>();
  const t = i18n[lang];
  const [registros, setRegistros] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendedorNome, setVendedorNome] = useState('');
  // A REABERTURA NO CUPOM DO VENDEDOR — SEM O MOTIVO.
  //
  // O motivo é conversa entre quem administra: "reabri para corrigir a
  // frequência do cliente tal" não diz nada a quem recebe o comprovante no
  // celular, e o cupom é o papel que chega ao cliente. Ele fica só no extrato
  // do web (ver ModalExtratoLiquidacao.tsx).
  //
  // O que vale aqui é o FATO: este dia foi reaberto, e isto mudou depois.
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [dataLiquidacao, setDataLiquidacao] = useState('');
  const [caixaMicroInicial, setCaixaMicroInicial] = useState(0);
  const [caixaMicroFinal, setCaixaMicroFinal] = useState(0);
  const [totalRetiroMicro, setTotalRetiroMicro] = useState(0);
  const [resumoOp, setResumoOp] = useState({ pagos: 0, naoPagos: 0, novos: 0, renovados: 0, renegociados: 0 });
  const [vendasDia, setVendasDia] = useState<any[]>([]);
  const [renegociacoesDia, setRenegociacoesDia] = useState<any[]>([]);
  // Blocos do extrato (mockup B): fechados ao abrir, cada um abre ao toque.
  const [blocosAbertos, setBlocosAbertos] = useState<Set<string>>(new Set());
  const [buscaCob, setBuscaCob] = useState('');
  // Carga tudo-ou-nada (ver `carregarExtrato`). O caixa sai do BANCO, na
  // leitura do dia; as props ficam só como valor até a primeira carga.
  const reqExtratoRef = useRef(0);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [caixaDb, setCaixaDb] = useState<{ ini: number; fim: number } | null>(null);
  const caixaInicial = caixaDb ? caixaDb.ini : caixaInicialProp;
  const caixaFinal = caixaDb ? caixaDb.fim : caixaFinalProp;
  const extratoViewRef = useRef<View>(null);
  // Selo de fechamento. `quando` é `data_fechamento`; `por` é o nome de quem
  // fechou, resolvido por `fn_nome_usuario` — que procura em `vendedores` e
  // depois em `user_profiles`, cobrindo tanto o vendedor no app quanto o
  // admin pelo webapp. Pedido do Julio em 23/09/2026.
  const [fechamento, setFechamento] = useState<{ quando: string; por: string | null } | null>(null);
  const [modalResetVisible, setModalResetVisible] = useState(false);
  const handleResetSuccess = () => {
    // Mantém o modal de reset E o extrato abertos.
    //
    // Antes fechava os dois (`setModalResetVisible(false)` + `onClose()`), o
    // que devolvia o usuário à Home. Resetar mais de um cliente é o caso
    // comum, e obrigava a refazer Home → Caixa → Extrato → Resetar a cada um.
    //
    // O extrato é recarregado porque os totais mudaram. A lista do modal de
    // reset já se atualiza sozinha — quem acabou de ser resetado sai dela.
    // A tela por trás é recarregada pelo `onClose` do extrato, quando o
    // usuário de fato terminar.
    carregarExtrato();
  };

  useEffect(() => {
    if (visible && liquidacaoId) carregarExtrato();
  }, [visible, liquidacaoId]);

  // ══════════════════════════════════════════════════════════════════
  // A CARGA É TUDO OU NADA (19/11/2026)
  // ══════════════════════════════════════════════════════════════════
  //
  // Relato do Julio em 17/11/2026: ao fechar o dia o extrato às vezes ficava
  // rodando sem fim, às vezes saía ZERADO, e num caso os ~6.500 emprestados
  // do dia apareceram como "Diferença não explicada". O banco estava certo
  // (medido: os dias com ~6.500 emprestados têm caixa e empréstimo íntegros).
  // O defeito era AQUI:
  //
  //  · cada consulta que falhava era engolida e a lista ficava vazia. Sem os
  //    empréstimos, o caixa final (que vem de outra fonte) não fecha, e a
  //    conta joga a sobra na diferença — exatamente o caso dos 6.500;
  //  · o filtro `created_at >= data_abertura` caía em AGORA quando a leitura
  //    do dia falhava, e aí nenhum empréstimo entrava. Saiu: medido, zero
  //    empréstimos na base nasceram antes da abertura do próprio dia;
  //  · o caixa vinha por prop. Ao fechar dia REABERTO,
  //    `fn_fechar_liquidacao_reaberta` devolve só (sucesso, mensagem), e o
  //    caixa final chegava 0. Agora sai do banco, na mesma leitura do dia;
  //  · cinco consultas em fila, sem prazo. Agora em paralelo, com 20 s.
  //
  // Regra: ou TODAS as fontes da conta chegam, ou o extrato não aparece —
  // aparece a tela de erro com "Tentar de novo". A "diferença não explicada"
  // só pode ser calculada sobre o dia inteiro. O mesmo vale no web
  // (ModalExtratoLiquidacao.tsx).
  const PRAZO_EXTRATO_MS = 20000;
  const carregarExtrato = async () => {
    const meu = ++reqExtratoRef.current;
    setLoading(true);
    setErroCarga(null);
    const es = lang === 'es';
    const falhou = (etapa: string, err: any): never => {
      throw new Error(`${etapa}: ${err?.message || (es ? 'sin respuesta' : 'sem resposta')}`);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const prazo = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error('PRAZO')), PRAZO_EXTRATO_MS);
    });
    try {
      const carga = (async () => {
        const liqRes = await supabase
          .from('liquidacoes_diarias')
          .select('data_liquidacao, data_abertura, status, data_fechamento, fechado_por, data_reabertura, caixa_inicial, caixa_final, microseguro_inicial, microseguro_final, clientes_pagos, clientes_nao_pagos, clientes_novos, clientes_renovados, clientes_renegociados')
          .eq('id', liquidacaoId)
          .single();
        if (liqRes.error || !liqRes.data) falhou(es ? 'liquidación' : 'liquidação', liqRes.error);
        const liq: any = liqRes.data;

        const [finRes, pagRes, empRes, audRes]: any[] = await Promise.all([
          supabase
            .from('financeiro')
            .select('id, tipo, categoria, descricao, valor, data_lancamento, created_at, forma_pagamento, cliente_nome, status')
            .eq('liquidacao_id', liquidacaoId)
            // ANULADO vem junto SÓ para aparecer riscado na lista de saídas.
            // Toda soma abaixo o descarta explicitamente.
            .in('status', ['PAGO', 'ANULADO'])
            .order('created_at', { ascending: true }),
          supabase
            .from('pagamentos_parcelas')
            .select(`
              id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_credito_gerado, valor_credito_usado,
              forma_pagamento, created_at, cliente_id, parcela_id, emprestimo_id,
              operacao_id, tipo_operacao, observacoes,
              clientes!pagamentos_parcelas_cliente_id_fkey(nome, consecutivo)
            `)
            .eq('liquidacao_id', liquidacaoId)
            .eq('estornado', false)
            .order('created_at', { ascending: true }),
          supabase
            .from('emprestimos')
            .select(`
              id, valor_principal, valor_total, valor_parcela, numero_parcelas,
              taxa_juros, frequencia_pagamento, data_primeiro_vencimento,
              tipo_emprestimo, created_at,
              cliente:cliente_id(nome, codigo_cliente)
            `)
            .eq('liquidacao_id', liquidacaoId)
            .neq('status', 'CANCELADO')
            .order('created_at', { ascending: true }),
          // Só busca a auditoria se o dia foi reaberto.
          liq.data_reabertura
            ? supabase.rpc('fn_auditoria_liquidacao', { p_liquidacao_id: liquidacaoId })
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (finRes.error) falhou(es ? 'movimientos' : 'lançamentos', finRes.error);
        if (empRes.error) falhou(es ? 'préstamos' : 'empréstimos', empRes.error);
        if (audRes.error) falhou(es ? 'reapertura' : 'reabertura', audRes.error);

        let pags: any[] = pagRes.data || [];
        if (pagRes.error) {
          // Reserva: sem o join, e os nomes numa segunda leitura. Se ela
          // também falhar, a carga inteira falha — não sai extrato sem as
          // cobranças.
          console.log('❌ Erro query pagamentos_parcelas:', pagRes.error.message);
          const semRes = await supabase
            .from('pagamentos_parcelas')
            .select('id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_credito_gerado, valor_credito_usado, forma_pagamento, created_at, cliente_id, parcela_id, emprestimo_id, operacao_id, tipo_operacao, observacoes')
            .eq('liquidacao_id', liquidacaoId)
            .eq('estornado', false)
            .order('created_at', { ascending: true });
          if (semRes.error) falhou(es ? 'cobros' : 'cobranças', semRes.error);
          const ids = [...new Set((semRes.data || []).map((p: any) => p.cliente_id).filter(Boolean))];
          let nomeMap = new Map<string, string>();
          if (ids.length > 0) {
            const cliRes = await supabase.from('clientes').select('id, nome').in('id', ids);
            if (cliRes.error) falhou('clientes', cliRes.error);
            nomeMap = new Map((cliRes.data || []).map((c: any) => [c.id, c.nome]));
          }
          pags = (semRes.data || []).map((p: any) => ({ ...p, clientes: { nome: nomeMap.get(p.cliente_id) || '' } }));
        }
        return { liq, fin: (finRes.data || []) as any[], pags, emps: (empRes.data || []) as any[], aud: (audRes.data || []) as any[] };
      })();

      const r = await Promise.race([carga, prazo]);
      if (meu !== reqExtratoRef.current) return;   // outra carga mais nova assumiu
      const { liq, fin, pags, emps, aud } = r;

      // Daqui para baixo nada falha: o estado é aplicado de uma vez.
      setCaixaDb({ ini: Number(liq.caixa_inicial || 0), fim: Number(liq.caixa_final || 0) });
      setAuditoria(aud);
      const dataStr = liq.data_liquidacao?.substring(0, 10) || liq.data_abertura?.substring(0, 10) || '';
      if (dataStr) {
        const [y, m, d] = dataStr.split('-');
        setDataLiquidacao(`${d}/${m}/${y}`);
      }
      if (vendedorNomeExterno) setVendedorNome(vendedorNomeExterno);

      // Só há selo se a liquidação foi de fato fechada. Uma reaberta perde o
      // selo de propósito: o extrato deixou de representar um dia encerrado.
      const fechadaEm = liq.data_fechamento as string | null;
      const statusLiq = String(liq.status || '').toUpperCase();
      if (fechadaEm && statusLiq === 'FECHADO') {
        setFechamento({ quando: fechadaEm, por: null });
        const quem = liq.fechado_por;
        if (quem) {
          // O nome é um extra: se a busca falhar, o selo aparece mesmo assim
          // com a data e a hora, que é o essencial (Julio, 23/09/2026).
          supabase.rpc('fn_nome_usuario', { p_user_id: quem }).then(
            ({ data: nome, error: errNome }) => {
              if (meu === reqExtratoRef.current && !errNome && typeof nome === 'string' && nome.trim()) {
                setFechamento({ quando: fechadaEm, por: nome.trim() });
              }
            },
            () => {},
          );
        }
      } else {
        setFechamento(null);
      }
      setCaixaMicroInicial(liq.microseguro_inicial || 0);
      setCaixaMicroFinal(liq.microseguro_final || 0);
      setResumoOp({
        pagos: liq.clientes_pagos || 0,
        naoPagos: liq.clientes_nao_pagos || 0,
        novos: liq.clientes_novos || 0,
        renovados: liq.clientes_renovados || 0,
        renegociados: liq.clientes_renegociados || 0,
      });

      setRegistros(fin);
      setTotalRetiroMicro(fin
        .filter((x: any) => x.tipo === 'PAGAR' && x.status !== 'ANULADO' && ['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(x.categoria))
        .reduce((s: number, x: any) => s + parseFloat(x.valor), 0));

      /**
       * SEM DEDUPLICAÇÃO, e isto é regra de negócio: cada linha é um
       * RECEBIMENTO, e a mesma parcela PODE receber dois no mesmo dia. O dedup
       * por `parcela_id` que havia aqui jogava o segundo na "Diferença não
       * explicada" (Julio, 26/10/2026, 4.1 nayivis vnz). Medido: 14 casos com
       * `operacao_id` diferente; linha de fato repetida, ZERO em 19.698.
       */
      setPagamentos([...pags].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

      setVendasDia(emps.filter((e: any) => e.tipo_emprestimo !== 'RENEGOCIACAO'));
      setRenegociacoesDia(emps.filter((e: any) => e.tipo_emprestimo === 'RENEGOCIACAO'));
    } catch (e: any) {
      if (meu !== reqExtratoRef.current) return;
      console.error('Erro extrato:', e);
      setErroCarga(e?.message === 'PRAZO'
        ? (es ? 'La conexión no respondió a tiempo.' : 'A internet não respondeu a tempo.')
        : String(e?.message || e));
    } finally {
      if (timer) clearTimeout(timer);
      if (meu === reqExtratoRef.current) setLoading(false);
    }
  };

  // ⭐ Total de empréstimos/renovações (SAÍDA de caixa - exclui renegociações pois não sai dinheiro)
  const totalVendasEmprestimos = vendasDia.reduce((s, e) => s + parseFloat(e.valor_principal || 0), 0);
  
  const totalSaidasDespesas = registros.filter(r => r.tipo === 'PAGAR' && r.status !== 'ANULADO' && r.categoria !== 'ESTORNO_PAGAMENTO' && r.categoria !== 'EMPRESTIMO' && !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria)).reduce((s, r) => s + parseFloat(r.valor), 0);
  // ⭐ Total de saídas = despesas + empréstimos/renovações (não inclui renegociações)
  const totalSaidas = totalSaidasDespesas + totalVendasEmprestimos;
  const totalEntradas = registros.filter(r => r.tipo === 'RECEBER' && r.status !== 'ANULADO').reduce((s, r) => s + parseFloat(r.valor), 0);
  
  // ⭐ CORREÇÃO: Filtrar pagamentos que entraram dinheiro no caixa
  // Exclui pagamentos feitos APENAS com crédito (forma_pagamento = 'CREDITO')
  // Pagamentos com dinheiro/transferência contam o valor_pago_atual (não valor_pago_total que inclui crédito usado)
  const pagamentosDinheiro = pagamentos.filter(p => p.forma_pagamento !== 'CREDITO');

  // Crédito consumido e parcelas fechadas por crédito, por empréstimo, DENTRO
  // desta liquidação.
  //
  // Serve para não anunciar como "Crédito gerado" um excedente que foi
  // consumido na mesma operação. Um pagamento de $576 numa parcela de $72 gera
  // $504 e a auto-quitação come tudo no mesmo instante — o extrato dizia
  // "Crédito gerado: $504" como se o cliente tivesse ficado com esse valor,
  // sem mencionar que 7 parcelas foram quitadas ali.
  const creditoDoDiaPorEmprestimo = new Map<string, { consumido: number; oculto: number; parcelas: number }>();
  for (const p of pagamentos) {
    const eid = (p as any).emprestimo_id;
    if (!eid) continue;
    const a = creditoDoDiaPorEmprestimo.get(eid) || { consumido: 0, oculto: 0, parcelas: 0 };
    const usado = parseFloat((p as any).valor_credito_usado || 0);
    a.consumido += usado;
    // `oculto`: crédito consumido por linhas CREDITO, que não aparecem na
    // lista (o filtro acima as remove, e com razão — não são caixa). Sem
    // anunciá-lo o extrato fecha 8 parcelas mostrando só o dinheiro de 6, e o
    // operador não tem de onde tirar a diferença. Foi a reclamação da Paloma
    // Unhas em 12/09/2026: $360 em dinheiro + $120 de crédito quitaram o
    // empréstimo, e os $120 não apareciam em lugar nenhum.
    if (p.forma_pagamento === 'CREDITO') {
      a.parcelas += 1;
      a.oculto += usado;
    }
    creditoDoDiaPorEmprestimo.set(eid, a);
  }

  // Última linha visível de cada empréstimo. O resumo do crédito é do
  // empréstimo, não do pagamento: repetido em todas as linhas ele multiplica o
  // que houve — seis linhas dizendo "quitou +2 parcelas" viram doze.
  const ultimaLinhaDoEmprestimo = new Map<string, string>();
  for (const p of pagamentosDinheiro) {
    const eid = (p as any).emprestimo_id;
    if (eid) ultimaLinhaDoEmprestimo.set(eid, p.id);
  }

  /** Excedente que REALMENTE sobrou, e o resumo do crédito do empréstimo. */
  const creditoLiquido = (p: any) => {
    const gerado = parseFloat(p.valor_credito_gerado || 0);
    const doDia = creditoDoDiaPorEmprestimo.get(p.emprestimo_id) || { consumido: 0, oculto: 0, parcelas: 0 };
    const ehUltima = ultimaLinhaDoEmprestimo.get(p.emprestimo_id) === p.id;
    return {
      excedente: Math.max(0, gerado - doDia.consumido),
      parcelasQuitadas: ehUltima ? doDia.parcelas : 0,
      creditoOculto: ehUltima ? doDia.oculto : 0,
    };
  };

  /** Fragmento que declara o crédito aplicado pelo empréstimo (uma vez só). */
  const fraseCredito = (liq: { parcelasQuitadas: number; creditoOculto: number }) => {
    const qtd = liq.parcelasQuitadas;
    if (liq.creditoOculto > 0 && mostrarCredito) {
      const un = lang === 'es'
        ? (qtd === 1 ? 'cuota' : 'cuotas')
        : (qtd === 1 ? 'parcela' : 'parcelas');
      return ` · crédito aplicado: ${fmt(liq.creditoOculto)}${qtd > 0 ? ` (${qtd} ${un})` : ''}`;
    }
    if (qtd > 0) {
      return ` · ${lang === 'es' ? 'liquidó' : 'quitou'} +${qtd} ${lang === 'es' ? 'cuotas' : 'parcelas'}`;
    }
    return '';
  };

  /**
   * O EXTRATO LISTA RECEBIMENTOS, NÃO PARCELAS.
   *
   * `pagamentos_parcelas` tem uma linha por PARCELA. Uma quitação de 5
   * parcelas de 61,33 virava cinco linhas de 61,33 — e nenhuma delas é um
   * valor que passou pela mão do vendedor. O que passou foi UM dinheiro de
   * 306,65.
   *
   * Relatado pelo Julio em 07/11/2026: o extrato é o papel que se confere
   * contra caixa e banco, e ali o valor da operação não existia em lugar
   * nenhum.
   *
   * `operacao_id` é o ato do vendedor — 1 para 1 com o lançamento em
   * `financeiro` —, preenchido em 100% dos pagamentos desde 2024.
   *
   * MEDIDO em 07/11/2026, sobre as 18.591 operações com liquidação:
   *   · 1.237 cobrem mais de uma parcela, e geram 7.530 linhas;
   *   · a 5.1 Sebastian em 17/10 mostrava 135 linhas para 48 recebimentos;
   *   · uma operação NUNCA atravessa cliente, empréstimo nem liquidação —
   *     ZERO exceções em 19.849. É isto que torna o agrupamento seguro.
   *
   * ⚠ O TOTAL NÃO MUDA. O dinheiro se distribui por linha, então a soma do
   * grupo é a soma das linhas que ele substitui, e `totalCobrancas` continua
   * saindo de `pagamentosDinheiro`. É mudança de apresentação: o extrato
   * fecha no mesmo número de antes.
   *
   * ⚠ E O DIA COMUM NÃO MUDA DE APARÊNCIA: 17.354 das 18.591 operações têm
   * uma parcela só e seguem renderizadas exatamente como hoje.
   */
  const recebimentosPorOp = (() => {
    const porOp = new Map<string, any[]>();
    for (const p of pagamentosDinheiro) {
      // Sem `operacao_id` a linha vira o seu próprio recebimento: é o
      // comportamento de antes, e nada desaparece da tela.
      const k = (p as any).operacao_id || p.id;
      const arr = porOp.get(k);
      if (arr) arr.push(p); else porOp.set(k, [p]);
    }
    // A ordem é a de `pagamentosDinheiro`, que já vem por `created_at`: o
    // Map preserva a ordem de inserção.
    return [...porOp.entries()].map(([key, linhas]) => {
      const dinheiro = linhas.reduce((s: number, p: any) => s
        + parseFloat(p.valor_pago_atual || p.valor_pago_total || 0)
        - parseFloat(p.valor_credito_usado || 0), 0);

      // ⚠ CRÉDITO SEGUE DETALHADO, a pedido do Julio — e é também o único
      // caso em que a soma seria ambígua: 378 operações têm duas formas de
      // pagamento, e são exatamente a mistura dinheiro + crédito.
      //
      // A pergunta é feita pelo GRUPO *e* pelo empréstimo no dia. Pelo grupo
      // não basta: as linhas de forma CREDITO estão fora de
      // `pagamentosDinheiro` (e com razão — não são caixa), então um grupo
      // pode parecer limpo e ainda assim ter crédito aplicado nele, que é a
      // nota que `fraseCredito` acrescenta à última linha visível do
      // empréstimo. Colapsar esse grupo engoliria a nota.
      const doDia = creditoDoDiaPorEmprestimo.get(linhas[0].emprestimo_id)
        || { consumido: 0, oculto: 0, parcelas: 0 };
      const temCredito = doDia.consumido > 0 || doDia.oculto > 0
        || linhas.some((p: any) => parseFloat(p.valor_credito_gerado || 0) > 0);

      return {
        key,
        linhas,
        dinheiro,
        nomeCliente: (linhas[0].clientes as any)?.nome || (linhas[0].cliente as any)?.nome
          || `${lang === 'es' ? 'Cuota' : 'Parcela'} ${linhas[0].numero_parcela}`,
        parcelas: linhas.map((p: any) => Number(p.numero_parcela || 0)).sort((a: number, b: number) => a - b),
        quitacao: linhas.some((p: any) => p.tipo_operacao === 'QUITACAO'),
        // Uma parcela só já É um recebimento: nada a agrupar, e a linha de
        // hoje diz mais (mostra o valor da parcela).
        detalhar: temCredito || linhas.length === 1,
        temCredito,
      };
    });
  })();

  // ══ UMA LINHA POR EMPRÉSTIMO NO DIA ═══════════════════════════════════
  //
  // Relato do Julio em 07 e 09/11/2026: o cliente paga 4 parcelas de 10 e o
  // extrato mostra 4 linhas de 10. O agrupamento por `operacao_id` acima não
  // basta, porque o banco guarda várias operações para o que o vendedor vê
  // como um pagamento só: o "Pagar várias" chama `fn_registrar_pagamento`
  // uma vez por parcela (marca `[LOTE i/N]`), e o cliente que paga em dois
  // toques gera dois recebimentos.
  //
  // Decisão do Mauricio em 19/11/2026: TODOS os recebimentos do mesmo
  // empréstimo no dia viram UMA linha, com o total e as parcelas embaixo, e
  // a hora do último. Na leitura, sem mexer no banco — o estorno segue um
  // recebimento por vez, do mais novo ao mais antigo.
  //
  // ⚠ COM CRÉDITO NÃO JUNTA, a pedido do Julio: o detalhamento do crédito
  // usado ou gerado continua linha a linha. MAS só quando a rota mostra
  // crédito (`mostrarCredito`); com o crédito desligado a tela já não tem
  // nota de crédito para preservar, e junta igual (Mauricio, 19/11/2026).
  //
  // ⚠ O TOTAL NÃO MUDA: o dinheiro da linha é a soma dos recebimentos que ela
  // substitui. Mudou num destes dois arquivos (app LiquidacaoDetalhes, web
  // ModalExtratoLiquidacao), muda no outro.
  const recebimentos = (() => {
    const out: typeof recebimentosPorOp = [];
    const porEmprestimo = new Map<string, (typeof recebimentosPorOp)[number]>();
    for (const rec of recebimentosPorOp) {
      const eid = rec.linhas[0]?.emprestimo_id;
      const separa = !eid || (rec.temCredito && mostrarCredito);
      const g = separa ? undefined : porEmprestimo.get(eid);
      if (g) {
        g.linhas = [...g.linhas, ...rec.linhas];
        g.dinheiro += rec.dinheiro;
        g.parcelas = [...g.parcelas, ...rec.parcelas].sort((a: number, b: number) => a - b);
        g.quitacao = g.quitacao || rec.quitacao;
        g.detalhar = false;
        continue;
      }
      const copia = { ...rec, linhas: [...rec.linhas] };
      out.push(copia);
      if (!separa) porEmprestimo.set(eid, copia);
    }
    return out;
  })();

  /**
   * A lista que a tela percorre, numerada de 1 a N.
   *
   * Grupo colapsado entra como UM item; grupo detalhado entra como as suas
   * linhas, cada uma renderizada byte a byte como antes. Assim o caso com
   * crédito não muda nada, que é o que o Julio pediu.
   */
  type ItemCobranca = { grupo?: typeof recebimentos[number]; p?: any; rec: typeof recebimentos[number] };
  const itensCobranca: ItemCobranca[] = recebimentos.flatMap((rec): ItemCobranca[] =>
    rec.detalhar
      ? rec.linhas.map((p: any) => ({ p, rec }))
      : [{ grupo: rec, rec }],
  );

  /** "5 parcelas (11 a 15)" — ou os números soltos, quando não são seguidos. */
  const fraseParcelas = (nums: number[]) => {
    const un = lang === 'es'
      ? (nums.length === 1 ? 'cuota' : 'cuotas')
      : (nums.length === 1 ? 'parcela' : 'parcelas');
    const seguidos = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    const quais = seguidos && nums.length > 1
      ? `${nums[0]} a ${nums[nums.length - 1]}`
      : nums.join(', ');
    return `${nums.length} ${un} (${quais})`;
  };

  const totalPagamentos = pagamentosDinheiro.reduce((s, p) => {
    // valor_pago_atual = dinheiro + crédito usado neste pagamento
    // valor_pago_total = valor aplicado na parcela (pode ser diferente se gerou excedente)
    // Para caixa, queremos o dinheiro que entrou = valor_pago_atual - valor_credito_usado
    const valorPagoAtual = parseFloat(p.valor_pago_atual || p.valor_pago_total || 0);
    const creditoUsado = parseFloat(p.valor_credito_usado || 0);
    return s + (valorPagoAtual - creditoUsado);
  }, 0);
  
  const registrosEntradas = registros.filter(r => r.tipo === 'RECEBER' && r.status !== 'CANCELADO' && r.status !== 'ANULADO');
  const registrosSaidas = registros.filter(r => r.tipo === 'PAGAR' && r.status !== 'CANCELADO' && r.categoria !== 'ESTORNO_PAGAMENTO' && r.categoria !== 'EMPRESTIMO' && !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria));

  // Separar entradas em 3 grupos
  const entradasCobrancas = registrosEntradas.filter(r => ['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS'].includes(r.categoria));
  const entradasMicroseguro = registrosEntradas.filter(r => ['VENDA_MICROSEGURO', 'MICROSEGURO'].includes(r.categoria));
  const entradasOutras = registrosEntradas.filter(r => !['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS', 'VENDA_MICROSEGURO', 'MICROSEGURO'].includes(r.categoria));
  // ⭐ CORREÇÃO: Usar totalPagamentos (de pagamentos_parcelas) pois inclui auto-quitações
  // O financeiro não registra parcelas quitadas automaticamente
  const totalCobrancas = totalPagamentos;

  // O bloco da reabertura e o que veio depois dela. O FECHAMENTO_POS_REABERTURA
  // sai das alteracoes: ele encerra o episodio, nao e uma alteracao.
  const reaberturas = auditoria.filter(
    (a: any) => a.tipo === 'REABERTURA' || a.tipo === 'FECHAMENTO_POS_REABERTURA'
  );
  const alteracoesPos = auditoria.filter(
    (a: any) => a.depois_da_reabertura && a.tipo !== 'FECHAMENTO_POS_REABERTURA'
  );
  const totalMicroseguros = entradasMicroseguro.reduce((s, r) => s + parseFloat(r.valor), 0);
  const totalOutrasReceitas = entradasOutras.reduce((s, r) => s + parseFloat(r.valor), 0);

  // Ajustes de saldo do dia — o valor já vem sinalizado, então a soma é
  // direta: negativo reduz, positivo aumenta.
  //
  // AJUSTE_ABERTURA fica fora porque não é movimento do dia: é a diferença
  // entre o caixa que o vendedor declarou na abertura e o saldo da conta, e
  // já está embutida no `caixaInicial` que a linha de cima mostra. Contá-lo
  // aqui o cobraria duas vezes.
  const registrosAjustes = registros.filter(
    r => r.tipo === 'AJUSTE' && r.status !== 'CANCELADO' && r.status !== 'ANULADO'
      && r.categoria !== 'AJUSTE_ABERTURA'
  );
  const totalAjustes = registrosAjustes.reduce((s, r) => s + parseFloat(r.valor), 0);
  const temAjustes = registrosAjustes.length > 0;

  // A diferença que as linhas não explicam.
  //
  // `caixaFinal` chega pronto: é o saldo REAL da conta da rota, que
  // `fn_fechar_liquidacao_diaria` lê e grava. As linhas acima são os
  // movimentos do dia. Quando discordam, há dinheiro que se moveu fora deste
  // dia — em geral uma correção retroativa, que muda a conta hoje e pertence
  // a um dia antigo.
  //
  // O fechamento sempre soube, e gravava em `observacoes`. Ninguém lia. Em
  // outubro de 2026 um vendedor passou quatro dias convencido de que tinha
  // perdido 101,00, porque o extrato não fechava e nada na tela dizia por quê.
  //
  // A linha não conserta a divergência — ela costuma ser legítima. Conserta o
  // silêncio: quem lê vê que o sistema sabe, em vez de descobrir subtraindo.
  const somaDasLinhas = caixaInicial + totalCobrancas + totalOutrasReceitas + totalAjustes
    - totalSaidasDespesas - totalVendasEmprestimos;
  const diferencaNaoExplicada = caixaFinal - somaDasLinhas;
  const temDiferenca = Math.abs(diferencaNaoExplicada) > 0.01;

  // ══ O EXTRATO REDESENHADO (19/11/2026) ════════════════════════════════
  // A conta primeiro e o detalhe em blocos — o "B" do mockup aprovado pelo
  // Mauricio. Uma linha por RECEBIMENTO (a regra de 08/11 segue valendo), o
  // empréstimo sem dado de contrato (juros, taxa e 1º vencimento são da
  // ficha, não do caixa), e o resumo operacional saiu: era número de
  // supervisor. Clientes que faltam também NÃO entram — isso é a aba
  // Clientes. A tela e o PDF leem as MESMAS listas abaixo.
  //
  // ⚠ OS TOTAIS NÃO MUDAM: todos saem das contas de cima.
  const L = (pt: string, es: string) => (lang === 'es' ? es : pt);
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  type LinhaCob = {
    key: string; nome: string; criado: string; sub: string; valor: number;
    quitacao: boolean; emprestimoId?: string;
    usado: number; gerado: number; nota: string; soCredito: number;
  };
  const linhasCobranca: LinhaCob[] = (() => {
    const subParcelas = (nums: number[]) =>
      nums.length === 1 ? `${L('parcela', 'cuota')} ${nums[0]}` : fraseParcelas(nums);
    const out: LinhaCob[] = recebimentos.map(rec => ({
      key: rec.key,
      nome: rec.nomeCliente,
      criado: rec.linhas[rec.linhas.length - 1].created_at,
      sub: subParcelas(rec.parcelas),
      valor: rec.dinheiro,
      quitacao: rec.quitacao,
      emprestimoId: rec.linhas[0].emprestimo_id,
      usado: rec.linhas.reduce((s: number, p: any) => s + parseFloat(p.valor_credito_usado || 0), 0),
      gerado: rec.linhas.reduce((s: number, p: any) => s + creditoLiquido(p).excedente, 0),
      nota: rec.linhas.map((p: any) => fraseCredito(creditoLiquido(p))).join('').replace(/^ · /, ''),
      soCredito: 0,
    }));
    // Recebimento SÓ de crédito, de empréstimo que não teve linha em
    // dinheiro no dia: sem isto ele sumia do extrato (a nota de crédito só
    // tem onde pendurar quando há linha visível). Aparece com 0,00 — o
    // valor NÃO entra na cobrança, que é dinheiro.
    const comLinha = new Set(pagamentosDinheiro.map((p: any) => p.emprestimo_id).filter(Boolean));
    const soCred = new Map<string, any[]>();
    for (const p of pagamentos) {
      if (p.forma_pagamento !== 'CREDITO' || comLinha.has((p as any).emprestimo_id)) continue;
      const k = (p as any).operacao_id || p.id;
      const arr = soCred.get(k);
      if (arr) arr.push(p); else soCred.set(k, [p]);
    }
    for (const [k, ls] of soCred) {
      const nums = ls.map((p: any) => Number(p.numero_parcela || 0)).sort((a: number, b: number) => a - b);
      out.push({
        key: 'c' + k,
        nome: (ls[0].clientes as any)?.nome || '—',
        criado: ls[ls.length - 1].created_at,
        sub: subParcelas(nums),
        valor: 0,
        quitacao: ls.some((p: any) => p.tipo_operacao === 'QUITACAO'),
        emprestimoId: ls[0].emprestimo_id,
        usado: 0, gerado: 0, nota: '',
        soCredito: ls.reduce((s: number, p: any) => s + parseFloat(p.valor_credito_usado || p.valor_pago_atual || 0), 0),
      });
    }
    return out.sort((a, b) => (a.criado < b.criado ? -1 : a.criado > b.criado ? 1 : 0));
  })();
  const qtdParcelasCob = recebimentos.reduce((s, r) => s + r.parcelas.length, 0);
  const notaSoCredito = (v: number) => mostrarCredito
    ? L(`pago só com crédito: ${fmt(v)}`, `pagado solo con crédito: ${fmt(v)}`)
    : L(`adiantamento aplicado: ${fmt(v)}`, `anticipo aplicado: ${fmt(v)}`);

  const tipoEmp = (e: any) => e.tipo_emprestimo === 'RENOVACAO'
    ? { rot: L('RENOVOU', 'RENOVÓ'), cor: '#92400E', fundo: '#FEF3C7' }
    : e.tipo_emprestimo === 'ADICIONAL'
      ? { rot: 'ADICIONAL', cor: '#1E40AF', fundo: '#DBEAFE' }
      : { rot: L('NOVO', 'NUEVO'), cor: '#065F46', fundo: '#D1FAE5' };
  const nRenov = vendasDia.filter((e: any) => e.tipo_emprestimo === 'RENOVACAO').length;
  const nAdic = vendasDia.filter((e: any) => e.tipo_emprestimo === 'ADICIONAL').length;
  const nNovos = vendasDia.length - nRenov - nAdic;
  const resumoEmprestimos = vendasDia.length === 0 ? L('nenhum', 'ninguno') : [
    nNovos ? plural(nNovos, L('novo', 'nuevo'), L('novos', 'nuevos')) : '',
    nRenov ? plural(nRenov, L('renovação', 'renovación'), L('renovações', 'renovaciones')) : '',
    nAdic ? plural(nAdic, 'adicional', L('adicionais', 'adicionales')) : '',
  ].filter(Boolean).join(' · ');
  const totalRenegociado = renegociacoesDia.reduce((s, e) => s + parseFloat(e.valor_principal || 0), 0);

  const despesasVivas = registrosSaidas.filter(r => r.status !== 'ANULADO');
  const nAnuladas = registrosSaidas.length - despesasVivas.length;
  const resumoDespesas = despesasVivas.length === 0 && nAnuladas === 0 ? L('nenhuma', 'ninguno') : [
    plural(despesasVivas.length, L('lançamento', 'movimiento'), L('lançamentos', 'movimientos')),
    nAnuladas ? plural(nAnuladas, L('anulado', 'anulado'), L('anulados', 'anulados')) : '',
  ].filter(Boolean).join(' · ');
  const nomeLanc = (r: any) => r.descricao || r.cliente_nome || formatarCategoria(r.categoria);

  // A conta que FECHA, nas duas pontas (tela e PDF).
  type LinhaConta = { rot: string; txt: string; cor: string };
  const sinal = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v)}`;
  const linhasConta: LinhaConta[] = [
    { rot: L('Abriu com', 'Abrió con'), txt: fmt(caixaInicial), cor: '#111827' },
    { rot: L('Cobrou', 'Cobró'), txt: `+${fmt(totalCobrancas)}`, cor: '#047857' },
  ];
  if (totalOutrasReceitas > 0) linhasConta.push({ rot: L('Outras receitas', 'Otros ingresos'), txt: `+${fmt(totalOutrasReceitas)}`, cor: '#047857' });
  if (totalVendasEmprestimos > 0) linhasConta.push({ rot: L('Emprestou', 'Prestó'), txt: `-${fmt(totalVendasEmprestimos)}`, cor: '#B91C1C' });
  if (totalSaidasDespesas > 0) linhasConta.push({ rot: L('Gastou', 'Gastó'), txt: `-${fmt(totalSaidasDespesas)}`, cor: '#B91C1C' });
  if (temAjustes) linhasConta.push({ rot: L('Ajustes de saldo', 'Ajustes de saldo'), txt: sinal(totalAjustes), cor: '#1D4ED8' });
  if (temDiferenca) linhasConta.push({ rot: L('Diferença não explicada', 'Diferencia no explicada'), txt: sinal(diferencaNaoExplicada), cor: '#B91C1C' });
  const rotTopo = isLiquidacaoAberta
    ? L('Saldo do caixa agora', 'Saldo de caja ahora')
    : L('Saldo do caixa no fim do dia', 'Saldo de caja al final del día');
  const rotFim = isLiquidacaoAberta ? L('Caixa agora', 'Caja ahora') : L('Fechou com', 'Cerró con');
  const avisoDiferenca = L(
    'Dinheiro que mexeu na conta fora deste dia — em geral uma correção de um dia anterior.',
    'Dinero que movió la cuenta fuera de este día — en general una corrección de un día anterior.',
  );

  const dataHoje = data(new Date());
  const horaAgora = hora(new Date());

  const DIV = '- - - - - - - - - - - -';
  const DDIV = '= = = = = = = = = = = =';

  const [compartilhando, setCompartilhando] = useState(false);

  const compartilharExtrato = async () => {
    if (compartilhando) return;
    setCompartilhando(true);
    try {

      // O PDF segue a TELA (mockup B): a conta primeiro, depois os blocos —
      // abertos, porque papel não tem toque. Mesmas listas da tela.
      const esc = (s: any) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const secao = (titulo: string, resumo: string, total: string, cor: string) => `
  <hr class="sep2">
  <div class="sec-row"><span class="secao" style="color:${cor}">${titulo}</span></div>
  ${resumo ? `<div class="sec-res">${esc(resumo)}</div>` : ''}
  <hr class="sep">`;
      const mov = (nome: string, valor: string, sub: string, opc: { cor?: string; cls?: string; badge?: string; badgeCor?: string; extra?: string } = {}) => `
  <div class="mov${opc.cls || ''}">
    <div class="mov-row"><span class="mov-cat">${esc(nome)}</span><span class="mov-val" style="color:${opc.cor || '#111827'}">${valor}</span></div>
    <div class="mov-sub">${opc.badge ? `<span class="badge" style="color:${opc.badgeCor}">${opc.badge}</span> ` : ''}${esc(sub)}</div>${opc.extra || ''}
  </div>`;

      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 5mm; size: 80mm auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #222; background: #FFF; }
  .cupom { width: 72mm; max-width: 72mm; margin: 0 auto; padding: 4mm 0; }
  .c { text-align: center; }
  .cb { text-align: center; font-weight: 700; }
  .sub { text-align: center; color: #666; font-size: 10px; margin-top: 2px; }
  .selo { text-align: center; margin-top: 6px; padding: 5px 8px;
          border: 1px dashed #CCC; border-radius: 4px; background: #FAFAFA;
          color: #666; font-size: 10px; line-height: 1.5; }
  .selo-t { font-weight: 700; color: #333; letter-spacing: 0.5px; }
  .sep { border: none; border-top: 1px dashed #CCC; margin: 6px 0; }
  .sep2 { border: none; border-top: 2px solid #AAA; margin: 8px 0 6px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; padding: 2px 0; font-size: 12px; line-height: 1.5; }
  .row .r { text-align: right; white-space: nowrap; }
  .b { font-weight: 700; }
  .lg { font-size: 14px; font-weight: 700; }
  .topo-rot { text-align: center; font-size: 10px; color: #666; margin-top: 4px; }
  .topo-val { text-align: center; font-size: 18px; font-weight: 700; margin: 2px 0 4px; }
  .aviso { font-size: 9px; color: #991B1B; margin-top: 3px; line-height: 1.4; }
  .sec-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  .secao { font-weight: 700; font-size: 12px; }
  .sec-res { font-size: 10px; color: #666; margin-top: 1px; }
  .mov { margin-top: 5px; padding-bottom: 4px; border-bottom: 1px dotted #DDD; }
  .mov:last-child { border-bottom: none; }
  .mov.quit { background: #F5F3FF; padding: 3px 4px; border-radius: 3px; }
  .mov.risc .mov-cat, .mov.risc .mov-val { color: #9CA3AF !important; text-decoration: line-through; }
  .mov-row { display: flex; align-items: baseline; gap: 6px; }
  .mov-cat { flex: 1; font-weight: 600; font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
  .mov-val { font-weight: 700; font-size: 12px; flex-shrink: 0; white-space: nowrap; }
  .mov-sub { color: #666; font-size: 10px; margin-top: 1px; }
  .badge { font-weight: 700; font-size: 9px; }
  .cred { font-size: 10px; color: #78350F; margin-top: 2px; }
  .cred .row { font-size: 10px; padding: 0; line-height: 1.4; }
  .vazio { text-align: center; color: #999; font-size: 10px; padding: 4px 0; }
</style></head>
<body>
<div class="cupom">

  <div class="cb" style="font-size:14px">${esc(rotaNome || 'Rota')}</div>
  ${vendedorNome ? `<div class="sub">${esc(vendedorNome)}</div>` : ''}
  <div class="sub">${dataLiquidacao || dataHoje}</div>
  ${fechamento ? `<div class="selo">
    <div class="selo-t">${lang === 'es' ? '🔒 SISTEMA CERRADO' : '🔒 SISTEMA FECHADO'}</div>
    <div>${fmtDataHora(fechamento.quando)}</div>
    ${fechamento.por ? `<div>por ${esc(fechamento.por)}</div>` : ''}
  </div>` : ''}

  <hr class="sep2">
  <div class="topo-rot">${rotTopo}</div>
  <div class="topo-val" style="color:${caixaFinal < 0 ? '#B91C1C' : '#111827'}">${fmt(caixaFinal)}</div>
  <hr class="sep">
  ${linhasConta.map(l => `<div class="row"><span style="color:${l.cor}">${l.rot}</span><span class="r" style="color:${l.cor}">${l.txt}</span></div>`).join('')}
  <hr class="sep">
  <div class="row"><span class="lg">${rotFim}</span><span class="r lg">${fmt(caixaFinal)}</span></div>
  ${temDiferenca ? `<div class="aviso">${avisoDiferenca}</div>` : ''}

  ${secao(L('COBRANÇAS', 'COBROS'),
    `${plural(linhasCobranca.length, L('recebimento', 'cobro'), L('recebimentos', 'cobros'))} · ${plural(qtdParcelasCob, L('parcela', 'cuota'), L('parcelas', 'cuotas'))}`,
    fmt(totalCobrancas), '#047857')}
  ${linhasCobranca.length === 0 ? `<div class="vazio">${t.nenhumaEntrada}</div>` : linhasCobranca.map(l => {
    const cred = mostrarCredito && (l.usado > 0 || l.gerado > 0)
      ? `<div class="cred">${l.usado > 0
          ? `<div class="row"><span>${L('Abateu das parcelas', 'Abonó a las cuotas')}</span><span class="r">${fmt(l.valor + l.usado)}</span></div>
             <div class="row"><span>${L('Usou de crédito', 'Usó de crédito')}</span><span class="r">-${fmt(l.usado)}</span></div>`
          : ''}${l.gerado > 0
          ? `<div class="row"><span>${L('Crédito gerado', 'Crédito generado')}</span><span class="r">+${fmt(l.gerado)}</span></div>`
          : ''}</div>`
      : '';
    const notas = [l.soCredito > 0 ? notaSoCredito(l.soCredito) : '', l.nota].filter(Boolean)
      .map(n => `<div class="mov-sub">${esc(n)}</div>`).join('');
    return mov(l.nome, fmt(l.valor), `${fmtHora(l.criado)} · ${l.sub}`, {
      cor: l.soCredito > 0 ? '#9CA3AF' : l.quitacao ? '#6D28D9' : '#111827',
      cls: l.quitacao ? ' quit' : '',
      badge: l.quitacao ? L('QUITOU', 'LIQUIDÓ') : '',
      badgeCor: '#5B21B6',
      extra: cred + notas,
    });
  }).join('')}

  ${entradasOutras.length > 0 ? `
  ${secao(L('OUTRAS RECEITAS', 'OTROS INGRESOS'), plural(entradasOutras.length, L('lançamento', 'movimiento'), L('lançamentos', 'movimientos')), `+${fmt(totalOutrasReceitas)}`, '#047857')}
  ${entradasOutras.map(r => mov(nomeLanc(r), `+${fmt(parseFloat(r.valor))}`, `${fmtHora(r.created_at)} · ${formatarCategoria(r.categoria)}`, { cor: '#047857' })).join('')}
  ` : ''}

  ${secao(L('EMPRÉSTIMOS', 'PRÉSTAMOS'), resumoEmprestimos, `-${fmt(totalVendasEmprestimos)}`, '#B91C1C')}
  ${vendasDia.map((e: any) => {
    const tp = tipoEmp(e);
    return mov((e.cliente as any)?.nome || '—', `-${fmt(parseFloat(e.valor_principal || 0))}`, fmtHora(e.created_at), { cor: '#B91C1C', badge: tp.rot, badgeCor: tp.cor });
  }).join('')}

  ${renegociacoesDia.length > 0 ? `
  ${secao(L('RENEGOCIAÇÕES', 'RENEGOCIACIONES'), `${plural(renegociacoesDia.length, L('renegociação', 'renegociación'), L('renegociações', 'renegociaciones'))} · ${L('não sai do caixa', 'no sale de caja')}`, fmt(totalRenegociado), '#B45309')}
  ${renegociacoesDia.map((e: any) => mov((e.cliente as any)?.nome || '—', fmt(parseFloat(e.valor_principal || 0)), fmtHora(e.created_at), { cor: '#B45309' })).join('')}
  ` : ''}

  ${secao(L('DESPESAS', 'GASTOS'), resumoDespesas, `-${fmt(totalSaidasDespesas)}`, '#B91C1C')}
  ${registrosSaidas.map(r => {
    const anulado = r.status === 'ANULADO';
    return mov(nomeLanc(r), `-${fmt(parseFloat(r.valor))}`,
      `${fmtHora(r.created_at)} · ${anulado ? t.anulado : formatarCategoria(r.categoria)}`,
      { cor: '#B91C1C', cls: anulado ? ' risc' : '' });
  }).join('')}

  ${entradasMicroseguro.length > 0 ? `
  ${secao(L('MICROSSEGURO', 'MICROSEGURO'), `${plural(entradasMicroseguro.length, L('venda', 'venta'), L('vendas', 'ventas'))} · ${L('caixa próprio', 'caja propia')}`, `+${fmt(totalMicroseguros)}`, '#7C3AED')}
  ${entradasMicroseguro.map(r => mov(r.cliente_nome || r.descricao || '—', `+${fmt(parseFloat(r.valor))}`, fmtHora(r.created_at), { cor: '#7C3AED' })).join('')}
  ` : ''}

  ${reaberturas.length > 0 ? `
  ${secao(t.reaberturas, '', '', '#2563EB')}
  ${reaberturas.map((ev: any) => mov(ev.tipo === 'REABERTURA' ? t.reaberta : t.fechadaDeNovo, fmtHora(ev.momento), ev.usuario || '—')).join('')}
  <div class="sec-res b" style="margin-top:6px">${t.aposReabertura}</div>
  ${alteracoesPos.length === 0
    ? `<div class="vazio">${t.semAlteracoes}</div>`
    : alteracoesPos.map((ev: any) => mov(ev.descricao || ev.tipo, ev.impacto_caixa === null ? '—' : fmt(Number(ev.impacto_caixa)), `${fmtHora(ev.momento)} · ${ev.usuario || '—'}`)).join('')}
  ` : ''}

  <hr class="sep2">
  <div class="row"><span class="lg">${t.saldoFinal}</span><span class="r lg">${fmt(caixaFinal)}</span></div>
  <hr class="sep2">
  <div class="c" style="margin-top:8px;font-size:10px;color:#999">${t.fimExtrato}</div>

</div>
</body></html>`;

      if (Platform.OS === 'web') {
        // Web: abre HTML em nova janela e dispara impressão
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => {
            win.print();
          }, 500);
        }
      } else {
        // Mobile: gera arquivo PDF e compartilha
        const result = await Print.printToFileAsync({ html });
        if (result?.uri) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(result.uri, {
              mimeType: 'application/pdf',
              dialogTitle: `${t.extratoDia} ${dataHoje}`,
            });
          }
        }
      }
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      try {
        let txt = `${rotaNome || 'Rota'} - ${t.extratoDia} ${dataHoje}\n`;
        txt += `${t.caixaInicial}: ${fmt(caixaInicial)}\n`;
        txt += `${t.cobrancas}: ${fmt(totalEntradas)}\n`;
        txt += `${t.saidas}: ${fmt(totalSaidasDespesas)}\n`;
        txt += `${t.caixaFinal}: ${fmt(caixaFinal)}`;
        await Share.share({ message: txt });
      } catch {}
    } finally {
      setCompartilhando(false);
    }
  };

  const alternarBloco = (id: string) => setBlocosAbertos(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const abrirFicha = (emprestimoId?: string) => {
    if (!emprestimoId) return;
    onClose();
    setTimeout(() => nav.navigate('FichaEmprestimo', { emprestimoId }), 250);
  };
  const buscaNorm = normalizarBusca(buscaCob);
  const linhasCobVisiveis = buscaNorm
    ? linhasCobranca.filter(l => normalizarBusca(l.nome).includes(buscaNorm))
    : linhasCobranca;
  const credLinha = (rot: string, val: string) => (
    <View style={ex.credLinha}>
      <Text style={ex.credRot}>{rot}</Text>
      <Text style={ex.credVal}>{val}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={ex.container}>
        <View style={ex.header}>
          <View style={ex.headerTxts}>
            <Text style={ex.headerTitulo}>{L('Extrato do dia', 'Extracto del día')}</Text>
            <Text style={ex.headerSub} numberOfLines={1}>
              {rotaNome || 'Rota'} · {dataLiquidacao || dataHoje}{vendedorNome ? ` · ${vendedorNome}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={ex.fecharBtn} accessibilityLabel={t.fechar}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={ex.scroll}
          contentContainerStyle={ex.scrollConteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={ex.cargaCaixa}>
              <ActivityIndicator size="large" color="#1F2937" />
              <Text style={ex.cargaTexto}>{lang === 'es' ? 'Cargando el extracto…' : 'Carregando o extrato…'}</Text>
            </View>
          ) : erroCarga ? (
            // Nunca um extrato parcial: sem TODAS as fontes, a conta não fecha
            // e a sobra cairia na "diferença não explicada".
            <View style={ex.cargaCaixa}>
              <Ionicons name="cloud-offline-outline" size={40} color="#B91C1C" />
              <Text style={ex.erroTitulo}>{lang === 'es' ? 'No fue posible cargar el extracto completo' : 'Não foi possível carregar o extrato completo'}</Text>
              <Text style={ex.cargaTexto}>{lang === 'es'
                ? 'El día y los valores están guardados; solo el extracto no cargó.'
                : 'O dia e os valores estão salvos; só o extrato não carregou.'}</Text>
              <Text style={ex.erroDetalhe}>{erroCarga}</Text>
              <TouchableOpacity style={ex.erroBotao} onPress={carregarExtrato} activeOpacity={0.8}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={ex.erroBotaoTx}>{lang === 'es' ? 'Intentar de nuevo' : 'Tentar de novo'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ═══ A CONTA — o que o vendedor precisa, sem rolar ═══ */}
              <View style={ex.conta}>
                <Text style={ex.contaRot}>{rotTopo}</Text>
                <Text style={[ex.contaGrande, caixaFinal < 0 && { color: '#B91C1C' }]}>{fmt(caixaFinal)}</Text>
                <View style={ex.contaLinhas}>
                  {linhasConta.map((l, i) => (
                    <View key={i} style={ex.contaLinha}>
                      <Text style={[ex.contaLinhaRot, { color: i === 0 ? '#4B5563' : l.cor }]}>{l.rot}</Text>
                      <Text style={[ex.contaLinhaVal, { color: l.cor }]}>{l.txt}</Text>
                    </View>
                  ))}
                  <View style={[ex.contaLinha, ex.contaFim]}>
                    <Text style={ex.contaFimRot}>{rotFim}</Text>
                    <Text style={ex.contaFimVal}>{fmt(caixaFinal)}</Text>
                  </View>
                </View>
                {temDiferenca && <Text style={ex.contaAviso}>{avisoDiferenca}</Text>}
              </View>

              {/* Selo: o que este extrato É — um dia oficialmente encerrado. */}
              {fechamento && (
                <View style={ex.selo}>
                  <Ionicons name="lock-closed" size={13} color="#374151" />
                  <Text style={ex.seloTx}>
                    {L('Sistema fechado', 'Sistema cerrado')} · {fmtDataHora(fechamento.quando)}
                    {fechamento.por ? ` · ${fechamento.por}` : ''}
                  </Text>
                </View>
              )}

              {/* ═══ COBRANÇAS — uma linha por recebimento ═══ */}
              <BlocoExtrato
                id="cob" aberto={blocosAbertos.has('cob')} onToggle={alternarBloco}
                icone="arrow-down" cor="#047857" fundo="#D1FAE5"
                titulo={L('Cobranças', 'Cobros')}
                resumo={linhasCobranca.length === 0 ? L('nenhuma', 'ninguno')
                  : `${plural(linhasCobranca.length, L('recebimento', 'cobro'), L('recebimentos', 'cobros'))} · ${plural(qtdParcelasCob, L('parcela', 'cuota'), L('parcelas', 'cuotas'))}`}
                valor={fmt(totalCobrancas)}
                vazio={linhasCobranca.length === 0}
              >
                {linhasCobranca.length > 8 && (
                  <TextInput
                    value={buscaCob}
                    onChangeText={setBuscaCob}
                    placeholder={L('Procurar cliente', 'Buscar cliente')}
                    placeholderTextColor="#6B7280"
                    style={ex.busca}
                  />
                )}
                {linhasCobVisiveis.map((l, i) => (
                  <TouchableOpacity
                    key={l.key}
                    disabled={!l.emprestimoId}
                    onPress={() => abrirFicha(l.emprestimoId)}
                    style={[ex.item, i > 0 && ex.itemSep, l.quitacao && ex.itemQuit]}
                  >
                    <View style={ex.itemTopo}>
                      <View style={ex.itemEsq}>
                        <Text style={ex.itemNome} numberOfLines={1}>{l.nome}</Text>
                        <View style={ex.itemSubLinha}>
                          {l.quitacao && (
                            <Text style={[ex.badge, { color: '#5B21B6', backgroundColor: '#EDE9FE' }]}>
                              {L('QUITOU', 'LIQUIDÓ')}
                            </Text>
                          )}
                          <Text style={ex.itemSub}>{fmtHora(l.criado)} · {l.sub}</Text>
                        </View>
                      </View>
                      <Text style={[
                        ex.itemValor,
                        l.quitacao && { color: '#6D28D9', fontWeight: '700' },
                        l.soCredito > 0 && { color: '#9CA3AF' },
                      ]}>
                        {fmt(l.valor)}
                      </Text>
                    </View>
                    {l.soCredito > 0 && <Text style={ex.itemNota}>{notaSoCredito(l.soCredito)}</Text>}
                    {mostrarCredito && (l.usado > 0 || l.gerado > 0) && (
                      <View style={ex.credBox}>
                        {l.usado > 0 && credLinha(L('Abateu das parcelas', 'Abonó a las cuotas'), fmt(l.valor + l.usado))}
                        {l.usado > 0 && credLinha(L('Usou de crédito', 'Usó de crédito'), `-${fmt(l.usado)}`)}
                        {l.gerado > 0 && credLinha(L('Crédito gerado', 'Crédito generado'), `+${fmt(l.gerado)}`)}
                      </View>
                    )}
                    {!!l.nota && <Text style={ex.itemNota}>{l.nota}</Text>}
                  </TouchableOpacity>
                ))}
                {linhasCobVisiveis.length === 0 && (
                  <Text style={ex.vazioTx}>{L('Nenhum cliente com esse nome', 'Ningún cliente con ese nombre')}</Text>
                )}
              </BlocoExtrato>

              {/* ═══ OUTRAS RECEITAS ═══ */}
              {entradasOutras.length > 0 && (
                <BlocoExtrato
                  id="rec" aberto={blocosAbertos.has('rec')} onToggle={alternarBloco}
                  icone="add" cor="#047857" fundo="#D1FAE5"
                  titulo={L('Outras receitas', 'Otros ingresos')}
                  resumo={plural(entradasOutras.length, L('lançamento', 'movimiento'), L('lançamentos', 'movimientos'))}
                  valor={fmt(totalOutrasReceitas)}
                >
                  {entradasOutras.map((r, i) => (
                    <View key={r.id} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={ex.itemNome} numberOfLines={1}>{nomeLanc(r)}</Text>
                          <Text style={ex.itemSub}>{fmtHora(r.created_at)} · {formatarCategoria(r.categoria)}</Text>
                        </View>
                        <Text style={[ex.itemValor, { color: '#047857' }]}>+{fmt(parseFloat(r.valor))}</Text>
                      </View>
                    </View>
                  ))}
                </BlocoExtrato>
              )}

              {/* ═══ EMPRÉSTIMOS — quem, quanto saiu, novo ou renovação ═══ */}
              <BlocoExtrato
                id="emp" aberto={blocosAbertos.has('emp')} onToggle={alternarBloco}
                icone="arrow-up" cor="#B91C1C" fundo="#FEE2E2"
                titulo={L('Empréstimos', 'Préstamos')}
                resumo={resumoEmprestimos}
                valor={fmt(totalVendasEmprestimos)}
                vazio={vendasDia.length === 0}
              >
                {vendasDia.map((e: any, i) => {
                  const tp = tipoEmp(e);
                  return (
                    <TouchableOpacity key={e.id} onPress={() => abrirFicha(e.id)} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={ex.itemNome} numberOfLines={1}>{(e.cliente as any)?.nome || '—'}</Text>
                          <View style={ex.itemSubLinha}>
                            <Text style={[ex.badge, { color: tp.cor, backgroundColor: tp.fundo }]}>{tp.rot}</Text>
                            <Text style={ex.itemSub}>{fmtHora(e.created_at)}</Text>
                          </View>
                        </View>
                        <Text style={[ex.itemValor, { color: '#B91C1C' }]}>-{fmt(parseFloat(e.valor_principal || 0))}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </BlocoExtrato>

              {/* ═══ RENEGOCIAÇÕES — não sai do caixa ═══ */}
              {renegociacoesDia.length > 0 && (
                <BlocoExtrato
                  id="reneg" aberto={blocosAbertos.has('reneg')} onToggle={alternarBloco}
                  icone="swap-horizontal" cor="#B45309" fundo="#FEF3C7"
                  titulo={L('Renegociações', 'Renegociaciones')}
                  resumo={`${plural(renegociacoesDia.length, L('renegociação', 'renegociación'), L('renegociações', 'renegociaciones'))} · ${L('não sai do caixa', 'no sale de caja')}`}
                  valor={fmt(totalRenegociado)}
                >
                  {renegociacoesDia.map((e: any, i) => (
                    <TouchableOpacity key={e.id} onPress={() => abrirFicha(e.id)} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={ex.itemNome} numberOfLines={1}>{(e.cliente as any)?.nome || '—'}</Text>
                          <Text style={ex.itemSub}>{fmtHora(e.created_at)}</Text>
                        </View>
                        <Text style={[ex.itemValor, { color: '#B45309' }]}>{fmt(parseFloat(e.valor_principal || 0))}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </BlocoExtrato>
              )}

              {/* ═══ DESPESAS — anulada fica, riscada e fora do total ═══ */}
              <BlocoExtrato
                id="desp" aberto={blocosAbertos.has('desp')} onToggle={alternarBloco}
                icone="remove" cor="#B91C1C" fundo="#FEE2E2"
                titulo={L('Despesas', 'Gastos')}
                resumo={resumoDespesas}
                valor={fmt(totalSaidasDespesas)}
                vazio={registrosSaidas.length === 0}
              >
                {registrosSaidas.map((r, i) => {
                  const anulado = r.status === 'ANULADO';
                  return (
                    <View key={r.id} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={[ex.itemNome, anulado && ex.itemRisc]} numberOfLines={1}>{nomeLanc(r)}</Text>
                          <Text style={ex.itemSub}>
                            {fmtHora(r.created_at)} · {anulado ? t.anulado : formatarCategoria(r.categoria)}
                          </Text>
                        </View>
                        <Text style={[ex.itemValor, { color: '#B91C1C' }, anulado && ex.itemRisc]}>-{fmt(parseFloat(r.valor))}</Text>
                      </View>
                    </View>
                  );
                })}
              </BlocoExtrato>

              {/* ═══ MICROSSEGURO — caixa próprio, fora da conta de cima ═══ */}
              {entradasMicroseguro.length > 0 && (
                <BlocoExtrato
                  id="micro" aberto={blocosAbertos.has('micro')} onToggle={alternarBloco}
                  icone="shield-checkmark" cor="#6D28D9" fundo="#EDE9FE"
                  titulo={L('Microsseguro', 'Microseguro')}
                  resumo={`${plural(entradasMicroseguro.length, L('venda', 'venta'), L('vendas', 'ventas'))} · ${L('caixa próprio', 'caja propia')}`}
                  valor={fmt(totalMicroseguros)}
                >
                  {entradasMicroseguro.map((r, i) => (
                    <View key={r.id} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={ex.itemNome} numberOfLines={1}>{r.cliente_nome || r.descricao || '—'}</Text>
                          <Text style={ex.itemSub}>{fmtHora(r.created_at)}</Text>
                        </View>
                        <Text style={[ex.itemValor, { color: '#6D28D9' }]}>+{fmt(parseFloat(r.valor))}</Text>
                      </View>
                    </View>
                  ))}
                </BlocoExtrato>
              )}

              {/* ═══ DIA REABERTO — sem o motivo, que fica no web ═══ */}
              {reaberturas.length > 0 && (
                <BlocoExtrato
                  id="reab" aberto={blocosAbertos.has('reab')} onToggle={alternarBloco}
                  icone="lock-open" cor="#1D4ED8" fundo="#DBEAFE"
                  titulo={L('Dia reaberto', 'Día reabierto')}
                  resumo={plural(alteracoesPos.length, L('alteração depois', 'cambio después'), L('alterações depois', 'cambios después'))}
                >
                  {reaberturas.map((ev: any, i: number) => (
                    <View key={`reab-${i}`} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={ex.itemNome}>{ev.tipo === 'REABERTURA' ? t.reaberta : t.fechadaDeNovo}</Text>
                          <Text style={ex.itemSub}>{ev.usuario || '—'}</Text>
                        </View>
                        <Text style={ex.itemSub}>{fmtHora(ev.momento)}</Text>
                      </View>
                    </View>
                  ))}
                  <Text style={ex.reabTitulo}>{t.aposReabertura}</Text>
                  {alteracoesPos.length === 0 ? (
                    <Text style={ex.vazioTx}>{t.semAlteracoes}</Text>
                  ) : alteracoesPos.map((ev: any, i: number) => (
                    <View key={`alt-${i}`} style={[ex.item, i > 0 && ex.itemSep]}>
                      <View style={ex.itemTopo}>
                        <View style={ex.itemEsq}>
                          <Text style={ex.itemNome}>{ev.descricao || ev.tipo}</Text>
                          <Text style={ex.itemSub}>{fmtHora(ev.momento)} · {ev.usuario || '—'}</Text>
                        </View>
                        <Text style={ex.itemValor}>{ev.impacto_caixa === null ? '—' : fmt(Number(ev.impacto_caixa))}</Text>
                      </View>
                    </View>
                  ))}
                </BlocoExtrato>
              )}
            </>
          )}
        </ScrollView>

        {/* Botões Compartilhar + Reset */}
        <View style={[cupom.shareBar, { backgroundColor: '#F3F4F6' }]}>
          {!loading && !erroCarga && <TouchableOpacity style={cupom.shareBtn} onPress={compartilharExtrato} disabled={compartilhando}>
            {compartilhando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={cupom.shareTxt}>📤 {t.compartilhar}</Text>
            )}
          </TouchableOpacity>}
          {isLiquidacaoAberta && (
            <TouchableOpacity
              style={[cupom.shareBtn, { backgroundColor: '#DC2626', marginTop: 8 }]}
              onPress={() => setModalResetVisible(true)}
            >
              <Text style={cupom.shareTxt}>🗑️ {lang === 'es' ? 'Resetar cliente' : 'Resetar cliente'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Modal Reset Cliente */}
        <ModalResetCliente
          visible={modalResetVisible}
          onClose={() => setModalResetVisible(false)}
          onResetSuccess={handleResetSuccess}
          liquidacaoId={liquidacaoId}
          lang={lang}
        />
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ModalResetCliente — Lista clientes com transações na liquidação + reset
// ══════════════════════════════════════════════════════════════════════════

interface ResetClienteProps {
  visible: boolean;
  onClose: () => void;
  onResetSuccess?: () => void;
  liquidacaoId: string;
  lang?: Lang;
}

export function ModalResetCliente({ visible, onClose, onResetSuccess, liquidacaoId, lang = 'pt-BR' }: ResetClienteProps) {
  const liqCtx = useLiquidacaoContext();
  const [clientes, setClientes] = useState<{ id: string; nome: string; qtd_transacoes: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetando, setResetando] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  // BUSCA POR NOME. Pedido do Julio em 06/11/2026: em rota com muitos clientes
  // ele percorria a lista inteira para achar quem resetar.
  //
  // Aparece SEMPRE, e nao a partir de um tamanho: medido em 08/11/2026 sobre
  // as 1.133 liquidacoes com transacao, a lista tem mediana de 15 clientes,
  // p90 de 40 e maximo de 344 -- e 758 delas (67%) passam de 8. Esconder a
  // lupa nos casos pequenos seria uma regra a mais para explicar, num modal
  // que o usuario abre para corrigir dinheiro.
  //
  // `normalizarBusca` vem de utils: a mesma que a lista de clientes usa, para
  // "nubia" achar "núbia" nas duas.
  const filtrados = useMemo(() => {
    const b = normalizarBusca(busca);
    if (!b) return clientes;
    return clientes.filter(c => normalizarBusca(c.nome).includes(b));
  }, [clientes, busca]);

  // A busca nao sobrevive ao fechar: o modal fica montado e, reaberto noutro
  // dia, mostraria a lista filtrada pelo nome digitado na vez anterior.
  useEffect(() => { if (!visible) setBusca(''); }, [visible]);

  useEffect(() => {
    if (visible && liquidacaoId) carregarClientes();
  }, [visible, liquidacaoId]);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      // Buscar clientes com pagamentos nessa liquidação
      const { data: pags } = await supabase
        .from('pagamentos_parcelas')
        .select('cliente_id, clientes!pagamentos_parcelas_cliente_id_fkey(nome)')
        .eq('liquidacao_id', liquidacaoId)
        .eq('estornado', false);

      // Buscar clientes com empréstimos criados nessa liquidação
      const { data: emps } = await supabase
        .from('emprestimos')
        .select('cliente_id, clientes!emprestimos_cliente_id_fkey(nome)')
        .eq('liquidacao_id', liquidacaoId);

      // Buscar clientes com microseguros nessa liquidação
      const { data: micros } = await supabase
        .from('microseguro_vendas')
        .select('cliente_id, clientes!microseguro_vendas_cliente_id_fkey(nome)')
        .eq('liquidacao_id', liquidacaoId);

      // Consolidar em mapa único clienteId → { nome, qtd }
      const map = new Map<string, { nome: string; qtd: number }>();
      const add = (rows: any[]) => {
        (rows || []).forEach((r: any) => {
          if (!r.cliente_id) return;
          const nome = r.clientes?.nome || r.cliente_id;
          const prev = map.get(r.cliente_id) || { nome, qtd: 0 };
          map.set(r.cliente_id, { nome, qtd: prev.qtd + 1 });
        });
      };
      add(pags || []);
      add(emps || []);
      add(micros || []);

      const lista = Array.from(map.entries())
        .map(([id, v]) => ({ id, nome: v.nome, qtd_transacoes: v.qtd }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setClientes(lista);
    } catch (e) {
      console.error('Erro ao carregar clientes para reset:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = (clienteId: string, clienteNome: string) => {
    const confirmar = async () => {
      setResetando(clienteId);
      try {
        const { data, error } = await supabase.rpc('fn_reset_cliente_liquidacao', {
          p_cliente_id: clienteId,
          p_liquidacao_id: liquidacaoId,
        });
        if (error) throw error;
        const res = Array.isArray(data) ? data[0] : data;
        if (res?.sucesso) {
          if (Platform.OS === 'web') window.alert(res.mensagem);
          else Alert.alert(lang === 'es' ? 'Éxito' : 'Sucesso', res.mensagem);
          // Remover cliente da lista
          setClientes(prev => prev.filter(c => c.id !== clienteId));
          // ⭐ Disparar sinal para ClientesScreen desmarcar o breadcrumb
          liqCtx.dispararResetFiltro();
          // Fechar extrato e atualizar liquidação
          onResetSuccess?.();
        } else {
          if (Platform.OS === 'web') window.alert(res?.mensagem || 'Erro ao resetar');
          else Alert.alert('Erro', res?.mensagem || 'Erro ao resetar');
        }
      } catch (e: any) {
        if (Platform.OS === 'web') window.alert(mensagemErro(e));
        else Alert.alert('Erro', mensagemErro(e));
      } finally {
        setResetando(null);
      }
    };

    const msg = lang === 'es'
      ? `Desea eliminar TODAS las transacciones de "${clienteNome}" en esta liquidación? Esta acción no se puede deshacer.`
      : `Deseja apagar TODAS as transações de "${clienteNome}" nesta liquidação? Esta ação não pode ser desfeita.`;

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) confirmar();
    } else {
      Alert.alert(
        lang === 'es' ? '⚠️ Resetar cliente' : '⚠️ Resetar cliente',
        msg,
        [
          { text: lang === 'es' ? 'Cancelar' : 'Cancelar', style: 'cancel' },
          { text: lang === 'es' ? 'Sí, eliminar' : 'Sim, apagar', style: 'destructive', onPress: confirmar },
        ]
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={resetStyles.container}>
        {/* Header */}
        <View style={resetStyles.header}>
          <Text style={resetStyles.headerTxt}>
            {lang === 'es' ? '🗑️ Resetar cliente' : '🗑️ Resetar cliente'}
          </Text>
          <TouchableOpacity onPress={onClose} style={resetStyles.closeBtn}>
            <Text style={resetStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Aviso */}
        <View style={resetStyles.aviso}>
          <Text style={resetStyles.avisoTxt}>
            {lang === 'es'
              ? '⚠️ Esta acción elimina TODAS las transacciones del cliente en esta liquidación (pagos, préstamos, microseguros). No se puede deshacer.'
              : '⚠️ Esta ação apaga TODAS as transações do cliente nesta liquidação (pagamentos, empréstimos, microseguros). Não pode ser desfeita.'}
          </Text>
        </View>

        {/* Busca */}
        {!loading && clientes.length > 0 && (
          <View style={resetStyles.buscaBox}>
            {/* Ionicons e nao emoji: emoji depende da fonte do aparelho, que e
                a mesma familia de problema do ICU em 04/11. */}
            <Ionicons name="search-outline" size={16} color="#9CA3AF" />
            <TextInput
              style={resetStyles.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder={lang === 'es' ? 'Buscar cliente por nombre...' : 'Buscar cliente pelo nome...'}
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {!!busca && (
              <TouchableOpacity onPress={() => setBusca('')} hitSlop={10} style={resetStyles.buscaLimpar}>
                <Ionicons name="close" size={13} color="#4B5563" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Lista */}
        {loading ? (
          <ActivityIndicator size="large" color="#DC2626" style={{ marginTop: 40 }} />
        ) : clientes.length === 0 ? (
          <View style={resetStyles.empty}>
            <Text style={resetStyles.emptyTxt}>
              {lang === 'es' ? 'Ningún cliente con transacciones' : 'Nenhum cliente com transações'}
            </Text>
          </View>
        ) : filtrados.length === 0 ? (
          /* Vazio da BUSCA, nao vazio da liquidacao: dizer "nenhum cliente com
             transacoes" aqui faria o usuario achar que o dia esta limpo. */
          <View style={resetStyles.empty}>
            <Text style={resetStyles.emptyTxt}>
              {lang === 'es'
                ? `Ningún cliente con "${busca}"`
                : `Nenhum cliente com "${busca}"`}
            </Text>
            <TouchableOpacity onPress={() => setBusca('')} style={resetStyles.limparBtn}>
              <Text style={resetStyles.limparBtnTxt}>
                {lang === 'es' ? 'Limpiar búsqueda' : 'Limpar busca'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={resetStyles.clienteRow}>
                <View style={resetStyles.clienteInfo}>
                  <Text style={resetStyles.clienteNome}>{item.nome}</Text>
                </View>
                <TouchableOpacity
                  style={[resetStyles.btnReset, resetando === item.id && { opacity: 0.5 }]}
                  onPress={() => handleReset(item.id, item.nome)}
                  disabled={resetando === item.id}
                >
                  {resetando === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={resetStyles.btnResetTxt}>🗑️</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const resetStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { backgroundColor: '#DC2626', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  aviso: { backgroundColor: '#FEF2F2', borderLeftWidth: 4, borderLeftColor: '#DC2626', margin: 16, padding: 12, borderRadius: 8 },
  avisoTxt: { fontSize: 13, color: '#7F1D1D', lineHeight: 18 },
  // `flexShrink: 1` no input: numa linha `row` o filho nasce rigido no React
  // Native, e o placeholder longo empurrava o X para fora da tela.
  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
  },
  buscaInput: { flex: 1, flexShrink: 1, minWidth: 0, paddingVertical: 10, fontSize: 14, color: '#1F2937' },
  buscaLimpar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  limparBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 8 },
  limparBtnTxt: { fontSize: 13, color: '#374151', fontWeight: '600' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyTxt: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  clienteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  clienteInfo: { flex: 1 },
  clienteNome: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  btnReset: { backgroundColor: '#DC2626', width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnResetTxt: { fontSize: 20 },
});

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

// ══════════════════════════════════════════════════════════════════════════
// Extrato redesenhado (19/11/2026) — um bloco que mostra a contagem e o
// total, e abre o detalhe ao toque. Bloco vazio não abre.
// ══════════════════════════════════════════════════════════════════════════
function BlocoExtrato({
  id, aberto, onToggle, icone, cor, fundo, titulo, resumo, valor, vazio, children,
}: {
  id: string;
  aberto: boolean;
  onToggle: (id: string) => void;
  icone: keyof typeof Ionicons.glyphMap;
  cor: string;
  fundo: string;
  titulo: string;
  resumo: string;
  valor?: string;
  vazio?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={ex.bloco}>
      <TouchableOpacity
        style={ex.blocoTopo}
        disabled={vazio}
        onPress={() => onToggle(id)}
        accessibilityState={{ expanded: aberto }}
      >
        <View style={[ex.blocoIcone, { backgroundColor: fundo }]}>
          <Ionicons name={icone} size={17} color={cor} />
        </View>
        <View style={ex.blocoTxts}>
          <Text style={ex.blocoTitulo}>{titulo}</Text>
          <Text style={ex.blocoResumo}>{resumo}</Text>
        </View>
        {valor != null && <Text style={[ex.blocoValor, { color: cor }]}>{valor}</Text>}
        {!vazio && <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />}
      </TouchableOpacity>
      {aberto && !vazio && <View style={ex.blocoCorpo}>{children}</View>}
    </View>
  );
}

const ex = StyleSheet.create({
  cargaCaixa: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16, gap: 10 },
  cargaTexto: { fontSize: 13, color: '#4B5563', textAlign: 'center' },
  erroTitulo: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  erroDetalhe: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  erroBotao: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1F2937', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 6 },
  erroBotaoTx: { color: '#fff', fontSize: 15, fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#1F2937', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTxts: { flex: 1, flexShrink: 1 },
  headerTitulo: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#D1D5DB', fontSize: 12, marginTop: 2 },
  fecharBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollConteudo: { padding: 14, gap: 10, paddingBottom: 24 },

  conta: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 4 },
  contaRot: { fontSize: 12, color: '#4B5563' },
  contaGrande: { fontSize: 30, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  contaLinhas: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 6, paddingTop: 8, gap: 6 },
  contaLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  contaLinhaRot: { flex: 1, flexShrink: 1, fontSize: 13 },
  contaLinhaVal: { fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  contaFim: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 2 },
  contaFimRot: { flex: 1, flexShrink: 1, fontSize: 13, fontWeight: '700', color: '#111827' },
  contaFimVal: { fontSize: 14, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  contaAviso: { fontSize: 11, color: '#7F1D1D', marginTop: 6, lineHeight: 15 },

  selo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  seloTx: { flexShrink: 1, fontSize: 12, color: '#374151' },

  bloco: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  blocoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  blocoIcone: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  blocoTxts: { flex: 1, flexShrink: 1 },
  blocoTitulo: { fontSize: 14, fontWeight: '500', color: '#111827' },
  blocoResumo: { fontSize: 11, color: '#4B5563', marginTop: 1 },
  blocoValor: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  blocoCorpo: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 4 },

  busca: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#111827', marginTop: 8, marginBottom: 4 },
  item: { paddingVertical: 9, paddingHorizontal: 2, gap: 4 },
  itemSep: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  itemQuit: { backgroundColor: '#F5F3FF', borderRadius: 8, paddingHorizontal: 6 },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemEsq: { flex: 1, flexShrink: 1, gap: 2 },
  itemNome: { fontSize: 13, color: '#111827' },
  itemSubLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemSub: { flexShrink: 1, fontSize: 11, color: '#4B5563' },
  itemValor: { fontSize: 14, fontWeight: '500', color: '#111827', fontVariant: ['tabular-nums'] },
  itemRisc: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  itemNota: { fontSize: 11, color: '#6B7280' },
  badge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },

  credBox: { backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  credLinha: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  credRot: { flex: 1, flexShrink: 1, fontSize: 11, color: '#78350F' },
  credVal: { fontSize: 11, color: '#78350F', fontVariant: ['tabular-nums'] },

  vazioTx: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingVertical: 10 },
  reabTitulo: { fontSize: 12, fontWeight: '700', color: '#1E40AF', marginTop: 8 },
});

const cupom = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E4DF' },
  header: { backgroundColor: '#333', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTxt: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: MONO },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  papel: { backgroundColor: '#FFFEF7', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  centro: { textAlign: 'center', fontSize: 12, color: '#1F2937', fontFamily: MONO, fontWeight: '700' },
  centroSub: { textAlign: 'center', fontSize: 10, color: '#6B7280', fontFamily: MONO, marginTop: 2 },

  // Selo de fechamento. Borda e fundo tênues, sem cor de alerta: não é aviso,
  // é constatação — o dia está encerrado.
  selo: {
    alignItems: 'center', marginTop: 8, paddingVertical: 7, paddingHorizontal: 10,
    borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB', borderStyle: 'dashed',
  },
  seloTitulo: { fontSize: 10, fontWeight: '700', color: '#374151', fontFamily: MONO, letterSpacing: 0.5 },
  seloTxt: { fontSize: 10, color: '#6B7280', fontFamily: MONO, marginTop: 2 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  txt: { fontSize: 11, color: '#1F2937', fontFamily: MONO },
  txtBold: { fontSize: 12, color: '#1F2937', fontFamily: MONO, fontWeight: '700' },
  txtVerde: { fontSize: 11, color: '#059669', fontFamily: MONO },
  txtVerm: { fontSize: 11, color: '#DC2626', fontFamily: MONO },
  // Azul, e não verde nem vermelho: o ajuste pode ir para os dois lados, e
  // pintá-lo com a cor de uma das pontas sugeriria um sinal que ele não tem.
  txtAzul: { fontSize: 11, color: '#2563EB', fontFamily: MONO },
  txtSmall: { fontSize: 10, color: '#1F2937', fontFamily: MONO, flex: 1 },
  txtSmallVerde: { fontSize: 10, color: '#059669', fontFamily: MONO, fontWeight: '600' },
  div1: { textAlign: 'center', fontSize: 9, color: '#D1D5DB', fontFamily: MONO, marginVertical: 3 },
  div2: { textAlign: 'center', fontSize: 9, color: '#9CA3AF', fontFamily: MONO, marginVertical: 3 },
  divPonto: { textAlign: 'center', fontSize: 8, color: '#E5E7EB', fontFamily: MONO, marginVertical: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  itemIdx: { fontSize: 10, color: '#9CA3AF', width: 20, fontFamily: MONO },
  itemCat: { flex: 1, fontSize: 11, color: '#1F2937', fontFamily: MONO, fontWeight: '600' },
  itemVal: { fontSize: 11, fontWeight: '700', fontFamily: MONO },
  itemSub: { fontSize: 10, color: '#6B7280', fontFamily: MONO },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  itemHora: { fontSize: 9, color: '#9CA3AF', fontFamily: MONO },
  shareBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#E8E4DF' },
  shareBtn: { backgroundColor: '#333', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  shareTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

// =====================================================
// 2. MODAL PAGAMENTOS (AGRUPADO POR CLIENTE)
// =====================================================
interface PagamentosProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalPagos: number;
  totalNaoPagos: number;
  lang?: Lang;
}

interface ClienteGrupo {
  /** cliente_id|emprestimo_id — um card por CONTA, não por cliente (ver o memo). */
  chave: string;
  clienteId: string;
  emprestimoId: string;
  /** Principal da conta; mostrado só quando o cliente tem mais de uma conta na lista. */
  valorPrincipal: number;
  clienteNome: string;
  clienteCod: string;
  totalPago: number;
  parcelas: any[];
  quitado: boolean; // ⭐ Indica se empréstimo foi quitado
}

export function ModalPagamentos({ visible, onClose, liquidacaoId, totalPagos, totalNaoPagos, lang = 'pt-BR' }: PagamentosProps) {
  const mostrarCredito = useTrabalhaCredito();
  const t = i18n[lang];
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (visible && liquidacaoId) carregarPagamentos();
    if (!visible) setExpandido(null);
  }, [visible, liquidacaoId]);

  const carregarPagamentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos_parcelas')
        .select(`
          id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_saldo,
          forma_pagamento, valor_credito_usado, valor_credito_gerado,
          status_parcela_atual, created_at, cliente_id, emprestimo_id,
          cliente:cliente_id(nome, consecutivo),
          emprestimo:emprestimo_id(valor_principal, numero_parcelas, status)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .eq('estornado', false)
        .order('created_at', { ascending: false });

      if (!error) setRegistros(data || []);
    } catch (e) {
      console.error('Erro pagamentos:', e);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ CORREÇÃO: Filtrar pagamentos que não são apenas crédito
  // e calcular o valor em dinheiro (descontando crédito usado)
  const pagamentosDinheiro = React.useMemo(() => {
    return registros.filter(r => r.forma_pagamento !== 'CREDITO');
  }, [registros]);

  // Agrupar por CONTA (cliente + empréstimo). SEM deduplicar — ver o porquê
  // no ModalExtrato acima. O dedup que havia aqui era ainda mais largo: por
  // `numero_parcela` DENTRO do cliente, então perdia também a parcela 8 do
  // empréstimo A quando o mesmo cliente pagou a parcela 8 do empréstimo B.
  //
  // ⚠ Agrupava por CLIENTE até 17/11/2026, e quitar + renovar + pagar a 1ª
  // parcela da renovação no mesmo dia virava UM card "✓ QUITADO" com as
  // parcelas das duas contas somadas (1.885,68, 8 parcelas) — a renovação
  // aparecia como quitada. O selo é da CONTA, então o card também.
  const clientesAgrupados: ClienteGrupo[] = React.useMemo(() => {
    const map = new Map<string, ClienteGrupo>();
    pagamentosDinheiro.forEach(r => {
      const cId = r.cliente_id || 'unknown';
      const eId = r.emprestimo_id || 'unknown';
      const chave = `${cId}|${eId}`;
      if (!map.has(chave)) {
        map.set(chave, {
          chave,
          clienteId: cId,
          emprestimoId: eId,
          valorPrincipal: parseFloat(r.emprestimo?.valor_principal || 0),
          clienteNome: r.cliente?.nome || t.cliente,
          clienteCod: r.cliente?.consecutivo || '',
          totalPago: 0,
          parcelas: [],
          quitado: false,
        });
      }
      const grupo = map.get(chave)!;
      grupo.parcelas.push(r);
      // ⭐ Verificar se empréstimo foi quitado
      if (r.emprestimo?.status === 'QUITADO') {
        grupo.quitado = true;
      }
    });
    // ⭐ CORREÇÃO: Recalcular totalPago como dinheiro efetivo (valor_pago_atual - credito_usado)
    map.forEach(grupo => {
      grupo.totalPago = grupo.parcelas.reduce((s: number, p: any) => {
        const valorPagoAtual = parseFloat(p.valor_pago_atual || p.valor_pago_total || 0);
        const creditoUsado = parseFloat(p.valor_credito_usado || 0);
        return s + (valorPagoAtual - creditoUsado);
      }, 0);
    });
    return Array.from(map.values());
  }, [pagamentosDinheiro]);

  // Quantas contas de cada cliente estão na lista: com mais de uma, o card
  // mostra o principal para o vendedor distinguir a quitada da renovação.
  const contasPorCliente = React.useMemo(() => {
    const m = new Map<string, number>();
    clientesAgrupados.forEach(g => m.set(g.clienteId, (m.get(g.clienteId) || 0) + 1));
    return m;
  }, [clientesAgrupados]);

  // ⭐ CORREÇÃO: Calcular totais considerando apenas dinheiro efetivo
  const totalDinheiro = pagamentosDinheiro
    .filter(r => r.forma_pagamento === 'DINHEIRO')
    .reduce((s, r) => {
      const valorPagoAtual = parseFloat(r.valor_pago_atual || r.valor_pago_total || 0);
      const creditoUsado = parseFloat(r.valor_credito_usado || 0);
      return s + (valorPagoAtual - creditoUsado);
    }, 0);
  const totalTransf = pagamentosDinheiro
    .filter(r => r.forma_pagamento && r.forma_pagamento !== 'DINHEIRO' && r.forma_pagamento !== 'CREDITO')
    .reduce((s, r) => {
      const valorPagoAtual = parseFloat(r.valor_pago_atual || r.valor_pago_total || 0);
      const creditoUsado = parseFloat(r.valor_credito_usado || 0);
      return s + (valorPagoAtual - creditoUsado);
    }, 0);

  const renderCliente = ({ item: grupo }: { item: ClienteGrupo }) => {
    const isExpanded = expandido === grupo.chave;
    const variasContas = (contasPorCliente.get(grupo.clienteId) || 0) > 1;

    return (
      <TouchableOpacity
        style={dStyles.pagItem}
        onPress={() => setExpandido(isExpanded ? null : grupo.chave)}
        activeOpacity={0.7}
      >
        {/* Header do cliente */}
        <View style={dStyles.pagItemTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={dStyles.pagClienteNome}>{grupo.clienteNome}</Text>
              {/* ⭐ Badge QUITADO */}
              {grupo.quitado && (
                <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700' }}>
                    {lang === 'es' ? '✓ LIQUIDADO' : '✓ QUITADO'}
                  </Text>
                </View>
              )}
            </View>
            {grupo.clienteCod ? <Text style={dStyles.pagClienteCod}>#{grupo.clienteCod}</Text> : null}
            {variasContas && (
              <Text style={dStyles.pagClienteCod}>
                {lang === 'es' ? 'Préstamo' : 'Empréstimo'} {fmt(grupo.valorPrincipal)}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[dStyles.pagDetailValue, { color: '#059669', fontWeight: '700', fontSize: 15 }]}>{fmt(grupo.totalPago)}</Text>
            <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{grupo.parcelas.length} {t.cuotas}</Text>
          </View>
        </View>

        {/* Parcelas (expandido) */}
        {isExpanded && (
          <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 }}>
            {grupo.parcelas.map((p) => (
              <View key={p.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
                <View style={dStyles.pagItemBottom}>
                  <View style={dStyles.pagDetail}>
                    <Text style={dStyles.pagDetailLabel}>{t.parcela}</Text>
                    <Text style={dStyles.pagDetailValue}>{p.numero_parcela}/{p.emprestimo?.numero_parcelas || '?'}</Text>
                  </View>
                  <View style={dStyles.pagDetail}>
                    <Text style={dStyles.pagDetailLabel}>{t.valor}</Text>
                    <Text style={[dStyles.pagDetailValue, { color: '#059669', fontWeight: '700' }]}>{fmt(parseFloat(p.valor_pago_total || 0))}</Text>
                  </View>
                  <View style={dStyles.pagDetail}>
                    <Text style={dStyles.pagDetailLabel}>Forma</Text>
                    <Text style={dStyles.pagDetailValue}>{p.forma_pagamento === 'DINHEIRO' ? '💵' : '📲'} {p.forma_pagamento}</Text>
                  </View>
                  <View style={dStyles.pagDetail}>
                    <Text style={dStyles.pagDetailLabel}>{t.hora}</Text>
                    <Text style={dStyles.pagDetailValue}>{fmtHora(p.created_at)}</Text>
                  </View>
                </View>
                {/* ⭐ Crédito: mostrar usado sempre, mas gerado só se NÃO quitou */}
                {mostrarCredito && (p.valor_credito_usado > 0 || (p.valor_credito_gerado > 0 && !grupo.quitado)) && (
                  <View style={dStyles.pagCredito}>
                    {p.valor_credito_usado > 0 && <Text style={dStyles.pagCreditoText}>{t.creditoUsado}: {fmt(p.valor_credito_usado)}</Text>}
                    {p.valor_credito_gerado > 0 && !grupo.quitado && <Text style={dStyles.pagCreditoText}>{t.creditoGerado}: {fmt(p.valor_credito_gerado)}</Text>}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Indicador expand */}
        {grupo.parcelas.length > 0 && (
          <Text style={{ textAlign: 'center', fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            {isExpanded ? '▲' : '▼'} {isExpanded ? t.ocultar : t.verParcelas}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dStyles.container}>
        <ModalHeader titulo={t.pagamentos} icone="💰" cor="#EF4444" onClose={onClose} />

        {/* Resumo */}
        <View style={dStyles.pagResumo}>
          <View style={dStyles.pagResumoItem}>
            <Text style={[dStyles.pagResumoValor, { color: '#059669' }]}>{totalPagos}</Text>
            <Text style={dStyles.pagResumoLabel}>{t.pagos}</Text>
          </View>
          <View style={dStyles.pagResumoDivider} />
          <View style={dStyles.pagResumoItem}>
            <Text style={[dStyles.pagResumoValor, { color: '#DC2626' }]}>{totalNaoPagos}</Text>
            <Text style={dStyles.pagResumoLabel}>{t.naoPagos}</Text>
          </View>
        </View>

        {/* Subtotais */}
        <View style={dStyles.pagSubtotais}>
          <View style={dStyles.pagSubItem}>
            <Text style={dStyles.pagSubIcon}>💵</Text>
            <Text style={dStyles.pagSubLabel}>{t.dinheiro}</Text>
            <Text style={dStyles.pagSubValue}>{fmt(totalDinheiro)}</Text>
          </View>
          <View style={dStyles.pagSubItem}>
            <Text style={dStyles.pagSubIcon}>📲</Text>
            <Text style={dStyles.pagSubLabel}>{t.transferencia}</Text>
            <Text style={dStyles.pagSubValue}>{fmt(totalTransf)}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 40 }} />
        ) : clientesAgrupados.length === 0 ? (
          <View style={dStyles.emptyState}>
            <Text style={dStyles.emptyIcon}>💳</Text>
            <Text style={dStyles.emptyText}>{t.semPagamentos}</Text>
          </View>
        ) : (
          <FlatList
            data={clientesAgrupados}
            keyExtractor={(item) => item.chave}
            renderItem={renderCliente}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// =====================================================
// 3. MODAL VENDAS / RECEITAS / DESPESAS (FINANCEIRO)
// =====================================================
type TipoFinanceiro = 'VENDAS' | 'RECEITAS' | 'DESPESAS';

interface FinanceiroProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  tipo: TipoFinanceiro;
  totalValor: number;
  totalQtd: number;
  lang?: Lang;
  isLiquidacaoAberta?: boolean;
  onRefresh?: () => void;
  userId?: string | null;        // ⭐ NOVO: id do usuário logado, p/ validar autoria do empréstimo no cancelamento
}

const getConfigFinanceiro = (lang: Lang): Record<TipoFinanceiro, { titulo: string; icone: string; cor: string; filtro: any }> => ({
  VENDAS: { titulo: i18n[lang].vendasTitulo, icone: '💼', cor: '#10B981', filtro: { tipo: 'PAGAR', categoria: 'EMPRESTIMO' } },
  RECEITAS: { titulo: i18n[lang].receitasTitulo, icone: '📥', cor: '#3B82F6', filtro: { tipo: 'RECEBER' } },
  DESPESAS: { titulo: i18n[lang].despesasTitulo, icone: '📤', cor: '#EF4444', filtro: { tipo: 'PAGAR' } },
});

export function ModalFinanceiro({ visible, onClose, liquidacaoId, tipo, totalValor, totalQtd, lang = 'pt-BR', isLiquidacaoAberta = false, onRefresh, userId }: FinanceiroProps) {
  const t = i18n[lang];
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  
  // ⭐ NOVO: estado do modal de cancelamento de empréstimo
  const [cancelandoEmprestimo, setCancelandoEmprestimo] = useState<any | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  // ⭐ Modal de visualização de comprovantes — um lançamento pode ter até 5.
  const [comprovantesAbertos, setComprovantesAbertos] = useState<string[] | null>(null);
  const [comprovanteIdx, setComprovanteIdx] = useState(0);
  // Microseguro vinculado ao empréstimo (se houver) — null = ainda buscando, undefined = não tem
  const [microseguroVinculado, setMicroseguroVinculado] = useState<number | null | undefined>(undefined);

  const config = getConfigFinanceiro(lang)[tipo];

  useEffect(() => {
    if (visible && liquidacaoId) carregarRegistros();
  }, [visible, liquidacaoId]);

  const carregarRegistros = async () => {
    setLoading(true);
    try {
      // VENDAS: busca direto em emprestimos para ter todos os campos de condições
      if (tipo === 'VENDAS') {
        // Buscar data de abertura da liquidação para filtrar empréstimos criados a partir dela
        const { data: liqData } = await supabase
          .from('liquidacoes_diarias')
          .select('data_abertura')
          .eq('id', liquidacaoId)
          .single();
        const dataAbertura = liqData?.data_abertura || new Date().toISOString();

        const { data, error } = await supabase
          .from('emprestimos')
          .select(`
            id, valor_principal, valor_total, valor_parcela, numero_parcelas,
            taxa_juros, frequencia_pagamento, data_primeiro_vencimento,
            tipo_emprestimo, created_at, data_emprestimo,
            status, criado_por_user_id, total_pago, numero_parcelas_pagas,
            cliente:cliente_id(nome, codigo_cliente)
          `)
          .eq('liquidacao_id', liquidacaoId)
          .gte('created_at', dataAbertura)
          .neq('status', 'CANCELADO')
          .neq('tipo_emprestimo', 'RENEGOCIACAO')
          .order('created_at', { ascending: false });
        if (!error) setRegistros(data || []);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('financeiro')
        .select('id, tipo, categoria, descricao, valor, created_at, forma_pagamento, cliente_nome, vendedor_nome, status, foto_url, comprovantes_urls')
        .eq('liquidacao_id', liquidacaoId)
        .in('status', ['PAGO', 'ANULADO'])  // Inclui anulados para mostrar riscados
        .order('created_at', { ascending: false });

      if (tipo === 'RECEITAS') {
        // Receitas financeiras (excluindo cobranças e microseguros)
        query = query.eq('tipo', 'RECEBER')
          .not('categoria', 'in', '("COBRANCA_PARCELAS","COBRANCA_CUOTAS","VENDA_MICROSEGURO","MICROSEGURO")');
      } else if (tipo === 'DESPESAS') {
        query = query.eq('tipo', 'PAGAR')
          .neq('categoria', 'EMPRESTIMO')
          .neq('categoria', 'ESTORNO_PAGAMENTO');
      }

      const { data, error } = await query;
      if (!error) setRegistros(data || []);
    } catch (e) {
      console.error(`Erro ${tipo}:`, e);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ NOVO: Abrir modal de cancelamento — busca microseguro vinculado primeiro
  const abrirModalCancelamento = async (emprestimo: any) => {
    setCancelandoEmprestimo(emprestimo);
    setMotivoCancelamento('');
    setMicroseguroVinculado(null); // sinal de "buscando..."
    
    try {
      const { data } = await supabase
        .from('microseguro_vendas')
        .select('valor')
        .eq('emprestimo_id', emprestimo.id)
        .limit(1);
      
      if (data && data.length > 0) {
        setMicroseguroVinculado(parseFloat(data[0].valor));
      } else {
        setMicroseguroVinculado(undefined); // não tem microseguro
      }
    } catch (e) {
      console.error('Erro ao buscar microseguro vinculado:', e);
      setMicroseguroVinculado(undefined); // em caso de erro, assume sem microseguro
    }
  };

  // ⭐ NOVO: Função para cancelar empréstimo do vendedor
  const handleCancelarEmprestimo = async () => {
    if (!cancelandoEmprestimo || !userId) return;
    
    setConfirmandoCancelamento(true);
    try {
      const { data, error } = await supabase.rpc('fn_cancelar_emprestimo_vendedor', {
        p_emprestimo_id: cancelandoEmprestimo.id,
        p_user_id: userId,
        p_motivo: motivoCancelamento.trim() || null,
      });
      
      if (error) throw error;
      
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        // Limpar estado e fechar modal de confirmação
        setCancelandoEmprestimo(null);
        setMotivoCancelamento('');
        setMicroseguroVinculado(undefined);
        // Recarregar lista
        await carregarRegistros();
        if (onRefresh) onRefresh();
        
        if (Platform.OS === 'web') {
          window.alert(t.cancelamentoSucesso);
        } else {
          Alert.alert(t.cancelamentoSucesso);
        }
      } else {
        const msg = res?.mensagem || t.cancelamentoErro;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert(t.cancelamentoErro, msg);
        }
      }
    } catch (e: any) {
      console.error('Erro ao cancelar empréstimo:', e);
      const msg = e?.message || t.cancelamentoErro;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t.cancelamentoErro, msg);
      }
    } finally {
      setConfirmandoCancelamento(false);
    }
  };

  // ⭐ Função para excluir/anular movimentação
  const handleExcluir = async (item: any) => {
    const confirmar = async () => {
      setExcluindo(item.id);
      try {
        const { data, error } = await supabase.rpc('fn_anular_lancamento_financeiro', {
          p_financeiro_id: item.id,
          p_motivo: 'Excluído pelo vendedor via app',
          p_user_id: null,
        });

        if (error) throw error;

        const res = Array.isArray(data) ? data[0] : data;
        if (res?.sucesso) {
          // Recarregar lista
          await carregarRegistros();
          // Notificar parent para atualizar totais
          if (onRefresh) onRefresh();
          
          if (Platform.OS === 'web') {
            window.alert(t.exclusaoSucesso || 'Movimentação excluída!');
          } else {
            Alert.alert('✓', res.mensagem || t.exclusaoSucesso);
          }
        } else {
          throw new Error(res?.mensagem || t.exclusaoErro);
        }
      } catch (e: any) {
        console.error('Erro ao excluir:', e);
        if (Platform.OS === 'web') {
          window.alert(mensagemErro(e, t.exclusaoErro));
        } else {
          Alert.alert('Erro', mensagemErro(e, t.exclusaoErro));
        }
      } finally {
        setExcluindo(null);
      }
    };

    // Confirmação
    if (Platform.OS === 'web') {
      if (window.confirm(`${t.confirmarExclusaoMsg}\n\n${formatarCategoria(item.categoria)}: ${fmt(item.valor)}`)) {
        confirmar();
      }
    } else {
      Alert.alert(
        t.confirmarExclusao,
        `${t.confirmarExclusaoMsg}\n\n${formatarCategoria(item.categoria)}: ${fmt(item.valor)}`,
        [
          { text: t.cancelar || 'Cancelar', style: 'cancel' },
          { text: t.sim || 'Sim', style: 'destructive', onPress: confirmar },
        ]
      );
    }
  };

  const fmtFrequencia = (f: string) => ({
    DIARIO: lang === 'es' ? 'Diario' : 'Diário',
    SEMANAL: lang === 'es' ? 'Semanal' : 'Semanal',
    QUINZENAL: 'Quinzenal',
    MENSAL: lang === 'es' ? 'Mensual' : 'Mensal',
    FLEXIVEL: lang === 'es' ? 'Flexible' : 'Flexível',
  }[f] || f);

  const renderItem = ({ item }: any) => {
    // Card especial para VENDAS (empréstimos)
    if (tipo === 'VENDAS') {
      const clienteNome = item.cliente?.nome || '—';
      const primeiroPgto = item.data_primeiro_vencimento
        ? data(item.data_primeiro_vencimento)
        : '—';
      
      // ⭐ NOVO: regras de cancelamento de venda
      // Vendedor pode cancelar se: liquidação aberta + autor do empréstimo + zero pagamentos
      const semPagamentos = (item.numero_parcelas_pagas || 0) === 0 
        && parseFloat(item.total_pago || 0) === 0;
      const ehAutor = userId && item.criado_por_user_id === userId;
      const statusOk = item.status === 'ATIVO' || item.status === 'VENCIDO';
      const podeCancelarVenda = isLiquidacaoAberta && ehAutor && semPagamentos && statusOk;
      
      return (
        <View style={dStyles.finItem}>
          <View style={dStyles.finItemTop}>
            <View style={[dStyles.finItemDot, { backgroundColor: config.cor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[dStyles.finItemCategoria, { fontWeight: '700', fontSize: 14 }]}>{clienteNome}</Text>
              <Text style={[dStyles.finItemCliente, { color: '#6B7280', marginTop: 2 }]}>
                {lang === 'es' ? '1° pago' : '1° pgto'}: {primeiroPgto}
                {'  ·  '}{item.numero_parcelas}x {fmt(parseFloat(item.valor_parcela || 0))}
                {'  ·  '}{lang === 'es' ? 'intereses' : 'juros'} {fmt(parseFloat(item.valor_total || 0) - parseFloat(item.valor_principal || 0))} ({item.taxa_juros}%)
                {'  ·  '}{fmtFrequencia(item.frequencia_pagamento)}
              </Text>
            </View>
            <Text style={[dStyles.finItemValor, { color: config.cor }]}>{fmt(parseFloat(item.valor_principal || 0))}</Text>
          </View>
          <View style={[dStyles.finItemBottom, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={dStyles.finItemHora}>{fmtHora(item.created_at)}</Text>
              <Text style={dStyles.finItemForma}>{item.tipo_emprestimo || 'NOVO'}</Text>
            </View>
            {podeCancelarVenda && (
              <TouchableOpacity
                onPress={() => abrirModalCancelamento(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: '#FEE2E2',
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626' }}>
                  {t.cancelar}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Se item está anulado, mostrar com estilo diferente
    const isAnulado = item.status === 'ANULADO';
    const isExcluindoEste = excluindo === item.id;
    // Sem `tipo !== 'VENDAS'`: o card de VENDAS ja retornou mais acima, entao
    // aqui `tipo` so pode ser RECEITAS ou DESPESAS e a clausula era sempre
    // verdadeira (o tsc acusava comparacao sem sobreposicao).
    const podeExcluir = isLiquidacaoAberta && !isAnulado;

    return (
    <View style={[dStyles.finItem, isAnulado && { opacity: 0.5, backgroundColor: '#F9FAFB' }]}>
      <View style={dStyles.finItemTop}>
        <View style={[dStyles.finItemDot, { backgroundColor: isAnulado ? '#9CA3AF' : config.cor }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[dStyles.finItemCategoria, isAnulado && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>
              {formatarCategoria(item.categoria)}
            </Text>
            {isAnulado && (
              <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#DC2626' }}>{t.anulado || 'ANULADO'}</Text>
              </View>
            )}
          </View>
          {item.cliente_nome && <Text style={dStyles.finItemCliente}>{item.cliente_nome}</Text>}
          {item.descricao && !item.cliente_nome && <Text style={dStyles.finItemCliente}>{item.descricao}</Text>}
        </View>
        <Text style={[dStyles.finItemValor, { color: isAnulado ? '#9CA3AF' : config.cor }, isAnulado && { textDecorationLine: 'line-through' }]}>
          {fmt(parseFloat(item.valor))}
        </Text>
      </View>
      <View style={[dStyles.finItemBottom, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Text style={dStyles.finItemHora}>{fmtHora(item.created_at)}</Text>
          {item.forma_pagamento && <Text style={dStyles.finItemForma}>{item.forma_pagamento}</Text>}
          {comprovantesDe(item).length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setComprovanteIdx(0);
                setComprovantesAbertos(comprovantesDe(item));
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="image-outline" size={14} color="#3B82F6" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#3B82F6' }}>
                {lang === 'es' ? 'Comprobante' : 'Comprovante'}
                {comprovantesDe(item).length > 1 ? ` (${comprovantesDe(item).length})` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {podeExcluir && (
          <TouchableOpacity 
            onPress={() => handleExcluir(item)} 
            disabled={isExcluindoEste}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#FEE2E2', 
              paddingHorizontal: 10, 
              paddingVertical: 5, 
              borderRadius: 6,
              opacity: isExcluindoEste ? 0.5 : 1,
            }}
          >
            {isExcluindoEste ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626', marginLeft: 4 }}>
                  {t.excluir || 'Excluir'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
    );
  };

  // Para VENDAS: total = soma de valor_principal dos empréstimos listados (igual ao total_emprestado_dia do banco)
  // Para outros: soma dos registros filtrados (excluindo anulados)
  const totalReal = tipo === 'VENDAS'
    ? registros.reduce((s, r) => s + parseFloat(r.valor_principal || 0), 0)
    : registros.filter(r => r.status !== 'ANULADO').reduce((s, r) => s + parseFloat(r.valor || 0), 0);
  const qtdReal = tipo === 'VENDAS' 
    ? registros.length 
    : registros.filter(r => r.status !== 'ANULADO').length;
  // Total de juros (apenas VENDAS): soma de (valor_total - valor_principal)
  const totalJurosReal = tipo === 'VENDAS'
    ? registros.reduce((s, r) => s + (parseFloat(r.valor_total || 0) - parseFloat(r.valor_principal || 0)), 0)
    : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dStyles.container}>
        <ModalHeader titulo={config.titulo} icone={config.icone} cor={config.cor} onClose={onClose} />

        {/* Resumo */}
        <View style={[dStyles.finResumo, { borderLeftColor: config.cor }]}>
          <View>
            <Text style={dStyles.finResumoLabel}>{t.total}</Text>
            <Text style={[dStyles.finResumoValor, { color: config.cor }]}>{fmt(loading ? totalValor : totalReal)}</Text>
          </View>
          {tipo === 'VENDAS' && !loading && totalJurosReal > 0 && (
            <View>
              <Text style={dStyles.finResumoLabel}>{lang === 'es' ? 'Intereses' : 'Juros'}</Text>
              <Text style={[dStyles.finResumoValor, { color: '#2563EB', fontSize: 18 }]}>{fmt(totalJurosReal)}</Text>
            </View>
          )}
          <View style={dStyles.finResumoBadge}>
            <Text style={dStyles.finResumoBadgeText}>{loading ? totalQtd : qtdReal} {tipo === 'VENDAS' ? t.empAbrev : t.lancamentos}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={config.cor} style={{ marginTop: 40 }} />
        ) : registros.length === 0 ? (
          <View style={dStyles.emptyState}>
            <Text style={dStyles.emptyIcon}>{config.icone}</Text>
            <Text style={dStyles.emptyText}>{t.semRegistros}</Text>
          </View>
        ) : (
          <FlatList
            data={registros}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* ⭐ MODAL VISUALIZAÇÃO DE COMPROVANTES — galeria de até 5 fotos.
          O fundo fecha ao toque, mas a FlatList intercepta os toques sobre a
          imagem para o swipe funcionar. */}
      <Modal
        visible={!!comprovantesAbertos}
        transparent
        animationType="fade"
        onRequestClose={() => setComprovantesAbertos(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setComprovantesAbertos(null)}
            style={{ ...StyleSheet.absoluteFillObject }}
          />

          {comprovantesAbertos && (
            <FlatList
              data={comprovantesAbertos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(u, i) => `${i}-${u}`}
              style={{ flexGrow: 0, marginTop: height * 0.1 }}
              onMomentumScrollEnd={(e) => {
                setComprovanteIdx(Math.round(e.nativeEvent.contentOffset.x / width));
              }}
              renderItem={({ item: uri }) => (
                <View style={{ width, height: height * 0.75, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
              )}
            />
          )}

          {/* Contador — só quando há mais de um comprovante */}
          {comprovantesAbertos && comprovantesAbertos.length > 1 && (
            <View style={{ position: 'absolute', bottom: 48, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {comprovanteIdx + 1} / {comprovantesAbertos.length}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setComprovantesAbertos(null)}
            style={{
              position: 'absolute', top: 40, right: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 20, width: 40, height: 40,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ⭐ MODAL DE CONFIRMAÇÃO DE CANCELAMENTO DE EMPRÉSTIMO */}
      <Modal
        visible={!!cancelandoEmprestimo}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!confirmandoCancelamento) {
            setCancelandoEmprestimo(null);
            setMotivoCancelamento('');
            setMicroseguroVinculado(undefined);
          }
        }}
      >
        <View style={cancelStyles.overlay}>
          <View style={cancelStyles.dialog}>
            <View style={cancelStyles.header}>
              <Ionicons name="warning" size={20} color="#DC2626" />
              <Text style={cancelStyles.title}>{t.cancelarEmprestimoTitulo}</Text>
            </View>
            
            {cancelandoEmprestimo && (
              <View style={cancelStyles.body}>
                <View style={cancelStyles.row}>
                  <Text style={cancelStyles.label}>{t.cliente}:</Text>
                  <Text style={cancelStyles.value} numberOfLines={1}>
                    {cancelandoEmprestimo.cliente?.nome || '—'}
                  </Text>
                </View>
                <View style={cancelStyles.row}>
                  <Text style={cancelStyles.label}>{t.valor}:</Text>
                  <Text style={cancelStyles.value}>
                    {fmt(parseFloat(cancelandoEmprestimo.valor_principal || 0))}
                  </Text>
                </View>
                <View style={cancelStyles.row}>
                  <Text style={cancelStyles.label}>{lang === 'es' ? 'Tipo' : 'Tipo'}:</Text>
                  <Text style={cancelStyles.value}>
                    {cancelandoEmprestimo.tipo_emprestimo || 'NOVO'}
                  </Text>
                </View>
                
                {/* ⭐ Linha de microseguro vinculado (se houver) */}
                {microseguroVinculado !== undefined && microseguroVinculado !== null && (
                  <View style={cancelStyles.microseguroBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="shield-checkmark-outline" size={14} color="#7C3AED" />
                      <Text style={cancelStyles.microseguroLabel}>
                        {t.microseguroCancelado} {fmt(microseguroVinculado)}
                      </Text>
                    </View>
                    <Text style={cancelStyles.microseguroAviso}>
                      {t.microseguroSeraCancelado}
                    </Text>
                  </View>
                )}
                
                <Text style={cancelStyles.aviso}>
                  ⚠️ {t.cancelarEmprestimoAviso}
                </Text>
                
                <Text style={cancelStyles.motivoLabel}>
                  {t.cancelarEmprestimoMotivo}
                </Text>
                <TextInput
                  style={cancelStyles.input}
                  value={motivoCancelamento}
                  onChangeText={setMotivoCancelamento}
                  placeholder={t.cancelarEmprestimoMotivoPlaceholder}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  editable={!confirmandoCancelamento}
                />
              </View>
            )}
            
            <View style={cancelStyles.footer}>
              <TouchableOpacity
                style={[cancelStyles.btnVoltar, confirmandoCancelamento && { opacity: 0.5 }]}
                onPress={() => {
                  setCancelandoEmprestimo(null);
                  setMotivoCancelamento('');
                  setMicroseguroVinculado(undefined);
                }}
                disabled={confirmandoCancelamento}
              >
                <Text style={cancelStyles.btnVoltarTx}>{t.cancelarVoltar}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cancelStyles.btnConfirmar, confirmandoCancelamento && { opacity: 0.7 }]}
                onPress={handleCancelarEmprestimo}
                disabled={confirmandoCancelamento}
              >
                {confirmandoCancelamento ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={cancelStyles.btnConfirmarTx}>{t.cancelando}</Text>
                  </View>
                ) : (
                  <Text style={cancelStyles.btnConfirmarTx}>{t.cancelarConfirmar}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// =====================================================
// 4. MODAL MICROSEGURO
// =====================================================
interface MicroseguroProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalValor: number;
  totalQtd: number;
  lang?: Lang;
}

export function ModalMicroseguro({ visible, onClose, liquidacaoId, totalValor, totalQtd, lang = 'pt-BR' }: MicroseguroProps) {
  const t = i18n[lang];
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && liquidacaoId) carregarVendas();
  }, [visible, liquidacaoId]);

  const carregarVendas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('microseguro_vendas')
        .select(`
          id, valor, data_venda, created_at,
          cliente:cliente_id(nome, consecutivo),
          emprestimo:emprestimo_id(valor_principal, numero_parcelas),
          vendedor:vendedor_id(nome)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro query microseguro:', error);
        setVendas([]);
      } else {
        setVendas(data || []);
      }
    } catch (e) {
      console.error('Erro microseguro:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => {
    const clienteNome = item.cliente?.nome || 'Cliente';
    const clienteCod = item.cliente?.consecutivo || '';
    const vendedorNome = item.vendedor?.nome || '';

    return (
      <View style={dStyles.microItem}>
        <View style={dStyles.microItemLeft}>
          <View style={dStyles.microItemAvatar}>
            <Text style={{ fontSize: 18 }}>🛡️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={dStyles.microItemNome}>{clienteNome}</Text>
            {clienteCod ? <Text style={dStyles.microItemCod}>#{clienteCod}</Text> : null}
            {item.emprestimo && (
              <Text style={dStyles.microItemEmprestimo}>
                {t.emprestimo}: {fmt(item.emprestimo.valor_principal)} ({item.emprestimo.numero_parcelas}x)
              </Text>
            )}
            {vendedorNome ? <Text style={dStyles.microItemVendedor}>{t.vendedor}: {vendedorNome}</Text> : null}
          </View>
          <View style={dStyles.microItemRight}>
            <Text style={dStyles.microItemValor}>{fmt(parseFloat(item.valor))}</Text>
            <Text style={dStyles.microItemHora}>{fmtHora(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dStyles.container}>
        <ModalHeader titulo={t.microseguro} icone="🛡️" cor="#D97706" onClose={onClose} />

        {/* Resumo */}
        <View style={dStyles.microResumo}>
          <View style={dStyles.microResumoItem}>
            <Text style={dStyles.microResumoValor}>{fmt(loading ? totalValor : vendas.reduce((s, v) => s + parseFloat(v.valor || 0), 0))}</Text>
            <Text style={dStyles.microResumoLabel}>{t.totalVendido}</Text>
          </View>
          <View style={dStyles.microResumoDivider} />
          <View style={dStyles.microResumoItem}>
            <Text style={dStyles.microResumoValor}>{loading ? totalQtd : vendas.length}</Text>
            <Text style={dStyles.microResumoLabel}>{t.contratos}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#D97706" style={{ marginTop: 40 }} />
        ) : vendas.length === 0 ? (
          <View style={dStyles.emptyState}>
            <Text style={dStyles.emptyIcon}>🛡️</Text>
            <Text style={dStyles.emptyText}>{t.semMicroseguro}</Text>
          </View>
        ) : (
          <FlatList
            data={vendas}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// =====================================================
// HELPER: Formatar categorias
// =====================================================
function formatarCategoria(cat: string): string {
  const map: Record<string, string> = {
    COBRANCA_CUOTAS: 'Cobrança Parcelas',
    COBRANCA_PARCELAS: 'Cobrança Parcelas',
    EMPRESTIMO: 'Empréstimo',
    VENDA_MICROSEGURO: 'Venda Microseguro',
    MICROSEGURO: 'Microseguro',
    PRESTAMO: 'Empréstimo',
    APORTE: 'Aporte de Capital',
    AJUSTE_CAJA: 'Ajuste de Caixa',
    GASOLINA: 'Gasolina',
    MANUTENCAO: 'Manutenção',
    ALIMENTACAO: 'Alimentação',
    TRANSPORTE: 'Transporte',
    ESTORNO_PAGAMENTO: 'Estorno de Pagamento',
    MULTA: 'Multa',
    OUTROS: 'Outros',
  };
  return map[cat] || cat?.replace(/_/g, ' ') || 'Outros';
}

// =====================================================
// ESTILOS
// =====================================================
const dStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcone: { fontSize: 22 },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  headerCloseText: { fontSize: 16, color: '#fff', fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },

  // ── EXTRATO ──
  extratoResumo: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, elevation: 2 },
  extratoResumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  extratoResumoLabel: { fontSize: 14, color: '#6B7280' },
  extratoResumoValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  extratoDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  extratoListHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  extratoListTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  extratoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  extratoItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  extratoIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  extratoCategoria: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  extratoCliente: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  extratoHora: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  extratoValor: { fontSize: 14, fontWeight: '700' },

  // Share bar
  shareBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 },
  shareIcon: { fontSize: 16, marginRight: 8 },
  shareText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // ── PAGAMENTOS ──
  pagResumo: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, elevation: 2 },
  pagResumoItem: { flex: 1, alignItems: 'center' },
  pagResumoDivider: { width: 1, backgroundColor: '#E5E7EB' },
  pagResumoValor: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  pagResumoLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  pagSubtotais: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, gap: 8 },
  pagSubItem: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 8, gap: 6 },
  pagSubIcon: { fontSize: 14 },
  pagSubLabel: { fontSize: 12, color: '#6B7280', flex: 1 },
  pagSubValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  pagItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  pagItemTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pagClienteNome: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  pagClienteCod: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  pagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pagBadgeText: { fontSize: 10, fontWeight: '700' },
  pagItemBottom: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  pagDetail: { },
  pagDetailLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' },
  pagDetailValue: { fontSize: 13, color: '#1F2937', fontWeight: '500', marginTop: 1 },
  pagCredito: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pagCreditoText: { fontSize: 11, color: '#6B7280' },

  // ── FINANCEIRO ──
  finResumo: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4 },
  finResumoLabel: { fontSize: 13, color: '#6B7280' },
  finResumoValor: { fontSize: 22, fontWeight: '700' },
  finResumoBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  finResumoBadgeText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  finItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
  finItemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finItemDot: { width: 10, height: 10, borderRadius: 5 },
  finItemCategoria: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  finItemCliente: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  finItemValor: { fontSize: 15, fontWeight: '700' },
  finItemBottom: { flexDirection: 'row', gap: 16, marginTop: 8, marginLeft: 20 },
  finItemHora: { fontSize: 11, color: '#9CA3AF' },
  finItemForma: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },

  // ── MICROSEGURO ──
  microResumo: { flexDirection: 'row', backgroundColor: '#FEF9C3', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FDE047' },
  microResumoItem: { flex: 1, alignItems: 'center' },
  microResumoDivider: { width: 1, backgroundColor: '#FDE047' },
  microResumoValor: { fontSize: 22, fontWeight: '700', color: '#92400E' },
  microResumoLabel: { fontSize: 12, color: '#A16207', marginTop: 4 },
  microItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  microItemLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  microItemAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF9C3', justifyContent: 'center', alignItems: 'center' },
  microItemNome: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  microItemCod: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  microItemEmprestimo: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  microItemVendedor: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  microItemRight: { alignItems: 'flex-end' },
  microItemValor: { fontSize: 16, fontWeight: '700', color: '#D97706' },
  microItemHora: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  microItemCancelado: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  microItemCanceladoText: { fontSize: 9, fontWeight: '700', color: '#DC2626' },
});

// =====================================================
// ESTILOS DO MODAL DE CANCELAMENTO DE EMPRÉSTIMO
// =====================================================
const cancelStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    width: 80,
  },
  value: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
  },
  aviso: {
    fontSize: 12,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 14,
  },
  microseguroBox: {
    backgroundColor: '#F3E8FF',
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  microseguroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5B21B6',
  },
  microseguroAviso: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
    marginLeft: 20,
  },
  motivoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1F2937',
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  btnVoltar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnVoltarTx: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  btnConfirmar: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmarTx: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});