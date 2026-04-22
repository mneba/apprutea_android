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

// Calcula dias de atraso entre data de pagamento e data de vencimento
// Retorna número positivo se pagou atrasado, 0 se pagou no dia, negativo se pagou adiantado
const calcularDiasAtraso = (dataVencimento: string | null | undefined, dataPagamento: string | null | undefined): number => {
  if (!dataVencimento || !dataPagamento) return 0;
  
  // Extrair apenas a parte da data (YYYY-MM-DD)
  const vencStr = dataVencimento.substring(0, 10);
  const pagStr = dataPagamento.substring(0, 10);
  
  // Criar datas sem timezone issues
  const [vY, vM, vD] = vencStr.split('-').map(Number);
  const [pY, pM, pD] = pagStr.split('-').map(Number);
  
  const vencDate = new Date(vY, vM - 1, vD);
  const pagDate = new Date(pY, pM - 1, pD);
  
  const diffMs = pagDate.getTime() - vencDate.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDias;
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
  isClientePago?: boolean; // ⭐ Cliente está pago na liquidação - desabilita pagamento
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
  visible,
  onClose,
  clienteModal,
  parcelasModal,
  loadingParcelas,
  creditoDisponivel,
  liqId,
  isViz,
  isClientePago = false,
  onPagar,
  onEstornar,
  t,
}: ParcelasModalProps) {
  const renderParcelaItem = (p: ParcelaModal) => {
    const isPago = p.status === 'PAGO';
    const isParcial = p.status === 'PARCIAL';
    const isVencida = p.status === 'VENCIDO' || p.status === 'VENCIDA';
    const isCancelado = p.status === 'CANCELADO';
    const isAutoQuitacao = (p.observacoes || '').includes('[AUTO-QUITAÇÃO]');
    const isQuitacaoOrigem = isPago && (p.credito_gerado || 0) > 0 && clienteModal?.emprestimo_status === 'QUITADO';

    // ⭐ Calcular dias de atraso para parcelas pagas
    const diasAtraso = isPago ? calcularDiasAtraso(p.data_vencimento, p.data_pagamento) : 0;
    const pagoComAtraso = isPago && diasAtraso > 0;
    const pagoNoDia = isPago && diasAtraso === 0;
    const pagoAdiantado = isPago && diasAtraso < 0;

    // ⭐ Cores diferenciadas: verde normal para no dia, amarelo/laranja para atraso
    const iconColor = isPago 
      ? (pagoComAtraso ? '#F59E0B' : '#10B981')  // Amarelo se atrasou, verde se no dia
      : isParcial ? '#F59E0B' 
      : isCancelado ? '#9CA3AF' 
      : isVencida ? '#EF4444' 
      : '#6B7280';
    
    const iconBg = isPago 
      ? (pagoComAtraso ? '#FEF3C7' : '#D1FAE5')  // Fundo amarelo se atrasou
      : isParcial ? '#FEF3C7' 
      : isCancelado ? '#F3F4F6' 
      : isVencida ? '#FEE2E2' 
      : '#F3F4F6';
    
    const statusColor = isPago 
      ? (pagoComAtraso ? '#D97706' : '#10B981')  // Laranja escuro se atrasou
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

    const valorPago = p.valor_pago || 0;
    const creditoUsado = p.credito_usado || 0;
    const valorDinheiro = valorPago - creditoUsado; // Valor efetivamente pago em dinheiro
    const valorSaldo = p.valor_saldo ?? (p.valor_parcela - valorPago);
    const temPagamentoParcial = !isPago && valorPago > 0;

    return (
      <View key={p.parcela_id} style={[S.mParcela, { borderLeftColor: iconColor }]}>
        <View style={S.mParcelaRow}>
          {/* Lado esquerdo: ícone + info + valores */}
          <View style={[S.mParcelaIcon, { backgroundColor: iconBg }]}>
            <Text style={{ color: iconColor, fontSize: 14 }}>
              {isPago ? '✓' : temPagamentoParcial ? '◐' : isParcial ? '◐' : '📅'}
            </Text>
          </View>
          <View style={S.mParcelaInfo}>
            {/* Linha 1: Parcela X + badge status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={S.mParcelaNum}>{t.parcela} {p.numero_parcela}</Text>
              <View style={[S.mParcelaStatus, { backgroundColor: statusBg }]}>
                <Text style={[S.mParcelaStatusTx, { color: statusColor }]}>{statusText}</Text>
              </View>
            </View>
            {/* Linha 2: Datas */}
            <View style={{ marginTop: 3 }}>
              <Text style={S.mParcelaVenc}>📅 {t.venc} {fmtData(p.data_vencimento)}</Text>
              {p.data_pagamento && (
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 1, gap: 6 }}>
                  <Text style={[S.mParcelaDataPg, pagoComAtraso && { color: '#D97706' }]}>
                    💰 {t.em} {fmtData(p.data_pagamento)}
                  </Text>
                  {/* ⭐ Badge de atraso/pontualidade */}
                  {pagoComAtraso && (
                    <View style={S.badgeAtraso}>
                      <Text style={S.badgeAtrasoTx}>
                        ⚠️ {diasAtraso} {diasAtraso === 1 ? t.diaAtraso : t.diasAtraso}
                      </Text>
                    </View>
                  )}
                  {pagoNoDia && (
                    <View style={S.badgeNoDia}>
                      <Text style={S.badgeNoDiaTx}>✓ {t.pagoNoDia}</Text>
                    </View>
                  )}
                  {pagoAdiantado && (
                    <View style={S.badgeAdiantado}>
                      <Text style={S.badgeAdiantadoTx}>⭐ {t.pagoAdiantado}</Text>
                    </View>
                  )}
                </View>
              )}
              {p.data_liquidacao && (
                <Text style={[S.mParcelaDataPg, { marginTop: 1, color: '#6366F1' }]}>📋 {t.liq} {fmtData(p.data_liquidacao)}</Text>
              )}
            </View>

            {/* PAGO: valor pago + original + crédito + indicador quitação */}
            {isPago && (
              <View style={{ marginTop: 2 }}>
                {/* Badge quitação antecipada (parcela que originou) */}
                {isQuitacaoOrigem && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>⚡ {t.quitacaoAntecipada}</Text>
                  </View>
                )}
                {/* Badge auto-quitação */}
                {isAutoQuitacao && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600' }}>🔄 {t.quitadoPorCredito}</Text>
                  </View>
                )}
                {/* ⭐ Exibição detalhada: Dinheiro + Crédito usado separados */}
                {creditoUsado > 0 ? (
                  <>
                    {/* Quando usou crédito, mostra breakdown completo */}
                    <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                    <View style={S.mParcelaBreakdown}>
                      <Text style={S.mParcelaBreakdownItem}>💵 {t.dinheiro}: {fmt(valorDinheiro)}</Text>
                      <Text style={S.mParcelaBreakdownItemCredito}>💳 {t.creditoUsado}: {fmt(creditoUsado)}</Text>
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
              <View style={{ marginTop: 2 }}>
                <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                {creditoUsado > 0 && (
                  <View style={S.mParcelaBreakdown}>
                    <Text style={S.mParcelaBreakdownItem}>💵 {t.dinheiro}: {fmt(valorDinheiro)}</Text>
                    <Text style={S.mParcelaBreakdownItemCredito}>💳 {t.creditoUsado}: {fmt(creditoUsado)}</Text>
                  </View>
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
                <Text style={S.mBtnPagarIcon}>💰</Text>
                <Text style={S.mBtnPagarTx}>{t.pagar}</Text>
              </TouchableOpacity>
            )}
            {/* Estorno: PAGO ou qualquer parcela com pagamento (parcial) na liquidação atual */}
            {(isPago || valorPago > 0) && p.parcela_id && liqId && !isViz && p.liquidacao_id === liqId && !['QUITADO', 'RENEGOCIADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && (
              <TouchableOpacity style={S.mBtnEstornar} onPress={() => onEstornar(p)}>
                <Text style={S.mBtnEstornarIcon}>↩</Text>
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
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{clienteModal?.nome || ''}</Text>
            <TouchableOpacity onPress={onClose} style={S.modalClose}>
              <Text style={S.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>
          {creditoDisponivel > 0 && (
            <View style={S.creditoBanner}>
              <Text style={S.creditoIcon}>💳</Text>
              <Text style={S.creditoText}>{t.creditoDisponivel} {fmt(creditoDisponivel)}</Text>
            </View>
          )}
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
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalCloseX: { fontSize: 16, color: '#6B7280' },
  modalScroll: { padding: 16 },
  modalEmpty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  creditoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#93C5FD' },
  creditoIcon: { fontSize: 18, marginRight: 10 },
  creditoText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  mParcela: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 4 },
  mParcelaRow: { flexDirection: 'row', alignItems: 'center' },
  mParcelaIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mParcelaInfo: { flex: 1 },
  mParcelaNum: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  mParcelaVenc: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  mParcelaOriginal: { fontSize: 10, color: '#9CA3AF' },
  mParcelaValor: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  mParcelaPago: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  mParcelaRestante: { fontSize: 11, fontWeight: '600', color: '#D97706', marginTop: 1 },
  mParcelaCredito: { fontSize: 10, color: '#2563EB' },
  // ⭐ Breakdown de pagamento (dinheiro + crédito)
  mParcelaBreakdown: { marginTop: 2, paddingLeft: 2 },
  mParcelaBreakdownItem: { fontSize: 11, color: '#6B7280' },
  mParcelaBreakdownItemCredito: { fontSize: 11, color: '#2563EB', fontWeight: '500' },
  mParcelaStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mParcelaStatusTx: { fontSize: 9, fontWeight: '700' },
  mParcelaDataPg: { fontSize: 9, color: '#6B7280', marginTop: 1 },
  // ⭐ Badges de atraso/pontualidade
  badgeAtraso: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA' },
  badgeAtrasoTx: { fontSize: 9, fontWeight: '700', color: '#DC2626' },
  badgeNoDia: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#A7F3D0' },
  badgeNoDiaTx: { fontSize: 9, fontWeight: '600', color: '#059669' },
  badgeAdiantado: { backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  badgeAdiantadoTx: { fontSize: 9, fontWeight: '600', color: '#2563EB' },
  mParcelaBtns: { marginLeft: 8, justifyContent: 'center' },
  mBtnPagar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
  mBtnPagarDisabled: { backgroundColor: '#E5E7EB', opacity: 0.5 },
  mBtnPagarIcon: { fontSize: 14 },
  mBtnPagarTx: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mBtnEstornar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', gap: 6 },
  mBtnEstornarIcon: { fontSize: 14, color: '#EF4444' },
  mBtnEstornarTx: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  mBtnFecharWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  mBtnFechar: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  mBtnFecharTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});