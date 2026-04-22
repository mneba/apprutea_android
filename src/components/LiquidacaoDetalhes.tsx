// =====================================================
// MODAIS DE DETALHE DA LIQUIDAÇÃO DIÁRIA
// Arquivo: src/components/LiquidacaoDetalhes.tsx
// =====================================================

import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../services/supabase';

const { width, height } = Dimensions.get('window');

// =====================================================
// HELPERS
// =====================================================
const fmt = (v: number | null | undefined) =>
  '$ ' + (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d: string | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR');
};

const fmtHora = (d: string | null) => {
  if (!d) return '';
  // Supabase retorna timestamps sem 'Z' mas são UTC — adicionar Z para forçar interpretação correta
  const utcStr = d.endsWith('Z') || d.includes('+') ? d : d + 'Z';
  const dt = new Date(utcStr);
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  },
  'es': {
    extratoDia: 'EXTRACTO DEL DÍA', extratoLiq: 'EXTRACTO LIQUIDACIÓN DIARIA',
    caixaInicial: 'CAJA INICIAL', saidas: '(-) SALIDAS',
    cobrancas: '(+) COBROS', caixaFinal: 'CAJA FINAL',
    movimentacoes: 'MOVIMIENTOS', nenhuma: 'Ningún movimiento',
    totalCobrancas: 'TOTAL COBROS', totalMicroseguros: 'TOTAL MICROSEGUROS', totalOutrasReceitas: 'TOTAL OTROS INGRESOS',
    totalSaidas: 'TOTAL SALIDAS', saldoFinal: 'SALDO FINAL',
    fimExtrato: '*** FIN DEL EXTRACTO ***', compartilhar: 'Compartir PDF',
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
}

