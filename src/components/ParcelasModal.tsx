import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParcelaModal {
  parcela_id: string;
  numero_parcela: number;
  data_vencimento: string;
  valor_parcela: number;
  status: string;
  data_pagamento: string | null;
  valor_multa: number;
  valor_pago?: number;
  valor_saldo?: number;
  credito_usado?: number;
  credito_gerado?: number;
  saldo_excedente?: number;
  liquidacao_id?: string | null;
  data_liquidacao?: string | null;
  observacoes?: string | null;
}

// Registro individual de pagamento (para o popup de detalhes)
export interface PagamentoDetalhe {
  id?: string;
  valor_pago_total: number;
  valor_credito_usado?: number;
  valor_credito_gerado?: number;
  forma_pagamento?: string;
  created_at: string;
  estornado?: boolean;
  data_liquidacao?: string | null;   // vem de liquidacoes_diarias.data_liquidacao
  data_abertura?: string | null;     // vem de liquidacoes_diarias.data_abertura
  importado?: boolean;               // true = registro da importação SmartPay
}

interface ClienteModalInfo {
  id: string;
  nome: string;
  emprestimo_id: string;
  emprestimo_status?: string;
  saldo_emprestimo?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d: string | null | undefined) => {
  if (!d) return '';
  if (d.length === 10 && d.includes('-')) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('pt-BR');
};

