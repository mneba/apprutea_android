import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
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

export interface PagamentoParcialInfo {
  valor: number;
  dataLiq: string | null; // data da liquidação em que o parcial foi pago (YYYY-MM-DD)
}

export interface EmprestimoInfo {
  valor_total: number;
  total_pago: number;
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

const parseValor = (s: string) => parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;

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
  /** Dados do empréstimo para o cenário (valor_total, total_pago). Opcional. */
  emprestimoInfo?: EmprestimoInfo | null;
  /** Pagamentos parciais não estornados desta parcela (para a faixa informativa). Opcional. */
  pagamentosParciais?: PagamentoParcialInfo[];
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
    // Novos (opcionais — fallback pt-BR embutido)
    quantoVaiPagar?: string;
    parcialmentePaga?: string;
    liquidacaoLbl?: string;
    avancar?: string;
    voltar?: string;
    confirmar?: string;
    confiraAntes?: string;
    pagamentoEspecie?: string;
    creditoDisponivel?: string;
    emprestimoLbl?: string;
    jaPagoAntes?: string;
    pagoHojeEspecie?: string;
    creditoUsado?: string;
    totalAbatido?: string;
    novoSaldo?: string;
    creditoRestante?: string;
    valorInvalido?: string;
    valorAcimaMax?: string;
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
  emprestimoInfo,
  pagamentosParciais,
  t,
}: PagamentoModalProps) {
  // Etapa 1 = valor | Etapa 2 = confirmar cenário
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [erroValor, setErroValor] = useState<string | null>(null);

  // Reset ao abrir
  useEffect(() => {
    if (visible) { setEtapa(1); setErroValor(null); }
  }, [visible]);

  if (!visible || !parcelaPagamento) return null;

  const credito = Number(dadosPagamento?.credito_disponivel || 0);
  const temCredito = credito > 0;
  const saldoEmprestimo = Number(clienteModal?.saldo_emprestimo ?? 0);
  // Teto do pagamento em espécie: o saldo do empréstimo (não se paga mais do que se deve)
  const maxPagamento = saldoEmprestimo > 0 ? saldoEmprestimo : Number(parcelaPagamento.valor_parcela || 0);

  const valorEspecie = parseValor(valorPagamento);
  // Mesmo cálculo do registrarPagamento: crédito limitado ao saldo da parcela
  const saldoParcelaAtual = Number(dadosPagamento?.valor_saldo_parcela || parcelaPagamento.valor_parcela || 0);
  const creditoAplicado = usarCredito ? Math.min(credito, saldoParcelaAtual) : 0;
  const totalAbatido = valorEspecie + creditoAplicado;

  const empTotal = Number(emprestimoInfo?.valor_total || 0);
  const empJaPago = Number(emprestimoInfo?.total_pago || 0);
  const novoSaldo = Math.max(saldoEmprestimo - totalAbatido, 0);
  const creditoRestante = Math.max(credito - creditoAplicado, 0);

  const parciais = (pagamentosParciais || []).filter(p => p.valor > 0);

  const validarEAvancar = () => {
    if (valorEspecie <= 0) { setErroValor(t.valorInvalido || 'Informe um valor válido'); return; }
    if (valorEspecie > maxPagamento + 0.001) {
      setErroValor((t.valorAcimaMax || 'Valor acima do máximo permitido:') + ' ' + fmt(maxPagamento));
      return;
    }
    setErroValor(null);
    setEtapa(2);
  };

  const faixaParcial = parciais.length > 0 && (
    <View style={S.pgFaixaParcial}>
      {parciais.map((p, i) => (
        <Text key={i} style={S.pgFaixaParcialTx}>
          ⓘ {(t.parcialmentePaga || 'Parcialmente paga')} · {(t.liquidacaoLbl || 'liquidação')} {fmtData(p.dataLiq) || '—'} · {fmt(p.valor)}
        </Text>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={S.folha}>
        {/* Header */}
        <View style={S.pgHeader}>
          <Text style={S.pgHeaderIcon}>💰</Text>
          <Text style={S.pgHeaderTitle}>{t.registrarPagamento}</Text>
          <TouchableOpacity onPress={onClose} style={S.modalClose}>
            <Text style={S.modalCloseX}>✕</Text>
          </TouchableOpacity>
        </View>

        {loadingDadosPagamento ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 13 }}>{t.carregandoDados}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Info da parcela (nas duas etapas) */}
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

            {/* Bloqueio por parcelas anteriores */}
            {etapa === 1 && dadosPagamento && dadosPagamento.qtd_parcelas_anteriores_pendentes > 0 && (
              <View style={S.pgAlertRed}>
                <Text style={S.pgAlertRedIcon}>⚠️</Text>
                <View style={S.pgAlertRedTexts}>
                  <Text style={S.pgAlertRedTitle}>{t.saldoAnterior || 'Saldo anterior de'} {dadosPagamento.qtd_parcelas_anteriores_pendentes} {t.parcela}(s)</Text>
                  <Text style={S.pgAlertRedDesc}>
                    {`${t.existemParcelas} ${dadosPagamento.qtd_parcelas_anteriores_pendentes} ${t.parcelasAnteriores} ${fmt(dadosPagamento.saldo_parcelas_anteriores)}. ${t.quitarPrimeiro}`}
                  </Text>
                  <TouchableOpacity style={S.pgAlertRedBtn} onPress={onIrProximaParcela}>
                    <Text style={S.pgAlertRedBtnTx}>{t.irProximaParcela}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(!dadosPagamento || dadosPagamento.qtd_parcelas_anteriores_pendentes === 0) && (
              <>
                {etapa === 1 ? (
                  <>
                    {/* ── ETAPA 1: valor ── */}
                    {faixaParcial}

                    <Text style={S.pgPergunta}>{t.quantoVaiPagar || 'Quanto o cliente vai pagar hoje?'}</Text>

                    <View style={S.pgInputBox}>
                      <View style={S.pgInputRow}>
                        <Text style={S.pgInputCurrency}>$</Text>
                        <TextInput
                          style={S.pgInput}
                          value={valorPagamento}
                          onChangeText={(v) => { setValorPagamento(v); if (erroValor) setErroValor(null); }}
                          keyboardType="decimal-pad"
                          placeholder="0,00"
                          editable={dadosPagamento?.permite_pagamento !== false}
                        />
                      </View>
                      <Text style={S.pgMaxTx}>{t.maxPermitido || 'Máx:'} {fmt(maxPagamento)}</Text>
                      {erroValor && <Text style={S.pgErroTx}>{erroValor}</Text>}
                    </View>

                    {/* Bloqueio por status */}
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
                      style={[S.pgBtnPagar, (dadosPagamento && !dadosPagamento.permite_pagamento) && S.pgBtnDisabled]}
                      onPress={validarEAvancar}
                      disabled={dadosPagamento && !dadosPagamento.permite_pagamento}
                    >
                      <Text style={S.pgBtnTx}>{t.avancar || 'Avançar'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* ── ETAPA 2: confirmar cenário ── */}
                    <View style={S.pgEspecieRow}>
                      <Text style={S.pgEspecieLbl}>{t.pagamentoEspecie || 'Pagamento em espécie'}</Text>
                      <Text style={S.pgEspecieValor}>{fmt(valorEspecie)}</Text>
                    </View>

                    {temCredito && (
                      <View style={S.pgCreditoBox}>
                        <Text style={S.pgCreditoBoxTx}>{t.creditoDisponivel || 'Crédito disponível:'} <Text style={{ fontWeight: '700' }}>{fmt(credito)}</Text></Text>
                        <TouchableOpacity
                          style={[S.pgCreditoBtn, usarCredito && S.pgCreditoBtnOn]}
                          onPress={() => setUsarCredito(!usarCredito)}
                        >
                          <View style={[S.pgCreditoCheck, usarCredito && S.pgCreditoCheckOn]}>
                            {usarCredito && <Text style={S.pgCreditoCheckIcon}>✓</Text>}
                          </View>
                          <Text style={[S.pgCreditoBtnTx, usarCredito && S.pgCreditoBtnTxOn]}>{t.usar || 'usar'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={S.pgCenario}>
                      <Text style={S.pgCenarioTitulo}>{t.confiraAntes || 'Confira antes de confirmar'}</Text>
                      {empTotal > 0 && (
                        <View style={S.pgCenarioRow}>
                          <Text style={S.pgCenarioLbl}>{t.emprestimoLbl || 'Empréstimo'}</Text>
                          <Text style={S.pgCenarioVal}>{fmt(empTotal)}</Text>
                        </View>
                      )}
                      {empTotal > 0 && (
                        <View style={S.pgCenarioRow}>
                          <Text style={S.pgCenarioLbl}>{t.jaPagoAntes || 'Já pago (antes de hoje)'}</Text>
                          <Text style={S.pgCenarioVal}>{fmt(empJaPago)}</Text>
                        </View>
                      )}
                      <View style={S.pgCenarioRow}>
                        <Text style={S.pgCenarioLbl}>{t.pagoHojeEspecie || 'Pago hoje (espécie)'}</Text>
                        <Text style={[S.pgCenarioVal, { fontWeight: '700' }]}>{fmt(valorEspecie)}</Text>
                      </View>
                      {creditoAplicado > 0 && (
                        <View style={S.pgCenarioRow}>
                          <Text style={[S.pgCenarioLbl, { color: '#6366F1' }]}>{t.creditoUsado || 'Crédito usado'}</Text>
                          <Text style={[S.pgCenarioVal, { color: '#6366F1' }]}>{fmt(creditoAplicado)}</Text>
                        </View>
                      )}
                      {creditoAplicado > 0 && (
                        <View style={S.pgCenarioRow}>
                          <Text style={S.pgCenarioLbl}>{t.totalAbatido || 'Total abatido'}</Text>
                          <Text style={[S.pgCenarioVal, { fontWeight: '700' }]}>{fmt(totalAbatido)}</Text>
                        </View>
                      )}
                      <View style={S.pgCenarioDivider} />
                      <View style={S.pgCenarioRow}>
                        <Text style={S.pgCenarioNovoLbl}>{t.novoSaldo || 'Novo saldo'}</Text>
                        <Text style={S.pgCenarioNovoVal}>{fmt(novoSaldo)}</Text>
                      </View>
                      {temCredito && (
                        <View style={S.pgCenarioRow}>
                          <Text style={S.pgCenarioResta}>{t.creditoRestante || 'Crédito restante'}</Text>
                          <Text style={S.pgCenarioResta}>{fmt(creditoRestante)}</Text>
                        </View>
                      )}
                    </View>

                    <View style={S.pgBtnsRow}>
                      <TouchableOpacity style={S.pgBtnVoltar} onPress={() => setEtapa(1)} disabled={processando}>
                        <Text style={S.pgBtnVoltarTx}>{t.voltar || 'Voltar'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[S.pgBtnConfirmar, processando && S.pgBtnDisabled]}
                        onPress={onRegistrarPagamento}
                        disabled={processando}
                      >
                        {processando ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={S.pgBtnTx}>{t.confirmar || 'Confirmar'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  folha: { flex: 1, backgroundColor: '#fff' },
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
  pgFaixaParcial: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  pgFaixaParcialTx: { fontSize: 12, color: '#B45309', lineHeight: 18 },
  pgPergunta: { fontSize: 15, color: '#1F2937', paddingHorizontal: 16, marginTop: 16 },
  pgInputBox: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  pgInputRow: { flexDirection: 'row', alignItems: 'center' },
  pgInputCurrency: { fontSize: 20, fontWeight: '700', color: '#6B7280', marginRight: 8 },
  pgInput: { flex: 1, fontSize: 26, fontWeight: '700', color: '#1F2937', padding: 0 },
  pgMaxTx: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  pgErroTx: { fontSize: 12, color: '#DC2626', marginTop: 6 },
  pgFormRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  pgFormLabel: { fontSize: 12, color: '#6B7280' },
  pgFormSelect: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 8 },
  pgFormSelectTx: { fontSize: 13, color: '#1F2937' },
  pgFormSelectChev: { fontSize: 10, color: '#9CA3AF' },
  pgGpsStatus: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  pgGpsOk: { backgroundColor: '#D1FAE5' },
  pgGpsErro: { backgroundColor: '#FEE2E2' },
  pgGpsIcon: { fontSize: 10 },
  pgGpsTx: { fontSize: 11, fontWeight: '600' },
  pgGpsTxOk: { color: '#059669' },
  pgGpsTxErro: { color: '#DC2626' },
  pgAlertRed: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, gap: 8 },
  pgAlertRedIcon: { fontSize: 16 },
  pgAlertRedTexts: { flex: 1 },
  pgAlertRedTitle: { fontSize: 13, fontWeight: '700', color: '#991B1B' },
  pgAlertRedDesc: { fontSize: 12, color: '#B91C1C', marginTop: 2, lineHeight: 17 },
  pgAlertRedBtn: { marginTop: 8, backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  pgAlertRedBtnTx: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pgEspecieRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 18 },
  pgEspecieLbl: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  pgEspecieValor: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  pgCreditoBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 14, backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  pgCreditoBoxTx: { fontSize: 13, color: '#4F46E5' },
  pgCreditoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E0E7FF' },
  pgCreditoBtnOn: { backgroundColor: '#4F46E5' },
  pgCreditoCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#6366F1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  pgCreditoCheckOn: { backgroundColor: '#fff' },
  pgCreditoCheckIcon: { fontSize: 10, color: '#4F46E5', fontWeight: '700' },
  pgCreditoBtnTx: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  pgCreditoBtnTxOn: { color: '#fff' },
  pgCenario: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  pgCenarioTitulo: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  pgCenarioRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  pgCenarioLbl: { fontSize: 14, color: '#6B7280' },
  pgCenarioVal: { fontSize: 14, color: '#1F2937' },
  pgCenarioDivider: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 6 },
  pgCenarioNovoLbl: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  pgCenarioNovoVal: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  pgCenarioResta: { fontSize: 12, color: '#6B7280' },
  pgBtnsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 18 },
  pgBtnVoltar: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pgBtnVoltarTx: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  pgBtnConfirmar: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  pgBtnPagar: { marginHorizontal: 16, marginTop: 18, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pgBtnDisabled: { opacity: 0.5 },
  pgBtnIcon: { fontSize: 16, color: '#fff' },
  pgBtnTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});