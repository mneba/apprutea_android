import React from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParcelaPagamento {
  parcela_id: string;
  numero_parcela: number;
  data_vencimento: string;
  valor_parcela: number;
  status: string;
  data_pagamento: string | null;
  valor_multa: number;
  valor_pago?: number;
  valor_saldo?: number;
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

// ─── Props ──────────────────────────────────────────────────────────────────

interface PagamentoModalProps {
  visible: boolean;
  onClose: () => void;
  parcelaPagamento: ParcelaPagamento | null;
  clienteModal: ClienteModalInfo | null;
  dadosPagamento: any;
  parcelasModalLength: number;
  loadingDadosPagamento: boolean;
  valorPagamento: string;
  setValorPagamento: (v: string) => void;
  usarCredito: boolean;
  setUsarCredito: (v: boolean) => void;
  formaPagamento: string;
  setFormaPagamento: (v: string) => void;
  gpsStatus: 'ok' | 'erro' | 'carregando';
  processando: boolean;
  onIrProximaParcela: () => void;
  onRegistrarPagamento: () => void;
  t: {
    parcela: string;
    pendente: string;
    vencimento: string;
    saldoAnterior: string;
    valorPendente: string;
    pagamentoBloqueado: string;
    existemParcelas: string;
    parcelasAnteriores: string;
    quitarPrimeiro: string;
    irProximaParcela: string;
    saldoAnteriorParcelas: string;
    incluirAtraso: string;
    valorAPagar: string;
    maxPermitido: string;
    credito: string;
    usar: string;
    forma: string;
    dinheiro: string;
    transferencia: string;
    gpsOk: string;
    gpsErro: string;
    pagarBtn: string;
    registrarPagamento: string;
    carregandoDados: string;
  };
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function PagamentoModal({
  visible,
  onClose,
  parcelaPagamento,
  clienteModal,
  dadosPagamento,
  parcelasModalLength,
  loadingDadosPagamento,
  valorPagamento,
  setValorPagamento,
  usarCredito,
  setUsarCredito,
  formaPagamento,
  setFormaPagamento,
  gpsStatus,
  processando,
  onIrProximaParcela,
  onRegistrarPagamento,
  t,
}: PagamentoModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalPagamento}>
          <View style={S.pgHeader}>
            <Text style={S.pgHeaderIcon}>💰</Text>
            <Text style={S.pgHeaderTitle}>{t.registrarPagamento}</Text>
            <TouchableOpacity onPress={onClose} style={S.modalClose}>
              <Text style={S.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {loadingDadosPagamento ? (
            <View style={S.pgLoading}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={S.pgLoadingText}>{t.carregandoDados || 'Carregando...'}</Text>
            </View>
          ) : parcelaPagamento && (
            <>
              <View style={S.pgInfoRow}>
                <Text style={S.pgInfoParcela}>{t.parcela} {dadosPagamento?.numero_parcela || parcelaPagamento.numero_parcela}/{dadosPagamento?.total_parcelas || parcelasModalLength || '?'}</Text>
                <View style={[
                  S.pgInfoStatus,
                  (dadosPagamento?.status_parcela || parcelaPagamento.status) === 'PARCIAL' && { backgroundColor: '#FEF3C7' }
                ]}>
                  <Text style={[
                    S.pgInfoStatusTx,
                    (dadosPagamento?.status_parcela || parcelaPagamento.status) === 'PARCIAL' && { color: '#D97706' }
                  ]}>
                    {(dadosPagamento?.status_parcela || parcelaPagamento.status) === 'PARCIAL' ? 'PARCIAL' : t.pendente}
                  </Text>
                </View>
              </View>
              <Text style={S.pgInfoCliente}>{dadosPagamento?.cliente_nome || clienteModal?.nome || ''}</Text>
              <Text style={S.pgInfoVenc}>{t.vencimento} {fmtData(dadosPagamento?.data_vencimento || parcelaPagamento.data_vencimento)}</Text>

              {/* CENÁRIO A: Parcela NÃO é a próxima - BLOQUEIA */}
              {dadosPagamento && dadosPagamento.qtd_parcelas_anteriores_pendentes > 0 && (
                <>
                  <View style={S.pgAlertYellow}>
                    <Text style={S.pgAlertYellowIcon}>⚠</Text>
                    <View style={S.pgAlertYellowTexts}>
                      <Text style={S.pgAlertYellowTitle}>{t.saldoAnterior || 'Saldo anterior de'} {dadosPagamento.qtd_parcelas_anteriores_pendentes} {t.parcela}(s)</Text>
                      <Text style={S.pgAlertYellowDesc}>{t.valorPendente || 'Valor pendente:'} {fmt(dadosPagamento.saldo_parcelas_anteriores)}</Text>
                    </View>
                  </View>

                  <View style={S.pgAlertRed}>
                    <Text style={S.pgAlertRedIcon}>⛔</Text>
                    <View style={S.pgAlertRedTexts}>
                      <Text style={S.pgAlertRedTitle}>{t.pagamentoBloqueado || 'Pagamento bloqueado'}</Text>
                      <Text style={S.pgAlertRedDesc}>
                        {`${t.existemParcelas} ${dadosPagamento.qtd_parcelas_anteriores_pendentes} ${t.parcelasAnteriores} ${fmt(dadosPagamento.saldo_parcelas_anteriores)}. ${t.quitarPrimeiro}`}
                      </Text>
                    </View>
                    <TouchableOpacity style={S.pgAlertRedBtn} onPress={onIrProximaParcela}>
                      <Text style={S.pgAlertRedBtnTx}>{t.irProximaParcela || 'Ir para próxima parcela pendente'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* CENÁRIO B: Parcela É a próxima - Mostra formulário */}
              {(!dadosPagamento || dadosPagamento.qtd_parcelas_anteriores_pendentes === 0) && (
                <>
                  {/* Aviso amarelo se tem saldo anterior parcial */}
                  {dadosPagamento?.tem_saldo_anterior && dadosPagamento.saldo_parcelas_anteriores > 0 && (
                    <View style={S.pgAlertYellow}>
                      <Text style={S.pgAlertYellowIcon}>⚠</Text>
                      <View style={S.pgAlertYellowTexts}>
                        <Text style={S.pgAlertYellowTitle}>{t.saldoAnterior} {t.saldoAnteriorParcelas}</Text>
                        <Text style={S.pgAlertYellowDesc}>{t.valorPendente} {fmt(dadosPagamento.saldo_parcelas_anteriores)}</Text>
                      </View>
                      <TouchableOpacity
                        style={S.pgAlertYellowBtn}
                        onPress={() => {
                          const valorTotal = dadosPagamento.valor_total_sugerido || (dadosPagamento.valor_saldo_parcela + dadosPagamento.saldo_parcelas_anteriores);
                          const valorFinal = usarCredito && dadosPagamento.credito_disponivel > 0
                            ? Math.max(0, valorTotal - dadosPagamento.credito_disponivel)
                            : valorTotal;
                          setValorPagamento(valorFinal.toFixed(2).replace('.', ','));
                        }}
                      >
                        <Text style={S.pgAlertYellowBtnTx}>+ {t.incluirAtraso} ({fmt(dadosPagamento.saldo_parcelas_anteriores)})</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Input de valor */}
                  <View style={S.pgInputBox}>
                    <Text style={S.pgInputLabel}>{t.valorAPagar}</Text>
                    <View style={S.pgInputRow}>
                      <Text style={S.pgInputCurrency}>$</Text>
                      <TextInput
                        style={S.pgInput}
                        value={valorPagamento}
                        onChangeText={setValorPagamento}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        editable={dadosPagamento?.permite_pagamento !== false}
                      />
                    </View>
                    {clienteModal?.saldo_emprestimo != null && (
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {t.maxPermitido || 'Máx:'} {fmt(clienteModal.saldo_emprestimo)}
                      </Text>
                    )}

                    {/* Linha de crédito disponível */}
                    {dadosPagamento?.tem_credito && dadosPagamento.credito_disponivel > 0 && (
                      <View style={S.pgCreditoRow}>
                        <Text style={S.pgCreditoIcon}>💳</Text>
                        <Text style={S.pgCreditoText}>{t.credito} {fmt(dadosPagamento.credito_disponivel)}</Text>
                        <TouchableOpacity
                          style={[S.pgCreditoBtn, usarCredito && S.pgCreditoBtnOn]}
                          onPress={() => {
                            const novoUsarCredito = !usarCredito;
                            setUsarCredito(novoUsarCredito);
                            const valorSaldoParcela = dadosPagamento.valor_saldo_parcela || parcelaPagamento.valor_parcela;
                            const saldoEmp = clienteModal?.saldo_emprestimo ?? valorSaldoParcela;
                            if (novoUsarCredito) {
                              const creditoAplicado = Math.min(dadosPagamento.credito_disponivel, valorSaldoParcela);
                              const maxDinheiro = Math.max(saldoEmp - creditoAplicado, 0);
                              const valorSugerido = Math.min(valorSaldoParcela - creditoAplicado, maxDinheiro);
                              setValorPagamento(Math.max(0, valorSugerido).toFixed(2).replace('.', ','));
                            } else {
                              setValorPagamento(valorSaldoParcela.toFixed(2).replace('.', ','));
                            }
                          }}
                        >
                          <View style={[S.pgCreditoCheck, usarCredito && S.pgCreditoCheckOn]}>
                            {usarCredito && <Text style={S.pgCreditoCheckIcon}>✓</Text>}
                          </View>
                          <Text style={[S.pgCreditoBtnTx, usarCredito && S.pgCreditoBtnTxOn]}>{t.usar || 'Usar'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Alerta de bloqueio por status */}
                  {dadosPagamento && !dadosPagamento.permite_pagamento && dadosPagamento.mensagem_bloqueio && (
                    <View style={S.pgAlertRed}>
                      <Text style={S.pgAlertRedIcon}>⛔</Text>
                      <View style={S.pgAlertRedTexts}>
                        <Text style={S.pgAlertRedTitle}>{t.pagamentoBloqueado || 'Pagamento bloqueado'}</Text>
                        <Text style={S.pgAlertRedDesc}>{dadosPagamento.mensagem_bloqueio}</Text>
                      </View>
                    </View>
                  )}

                  <View style={S.pgFormRow}>
                    <Text style={S.pgFormLabel}>{t.forma}</Text>
                    <TouchableOpacity style={S.pgFormSelect} onPress={() => setFormaPagamento(formaPagamento === 'DINHEIRO' ? 'TRANSFERENCIA' : 'DINHEIRO')}>
                      <Text style={S.pgFormSelectTx}>{formaPagamento === 'DINHEIRO' ? t.dinheiro : t.transferencia}</Text>
                      <Text style={S.pgFormSelectChev}>▼</Text>
                    </TouchableOpacity>
                    <View style={[S.pgGpsStatus, gpsStatus === 'ok' ? S.pgGpsOk : S.pgGpsErro]}>
                      <Text style={S.pgGpsIcon}>{gpsStatus === 'ok' ? '◉' : '○'}</Text>
                      <Text style={[S.pgGpsTx, gpsStatus === 'ok' ? S.pgGpsTxOk : S.pgGpsTxErro]}>{gpsStatus === 'ok' ? t.gpsOk : t.gpsErro}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[S.pgBtnPagar, (processando || (dadosPagamento && !dadosPagamento.permite_pagamento)) && S.pgBtnDisabled]}
                    onPress={onRegistrarPagamento}
                    disabled={processando || (dadosPagamento && !dadosPagamento.permite_pagamento)}
                  >
                    {processando ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={S.pgBtnIcon}>✓</Text>
                        <Text style={S.pgBtnTx}>{t.pagarBtn} {fmt(
                          (parseFloat(valorPagamento.replace(',', '.')) || 0) +
                          (usarCredito && dadosPagamento?.credito_disponivel
                            ? Math.min(dadosPagamento.credito_disponivel, dadosPagamento.valor_saldo_parcela || parcelaPagamento?.valor_parcela || 0)
                            : 0)
                        )}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalPagamento: { width: '90%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalCloseX: { fontSize: 16, color: '#6B7280' },
  pgHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pgHeaderIcon: { fontSize: 20, marginRight: 10 },
  pgHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  pgInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  pgInfoParcela: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  pgInfoStatus: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pgInfoStatusTx: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  pgInfoCliente: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginTop: 4 },
  pgInfoVenc: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: 16, marginTop: 2 },
  pgInputBox: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  pgInputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  pgInputRow: { flexDirection: 'row', alignItems: 'center' },
  pgInputCurrency: { fontSize: 20, fontWeight: '700', color: '#6B7280', marginRight: 8 },
  pgInput: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1F2937', padding: 0 },
  pgFormRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  pgFormLabel: { fontSize: 12, color: '#6B7280' },
  pgFormSelect: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 8 },
  pgFormSelectTx: { fontSize: 13, color: '#1F2937' },
  pgFormSelectChev: { fontSize: 10, color: '#9CA3AF' },
  pgGpsStatus: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  pgGpsOk: { backgroundColor: '#D1FAE5' },
  pgGpsErro: { backgroundColor: '#FEE2E2' },
  pgGpsIcon: { fontSize: 10 },
  pgGpsTx: { fontSize: 11, fontWeight: '500' },
  pgGpsTxOk: { color: '#059669' },
  pgGpsTxErro: { color: '#DC2626' },
  pgBtnPagar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', marginHorizontal: 16, marginVertical: 16, paddingVertical: 14, borderRadius: 12, gap: 8 },
  pgBtnDisabled: { opacity: 0.5 },
  pgBtnIcon: { fontSize: 16, color: '#fff' },
  pgBtnTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
  pgLoading: { padding: 40, alignItems: 'center' },
  pgLoadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  pgCreditoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  pgCreditoIcon: { fontSize: 16, marginRight: 8 },
  pgCreditoText: { flex: 1, fontSize: 13, color: '#6B7280' },
  pgCreditoBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  pgCreditoBtnOn: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  pgCreditoCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  pgCreditoCheckOn: { borderColor: '#10B981', backgroundColor: '#10B981' },
  pgCreditoCheckIcon: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pgCreditoBtnTx: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  pgCreditoBtnTxOn: { color: '#059669' },
  pgAlertYellow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' },
  pgAlertYellowIcon: { fontSize: 16, marginRight: 10, marginTop: 2 },
  pgAlertYellowTexts: { flex: 1 },
  pgAlertYellowTitle: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  pgAlertYellowDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },
  pgAlertYellowBtn: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F59E0B' },
  pgAlertYellowBtnTx: { fontSize: 12, fontWeight: '600', color: '#fff' },
  pgAlertRed: { backgroundColor: '#FEF2F2', marginHorizontal: 16, marginTop: 12, marginBottom: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  pgAlertRedIcon: { fontSize: 16, marginRight: 10 },
  pgAlertRedTexts: { marginBottom: 10 },
  pgAlertRedTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  pgAlertRedDesc: { fontSize: 12, color: '#B91C1C', marginTop: 4 },
  pgAlertRedBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DC2626', backgroundColor: '#fff' },
  pgAlertRedBtnTx: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
});