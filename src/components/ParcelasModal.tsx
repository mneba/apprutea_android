import { Ionicons } from '@expo/vector-icons';
import React from 'react';
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

interface ClienteModalInfo {
  id: string;
  nome: string;
  emprestimo_id: string;
  emprestimo_status?: string;
  saldo_emprestimo?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const calcularDiasAtraso = (dataVencimento: string | null | undefined, dataPagamento: string | null | undefined): number => {
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
  onPagar: (parcela: ParcelaModal) => void;
  onEstornar: (parcela: ParcelaModal) => void;
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

// ─── Componente ─────────────────────────────────────────────────────────────

export default function ParcelasModal({
  visible, onClose, clienteModal, parcelasModal, loadingParcelas,
  creditoDisponivel, liqId, isViz, isClientePago = false, onPagar, onEstornar, t,
}: ParcelasModalProps) {

  const renderParcelaItem = (p: ParcelaModal) => {
    const isPago = p.status === 'PAGO';
    const isParcial = p.status === 'PARCIAL';
    const isVencida = p.status === 'VENCIDO' || p.status === 'VENCIDA';
    const isCancelado = p.status === 'CANCELADO';
    const isAutoQuitacao = (p.observacoes || '').includes('[AUTO-QUITAÇÃO]');
    const isQuitacaoOrigem = isPago && (p.credito_gerado || 0) > 0 && clienteModal?.emprestimo_status === 'QUITADO';

    const diasAtraso = isPago ? calcularDiasAtraso(p.data_vencimento, p.data_pagamento) : 0;
    const pagoComAtraso = isPago && diasAtraso > 0;
    const pagoNoDia = isPago && diasAtraso === 0;
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

    const statusText = isPago ? t.pagoStatus : isParcial ? t.parcialStatus : isCancelado ? 'CANCELADO' : isVencida ? t.vencidaStatus : t.pendente;

    // Ícone por status
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

    return (
      <View key={p.parcela_id} style={[S.mParcela, { borderLeftColor: iconColor }]}>
        <View style={S.mParcelaRow}>
          {/* Ícone de status */}
          <View style={[S.mParcelaIcon, { backgroundColor: iconBg }]}>
            <Ionicons name={statusIcon} size={16} color={iconColor} />
          </View>

          {/* Info central */}
          <View style={S.mParcelaInfo}>
            {/* Linha 1: Número + Status badge */}
            <View style={S.headerRow}>
              <Text style={S.mParcelaNum}>{t.parcela} {p.numero_parcela}</Text>
              <View style={[S.mParcelaStatus, { backgroundColor: statusBg }]}>
                <Text style={[S.mParcelaStatusTx, { color: statusColor }]}>{statusText}</Text>
              </View>
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
                  <Text style={[S.dateText, pagoComAtraso && { color: '#D97706' }]}>{t.em} {fmtData(p.data_pagamento)}</Text>
                  {/* Badge atraso/pontualidade */}
                  {pagoComAtraso && (
                    <View style={S.badgeAtraso}>
                      <Ionicons name="alert-circle" size={9} color="#DC2626" />
                      <Text style={S.badgeAtrasoTx}> {diasAtraso} {diasAtraso === 1 ? t.diaAtraso : t.diasAtraso}</Text>
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

            {/* PAGO: valores */}
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

          {/* Lado direito: botões */}
          <View style={S.mParcelaBtns}>
            {!isPago && p.parcela_id && !['RENEGOCIADO', 'QUITADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && p.status !== 'CANCELADO' && (
              <TouchableOpacity
                style={[S.mBtnPagar, (!liqId || isViz || isClientePago) && S.mBtnPagarDisabled]}
                onPress={() => onPagar(p)}
                disabled={!liqId || isViz || isClientePago}
              >
                <Ionicons name="cash-outline" size={14} color="#fff" />
                <Text style={S.mBtnPagarTx}>{t.pagar}</Text>
              </TouchableOpacity>
            )}
            {(isPago || valorPago > 0) && p.parcela_id && liqId && !isViz && p.liquidacao_id === liqId && !['QUITADO', 'RENEGOCIADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && (
              <TouchableOpacity style={S.mBtnEstornar} onPress={() => onEstornar(p)}>
                <Ionicons name="arrow-undo-outline" size={14} color="#EF4444" />
                <Text style={S.mBtnEstornarTx}>{t.estornar}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
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

          {/* Botão Fechar */}
          <View style={S.mBtnFecharWrap}>
            <TouchableOpacity style={S.mBtnFechar} onPress={onClose}>
              <Text style={S.mBtnFecharTx}>{t.fechar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
});