const fmtTs = (ts: string) => {
  try {
    const s = ts.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z');
    const dt = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const calcularDiasAtraso = (
  dataVencimento: string | null | undefined,
  dataPagamento: string | null | undefined
): number => {
  if (!dataVencimento || !dataPagamento) return 0;
  const vencStr = dataVencimento.substring(0, 10);
  const pagStr = dataPagamento.substring(0, 10);
  const [vY, vM, vD] = vencStr.split('-').map(Number);
  const [pY, pM, pD] = pagStr.split('-').map(Number);
  const vencDate = new Date(vY, vM - 1, vD);
  const pagDate = new Date(pY, pM - 1, pD);
  return Math.round((pagDate.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24));
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface ParcelasModalProps {
  visible: boolean;
  onClose: () => void;
  clienteModal: ClienteModalInfo | null;
  parcelasModal: ParcelaModal[];
  loadingParcelas: boolean;
  creditoDisponivel: number;
  liqId: string | null;
  isViz: boolean;
  isClientePago?: boolean;
  lang?: 'pt-BR' | 'es';
  onPagar: (parcela: ParcelaModal) => void;
  onPagarMultiplo?: (parcelas: ParcelaModal[], totalValor: number, creditoUsado: number) => void;
  onEstornar: (parcela: ParcelaModal) => void;
  // Opcional: mapa parcela_id → lista de pagamentos individuais
  // Quando fornecido, cada parcela vira toque que abre o popup de detalhes
  pagamentosDetalhados?: Map<string, PagamentoDetalhe[]>;
  t: {
    parcela: string;
    pago: string;
    original: string;
    credito: string;
    restante: string;
    creditoDisponivel: string;
    pagar: string;
    estornar: string;
    fechar: string;
    venc: string;
    em: string;
    liq: string;
    pendente: string;
    pagoStatus: string;
    parcialStatus: string;
    vencidaStatus: string;
    nenhumaParcelaEncontrada: string;
    quitacaoAntecipada: string;
    quitadoPorCredito: string;
    pagoComAtraso: string;
    diasAtraso: string;
    diaAtraso: string;
    pagoNoDia: string;
    pagoAdiantado: string;
    dinheiro: string;
    creditoUsado: string;
  };
}

// ─── Popup de Detalhes de Pagamento ─────────────────────────────────────────

interface DetalhesPopupProps {
  visible: boolean;
  onClose: () => void;
  parcela: ParcelaModal | null;
  pagamentos: PagamentoDetalhe[];
  t: ParcelasModalProps['t'];
}

function DetalhesPopup({ visible, onClose, parcela, pagamentos, t }: DetalhesPopupProps) {
  if (!parcela) return null;

  const valorPago = parcela.valor_pago || 0;
  const creditoGerado = parcela.credito_gerado || 0;
  const saldoExcedente = parcela.saldo_excedente || 0;
  const valorSaldo = parcela.valor_saldo ?? (parcela.valor_parcela - valorPago);

  // Calcula dinheiro e crédito usado a partir dos registros individuais (mais preciso)
  // Evita o problema de credito_usado = 0 no dado agregado da parcela
  const pagsNaoEstornados = pagamentos.filter(pp => !pp.estornado);
  const dinheiroReal = pagsNaoEstornados.reduce((s, pp) => s + parseFloat(String(pp.valor_pago_total || 0)), 0);
  const creditoUsado = pagsNaoEstornados.reduce((s, pp) => s + parseFloat(String(pp.valor_credito_usado || 0)), 0);
  // Se não temos registros individuais (importado), cai de volta para o dado da parcela
  const valorDinheiro = pagsNaoEstornados.length > 0 ? dinheiroReal : (valorPago - (parcela.credito_usado || 0));
  const creditoUsadoFinal = pagsNaoEstornados.length > 0 ? creditoUsado : (parcela.credito_usado || 0);
  const isPago = parcela.status === 'PAGO';
  const isParcial = parcela.status === 'PARCIAL';
  const isVencida = parcela.status === 'VENCIDO' || parcela.status === 'VENCIDA';
  const temPagamentoParcial = !isPago && valorPago > 0;
  const isAutoQuitacao = (parcela.observacoes || '').includes('[AUTO-QUITAÇÃO]');

  // Filtra estornados para exibição
  const pagsAtivos = pagamentos.filter(pp => !pp.estornado);
  const pagsEstornados = pagamentos.filter(pp => pp.estornado);

  const corStatus = isPago ? '#10B981' : isParcial ? '#D97706' : isVencida ? '#EF4444' : '#6B7280';
  const bgStatus = isPago ? '#D1FAE5' : isParcial ? '#FEF3C7' : isVencida ? '#FEE2E2' : '#F3F4F6';
  const statusText = isPago ? t.pagoStatus : isParcial ? t.parcialStatus : isVencida ? t.vencidaStatus : t.pendente;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={D.overlay}>
        <View style={D.sheet}>
          {/* Handle */}
          <View style={D.handle} />

          {/* Header */}
          <View style={D.header}>
            <View style={D.headerLeft}>
              <Text style={D.headerTitle}>{t.parcela} {parcela.numero_parcela}</Text>
              <View style={[D.statusBadge, { backgroundColor: bgStatus }]}>
                <Text style={[D.statusText, { color: corStatus }]}>{statusText}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={D.closeBtn}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={D.scroll} showsVerticalScrollIndicator={false}>
            {/* Resumo da parcela */}
            <View style={D.resumoCard}>
              <View style={D.resumoRow}>
                <Text style={D.resumoLabel}>Parcela original</Text>
                <Text style={D.resumoValue}>{fmt(parcela.valor_parcela)}</Text>
              </View>
              <View style={D.resumoRow}>
                <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                <Text style={[D.resumoLabel, { marginLeft: 4 }]}>{t.venc}</Text>
                <Text style={D.resumoValue}>{fmtData(parcela.data_vencimento)}</Text>
              </View>

              {/* Linha separadora quando tem pagamento */}
              {(isPago || temPagamentoParcial || (isVencida && valorPago > 0)) && (
                <>
                  <View style={D.separator} />
                  {valorPago > 0 && creditoUsadoFinal === 0 && (
                    <View style={D.resumoRow}>
                      <Ionicons name="cash-outline" size={12} color="#6B7280" />
                      <Text style={[D.resumoLabel, { marginLeft: 4 }]}>{t.dinheiro}</Text>
                      <Text style={[D.resumoValue, { color: '#10B981', fontWeight: '700' }]}>{fmt(valorDinheiro)}</Text>
                    </View>
                  )}
                  {creditoUsadoFinal > 0 && (
                    <>
                      <View style={D.resumoRow}>
                        <Ionicons name="cash-outline" size={12} color="#6B7280" />
                        <Text style={[D.resumoLabel, { marginLeft: 4 }]}>{t.dinheiro}</Text>
                        <Text style={[D.resumoValue, { color: '#10B981', fontWeight: '700' }]}>{fmt(valorDinheiro)}</Text>
                      </View>
                      <View style={D.resumoRow}>
                        <Ionicons name="card-outline" size={12} color="#2563EB" />
                        <Text style={[D.resumoLabel, { marginLeft: 4, color: '#2563EB' }]}>{t.creditoUsado}</Text>
                        <Text style={[D.resumoValue, { color: '#2563EB' }]}>{fmt(creditoUsadoFinal)}</Text>
                      </View>
                    </>
                  )}
                  {/* Saldo restante (parcial/vencida com pagamento) */}
                  {(isParcial || (isVencida && valorSaldo > 0) || (temPagamentoParcial && valorSaldo > 0)) && (
                    <View style={D.resumoRow}>
                      <Text style={[D.resumoLabel, { color: '#D97706' }]}>{t.restante}</Text>
                      <Text style={[D.resumoValue, { color: '#D97706', fontWeight: '700' }]}>{fmt(valorSaldo)}</Text>
                    </View>
                  )}
                  {/* Crédito gerado */}
                  {(creditoGerado > 0 || saldoExcedente > 0) && !isAutoQuitacao && (
                    <View style={[D.resumoRow, { marginTop: 2 }]}>
                      <Ionicons name="flash-outline" size={12} color="#7C3AED" />
                      <Text style={[D.resumoLabel, { marginLeft: 4, color: '#7C3AED' }]}>Crédito gerado</Text>
                      <Text style={[D.resumoValue, { color: '#7C3AED' }]}>
                        {fmt(creditoGerado > 0 ? creditoGerado : saldoExcedente)}
                      </Text>
                    </View>
                  )}
                  {isAutoQuitacao && (
                    <View style={D.autoQuitBadge}>
                      <Ionicons name="swap-horizontal" size={11} color="#2563EB" />
                      <Text style={D.autoQuitText}> Quitado por crédito</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Lista de pagamentos individuais */}
            {pagsAtivos.length > 0 && (
              <View style={D.section}>
                <Text style={D.sectionTitle}>
                  Pagamentos ({pagsAtivos.length})
                </Text>
                {pagsAtivos.map((pp, idx) => {
                  const dataLiq = pp.data_liquidacao
                    || (pp.data_abertura ? pp.data_abertura.substring(0, 10) : null);
                  const isImportado = pp.importado === true;
                  const valorPP = parseFloat(String(pp.valor_pago_total || 0));
                  const creditoPP = parseFloat(String(pp.valor_credito_gerado || 0));

                  return (
                    <View key={idx} style={D.pagCard}>
                      <View style={D.pagRow}>
                        <View style={D.pagIconBox}>
                          <Ionicons
                            name={isImportado ? 'archive-outline' : 'cash-outline'}
                            size={14}
                            color={isImportado ? '#6B7280' : '#10B981'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          {/* Valor + forma */}
                          <View style={D.pagTopRow}>
                            <Text style={D.pagValor}>{fmt(valorPP)}</Text>
                            {isImportado ? (
                              <View style={D.importBadge}>
                                <Text style={D.importText}>Importado</Text>
                              </View>
                            ) : pp.forma_pagamento ? (
                              <View style={D.formaBadge}>
                                <Ionicons
                                  name={pp.forma_pagamento === 'DINHEIRO' ? 'cash-outline' : 'swap-horizontal-outline'}
                                  size={10}
                                  color="#6B7280"
                                />
                                <Text style={D.formaText}>
                                  {pp.forma_pagamento === 'DINHEIRO' ? t.dinheiro : 'Transferência'}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Data/hora do pagamento */}
                          {pp.created_at && !isImportado && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="time-outline" size={11} color="#9CA3AF" />
                              <Text style={D.pagInfoText}>{fmtTs(pp.created_at)}</Text>
                            </View>
                          )}

                          {/* Data da liquidação */}
                          {dataLiq && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="document-text-outline" size={11} color="#6366F1" />
                              <Text style={[D.pagInfoText, { color: '#6366F1' }]}>
                                {t.liq} {fmtData(dataLiq)}
                              </Text>
                            </View>
                          )}

                          {/* Crédito usado neste pagamento */}
                          {(parseFloat(String(pp.valor_credito_usado || 0))) > 0 && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="card-outline" size={11} color="#2563EB" />
                              <Text style={[D.pagInfoText, { color: '#2563EB' }]}>
                                +{fmt(parseFloat(String(pp.valor_credito_usado || 0)))} crédito usado
                              </Text>
                            </View>
                          )}
                          {/* Crédito gerado neste pagamento */}
                          {creditoPP > 0 && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="flash-outline" size={11} color="#7C3AED" />
                              <Text style={[D.pagInfoText, { color: '#7C3AED' }]}>
                                +{fmt(creditoPP)} crédito gerado
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Sem pagamentos registrados (parcela paga mas sem detalhes) */}
            {(isPago || temPagamentoParcial || (isVencida && valorPago > 0)) && pagsAtivos.length === 0 && (
              <View style={D.section}>
                <View style={D.semDetalhes}>
                  <Ionicons name="archive-outline" size={20} color="#9CA3AF" />
                  <Text style={D.semDetalhesText}>Saldo importado (sem registro individual)</Text>
                </View>
              </View>
            )}

            {/* Pagamentos estornados (colapsado) */}
            {pagsEstornados.length > 0 && (
              <View style={D.section}>
                <Text style={[D.sectionTitle, { color: '#9CA3AF' }]}>
                  Estornados ({pagsEstornados.length})
                </Text>
                {pagsEstornados.map((pp, idx) => (
                  <View key={idx} style={[D.pagCard, { opacity: 0.5 }]}>
                    <View style={D.pagRow}>
                      <View style={[D.pagIconBox, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="arrow-undo-outline" size={14} color="#EF4444" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[D.pagValor, { color: '#9CA3AF', textDecorationLine: 'line-through' }]}>
                          {fmt(parseFloat(String(pp.valor_pago_total || 0)))}
                        </Text>
                        {pp.created_at && (
                          <Text style={D.pagInfoText}>{fmtTs(pp.created_at)}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Botão fechar */}
          <View style={D.footer}>
            <TouchableOpacity style={D.footerBtn} onPress={onClose}>
              <Text style={D.footerBtnTx}>{t.fechar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles do Popup ────────────────────────────────────────────────────────

const D = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  handle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  // Resumo
  resumoCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  resumoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  resumoLabel: { flex: 1, fontSize: 13, color: '#6B7280' },
  resumoValue: { fontSize: 13, color: '#1F2937', fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  autoQuitBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  autoQuitText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },

  // Seções
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  // Card de pagamento
  pagCard: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  pagRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pagIconBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  pagTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pagValor: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  pagInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pagInfoText: { fontSize: 11, color: '#9CA3AF' },

  // Badges
  formaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  formaText: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  importBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  importText: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },

  // Sem detalhes
  semDetalhes: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  semDetalhesText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },

  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footerBtn: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  footerBtnTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Componente Principal ────────────────────────────────────────────────────

export default function ParcelasModal({
  visible, onClose, clienteModal, parcelasModal, loadingParcelas,
  creditoDisponivel, liqId, isViz, isClientePago = false, lang = 'pt-BR',
  onPagar, onPagarMultiplo, onEstornar, pagamentosDetalhados, t,
}: ParcelasModalProps) {

  const [parcelaDetalhes, setParcelaDetalhes] = useState<ParcelaModal | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset seleção ao fechar/abrir modal
  useEffect(() => {
    if (!visible) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [visible]);

  // Parcelas selecionáveis (pendentes, não canceladas, com parcela_id)
  const isSelectable = (p: ParcelaModal) => {
    if (!p.parcela_id) return false;
    if (p.status === 'PAGO' || p.status === 'CANCELADO') return false;
    if (['RENEGOCIADO', 'QUITADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '')) return false;
    if (!liqId || isViz || isClientePago) return false;
    return true;
  };

  // Toggle seleção
  const toggleSelection = (p: ParcelaModal) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(p.parcela_id)) next.delete(p.parcela_id);
      else next.add(p.parcela_id);
      // Se desmarcou tudo, sai do modo seleção
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  // Long press: ativa modo seleção + seleciona a parcela
  const handleLongPress = (p: ParcelaModal) => {
    if (!isSelectable(p)) return;
    setSelectionMode(true);
    setSelectedIds(new Set([p.parcela_id]));
  };

  // Cancelar seleção
  const cancelarSelecao = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Parcelas selecionadas ordenadas por numero_parcela
  const selectedParcelas = parcelasModal
    .filter(p => selectedIds.has(p.parcela_id))
    .sort((a, b) => a.numero_parcela - b.numero_parcela);

  // Calcular total: valor_parcela inteira OU saldo (se parcial)
  const calcValorParcela = (p: ParcelaModal): number => {
    const valorPago = p.valor_pago || 0;
    if (valorPago > 0 && p.status !== 'PAGO') {
      // Parcela com pagamento parcial → cobra só o restante
      return p.valor_saldo ?? (p.valor_parcela - valorPago);
    }
    return p.valor_parcela;
  };

  // Verificar se a última parcela do empréstimo está selecionada
  const ultimaParcelaEmprestimo = parcelasModal
    .filter(p => p.status !== 'PAGO' && p.status !== 'CANCELADO')
    .sort((a, b) => b.numero_parcela - a.numero_parcela)[0];

  const ultimaSelecionada = ultimaParcelaEmprestimo && selectedIds.has(ultimaParcelaEmprestimo.parcela_id);

  // Calcular totais
  const subtotal = selectedParcelas.reduce((sum, p) => sum + calcValorParcela(p), 0);
  const creditoAplicado = ultimaSelecionada && creditoDisponivel > 0
    ? Math.min(creditoDisponivel, calcValorParcela(ultimaParcelaEmprestimo))
    : 0;
  const totalFinal = Math.max(0, subtotal - creditoAplicado);

  // Confirmar pagamento múltiplo
  const confirmarMultiplo = () => {
    if (selectedParcelas.length === 0 || !onPagarMultiplo) return;
    onPagarMultiplo(selectedParcelas, totalFinal, creditoAplicado);
    cancelarSelecao();
  };

  const abrirDetalhes = (p: ParcelaModal) => {
    if (!pagamentosDetalhados) return;
    setParcelaDetalhes(p);
  };

  const fecharDetalhes = () => setParcelaDetalhes(null);

  const renderParcelaItem = (p: ParcelaModal) => {
    const isPago = p.status === 'PAGO';
    const isParcial = p.status === 'PARCIAL';
    const isVencida = p.status === 'VENCIDO' || p.status === 'VENCIDA';
    const isCancelado = p.status === 'CANCELADO';
    const isAutoQuitacao = (p.observacoes || '').includes('[AUTO-QUITAÇÃO]');
    const isQuitacaoOrigem = isPago && (p.credito_gerado || 0) > 0 && clienteModal?.emprestimo_status === 'QUITADO';

    const diasAtraso = isPago ? calcularDiasAtraso(p.data_vencimento, p.data_pagamento) : 0;
    const pagoComAtraso = isPago && diasAtraso > 0;
    const pagoAdiantado = isPago && diasAtraso < 0;

    // Cores por status
    const iconColor = isPago
      ? (pagoComAtraso ? '#F59E0B' : '#10B981')
      : isParcial ? '#F59E0B'
      : isCancelado ? '#9CA3AF'
      : isVencida ? '#EF4444'
      : '#6B7280';

    const iconBg = isPago
      ? (pagoComAtraso ? '#FEF3C7' : '#D1FAE5')
      : isParcial ? '#FEF3C7'
      : isCancelado ? '#F3F4F6'
      : isVencida ? '#FEE2E2'
      : '#F3F4F6';

    const statusColor = isPago
      ? (pagoComAtraso ? '#D97706' : '#10B981')
      : isParcial ? '#D97706'
      : isCancelado ? '#9CA3AF'
      : isVencida ? '#EF4444'
      : '#F97316';

    const statusBg = isPago
      ? (pagoComAtraso ? '#FEF3C7' : '#D1FAE5')
      : isParcial ? '#FEF3C7'
      : isCancelado ? '#F3F4F6'
      : isVencida ? '#FEE2E2'
      : '#FFEDD5';

    const statusText = isPago ? t.pagoStatus
      : isParcial ? t.parcialStatus
      : isCancelado ? 'CANCELADO'
      : isVencida ? t.vencidaStatus
      : t.pendente;

    const statusIcon: keyof typeof Ionicons.glyphMap = isPago
      ? 'checkmark-circle'
      : isParcial || (!isPago && (p.valor_pago || 0) > 0) ? 'pie-chart'
      : isCancelado ? 'close-circle'
      : 'time-outline';

    const valorPago = p.valor_pago || 0;
    const creditoUsado = p.credito_usado || 0;
    const valorDinheiro = valorPago - creditoUsado;
    const valorSaldo = p.valor_saldo ?? (p.valor_parcela - valorPago);
    const temPagamentoParcial = !isPago && valorPago > 0;

    // Parcela é toque quando temos pagamentosDetalhados e há algo a mostrar
    const temDetalhes = !!pagamentosDetalhados && (isPago || isParcial || temPagamentoParcial || (isVencida && valorPago > 0));
    const isSelected = selectionMode && selectedIds.has(p.parcela_id);
    const canSelect = isSelectable(p);

    // Handler de toque: em modo seleção → toggle; senão → detalhes
    const handlePress = () => {
      if (selectionMode && canSelect) {
        toggleSelection(p);
      } else if (temDetalhes) {
        abrirDetalhes(p);
      }
    };

    // Handler de long press: ativa seleção
    const handleLongPressCard = () => {
      if (canSelect && !selectionMode) {
        handleLongPress(p);
      }
    };

    return (
      <TouchableOpacity
        key={p.parcela_id}
        style={[
          S.mParcela,
          { borderLeftColor: iconColor },
          isSelected && S.mParcelaSelected,
        ]}
        activeOpacity={0.7}
        onPress={handlePress}
        onLongPress={handleLongPressCard}
        delayLongPress={400}
      >
        <View style={S.mParcelaRow}>
          {/* Ícone de status / checkbox de seleção */}
          <View style={[S.mParcelaIcon, { backgroundColor: isSelected ? '#DBEAFE' : iconBg }]}>
            {selectionMode && canSelect ? (
              <Ionicons 
                name={isSelected ? 'checkbox' : 'square-outline'} 
                size={18} 
                color={isSelected ? '#2563EB' : '#9CA3AF'} 
              />
            ) : (
              <Ionicons name={statusIcon} size={16} color={iconColor} />
            )}
          </View>

          {/* Info central */}
          <View style={S.mParcelaInfo}>
            {/* Linha 1: Número + Status badge */}
            <View style={S.headerRow}>
              <Text style={S.mParcelaNum}>{t.parcela} {p.numero_parcela}</Text>
              <View style={[S.mParcelaStatus, { backgroundColor: statusBg }]}>
                <Text style={[S.mParcelaStatusTx, { color: statusColor }]}>{statusText}</Text>
              </View>
              {/* Indicador de detalhes disponíveis */}
              {temDetalhes && (
                <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" style={{ marginLeft: 2 }} />
              )}
            </View>

            {/* Linha 2: Datas compactas */}
            <View style={S.datesBlock}>
              <View style={S.dateRow}>
                <Ionicons name="calendar-outline" size={11} color="#9CA3AF" />
                <Text style={S.dateText}>{t.venc} {fmtData(p.data_vencimento)}</Text>
              </View>
              {p.data_pagamento && (
                <View style={S.dateRow}>
                  <Ionicons name="checkmark-done-outline" size={11} color={pagoComAtraso ? '#D97706' : '#6B7280'} />
                  <Text style={[S.dateText, pagoComAtraso && { color: '#D97706' }]}>
                    {t.em} {fmtData(p.data_pagamento)}
                  </Text>
                  {pagoComAtraso && (
                    <View style={S.badgeAtraso}>
                      <Ionicons name="alert-circle" size={9} color="#DC2626" />
                      <Text style={S.badgeAtrasoTx}>
                        {' '}{diasAtraso} {diasAtraso === 1 ? t.diaAtraso : t.diasAtraso}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {p.data_liquidacao && (
                <View style={S.dateRow}>
                  <Ionicons name="document-text-outline" size={11} color="#6366F1" />
                  <Text style={[S.dateText, { color: '#6366F1' }]}>{t.liq} {fmtData(p.data_liquidacao)}</Text>
                </View>
              )}
            </View>

            {/* Badges especiais */}
            {isQuitacaoOrigem && (
              <View style={S.badgeSpecial}>
                <Ionicons name="flash" size={10} color="#D97706" />
                <Text style={S.badgeSpecialTxAmber}> {t.quitacaoAntecipada}</Text>
              </View>
            )}
            {isAutoQuitacao && (
              <View style={[S.badgeSpecial, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                <Ionicons name="swap-horizontal" size={10} color="#2563EB" />
                <Text style={[S.badgeSpecialTxAmber, { color: '#2563EB' }]}> {t.quitadoPorCredito}</Text>
              </View>
            )}

            {/* PAGO: valores resumidos */}
            {isPago && (
              <View style={S.valoresBlock}>
                {creditoUsado > 0 ? (
                  <>
                    <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                    <View style={S.breakdownRow}>
                      <Ionicons name="cash-outline" size={11} color="#6B7280" />
                      <Text style={S.breakdownText}> {t.dinheiro}: {fmt(valorDinheiro)}</Text>
                    </View>
                    <View style={S.breakdownRow}>
                      <Ionicons name="card-outline" size={11} color="#2563EB" />
                      <Text style={S.breakdownTextCredito}> {t.creditoUsado}: {fmt(creditoUsado)}</Text>
                    </View>
                    {valorPago !== p.valor_parcela && (
                      <Text style={S.mParcelaOriginal}>{t.original} {fmt(p.valor_parcela)}</Text>
                    )}
                  </>
                ) : valorPago !== p.valor_parcela ? (
                  <>
                    <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                    <Text style={S.mParcelaOriginal}>{t.original} {fmt(p.valor_parcela)}</Text>
                  </>
                ) : (
                  <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                )}
                {(p.credito_gerado || 0) > 0 && !isAutoQuitacao && (
                  <Text style={S.mParcelaCredito}>{t.credito} {fmt(p.credito_gerado || 0)}</Text>
                )}
                {(p.saldo_excedente || 0) > 0 && (p.credito_gerado || 0) === 0 && !isAutoQuitacao && (
                  <Text style={S.mParcelaCredito}>{t.credito} {fmt(p.saldo_excedente || 0)}</Text>
                )}
              </View>
            )}

            {/* PARCIAL / VENCIDA com pagamento parcial */}
            {temPagamentoParcial && (
              <View style={S.valoresBlock}>
                <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                {creditoUsado > 0 && (
                  <>
                    <View style={S.breakdownRow}>
                      <Ionicons name="cash-outline" size={11} color="#6B7280" />
                      <Text style={S.breakdownText}> {t.dinheiro}: {fmt(valorDinheiro)}</Text>
                    </View>
                    <View style={S.breakdownRow}>
                      <Ionicons name="card-outline" size={11} color="#2563EB" />
                      <Text style={S.breakdownTextCredito}> {t.creditoUsado}: {fmt(creditoUsado)}</Text>
                    </View>
                  </>
                )}
                <Text style={S.mParcelaRestante}>{t.restante} {fmt(valorSaldo)}</Text>
              </View>
            )}

            {/* SEM PAGAMENTO: só valor */}
            {!isPago && !temPagamentoParcial && (
              <Text style={S.mParcelaValor}>{fmt(p.valor_parcela)}</Text>
            )}
          </View>

          {/* Lado direito: botões (escondidos em modo seleção) */}
          <View style={S.mParcelaBtns}>
            {!selectionMode && !isPago && p.parcela_id && !['RENEGOCIADO', 'QUITADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && p.status !== 'CANCELADO' && (
              <TouchableOpacity
                style={[S.mBtnPagar, (!liqId || isViz || isClientePago) && S.mBtnPagarDisabled]}
                onPress={() => onPagar(p)}
                disabled={!liqId || isViz || isClientePago}
              >
                <Ionicons name="cash-outline" size={14} color="#fff" />
                <Text style={S.mBtnPagarTx}>{t.pagar}</Text>
              </TouchableOpacity>
            )}
            {!selectionMode && (isPago || valorPago > 0) && p.parcela_id && liqId && !isViz && p.liquidacao_id === liqId && !['QUITADO', 'RENEGOCIADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && (
              <TouchableOpacity style={S.mBtnEstornar} onPress={() => onEstornar(p)}>
                <Ionicons name="arrow-undo-outline" size={14} color="#EF4444" />
                <Text style={S.mBtnEstornarTx}>{t.estornar}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={S.modalOverlay}>
          <View style={S.modalContainer}>
            {/* Header */}
            <View style={S.modalHeader}>
              <Text style={S.modalTitle} numberOfLines={1}>{clienteModal?.nome || ''}</Text>
              <TouchableOpacity onPress={onClose} style={S.modalClose}>
                <Ionicons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Banner crédito */}
            {creditoDisponivel > 0 && (
              <View style={S.creditoBanner}>
                <Ionicons name="card-outline" size={16} color="#1D4ED8" />
                <Text style={S.creditoText}>{t.creditoDisponivel} {fmt(creditoDisponivel)}</Text>
              </View>
            )}

            {/* Hint de toque (quando detalhes disponíveis) */}
            {/* Hint: detalhes de parcela paga (só quando não tem parcelas selecionáveis) */}
            {pagamentosDetalhados && !parcelasModal.some(p => isSelectable(p)) && (
              <View style={S.hintBar}>
                <Ionicons name="information-circle-outline" size={13} color="#6B7280" />
                <Text style={S.hintText}>
                  {lang === 'es' ? 'Toque en una cuota pagada para ver detalles' : 'Toque em uma parcela paga para ver detalhes'}
                </Text>
              </View>
            )}

            {/* Lista de parcelas */}
            <ScrollView style={S.modalScroll} showsVerticalScrollIndicator={false}>
              {loadingParcelas ? (
                <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
              ) : parcelasModal.length === 0 ? (
                <Text style={S.modalEmpty}>{t.nenhumaParcelaEncontrada}</Text>
              ) : (
                parcelasModal.map(p => renderParcelaItem(p))
              )}
              <View style={{ height: 10 }} />
            </ScrollView>

            {/* Barra de seleção múltipla */}
            {selectionMode && selectedParcelas.length > 0 && (
              <View style={S.selBar}>
                <View style={S.selInfo}>
                  <Text style={S.selCount}>
                    {selectedParcelas.length} {selectedParcelas.length === 1
                      ? (lang === 'es' ? 'cuota' : 'parcela')
                      : (lang === 'es' ? 'cuotas' : 'parcelas')}
                  </Text>
                  {creditoAplicado > 0 && (
                    <Text style={S.selCredito}>
                      <Ionicons name="card-outline" size={11} color="#2563EB" /> {lang === 'es' ? 'Crédito' : 'Crédito'}: -{fmt(creditoAplicado)}
                    </Text>
                  )}
                  <Text style={S.selTotal}>
                    {lang === 'es' ? 'Total' : 'Total'}: {fmt(totalFinal)}
                  </Text>
                </View>
                <View style={S.selBtns}>
                  <TouchableOpacity style={S.selBtnCancel} onPress={cancelarSelecao} activeOpacity={0.7}>
                    <Ionicons name="close" size={18} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity style={S.selBtnPagar} onPress={confirmarMultiplo} activeOpacity={0.7}>
                    <Ionicons name="cash-outline" size={16} color="#fff" />
                    <Text style={S.selBtnPagarTx}>{t.pagar}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Hint de seleção múltipla (apenas fora do modo seleção) */}
            {!selectionMode && !loadingParcelas && parcelasModal.some(p => isSelectable(p)) && (
              <View style={S.hintBar}>
                <Ionicons name="hand-left-outline" size={13} color="#9CA3AF" />
                <Text style={S.hintText}>
                  {lang === 'es' ? 'Mantenga presionado para seleccionar varias cuotas' : 'Segure para selecionar várias parcelas'}
                </Text>
              </View>
            )}

            {/* Botão Fechar */}
            <View style={S.mBtnFecharWrap}>
              <TouchableOpacity style={S.mBtnFechar} onPress={onClose}>
                <Text style={S.mBtnFecharTx}>{t.fechar}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Popup de detalhes — fora do modal principal para sobrepor corretamente */}
      <DetalhesPopup
        visible={!!parcelaDetalhes}
        onClose={fecharDetalhes}
        parcela={parcelaDetalhes}
        pagamentos={
          parcelaDetalhes && pagamentosDetalhados
            ? (pagamentosDetalhados.get(parcelaDetalhes.parcela_id) || [])
            : []
        }
        t={t}
      />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', maxHeight: '85%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 12 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { padding: 16 },
  modalEmpty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },

  // Banner crédito
  creditoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DBEAFE', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#93C5FD' },
  creditoText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },

  // Hint
  hintBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  hintText: { fontSize: 11, color: '#9CA3AF' },

  // Card parcela
  mParcela: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 4 },
  mParcelaRow: { flexDirection: 'row', alignItems: 'flex-start' },
  mParcelaIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2 },
  mParcelaInfo: { flex: 1 },

  // Header da parcela
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mParcelaNum: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  mParcelaStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mParcelaStatusTx: { fontSize: 9, fontWeight: '700' },

  // Datas
  datesBlock: { marginTop: 4, gap: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11, color: '#6B7280' },

  // Badges atraso/pontualidade
  badgeAtraso: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA', marginLeft: 4 },
  badgeAtrasoTx: { fontSize: 9, fontWeight: '700', color: '#DC2626' },

  // Badge especial (quitação/auto-quitação)
  badgeSpecial: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FDE68A' },
  badgeSpecialTxAmber: { fontSize: 11, fontWeight: '600', color: '#D97706' },

  // Valores
  valoresBlock: { marginTop: 4 },
  mParcelaPago: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  mParcelaOriginal: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  mParcelaValor: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 4 },
  mParcelaRestante: { fontSize: 11, fontWeight: '600', color: '#D97706', marginTop: 2 },
  mParcelaCredito: { fontSize: 10, color: '#2563EB', marginTop: 1 },

  // Breakdown dinheiro/crédito
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  breakdownText: { fontSize: 11, color: '#6B7280' },
  breakdownTextCredito: { fontSize: 11, color: '#2563EB', fontWeight: '500' },

  // Botões
  mParcelaBtns: { marginLeft: 8, justifyContent: 'center', gap: 6 },
  mBtnPagar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 5 },
  mBtnPagarDisabled: { backgroundColor: '#E5E7EB', opacity: 0.5 },
  mBtnPagarTx: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mBtnEstornar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', gap: 5 },
  mBtnEstornarTx: { color: '#EF4444', fontSize: 12, fontWeight: '600' },

  // Fechar
  mBtnFecharWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  mBtnFechar: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  mBtnFecharTx: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Seleção múltipla
  mParcelaSelected: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 2 },
  selBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F0FDF4', borderTopWidth: 1, borderTopColor: '#BBF7D0' },
  selInfo: { flex: 1 },
  selCount: { fontSize: 13, fontWeight: '600', color: '#374151' },
  selCredito: { fontSize: 11, color: '#2563EB', marginTop: 2 },
  selTotal: { fontSize: 16, fontWeight: '700', color: '#059669', marginTop: 2 },
  selBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selBtnCancel: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  selBtnPagar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, gap: 6 },
  selBtnPagarTx: { color: '#fff', fontSize: 14, fontWeight: '700' },
});