export function ModalExtrato({ visible, onClose, liquidacaoId, caixaInicial, caixaFinal, rotaNome, vendedorNomeExterno, lang = 'pt-BR' }: ExtratoProps) {
  const t = i18n[lang];
  const [registros, setRegistros] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendedorNome, setVendedorNome] = useState('');
  const [dataLiquidacao, setDataLiquidacao] = useState('');
  const [caixaMicroInicial, setCaixaMicroInicial] = useState(0);
  const [caixaMicroFinal, setCaixaMicroFinal] = useState(0);
  const [totalRetiroMicro, setTotalRetiroMicro] = useState(0);
  const [resumoOp, setResumoOp] = useState({ pagos: 0, naoPagos: 0, novos: 0, renovados: 0, renegociados: 0 });
  const [vendasDia, setVendasDia] = useState<any[]>([]);
  const [renegociacoesDia, setRenegociacoesDia] = useState<any[]>([]);
  const extratoViewRef = useRef<View>(null);

  useEffect(() => {
    if (visible && liquidacaoId) carregarExtrato();
  }, [visible, liquidacaoId]);

  const carregarExtrato = async () => {
    setLoading(true);
    try {
      // Busca dados da liquidação (vendedor + data + microseguro)
      const { data: liqData } = await supabase
        .from('liquidacoes_diarias')
        .select('data_liquidacao, data_abertura, microseguro_inicial, microseguro_final, clientes_pagos, clientes_nao_pagos, clientes_novos, clientes_renovados, clientes_renegociados')
        .eq('id', liquidacaoId)
        .single();

      if (liqData) {
        const dataStr = liqData.data_liquidacao?.substring(0, 10) || liqData.data_abertura?.substring(0, 10) || '';
        if (dataStr) {
          const [y, m, d] = dataStr.split('-');
          setDataLiquidacao(`${d}/${m}/${y}`);
        }
        if (vendedorNomeExterno) setVendedorNome(vendedorNomeExterno);
        setCaixaMicroInicial(liqData.microseguro_inicial || 0);
        setCaixaMicroFinal(liqData.microseguro_final || 0);
        setResumoOp({
          pagos: (liqData as any).clientes_pagos || 0,
          naoPagos: (liqData as any).clientes_nao_pagos || 0,
          novos: (liqData as any).clientes_novos || 0,
          renovados: (liqData as any).clientes_renovados || 0,
          renegociados: (liqData as any).clientes_renegociados || 0,
        });
      }

      // Busca movimentações financeiras
      const { data, error } = await supabase
        .from('financeiro')
        .select('id, tipo, categoria, descricao, valor, data_lancamento, created_at, forma_pagamento, cliente_nome, status')
        .eq('liquidacao_id', liquidacaoId)
        .eq('status', 'PAGO')
        .order('created_at', { ascending: true });

      if (!error) {
        setRegistros(data || []);
        const retiroMicro = (data || [])
          .filter((r: any) => r.tipo === 'PAGAR' && ['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria))
          .reduce((s: number, r: any) => s + parseFloat(r.valor), 0);
        setTotalRetiroMicro(retiroMicro);
      }

      // Busca pagamentos de parcelas (cobranças)
      const { data: pags, error: errPag } = await supabase
        .from('pagamentos_parcelas')
        .select(`
          id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_credito_gerado, valor_credito_usado,
          forma_pagamento, created_at, cliente_id, parcela_id, emprestimo_id,
          clientes!pagamentos_parcelas_cliente_id_fkey(nome, consecutivo)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .eq('estornado', false)
        .order('created_at', { ascending: true });

      if (errPag) {
        console.log('❌ Erro query pagamentos_parcelas:', errPag.message, errPag.details, errPag.hint);
        // Fallback: busca sem join se foreign key falhar
        const { data: pagsSem, error: errSem } = await supabase
          .from('pagamentos_parcelas')
          .select('id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_credito_gerado, valor_credito_usado, forma_pagamento, created_at, cliente_id')
          .eq('liquidacao_id', liquidacaoId)
          .eq('estornado', false)
          .order('created_at', { ascending: true });
        console.log('🔄 Fallback pagamentos:', pagsSem?.length, errSem?.message);
        // Busca nomes dos clientes separadamente
        const ids = [...new Set((pagsSem || []).map((p: any) => p.cliente_id).filter(Boolean))];
        if (ids.length > 0) {
          const { data: clisData } = await supabase
            .from('clientes')
            .select('id, nome')
            .in('id', ids);
          const nomeMap = new Map((clisData || []).map((c: any) => [c.id, c.nome]));
          setPagamentos((pagsSem || []).map((p: any) => ({ ...p, clientes: { nome: nomeMap.get(p.cliente_id) || '' } })));
        } else {
          setPagamentos(pagsSem || []);
        }
      } else {
        console.log('✅ Pagamentos carregados:', pags?.length);
        // Deduplicar: chave = emprestimo_parcela_id > emprestimo_id+numero_parcela > cliente_id+numero_parcela
        // Manter o registro com maior valor total real (valor_pago_total + valor_credito_gerado)
        const mapaDedup = new Map<string, any>();
        for (const p of (pags || [])) {
          const key = p.parcela_id || `${p.emprestimo_id}-${p.numero_parcela}` || `${p.cliente_id}-${p.numero_parcela}`;
          const existing = mapaDedup.get(key);
          const totalAtual = parseFloat(p.valor_pago_total || 0);
          const totalExistente = existing ? parseFloat(existing.valor_pago_total || 0) : -1;
          if (!existing || totalAtual > totalExistente) {
            mapaDedup.set(key, p);
          }
        }
        const deduped = Array.from(mapaDedup.values())
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setPagamentos(deduped);
      }

      // Busca empréstimos do dia — separando vendas de renegociações
      const { data: empsData } = await supabase
        .from('emprestimos')
        .select(`
          id, valor_principal, valor_total, valor_parcela, numero_parcelas,
          taxa_juros, frequencia_pagamento, data_primeiro_vencimento,
          tipo_emprestimo, created_at,
          cliente:cliente_id(nome, codigo_cliente)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .gte('created_at', liqData?.data_abertura || new Date().toISOString())
        .neq('status', 'CANCELADO')
        .order('created_at', { ascending: true });

      const emps = empsData || [];
      setVendasDia(emps.filter((e: any) => e.tipo_emprestimo !== 'RENEGOCIACAO'));
      setRenegociacoesDia(emps.filter((e: any) => e.tipo_emprestimo === 'RENEGOCIACAO'));
    } catch (e) {
      console.error('Erro extrato:', e);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ Total de empréstimos/renovações (SAÍDA de caixa - exclui renegociações pois não sai dinheiro)
  const totalVendasEmprestimos = vendasDia.reduce((s, e) => s + parseFloat(e.valor_principal || 0), 0);
  
  const totalSaidasDespesas = registros.filter(r => r.tipo === 'PAGAR' && r.categoria !== 'ESTORNO_PAGAMENTO' && r.categoria !== 'EMPRESTIMO' && !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria)).reduce((s, r) => s + parseFloat(r.valor), 0);
  // ⭐ Total de saídas = despesas + empréstimos/renovações (não inclui renegociações)
  const totalSaidas = totalSaidasDespesas + totalVendasEmprestimos;
  const totalEntradas = registros.filter(r => r.tipo === 'RECEBER').reduce((s, r) => s + parseFloat(r.valor), 0);
  
  // ⭐ CORREÇÃO: Filtrar pagamentos que entraram dinheiro no caixa
  // Exclui pagamentos feitos APENAS com crédito (forma_pagamento = 'CREDITO')
  // Pagamentos com dinheiro/transferência contam o valor_pago_atual (não valor_pago_total que inclui crédito usado)
  const pagamentosDinheiro = pagamentos.filter(p => p.forma_pagamento !== 'CREDITO');
  const totalPagamentos = pagamentosDinheiro.reduce((s, p) => {
    // valor_pago_atual = dinheiro + crédito usado neste pagamento
    // valor_pago_total = valor aplicado na parcela (pode ser diferente se gerou excedente)
    // Para caixa, queremos o dinheiro que entrou = valor_pago_atual - valor_credito_usado
    const valorPagoAtual = parseFloat(p.valor_pago_atual || p.valor_pago_total || 0);
    const creditoUsado = parseFloat(p.valor_credito_usado || 0);
    return s + (valorPagoAtual - creditoUsado);
  }, 0);
  
  const registrosEntradas = registros.filter(r => r.tipo === 'RECEBER' && r.status !== 'CANCELADO');
  const registrosSaidas = registros.filter(r => r.tipo === 'PAGAR' && r.status !== 'CANCELADO' && r.categoria !== 'ESTORNO_PAGAMENTO' && r.categoria !== 'EMPRESTIMO' && !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria));

  // Separar entradas em 3 grupos
  const entradasCobrancas = registrosEntradas.filter(r => ['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS'].includes(r.categoria));
  const entradasMicroseguro = registrosEntradas.filter(r => ['VENDA_MICROSEGURO', 'MICROSEGURO'].includes(r.categoria));
  const entradasOutras = registrosEntradas.filter(r => !['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS', 'VENDA_MICROSEGURO', 'MICROSEGURO'].includes(r.categoria));
  // ⭐ CORREÇÃO: Usar totalPagamentos (de pagamentos_parcelas) pois inclui auto-quitações
  // O financeiro não registra parcelas quitadas automaticamente
  const totalCobrancas = totalPagamentos;
  const totalMicroseguros = entradasMicroseguro.reduce((s, r) => s + parseFloat(r.valor), 0);
  const totalOutrasReceitas = entradasOutras.reduce((s, r) => s + parseFloat(r.valor), 0);

  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const DIV = '- - - - - - - - - - - -';
  const DDIV = '= = = = = = = = = = = =';

  const [compartilhando, setCompartilhando] = useState(false);

  const compartilharExtrato = async () => {
    if (compartilhando) return;
    setCompartilhando(true);
    try {

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
  .sep { border: none; border-top: 1px dashed #CCC; margin: 6px 0; }
  .sep2 { border: none; border-top: 2px solid #AAA; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; font-size: 12px; line-height: 1.6; }
  .row .r { text-align: right; white-space: nowrap; }
  .sm { font-size: 11px; }
  .b { font-weight: 700; }
  .lg { font-size: 14px; font-weight: 700; }
  .verde { color: #059669; }
  .verm { color: #DC2626; }
  .cinza { color: #999; }
  .mov { margin-top: 5px; padding-bottom: 4px; border-bottom: 1px dotted #DDD; }
  .mov:last-child { border-bottom: none; }
  .mov-row { display: flex; align-items: baseline; }
  .mov-idx { color: #999; width: 20px; font-size: 11px; flex-shrink: 0; }
  .mov-cat { flex: 1; font-weight: 600; font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 160px; min-width: 0; }
  .mov-val { font-weight: 700; font-size: 12px; flex-shrink: 0; white-space: nowrap; padding-left: 6px; }
  .mov-sub { color: #666; font-size: 10px; padding-left: 20px; margin-top: 1px; }
  .mov-meta { display: flex; justify-content: space-between; color: #999; font-size: 9px; padding-left: 20px; }
  .secao { text-align: center; font-weight: 700; font-size: 12px; margin-top: 14px; }
</style></head>
<body>
<div class="cupom">

  <div class="cb" style="font-size:14px">${rotaNome || 'Rota'}</div>
  ${vendedorNome ? `<div class="sub">${vendedorNome}</div>` : ''}
  <div class="sub">${dataLiquidacao || dataHoje}</div>
  <hr class="sep2">

  <div class="row"><span>${lang === 'es' ? 'Caja inicial' : 'Caixa inicial'}</span><span class="r">${fmt(caixaInicial)}</span></div>
  <div class="row"><span class="verde">(+) ${lang === 'es' ? 'Cobros del día' : 'Cobrança do dia'}</span><span class="r verde">${fmt(totalCobrancas)}</span></div>
  <div class="row"><span class="verde">(+) ${lang === 'es' ? 'Ingresos del día' : 'Receitas do dia'}</span><span class="r verde">${fmt(totalOutrasReceitas)}</span></div>
  <div class="row"><span class="verm">(-) ${lang === 'es' ? 'Gastos del día' : 'Despesas do dia'}</span><span class="r verm">${fmt(totalSaidas)}</span></div>
  <hr class="sep2">
  <div class="row"><span class="lg">(=) ${lang === 'es' ? 'Caja final' : 'Caixa final'}</span><span class="r lg">${fmt(caixaFinal)}</span></div>
  <hr class="sep2">
  ${totalMicroseguros > 0 ? `
  <div class="row"><span style="color:#7C3AED">(+) ${lang === 'es' ? 'Microseguro del día' : 'Microseguro do dia'}</span><span class="r" style="color:#7C3AED">${fmt(totalMicroseguros)}</span></div>
  <hr class="sep2">
  <div class="row"><span class="lg" style="color:#7C3AED">(=) ${lang === 'es' ? 'Caja final microseguro' : 'Caixa final microseguro'}</span><span class="r lg" style="color:#7C3AED">${fmt(totalMicroseguros)}</span></div>
  <hr class="sep2">
  ` : ''}

  <div class="secao">${t.detalheEntradas} (${pagamentosDinheiro.length + entradasOutras.length})</div>
  <hr class="sep">
  ${pagamentosDinheiro.length === 0 && entradasOutras.length === 0 ? `<div class="c cinza">${t.nenhumaEntrada}</div>` : `
    ${pagamentosDinheiro.length > 0 ? `
      <div class="c cinza" style="font-size:10px">── ${t.cobrancasParcelas} (${pagamentosDinheiro.length}) ──</div>
      ${pagamentosDinheiro.map((p, idx) => {
        const nomeCliente = (p.clientes as any)?.nome || (p.cliente as any)?.nome || `Parcela ${p.numero_parcela}`;
        const excedente = parseFloat(p.valor_credito_gerado || 0);
        // ⭐ Mostrar o valor que entrou no caixa (dinheiro), não o valor_pago_total
        const valorPagoAtual = parseFloat(p.valor_pago_atual || p.valor_pago_total || 0);
        const creditoUsado = parseFloat(p.valor_credito_usado || 0);
        const dinheiroRecebido = valorPagoAtual - creditoUsado;
        return `<div class="mov">
          <div class="mov-row"><span class="mov-idx">${String(idx + 1).padStart(2, '0')}</span><span class="mov-cat">${nomeCliente}</span><span class="mov-val verde">+${fmt(dinheiroRecebido)}</span></div>
          ${excedente > 0 ? `<div class="mov-sub" style="color:#6B7280">${lang === 'es' ? 'Cuota' : 'Parcela'}: ${fmt(parseFloat(p.valor_parcela || 0))} · ${lang === 'es' ? 'Excedente' : 'Excedente'}: ${fmt(excedente)}</div>` : ''}
          <div class="mov-meta"><span>${fmtHora(p.created_at)}</span>${p.forma_pagamento ? `<span>${p.forma_pagamento}</span>` : ''}</div>
        </div>`;
      }).join('')}
      <div class="row"><span class="verde" style="font-size:10px">${t.totalCobrancas}</span><span class="r verde" style="font-size:10px">${fmt(totalCobrancas)}</span></div>
    ` : ''}
    ${entradasOutras.length > 0 ? `
      <div class="c cinza" style="font-size:10px">── ${t.outrasReceitas} (${entradasOutras.length}) ──</div>
      ${entradasOutras.map((item, idx) => {
        const sub = item.cliente_nome || item.descricao || '';
        return `<div class="mov">
          <div class="mov-row"><span class="mov-idx">${String(idx + 1).padStart(2, '0')}</span><span class="mov-cat">${formatarCategoria(item.categoria)}</span><span class="mov-val verde">+${fmt(parseFloat(item.valor))}</span></div>
          ${sub ? `<div class="mov-sub">${sub}</div>` : ''}
          <div class="mov-meta"><span>${fmtHora(item.created_at)}</span>${item.forma_pagamento ? `<span>${item.forma_pagamento}</span>` : ''}</div>
        </div>`;
      }).join('')}
      <div class="row"><span class="verde" style="font-size:10px">${t.totalOutrasReceitas}</span><span class="r verde" style="font-size:10px">${fmt(totalOutrasReceitas)}</span></div>
    ` : ''}
  `}
  <hr class="sep">
  ${entradasOutras.length > 0 ? `<div class="row"><span class="verde b">TOTAL ENTRADAS</span><span class="r verde b">${fmt(totalCobrancas + totalOutrasReceitas)}</span></div>` : ''}

  <div class="secao">${t.detalheSaidas} (${registrosSaidas.length})</div>
  <hr class="sep">
  ${registrosSaidas.length === 0 ? `<div class="c cinza">${t.nenhunaSaida}</div>` :
    registrosSaidas.map((item, idx) => {
      const principal = item.cliente_nome || formatarCategoria(item.categoria);
      const sub = item.cliente_nome && item.descricao ? item.descricao : '';
      return `<div class="mov">
        <div class="mov-row"><span class="mov-idx">${String(idx + 1).padStart(2, '0')}</span><span class="mov-cat">${principal}</span><span class="mov-val verm">-${fmt(parseFloat(item.valor))}</span></div>
        ${sub ? `<div class="mov-sub">${sub}</div>` : ''}
        <div class="mov-meta"><span>${fmtHora(item.created_at)}</span>${item.forma_pagamento ? `<span>${item.forma_pagamento}</span>` : ''}</div>
      </div>`;
    }).join('')}
  <hr class="sep">
  <div class="row"><span class="verm b">${t.totalSaidas}</span><span class="r verm b">${fmt(totalSaidas)}</span></div>

  ${entradasMicroseguro.length > 0 ? `
  <hr class="sep2">
  <div class="secao" style="color:#7C3AED">MICROSEGUROS</div>
  <hr class="sep">
  ${entradasMicroseguro.map((item, idx) => `
    <div class="mov">
      <div class="mov-row"><span class="mov-idx">${String(idx + 1).padStart(2, '0')}</span><span class="mov-cat">${item.cliente_nome || item.descricao || '—'}</span><span class="mov-val" style="color:#7C3AED">+${fmt(parseFloat(item.valor))}</span></div>
      <div class="mov-meta"><span>${fmtHora(item.created_at)}</span></div>
    </div>`).join('')}
  <hr class="sep">
  <div class="row"><span class="b" style="color:#7C3AED">(=) ${lang === 'es' ? 'Caja final microseguro' : 'Caixa final microseguro'}</span><span class="r b" style="color:#7C3AED">${fmt(totalMicroseguros)}</span></div>
  ` : ''}

  ${vendasDia.length > 0 ? `
  <hr class="sep2">
  <div class="secao" style="color:#EF4444">${lang === 'es' ? 'PRÉSTAMOS DEL DÍA' : 'EMPRÉSTIMOS DO DIA'}</div>
  <hr class="sep">
  ${vendasDia.map((emp, idx) => {
    const clienteNome = emp.cliente?.nome || '—';
    const clienteCodigo = emp.cliente?.codigo_cliente || '';
    const primeiroPgto = emp.data_primeiro_vencimento
      ? new Date(emp.data_primeiro_vencimento + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-CO' : 'pt-BR')
      : '—';
    const isRenovacao = emp.tipo_emprestimo === 'RENOVACAO';
    const isAdicional = emp.tipo_emprestimo === 'ADICIONAL';
    const tipoLabel = isRenovacao ? (lang === 'es' ? '🔄 RENOVACIÓN' : '🔄 RENOVAÇÃO') 
      : isAdicional ? (lang === 'es' ? '➕ ADICIONAL' : '➕ ADICIONAL')
      : (lang === 'es' ? '🆕 NUEVO' : '🆕 NOVO');
    const tipoCor = isRenovacao ? '#F59E0B' : isAdicional ? '#8B5CF6' : '#10B981';
    return `<div class="mov">
      <div style="margin-bottom:2px"><span style="font-size:9px;font-weight:700;color:${tipoCor};background:${tipoCor}20;padding:1px 6px;border-radius:4px">${tipoLabel}</span></div>
      <div class="mov-row"><span class="mov-idx">${String(idx + 1).padStart(2, '0')}</span><span class="mov-cat">${clienteCodigo ? '#' + clienteCodigo + ' ' : ''}${clienteNome}</span><span class="mov-val verm">-${fmt(parseFloat(emp.valor_principal))}</span></div>
      <div class="mov-sub">${lang === 'es' ? '1° pago' : '1° pgto'}: ${primeiroPgto} · ${emp.numero_parcelas}x ${fmt(parseFloat(emp.valor_parcela))} · ${emp.taxa_juros}%</div>
      <div class="mov-meta"><span>${fmtHora(emp.created_at)}</span></div>
    </div>`;
  }).join('')}
  <hr class="sep">
  <div class="row"><span class="verm b">${lang === 'es' ? 'TOTAL PRÉSTAMOS' : 'TOTAL EMPRÉSTIMOS'}</span><span class="r verm b">-${fmt(vendasDia.reduce((s, e) => s + parseFloat(e.valor_principal || 0), 0))}</span></div>
  ` : ''}

  ${renegociacoesDia.length > 0 ? `
  <hr class="sep2">
  <div class="secao" style="color:#F59E0B">${lang === 'es' ? 'RENEGOCIACIONES' : 'RENEGOCIAÇÕES'}</div>
  <hr class="sep">
  ${renegociacoesDia.map((emp, idx) => {
    const clienteNome = emp.cliente?.nome || '—';
    const primeiroPgto = emp.data_primeiro_vencimento
      ? new Date(emp.data_primeiro_vencimento + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-CO' : 'pt-BR')
      : '—';
    return `<div class="mov">
      <div class="mov-row"><span class="mov-idx">${String(idx + 1).padStart(2, '0')}</span><span class="mov-cat">${clienteNome}</span><span class="mov-val" style="color:#F59E0B">${fmt(parseFloat(emp.valor_principal))}</span></div>
      <div class="mov-sub">${lang === 'es' ? '1° pago' : '1° pgto'}: ${primeiroPgto} · ${emp.numero_parcelas}x ${fmt(parseFloat(emp.valor_parcela))} · ${emp.taxa_juros}%</div>
      <div class="mov-meta"><span>${fmtHora(emp.created_at)}</span></div>
    </div>`;
  }).join('')}
  <hr class="sep">
  <div class="row"><span class="b" style="color:#F59E0B">${lang === 'es' ? 'TOTAL RENEGOCIACIONES' : 'TOTAL RENEGOCIAÇÕES'}</span><span class="r b" style="color:#F59E0B">${fmt(renegociacoesDia.reduce((s, e) => s + parseFloat(e.valor_principal || 0), 0))}</span></div>
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
        txt += `${t.saidas}: ${fmt(totalSaidas)}\n`;
        txt += `${t.caixaFinal}: ${fmt(caixaFinal)}`;
        await Share.share({ message: txt });
      } catch {}
    } finally {
      setCompartilhando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={cupom.container}>
        {/* Header */}
        <View style={cupom.header}>
          <Text style={cupom.headerTxt}>{t.extratoDia}</Text>
          <TouchableOpacity onPress={onClose} style={cupom.closeBtn}>
            <Text style={cupom.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={cupom.scroll} showsVerticalScrollIndicator={false}>
          <View ref={extratoViewRef} collapsable={false} style={cupom.papel}>
            {/* ═══ CABEÇALHO ═══ */}
            <Text style={cupom.centro}>{rotaNome || 'Rota'}</Text>
            {vendedorNome ? <Text style={cupom.centroSub}>{vendedorNome}</Text> : null}
            <Text style={cupom.centroSub}>{dataLiquidacao || dataHoje}</Text>
            <Text style={cupom.div2}>{DDIV}</Text>

            {/* ═══ RESUMO CAIXA ═══ */}
            <View style={cupom.linha}>
              <Text style={cupom.txt}>{lang === 'es' ? 'Caja inicial' : 'Caixa inicial'}</Text>
              <Text style={cupom.txt}>{fmt(caixaInicial)}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={cupom.txtVerde}>(+) {lang === 'es' ? 'Cobros del día' : 'Cobrança do dia'}</Text>
              <Text style={cupom.txtVerde}>{fmt(totalCobrancas)}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={cupom.txtVerde}>(+) {lang === 'es' ? 'Ingresos del día' : 'Receitas do dia'}</Text>
              <Text style={cupom.txtVerde}>{fmt(totalOutrasReceitas)}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={cupom.txtVerm}>(-) {lang === 'es' ? 'Gastos del día' : 'Despesas do dia'}</Text>
              <Text style={cupom.txtVerm}>{fmt(totalSaidas)}</Text>
            </View>
            <Text style={cupom.div2}>{DDIV}</Text>
            <View style={cupom.linha}>
              <Text style={cupom.txtBold}>(=) {lang === 'es' ? 'Caja final' : 'Caixa final'}</Text>
              <Text style={cupom.txtBold}>{fmt(caixaFinal)}</Text>
            </View>
            <Text style={cupom.div2}>{DDIV}</Text>

            {/* ═══ MICROSEGUROS ═══ */}
            {entradasMicroseguro.length > 0 && (
              <>
                <Text style={[cupom.centro, { fontSize: 11, fontWeight: '700', marginBottom: 4, color: '#7C3AED' }]}>
                  {lang === 'es' ? 'MICROSEGUROS' : 'MICROSEGUROS'}
                </Text>
                <Text style={cupom.div1}>{DIV}</Text>
                {entradasMicroseguro.map((item, idx) => (
                  <View key={item.id}>
                    <View style={cupom.itemRow}>
                      <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                      <Text style={cupom.itemCat} numberOfLines={1}>{item.cliente_nome || item.descricao || '—'}</Text>
                      <Text style={[cupom.itemVal, { color: '#7C3AED' }]}>+{fmt(parseFloat(item.valor))}</Text>
                    </View>
                    <View style={cupom.itemMeta}>
                      <Text style={cupom.itemHora}>   {fmtHora(item.created_at)}</Text>
                    </View>
                    {idx < entradasMicroseguro.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                  </View>
                ))}
                <Text style={cupom.div2}>{DDIV}</Text>
                <View style={cupom.linha}>
                  <Text style={[cupom.txtBold, { color: '#7C3AED' }]}>(=) {lang === 'es' ? 'Caja final microseguro' : 'Caixa final microseguro'}</Text>
                  <Text style={[cupom.txtBold, { color: '#7C3AED' }]}>{fmt(totalMicroseguros)}</Text>
                </View>
                <Text style={cupom.div2}>{DDIV}</Text>
              </>
            )}

            {/* ═══ VENDAS/EMPRÉSTIMOS DO DIA (SAÍDAS DE CAIXA) ═══ */}
            {vendasDia.length > 0 && (
              <>
                <Text style={[cupom.centro, { fontSize: 11, fontWeight: '700', marginBottom: 4, color: '#EF4444' }]}>
                  {lang === 'es' ? 'PRÉSTAMOS DEL DÍA' : 'EMPRÉSTIMOS DO DIA'}
                </Text>
                <Text style={cupom.div1}>{DIV}</Text>
                {vendasDia.map((emp, idx) => {
                  const clienteNome = (emp.cliente as any)?.nome || '—';
                  const clienteCodigo = (emp.cliente as any)?.codigo_cliente || '';
                  const primeiroPgto = emp.data_primeiro_vencimento
                    ? new Date(emp.data_primeiro_vencimento + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-CO' : 'pt-BR')
                    : '—';
                  // ⭐ Identificar tipo: NOVO, RENOVACAO, ADICIONAL
                  const isRenovacao = emp.tipo_emprestimo === 'RENOVACAO';
                  const isAdicional = emp.tipo_emprestimo === 'ADICIONAL';
                  const tipoLabel = isRenovacao ? (lang === 'es' ? '🔄 RENOVACIÓN' : '🔄 RENOVAÇÃO') 
                    : isAdicional ? (lang === 'es' ? '➕ ADICIONAL' : '➕ ADICIONAL')
                    : (lang === 'es' ? '🆕 NUEVO' : '🆕 NOVO');
                  const tipoCor = isRenovacao ? '#F59E0B' : isAdicional ? '#8B5CF6' : '#10B981';
                  return (
                    <View key={emp.id}>
                      {/* ⭐ Badge do tipo em destaque */}
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: tipoCor, backgroundColor: tipoCor + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                          {tipoLabel}
                        </Text>
                      </View>
                      <View style={cupom.itemRow}>
                        <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                        <Text style={cupom.itemCat} numberOfLines={1}>{clienteCodigo ? `#${clienteCodigo} ` : ''}{clienteNome}</Text>
                        {/* ⭐ Sinal NEGATIVO e cor VERMELHA (é saída de caixa) */}
                        <Text style={[cupom.itemVal, { color: '#EF4444' }]}>-{fmt(parseFloat(emp.valor_principal))}</Text>
                      </View>
                      <Text style={[cupom.itemSub, { fontSize: 9 }]}>
                        {'   '}{lang === 'es' ? '1° pago' : '1° pgto'}: {primeiroPgto}
                        {'  '}{emp.numero_parcelas}x {fmt(parseFloat(emp.valor_parcela))}
                        {'  '}{emp.taxa_juros}%
                      </Text>
                      <View style={cupom.itemMeta}>
                        <Text style={cupom.itemHora}>   {fmtHora(emp.created_at)}</Text>
                      </View>
                      {idx < vendasDia.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                    </View>
                  );
                })}
                <View style={cupom.linha}>
                  {/* ⭐ Total em VERMELHO (é saída) */}
                  <Text style={[cupom.txtVerm, { fontSize: 10 }]}>{lang === 'es' ? 'TOTAL PRÉSTAMOS' : 'TOTAL EMPRÉSTIMOS'}</Text>
                  <Text style={[cupom.txtVerm, { fontSize: 10 }]}>-{fmt(vendasDia.reduce((s, e) => s + parseFloat(e.valor_principal), 0))}</Text>
                </View>
                <Text style={cupom.div1}>{DIV}</Text>
              </>
            )}

            {/* ═══ RENEGOCIAÇÕES DO DIA ═══ */}
            {renegociacoesDia.length > 0 && (
              <>
                <Text style={[cupom.centro, { fontSize: 11, fontWeight: '700', marginBottom: 4, color: '#F59E0B' }]}>
                  {lang === 'es' ? 'RENEGOCIACIONES' : 'RENEGOCIAÇÕES'}
                </Text>
                <Text style={cupom.div1}>{DIV}</Text>
                {renegociacoesDia.map((emp, idx) => {
                  const clienteNome = (emp.cliente as any)?.nome || '—';
                  const primeiroPgto = emp.data_primeiro_vencimento
                    ? new Date(emp.data_primeiro_vencimento + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-CO' : 'pt-BR')
                    : '—';
                  return (
                    <View key={emp.id}>
                      <View style={cupom.itemRow}>
                        <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                        <Text style={cupom.itemCat} numberOfLines={1}>{clienteNome}</Text>
                        <Text style={[cupom.itemVal, { color: '#F59E0B' }]}>{fmt(parseFloat(emp.valor_principal))}</Text>
                      </View>
                      <Text style={[cupom.itemSub, { fontSize: 9 }]}>
                        {'   '}{lang === 'es' ? '1° pago' : '1° pgto'}: {primeiroPgto}
                        {'  '}{emp.numero_parcelas}x {fmt(parseFloat(emp.valor_parcela))}
                        {'  '}{emp.taxa_juros}%
                      </Text>
                      <View style={cupom.itemMeta}>
                        <Text style={cupom.itemHora}>   {fmtHora(emp.created_at)}</Text>
                      </View>
                      {idx < renegociacoesDia.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                    </View>
                  );
                })}
                <View style={cupom.linha}>
                  <Text style={[cupom.txt, { fontSize: 10, color: '#F59E0B' }]}>{lang === 'es' ? 'TOTAL RENEGOCIACIONES' : 'TOTAL RENEGOCIAÇÕES'}</Text>
                  <Text style={[cupom.txt, { fontSize: 10, color: '#F59E0B' }]}>{fmt(renegociacoesDia.reduce((s, e) => s + parseFloat(e.valor_principal), 0))}</Text>
                </View>
                <Text style={cupom.div1}>{DIV}</Text>
              </>
            )}

            {/* ═══ RESUMO OPERACIONAL ═══ */}
            <Text style={[cupom.centro, { fontSize: 10, marginBottom: 6, color: '#6B7280' }]}>
              {lang === 'es' ? 'RESUMEN OPERACIONAL' : 'RESUMO OPERACIONAL'}
            </Text>
            <View style={cupom.linha}>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{lang === 'es' ? 'Clientes pagados' : 'Clientes pagos'}</Text>
              <Text style={[cupom.txtVerde, { fontSize: 10 }]}>{resumoOp.pagos}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{lang === 'es' ? 'Clientes no pagados' : 'Clientes não pagos'}</Text>
              <Text style={[cupom.txtVerm, { fontSize: 10 }]}>{resumoOp.naoPagos}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{lang === 'es' ? 'Clientes nuevos' : 'Clientes novos'}</Text>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{resumoOp.novos}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{lang === 'es' ? 'Renovaciones' : 'Renovações'}</Text>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{resumoOp.renovados}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{lang === 'es' ? 'Renegociaciones' : 'Renegociações'}</Text>
              <Text style={[cupom.txt, { fontSize: 10 }]}>{resumoOp.renegociados}</Text>
            </View>
            <Text style={cupom.div2}>{DDIV}</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#333" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* ═══ DETALHES ENTRADAS ═══ */}
                <Text style={[cupom.centro, { marginTop: 14 }]}>{t.detalheEntradas} ({pagamentosDinheiro.length + entradasOutras.length})</Text>
                <Text style={cupom.div1}>{DIV}</Text>

                {pagamentosDinheiro.length === 0 && entradasOutras.length === 0 ? (
                  <Text style={cupom.centro}>{t.nenhumaEntrada}</Text>
                ) : (
                  <>
                    {/* ── COBRANÇAS DE PARCELAS — usa pagamentos_parcelas diretamente ── */}
                    {pagamentosDinheiro.length > 0 && (
                      <>
                        <Text style={[cupom.centro, { fontSize: 10, marginTop: 6, color: '#6B7280' }]}>── {t.cobrancasParcelas} ({pagamentosDinheiro.length}) ──</Text>
                        {pagamentosDinheiro.map((p, idx) => {
                          const nomeCliente = (p.clientes as any)?.nome || (p.cliente as any)?.nome || `Parcela ${p.numero_parcela}`;
                          const excedente = parseFloat(p.valor_credito_gerado || 0);
                          // ⭐ Mostrar o valor que entrou no caixa (dinheiro), não o valor_pago_total
                          const valorPagoAtual = parseFloat(p.valor_pago_atual || p.valor_pago_total || 0);
                          const creditoUsado = parseFloat(p.valor_credito_usado || 0);
                          const dinheiroRecebido = valorPagoAtual - creditoUsado;
                          const temExcedente = excedente > 0;
                          return (
                            <View key={p.id}>
                              <View style={cupom.itemRow}>
                                <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                                <Text style={cupom.itemCat} numberOfLines={1}>{nomeCliente}</Text>
                                <Text style={[cupom.itemVal, { color: '#059669' }]}>+{fmt(dinheiroRecebido)}</Text>
                              </View>
                              {temExcedente && (
                                <Text style={[cupom.itemSub, { color: '#6B7280', fontSize: 9 }]}>
                                  {'   '}
                                  {lang === 'es' ? 'Cuota' : 'Parcela'}: {fmt(parseFloat(p.valor_parcela || 0))} · {lang === 'es' ? 'Excedente' : 'Excedente'}: {fmt(excedente)}
                                </Text>
                              )}
                              <View style={cupom.itemMeta}>
                                <Text style={cupom.itemHora}>   {fmtHora(p.created_at)}</Text>
                                {p.forma_pagamento && <Text style={cupom.itemHora}>{p.forma_pagamento}</Text>}
                              </View>
                              {idx < pagamentosDinheiro.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                            </View>
                          );
                        })}
                        <View style={cupom.linha}>
                          <Text style={[cupom.txtVerde, { fontSize: 10 }]}>{t.totalCobrancas}</Text>
                          <Text style={[cupom.txtVerde, { fontSize: 10 }]}>{fmt(totalCobrancas)}</Text>
                        </View>
                      </>
                    )}

                    {/* ── OUTRAS RECEITAS ── */}
                    {entradasOutras.length > 0 && (
                      <>
                        <Text style={[cupom.centro, { fontSize: 10, marginTop: 6, color: '#6B7280' }]}>── {t.outrasReceitas} ({entradasOutras.length}) ──</Text>
                        {entradasOutras.map((item, idx) => (
                          <View key={item.id}>
                            <View style={cupom.itemRow}>
                              <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                              <Text style={cupom.itemCat} numberOfLines={1}>{formatarCategoria(item.categoria)}</Text>
                              <Text style={[cupom.itemVal, { color: '#059669' }]}>+{fmt(parseFloat(item.valor))}</Text>
                            </View>
                            {(item.cliente_nome || item.descricao) && (
                              <Text style={cupom.itemSub} numberOfLines={1}>   {item.cliente_nome || item.descricao}</Text>
                            )}
                            <View style={cupom.itemMeta}>
                              <Text style={cupom.itemHora}>   {fmtHora(item.created_at)}</Text>
                              {item.forma_pagamento && <Text style={cupom.itemHora}>{item.forma_pagamento}</Text>}
                            </View>
                            {idx < entradasOutras.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                          </View>
                        ))}
                        <View style={cupom.linha}>
                          <Text style={[cupom.txtVerde, { fontSize: 10 }]}>{t.totalOutrasReceitas}</Text>
                          <Text style={[cupom.txtVerde, { fontSize: 10 }]}>{fmt(totalOutrasReceitas)}</Text>
                        </View>
                      </>
                    )}
                  </>
                )}

                {entradasOutras.length > 0 && (
                  <>
                    <Text style={cupom.div1}>{DIV}</Text>
                    <View style={cupom.linha}>
                      <Text style={cupom.txtVerde}>TOTAL ENTRADAS</Text>
                      <Text style={cupom.txtVerde}>{fmt(totalCobrancas + totalOutrasReceitas)}</Text>
                    </View>
                  </>
                )}

                {/* ═══ DETALHES SAÍDAS ═══ */}
                <Text style={[cupom.centro, { marginTop: 14 }]}>{t.detalheSaidas} ({registrosSaidas.length})</Text>
                <Text style={cupom.div1}>{DIV}</Text>

                {registrosSaidas.length === 0 ? (
                  <Text style={cupom.centro}>{t.nenhunaSaida}</Text>
                ) : (
                  registrosSaidas.map((item, idx) => (
                    <View key={item.id}>
                      <View style={cupom.itemRow}>
                        <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                        <Text style={cupom.itemCat} numberOfLines={1} ellipsizeMode="tail">
                          {item.cliente_nome || formatarCategoria(item.categoria)}
                        </Text>
                        <Text style={[cupom.itemVal, { color: '#DC2626' }]}>-{fmt(parseFloat(item.valor))}</Text>
                      </View>
                      {item.cliente_nome && item.descricao && (
                        <Text style={cupom.itemSub} numberOfLines={1}>   {item.descricao}</Text>
                      )}
                      <View style={cupom.itemMeta}>
                        <Text style={cupom.itemHora}>   {fmtHora(item.created_at)}</Text>
                        {item.forma_pagamento && <Text style={cupom.itemHora}>{item.forma_pagamento}</Text>}
                      </View>
                      {idx < registrosSaidas.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                    </View>
                  ))
                )}

                <Text style={cupom.div1}>{DIV}</Text>
                <View style={cupom.linha}>
                  <Text style={cupom.txtVerm}>{t.totalSaidas}</Text>
                  <Text style={cupom.txtVerm}>{fmt(totalSaidas)}</Text>
                </View>

                {/* ═══ SALDO FINAL ═══ */}
                <Text style={cupom.div2}>{DDIV}</Text>
                <View style={cupom.linha}>
                  <Text style={cupom.txtBold}>{t.saldoFinal}</Text>
                  <Text style={cupom.txtBold}>{fmt(caixaFinal)}</Text>
                </View>
                <Text style={cupom.div2}>{DDIV}</Text>
                <Text style={[cupom.centro, { marginTop: 8, fontSize: 10 }]}>{t.fimExtrato}</Text>
              </>
            )}
            <View style={{ height: 24 }} />
          </View>
        </ScrollView>

        {/* Botão Compartilhar */}
        <View style={cupom.shareBar}>
          <TouchableOpacity style={cupom.shareBtn} onPress={compartilharExtrato} disabled={compartilhando}>
            {compartilhando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={cupom.shareTxt}>📤 {t.compartilhar}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

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
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  txt: { fontSize: 11, color: '#1F2937', fontFamily: MONO },
  txtBold: { fontSize: 12, color: '#1F2937', fontFamily: MONO, fontWeight: '700' },
  txtVerde: { fontSize: 11, color: '#059669', fontFamily: MONO },
  txtVerm: { fontSize: 11, color: '#DC2626', fontFamily: MONO },
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
  clienteId: string;
  clienteNome: string;
  clienteCod: string;
  totalPago: number;
  parcelas: any[];
  quitado: boolean; // ⭐ Indica se empréstimo foi quitado
}

export function ModalPagamentos({ visible, onClose, liquidacaoId, totalPagos, totalNaoPagos, lang = 'pt-BR' }: PagamentosProps) {
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
          status_parcela_atual, created_at, cliente_id,
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

  // Agrupar por cliente — deduplicar parcelas pelo maior valor_pago_total
  // Usar apenas pagamentosDinheiro
  const clientesAgrupados: ClienteGrupo[] = React.useMemo(() => {
    const map = new Map<string, ClienteGrupo>();
    pagamentosDinheiro.forEach(r => {
      const cId = r.cliente_id || 'unknown';
      if (!map.has(cId)) {
        map.set(cId, {
          clienteId: cId,
          clienteNome: r.cliente?.nome || t.cliente,
          clienteCod: r.cliente?.consecutivo || '',
          totalPago: 0,
          parcelas: [],
          quitado: false,
        });
      }
      const grupo = map.get(cId)!;
      // Deduplicar por numero_parcela — manter o de maior valor_pago_total
      const existIdx = grupo.parcelas.findIndex((p: any) => p.numero_parcela === r.numero_parcela);
      if (existIdx === -1) {
        grupo.parcelas.push(r);
      } else if (parseFloat(r.valor_pago_total || 0) > parseFloat(grupo.parcelas[existIdx].valor_pago_total || 0)) {
        grupo.parcelas[existIdx] = r;
      }
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
    const isExpanded = expandido === grupo.clienteId;

    return (
      <TouchableOpacity
        style={dStyles.pagItem}
        onPress={() => setExpandido(isExpanded ? null : grupo.clienteId)}
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
                {(p.valor_credito_usado > 0 || (p.valor_credito_gerado > 0 && !grupo.quitado)) && (
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
            keyExtractor={(item) => item.clienteId}
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
}

const getConfigFinanceiro = (lang: Lang): Record<TipoFinanceiro, { titulo: string; icone: string; cor: string; filtro: any }> => ({
  VENDAS: { titulo: i18n[lang].vendasTitulo, icone: '💼', cor: '#10B981', filtro: { tipo: 'PAGAR', categoria: 'EMPRESTIMO' } },
  RECEITAS: { titulo: i18n[lang].receitasTitulo, icone: '📥', cor: '#3B82F6', filtro: { tipo: 'RECEBER' } },
  DESPESAS: { titulo: i18n[lang].despesasTitulo, icone: '📤', cor: '#EF4444', filtro: { tipo: 'PAGAR' } },
});

export function ModalFinanceiro({ visible, onClose, liquidacaoId, tipo, totalValor, totalQtd, lang = 'pt-BR', isLiquidacaoAberta = false, onRefresh }: FinanceiroProps) {
  const t = i18n[lang];
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);

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
        .select('id, tipo, categoria, descricao, valor, created_at, forma_pagamento, cliente_nome, vendedor_nome, status')
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
          window.alert(e.message || t.exclusaoErro);
        } else {
          Alert.alert('Erro', e.message || t.exclusaoErro);
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
        ? new Date(item.data_primeiro_vencimento + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-CO' : 'pt-BR')
        : '—';
      return (
        <View style={dStyles.finItem}>
          <View style={dStyles.finItemTop}>
            <View style={[dStyles.finItemDot, { backgroundColor: config.cor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[dStyles.finItemCategoria, { fontWeight: '700', fontSize: 14 }]}>{clienteNome}</Text>
              <Text style={[dStyles.finItemCliente, { color: '#6B7280', marginTop: 2 }]}>
                {lang === 'es' ? '1° pago' : '1° pgto'}: {primeiroPgto}
                {'  ·  '}{item.numero_parcelas}x {fmt(parseFloat(item.valor_parcela || 0))}
                {'  ·  '}{item.taxa_juros}%
                {'  ·  '}{fmtFrequencia(item.frequencia_pagamento)}
              </Text>
            </View>
            <Text style={[dStyles.finItemValor, { color: config.cor }]}>{fmt(parseFloat(item.valor_principal || 0))}</Text>
          </View>
          <View style={dStyles.finItemBottom}>
            <Text style={dStyles.finItemHora}>{fmtHora(item.created_at)}</Text>
            <Text style={dStyles.finItemForma}>{item.tipo_emprestimo || 'NOVO'}</Text>
          </View>
        </View>
      );
    }

    // Se item está anulado, mostrar com estilo diferente
    const isAnulado = item.status === 'ANULADO';
    const isExcluindoEste = excluindo === item.id;
    const podeExcluir = isLiquidacaoAberta && !isAnulado && tipo !== 'VENDAS';

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
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={dStyles.finItemHora}>{fmtHora(item.created_at)}</Text>
          {item.forma_pagamento && <Text style={dStyles.finItemForma}>{item.forma_pagamento}</Text>}
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