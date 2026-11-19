import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './texto';
import { useAuth } from '../contexts/AuthContext';
import { useTrabalhaCredito } from '../hooks/useTrabalhaCredito';
import { parcelasPagasEquivalentes, fracaoBr } from '../utils/creditoEmTela';
import AnexosLista from './AnexosLista';
import { moeda, data, dataAno2Hora, diaMes, hora, numeroBr } from '../utils/formato';

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
  // Para a tela de parcelas (layout C, 18/11/2026): "pago no dia aberto"
  // compara liquidacao_id com o dia aberto, e operacao_id separa o
  // recebimento de UMA parcela do de várias (quitação, sem estorno por parcela).
  liquidacao_id?: string | null;
  operacao_id?: string | null;
  // Detalhes do estorno (preenchidos quando estornado = true)
  motivo_estorno?: string;
  data_estorno?: string;
  estornado_por_nome?: string;
}

/** O que o resumo do topo precisa do empréstimo. */
export interface EmprestimoResumo {
  status: string;
  tipo_emprestimo?: string | null;
  valor_principal: number;
  valor_total: number;
  /** Já LÍQUIDO de crédito (o gatilho desconta) — não subtrair de novo. */
  valor_saldo: number;
  numero_parcelas: number;
  frequencia_pagamento?: string | null;
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
  moeda(v);

const fmtData = (d: string | null | undefined) => {
  if (!d) return '';
  if (d.length === 10 && d.includes('-')) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return data(dt);
};

const fmtTs = (ts: string) => {
  try {
    const s = ts.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z');
    const dt = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
    if (isNaN(dt.getTime())) return '—';
    return dataAno2Hora(dt);
  } catch {
    return '—';
  }
};

// Atraso: regra única em src/utils/diasCobranca. A implementação que morava
// aqui excluía domingo corretamente, mas ignorava feriados — e era a única do
// app que acertava o domingo, o que mascarou o bug nas outras telas.

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
  trabalhaDomingo?: boolean;   // se a rota não trabalha domingo, domingos não contam atraso
  feriados?: Set<string> | null;  // 'YYYY-MM-DD' de feriados_rota — também não contam
  /**
   * Data operacional da rota: a liquidação aberta, ou o hoje da rota quando
   * não há dia aberto. É contra ela que se decide o que está vencido — nunca
   * contra o relógio do aparelho.
   */
  dataOperacional: string;
  /** Abre o MENU de pagamento (não paga direto). */
  onPagar: (parcela: ParcelaModal) => void;
  onEstornar: (parcela: ParcelaModal) => void;
  /** Resumo do topo; sem ele a tela mostra só a lista. */
  emprestimo?: EmprestimoResumo | null;
  /** A origem já tem renovação viva: o Renovar fica, desabilitado. */
  jaRenovado?: boolean;
  /** Só com o empréstimo QUITADO. */
  onRenovar?: () => void;
  onAbrirFicha?: () => void;
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
  clienteId?: string | null;
  lang: 'pt-BR' | 'es';
  podeAnexar?: boolean;
  enviadoPor?: string | null;
  enviadoPorNome?: string | null;
  /** Data operacional (YYYY-MM-DD) — base para decidir o que está vencido. */
  dataOperacional: string;
  t: ParcelasModalProps['t'];
}

function DetalhesPopup({
  visible, onClose, parcela, pagamentos, clienteId, lang,
  podeAnexar = true, enviadoPor, enviadoPorNome, dataOperacional, t,
}: DetalhesPopupProps) {
  const mostrarCredito = useTrabalhaCredito();
  // Comprovantes abrem sob demanda, um pagamento por vez: a lista de anexos
  // consulta o banco ao montar, e renderizar todas de uma vez faria N buscas
  // só para abrir o popup.
  const [comprovanteAberto, setComprovanteAberto] = useState<string | null>(null);

  if (!parcela) return null;

  const valorPago = parcela.valor_pago || 0;
  const creditoGerado = parcela.credito_gerado || 0;
  const saldoExcedente = parcela.saldo_excedente || 0;
  const valorSaldo = parcela.valor_saldo ?? (parcela.valor_parcela - valorPago);

  // Calcula dinheiro e crédito usado a partir dos registros individuais (mais preciso)
  // Evita o problema de credito_usado = 0 no dado agregado da parcela
  const pagsNaoEstornados = pagamentos.filter(pp => !pp.estornado);
  const creditoUsado = pagsNaoEstornados.reduce((s, pp) => s + parseFloat(String(pp.valor_credito_usado || 0)), 0);
  // dinheiroReal = total entregue MENOS o crédito usado. O valor_pago_total
  // inclui a parte paga em crédito; sem subtrair, o crédito era exibido como
  // se fosse dinheiro (ex.: $20 dinheiro + $20 crédito aparecia "Dinheiro $40").
  const totalPagoReal = pagsNaoEstornados.reduce((s, pp) => s + parseFloat(String(pp.valor_pago_total || 0)), 0);
  const dinheiroReal = totalPagoReal - creditoUsado;
  // Se não temos registros individuais (importado), cai de volta para o dado da parcela
  const valorDinheiro = pagsNaoEstornados.length > 0 ? dinheiroReal : (valorPago - (parcela.credito_usado || 0));
  const creditoUsadoFinal = pagsNaoEstornados.length > 0 ? creditoUsado : (parcela.credito_usado || 0);
  const isPago = parcela.status === 'PAGO';
  const isParcial = parcela.status === 'PARCIAL';
  // Vencida se ficou para trás do DIA OPERACIONAL — não pelo status, que o
  // trigger grava comparando com CURRENT_DATE. Ver a nota extensa na lista,
  // mais abaixo.
  const isVencida = !isPago && !isParcial && !!parcela.data_vencimento
    && String(parcela.data_vencimento).substring(0, 10) < dataOperacional;
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
                      {mostrarCredito && <View style={D.resumoRow}>
                        <Ionicons name="card-outline" size={12} color="#2563EB" />
                        <Text style={[D.resumoLabel, { marginLeft: 4, color: '#2563EB' }]}>{t.creditoUsado}</Text>
                        <Text style={[D.resumoValue, { color: '#2563EB' }]}>{fmt(creditoUsadoFinal)}</Text>
                      </View>}
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
                                  name={pp.forma_pagamento === 'DINHEIRO' ? 'cash-outline' : pp.forma_pagamento === 'CREDITO' ? 'card-outline' : 'swap-horizontal-outline'}
                                  size={10}
                                  color="#6B7280"
                                />
                                <Text style={D.formaText}>
                                  {pp.forma_pagamento === 'DINHEIRO' ? t.dinheiro
                                    : pp.forma_pagamento === 'CREDITO' ? 'Pago com crédito'
                                    : 'Transferência'}
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

                      {/* Comprovante deste pagamento. O cliente às vezes paga
                          por transferência e manda o comprovante; fica preso
                          ao PAGAMENTO, não à parcela — uma parcela paga em
                          três dias tem três comprovantes diferentes.
                          Importados não têm id próprio, logo não têm âncora. */}
                      {clienteId && pp.id && !isImportado && (
                        <View style={D.compBox}>
                          <TouchableOpacity
                            style={D.compBtn}
                            onPress={() => setComprovanteAberto(comprovanteAberto === pp.id ? null : pp.id!)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={comprovanteAberto === pp.id ? 'chevron-up' : 'receipt-outline'}
                              size={13}
                              color="#2563EB"
                            />
                            <Text style={D.compBtnTx}>
                              {comprovanteAberto === pp.id
                                ? (lang === 'es' ? 'Ocultar comprobante' : 'Ocultar comprovante')
                                : (lang === 'es' ? 'Comprobante' : 'Comprovante')}
                            </Text>
                          </TouchableOpacity>
                          {comprovanteAberto === pp.id && (
                            <View style={D.compConteudo}>
                              <AnexosLista
                                clienteId={clienteId}
                                pagamentoId={pp.id}
                                lang={lang}
                                enviadoPor={enviadoPor}
                                enviadoPorNome={enviadoPorNome}
                                podeEditar={podeAnexar}
                              />
                            </View>
                          )}
                        </View>
                      )}
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
                {pagsEstornados.map((pp, idx) => {
                  const dataEst = pp.data_estorno || pp.created_at;
                  return (
                    <View key={idx} style={[D.pagCard, { opacity: 0.6 }]}>
                      <View style={D.pagRow}>
                        <View style={[D.pagIconBox, { backgroundColor: '#FEE2E2' }]}>
                          <Ionicons name="arrow-undo-outline" size={14} color="#EF4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[D.pagValor, { color: '#9CA3AF', textDecorationLine: 'line-through' }]}>
                            {fmt(parseFloat(String(pp.valor_pago_total || 0)))}
                          </Text>
                          {dataEst && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="time-outline" size={11} color="#9CA3AF" />
                              <Text style={D.pagInfoText}>{fmtTs(dataEst)}</Text>
                            </View>
                          )}
                          {pp.motivo_estorno && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="chatbox-ellipses-outline" size={11} color="#9CA3AF" />
                              <Text style={[D.pagInfoText, { fontStyle: 'italic' }]}>
                                {pp.motivo_estorno}
                              </Text>
                            </View>
                          )}
                          {pp.estornado_por_nome && (
                            <View style={D.pagInfoRow}>
                              <Ionicons name="person-outline" size={11} color="#9CA3AF" />
                              <Text style={D.pagInfoText}>{pp.estornado_por_nome}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
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
  compBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#EFF2F5', paddingTop: 8 },
  compBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  compBtnTx: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  compConteudo: { marginTop: 10 },

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
//
// Layout C (Mauricio, 17 e 18/11/2026; mockup "Parcelas" no claude.ai). Uma
// lista só, sempre com o mesmo esqueleto:
//
//   resumo do empréstimo · faixa "hoje" · uma linha por parcela · rodapé
//
// Regras fixas, e cada uma tem motivo:
//   1. O valor da linha é SEMPRE o da parcela. Dinheiro a mais ou a menos vai
//      para a legenda — senão a coluna mistura duas grandezas e a soma visual
//      deixa de fechar com o total.
//   2. ↶ só em parcela paga NO DIA ABERTO, e só a última delas fica ativa: o
//      estorno é linear (abrirEstorno recusa fora de ordem). Paga em dia
//      fechado mostra "Pago em dd/mm", sem botão — o vendedor não alcança
//      aquele dia.
//   3. Um Pagar só, na primeira parcela em aberto, e ele abre o MENU de
//      pagamento (é lá que vivem crédito, quitação e "pagar várias"). Linha
//      com ↶ não tem Pagar, inclusive a parcial.
//   4. Recebimento de várias parcelas (quitação) vira UMA faixa, sem ↶: o
//      banco recusa estorno por parcela desse recebimento desde 16/11/2026
//      (sql/2026-11-16_reset_reencadeia_e_estorno_recusa_multi.sql). A faixa
//      diz o caminho: Resetar cliente.
//   5. Crédito aparece só no resumo, como "Crédito disponível" — o mesmo
//      rótulo do card. O Restante já vem LÍQUIDO de crédito
//      (emprestimos.valor_saldo); a linha não é para ser subtraída.

const TX = {
  'pt-BR': {
    emprestimo: 'Empréstimo', recebido: 'Recebido', restante: 'Restante',
    pagas: (a: number | string, b: number) => `${a} de ${b} pagas`,
    parciais: (n: number) => `${n} parcial${n === 1 ? '' : 's'}`,
    creditoDisp: 'Crédito disponível',
    hojeRecebido: 'Hoje recebido',
    parcelasN: (n: number) => `${n} parcela${n === 1 ? '' : 's'}`,
    parcial: 'parcial', maisCredito: ' + crédito',
    quitadoHoje: 'QUITADO hoje', recebHoje: 'Recebido hoje',
    multiAviso: 'Recebimento de várias parcelas não se estorna por parcela. Para desfazer, use Resetar cliente no Caixa.',
    quitAviso: 'Para desfazer a quitação, use Resetar cliente no Caixa.',
    pagoHoje: 'Pago hoje', pagoEm: 'Pago em', quitacao: 'quitação',
    parcialLeg: 'Parcial', hoje: 'hoje', falta: 'falta',
    gerouCredito: 'gerou crédito', usouCredito: 'usou crédito',
    quitadoCredito: 'Quitado por crédito',
    pago: 'Pago', naoPago: 'Não pago', cancelada: 'Cancelada', pagar: 'Pagar',
    renovar: 'Renovar', renovado: 'Renovado',
    verFicha: 'Ver ficha completa',
    vazio: 'Nenhuma parcela encontrada',
    freq: { DIARIO: 'diário', SEMANAL: 'semanal', QUINZENAL: 'quinzenal', MENSAL: 'mensal', FLEXIVEL: 'flexível' } as Record<string, string>,
    unid: { DIARIO: ['dia', 'dias'], SEMANAL: ['semana', 'semanas'], QUINZENAL: ['quinzena', 'quinzenas'], MENSAL: ['mês', 'meses'] } as Record<string, [string, string]>,
    tipo: { NOVO: 'Empréstimo novo', RENOVACAO: 'Renovação', ADICIONAL: 'Adicional', RENEGOCIACAO: 'Renegociação' } as Record<string, string>,
    status: { QUITADO: 'Quitado', RENEGOCIADO: 'Renegociado', CANCELADO: 'Cancelado', VENCIDO: 'Vencido' } as Record<string, string>,
  },
  es: {
    emprestimo: 'Préstamo', recebido: 'Recibido', restante: 'Restante',
    pagas: (a: number | string, b: number) => `${a} de ${b} pagadas`,
    parciais: (n: number) => `${n} parcial${n === 1 ? '' : 'es'}`,
    creditoDisp: 'Crédito disponible',
    hojeRecebido: 'Recibido hoy',
    parcelasN: (n: number) => `${n} cuota${n === 1 ? '' : 's'}`,
    parcial: 'parcial', maisCredito: ' + crédito',
    quitadoHoje: 'LIQUIDADO hoy', recebHoje: 'Recibido hoy',
    multiAviso: 'Un cobro de varias cuotas no se reversa por cuota. Para deshacerlo, use Resetar cliente en Caja.',
    quitAviso: 'Para deshacer la liquidación, use Resetar cliente en Caja.',
    pagoHoje: 'Pagado hoy', pagoEm: 'Pagado el', quitacao: 'liquidación',
    parcialLeg: 'Parcial', hoje: 'hoy', falta: 'falta',
    gerouCredito: 'generó crédito', usouCredito: 'usó crédito',
    quitadoCredito: 'Liquidado por crédito',
    pago: 'Pagado', naoPago: 'No pagado', cancelada: 'Cancelada', pagar: 'Pagar',
    renovar: 'Renovar', renovado: 'Renovado',
    verFicha: 'Ver ficha completa',
    vazio: 'Ninguna cuota encontrada',
    freq: { DIARIO: 'diario', SEMANAL: 'semanal', QUINZENAL: 'quincenal', MENSAL: 'mensual', FLEXIVEL: 'flexible' } as Record<string, string>,
    unid: { DIARIO: ['día', 'días'], SEMANAL: ['semana', 'semanas'], QUINZENAL: ['quincena', 'quincenas'], MENSAL: ['mes', 'meses'] } as Record<string, [string, string]>,
    tipo: { NOVO: 'Préstamo nuevo', RENOVACAO: 'Renovación', ADICIONAL: 'Adicional', RENEGOCIACAO: 'Renegociación' } as Record<string, string>,
    status: { QUITADO: 'Liquidado', RENEGOCIADO: 'Renegociado', CANCELADO: 'Cancelado', VENCIDO: 'Vencido' } as Record<string, string>,
  },
};

const num = (v: unknown) => Number(v || 0);
const dinheiroDe = (pp: PagamentoDetalhe) => num(pp.valor_pago_total) - num(pp.valor_credito_usado);

export default function ParcelasModal({
  visible, onClose, clienteModal, parcelasModal, loadingParcelas,
  creditoDisponivel, liqId, isViz, lang = 'pt-BR',
  dataOperacional, emprestimo, jaRenovado = false,
  onPagar, onEstornar, onRenovar, onAbrirFicha, pagamentosDetalhados, t,
}: ParcelasModalProps) {
  const { vendedor } = useAuth();
  const mostrarCredito = useTrabalhaCredito();
  const [parcelaDetalhes, setParcelaDetalhes] = useState<ParcelaModal | null>(null);
  const tx = TX[lang] || TX['pt-BR'];

  const empStatus = String(emprestimo?.status || clienteModal?.emprestimo_status || '').toUpperCase();
  const encerrado = ['QUITADO', 'RENEGOCIADO', 'CANCELADO'].includes(empStatus);
  // Botão só com dia aberto e fora do modo visualização.
  const podeAgir = !!liqId && !isViz;

  const vivas = parcelasModal.filter(p => p.status !== 'CANCELADO');
  const pagsVivos = (id: string) => (pagamentosDetalhados?.get(id) || []).filter(pp => !pp.estornado);
  const pagsHoje = (id: string) => (liqId ? pagsVivos(id).filter(pp => pp.liquidacao_id === liqId) : []);

  // Operação → parcelas que ela cobre (só pagamentos vivos). Uma operação com
  // mais de uma parcela é recebimento múltiplo: não tem ↶.
  const parcelasPorOp = new Map<string, Set<string>>();
  parcelasModal.forEach(p => pagsVivos(p.parcela_id).forEach(pp => {
    if (!pp.operacao_id) return;
    const s = parcelasPorOp.get(pp.operacao_id) || new Set<string>();
    s.add(p.parcela_id);
    parcelasPorOp.set(pp.operacao_id, s);
  }));
  const ehMultiHoje = (p: ParcelaModal) =>
    pagsHoje(p.parcela_id).some(pp => !!pp.operacao_id && (parcelasPorOp.get(pp.operacao_id)?.size || 0) > 1);

  // ── Faixa "hoje" ──
  const parcelasHoje = parcelasModal.filter(p => pagsHoje(p.parcela_id).length > 0);
  const todosHoje = parcelasHoje.flatMap(p => pagsHoje(p.parcela_id));
  const valorHoje = todosHoje.reduce((s, pp) => s + dinheiroDe(pp), 0);
  const geradoHoje = todosHoje.some(pp => num(pp.valor_credito_gerado) > 0);
  const ultimoHoje = todosHoje.reduce<string | null>((m, pp) => (!m || pp.created_at > m ? pp.created_at : m), null);
  const temMultiHoje = parcelasHoje.some(ehMultiHoje);
  const quitadoHoje = empStatus === 'QUITADO' && parcelasHoje.length > 0;
  const rotuloHoje = parcelasHoje.length === 1 && parcelasHoje[0].status !== 'PAGO'
    ? tx.parcial
    : tx.parcelasN(parcelasHoje.length) + (geradoHoje && mostrarCredito ? tx.maisCredito : '');

  // ↶: parcela paga no dia aberto, fora de recebimento múltiplo, empréstimo
  // ainda aberto. Só a de maior número fica ativa.
  const estornaveis = podeAgir && !encerrado
    ? parcelasHoje.filter(p => !ehMultiHoje(p))
    : [];
  const ultimaEstornavel = estornaveis.reduce((m, p) => Math.max(m, p.numero_parcela), 0);

  // Pagar: a primeira em aberto, se ela não tiver ↶.
  const ordenadas = [...vivas].sort((a, b) => a.numero_parcela - b.numero_parcela);
  const primeiraAberta = ordenadas.find(p => p.status !== 'PAGO');
  const idPagar = podeAgir && !encerrado && primeiraAberta && pagsHoje(primeiraAberta.parcela_id).length === 0
    ? primeiraAberta.parcela_id : null;

  // ── Resumo ──
  const qtdTotal = vivas.length;
  const qtdPagas = vivas.filter(p => p.status === 'PAGO').length;
  const qtdParciais = vivas.filter(p => p.status !== 'PAGO' && num(p.valor_pago) > 0).length;
  const valorTotal = num(emprestimo?.valor_total);
  const restante = Math.max(0, num(emprestimo?.valor_saldo));
  // Recebido sai do SALDO, não da soma de pagamentos: é a regra da Ficha
  // (importação sem pagamento registrado daria 0 recebido num empréstimo meio
  // quitado), e faz Recebido + Restante fechar no total por construção.
  const recebido = Math.max(0, valorTotal - restante);
  const progresso = valorTotal > 0 ? Math.min(1, recebido / valorTotal) : (qtdTotal > 0 ? qtdPagas / qtdTotal : 0);
  const primeiraVenc = ordenadas[0]?.data_vencimento;
  const ultimaVenc = ordenadas[ordenadas.length - 1]?.data_vencimento;
  const freq = String(emprestimo?.frequencia_pagamento || '').toUpperCase();
  const unid = tx.unid[freq];
  const duracao = unid && qtdTotal > 0 ? ` · ${qtdTotal} ${qtdTotal === 1 ? unid[0] : unid[1]}` : '';
  const valorParcelaTipica = ordenadas[0]?.valor_parcela || 0;
  // Sem crédito à vista, a contagem é em EQUIVALENTE: o pago a mais vira
  // fração ("1,5 de 24 pagas"). Ver utils/creditoEmTela.
  const pagasEquiv = parcelasPagasEquivalentes(valorTotal, restante, valorParcelaTipica, qtdTotal);
  const subtitulo = [
    tx.tipo[String(emprestimo?.tipo_emprestimo || '').toUpperCase()],
    tx.status[empStatus],
  ].filter(Boolean).join(' · ');

  const mostrarRenovar = empStatus === 'QUITADO' && !!onRenovar;
  const renovarOff = jaRenovado || !podeAgir;

  const renderLinha = (p: ParcelaModal, idx: number) => {
    const cancelada = p.status === 'CANCELADO';
    const pago = p.status === 'PAGO';
    const vPago = num(p.valor_pago);
    const parcial = !pago && !cancelada && vPago > 0;
    // Vencida pela DATA OPERACIONAL, nunca pelo status persistido (o gatilho
    // grava contra CURRENT_DATE). `<`: a que vence no próprio dia está no prazo.
    const vencida = !pago && !parcial && !cancelada && !!p.data_vencimento
      && String(p.data_vencimento).substring(0, 10) < dataOperacional;
    const hojePags = pagsHoje(p.parcela_id);
    const pagaHoje = hojePags.length > 0;
    const multi = ehMultiHoje(p);
    const autoQuit = (p.observacoes || '').includes('[AUTO-QUITAÇÃO]');
    const vivos = pagsVivos(p.parcela_id);

    // Legenda: tudo o que não é o valor da parcela.
    const legenda: string[] = [];
    if (pagaHoje) {
      const h = hora(hojePags[hojePags.length - 1].created_at);
      const dHoje = hojePags.reduce((s, pp) => s + dinheiroDe(pp), 0);
      if (parcial) {
        legenda.push(`${tx.parcialLeg} · ${tx.hoje}${h ? ' ' + h : ''} · ${numeroBr(dHoje)} · ${tx.falta} ${numeroBr(num(p.valor_saldo))}`);
      } else if (multi) {
        legenda.push(`${tx.pagoHoje} · ${tx.quitacao}`);
      } else {
        const difere = Math.abs(dHoje - num(p.valor_parcela)) > 0.009;
        legenda.push(`${tx.pagoHoje}${h ? ' ' + h : ''}${difere ? ' · ' + numeroBr(dHoje) : ''}`);
      }
    } else if (pago || parcial) {
      // Dia em que foi paga = dia da LIQUIDAÇÃO do último pagamento vivo, não
      // o relógio do registro (régua do tempo).
      const ultimo = vivos[vivos.length - 1];
      const dia = ultimo?.data_liquidacao || p.data_liquidacao || p.data_pagamento;
      // Sem crédito à vista, quitada pelo adiantamento é só "paga em".
      if (autoQuit && mostrarCredito) legenda.push(tx.quitadoCredito);
      else if (parcial) legenda.push(`${tx.parcialLeg} · ${numeroBr(vPago)} · ${tx.falta} ${numeroBr(num(p.valor_saldo))}`);
      else if (dia) legenda.push(`${tx.pagoEm} ${diaMes(dia)}`);
    }
    const gerado = vivos.reduce((s, pp) => s + num(pp.valor_credito_gerado), 0);
    const usado = vivos.reduce((s, pp) => s + num(pp.valor_credito_usado), 0);
    const credLeg: string[] = [];
    if (gerado > 0 && !autoQuit && mostrarCredito) credLeg.push(`${tx.gerouCredito} ${numeroBr(gerado)}`);
    if (usado > 0 && !autoQuit && mostrarCredito) credLeg.push(`${tx.usouCredito} ${numeroBr(usado)}`);

    const circ = cancelada ? R.cNeu : pago ? R.cOk : parcial ? R.cWarn : vencida ? R.cBad : R.cNeu;
    const circTx = cancelada ? R.cNeuTx : pago ? R.cOkTx : parcial ? R.cWarnTx : vencida ? R.cBadTx : R.cNeuTx;

    const temEstorno = estornaveis.some(x => x.parcela_id === p.parcela_id);
    const estornoAtivo = temEstorno && p.numero_parcela === ultimaEstornavel;
    const temPagar = idPagar === p.parcela_id;
    const temDetalhes = !!pagamentosDetalhados && (pago || parcial || vivos.length > 0);

    let direita: React.ReactNode;
    if (temEstorno) {
      direita = (
        <TouchableOpacity
          style={[R.btn, R.btnRed, !estornoAtivo && R.btnOff]}
          disabled={!estornoAtivo}
          onPress={() => onEstornar(p)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="arrow-undo" size={15} color="#DC2626" />
        </TouchableOpacity>
      );
    } else if (temPagar) {
      direita = (
        <TouchableOpacity style={[R.btn, R.btnGreen]} onPress={() => onPagar(p)}>
          <Text style={R.btnGreenTx}>$ {tx.pagar}</Text>
        </TouchableOpacity>
      );
    } else {
      const [pillBg, pillCor, pillTx] = cancelada ? ['#E5E7EB', '#6B7280', tx.cancelada]
        : pago ? ['#D1FAE5', '#059669', tx.pago]
        : parcial ? ['#FEF3C7', '#D97706', tx.parcialLeg]
        : ['#E5E7EB', '#6B7280', tx.naoPago];
      direita = (
        <View style={[R.pill, { backgroundColor: pillBg }]}>
          <Text style={[R.pillTx, { color: pillCor }]}>{pillTx}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={p.parcela_id}
        style={[R.linha, idx > 0 && R.linhaBorda, cancelada && { opacity: 0.55 }]}
        activeOpacity={temDetalhes ? 0.6 : 1}
        onPress={() => { if (temDetalhes) setParcelaDetalhes(p); }}
      >
        <View style={[R.circ, circ]}>
          <Text style={[R.circTx, circTx]}>{p.numero_parcela}</Text>
        </View>
        <View style={R.meio}>
          <Text style={R.venc}>{diaMes(p.data_vencimento)}</Text>
          {legenda.map((l, i) => <Text key={i} style={R.leg}>{l}</Text>)}
          {credLeg.map((l, i) => <Text key={'c' + i} style={R.legCred}>{l}</Text>)}
        </View>
        <Text style={[R.valor, cancelada && { textDecorationLine: 'line-through' }]}>{numeroBr(p.valor_parcela)}</Text>
        {direita}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={R.overlay}>
          <View style={R.caixa}>
            {/* Cabeçalho */}
            <View style={R.cab}>
              <View style={R.cabTextos}>
                <Text style={R.cabNome} numberOfLines={1}>{clienteModal?.nome || ''}</Text>
                {!!subtitulo && <Text style={R.cabSub}>{subtitulo}</Text>}
              </View>
              <TouchableOpacity onPress={onClose} style={R.cabFechar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={R.corpo} contentContainerStyle={R.corpoConteudo} showsVerticalScrollIndicator={false}>
              {loadingParcelas ? (
                <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 40 }} />
              ) : parcelasModal.length === 0 ? (
                <Text style={R.vazio}>{tx.vazio}</Text>
              ) : (
                <>
                  {/* Resumo */}
                  {emprestimo && (
                    <View style={R.topo}>
                      <View style={R.topoLinha}>
                        <View style={R.topoEsq}>
                          <Text style={R.topoRot}>{tx.emprestimo}</Text>
                          <Text style={R.topoGrande}>{numeroBr(emprestimo.valor_principal)}</Text>
                          <Text style={R.topoRot}>
                            {qtdTotal} × {numeroBr(valorParcelaTipica)}{tx.freq[freq] ? ` · ${tx.freq[freq]}` : ''}
                          </Text>
                        </View>
                        <View style={R.topoDir}>
                          <View style={R.kv}>
                            <Text style={R.topoRot}>{tx.recebido}</Text>
                            <Text style={R.topoValor}>{numeroBr(recebido)}</Text>
                          </View>
                          <View style={R.kv}>
                            <Text style={R.topoRot}>{tx.restante}</Text>
                            <Text style={R.topoValor}>{numeroBr(restante)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={R.barra}>
                        <View style={[R.barraFill, { width: `${Math.round(progresso * 100)}%` }]} />
                      </View>
                      <View style={R.topoRodape}>
                        <Text style={R.topoRodapeTx}>
                          {!mostrarCredito && pagasEquiv != null
                            ? tx.pagas(fracaoBr(pagasEquiv), qtdTotal)
                            : `${tx.pagas(qtdPagas, qtdTotal)}${qtdParciais > 0 ? ` · ${tx.parciais(qtdParciais)}` : ''}`}
                        </Text>
                        {!!primeiraVenc && (
                          <Text style={R.topoRodapeTx}>
                            {diaMes(primeiraVenc)} → {diaMes(ultimaVenc)}{duracao}
                          </Text>
                        )}
                      </View>
                      {creditoDisponivel > 0.009 && mostrarCredito && (
                        <View style={R.topoCredito}>
                          <Text style={R.topoCreditoRot}>{tx.creditoDisp}</Text>
                          <Text style={R.topoCreditoVal}>{numeroBr(creditoDisponivel)}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Faixa do dia */}
                  {parcelasHoje.length > 0 && (temMultiHoje || quitadoHoje) ? (
                    <View style={R.faixaQuit}>
                      <View style={R.kv}>
                        <Text style={R.faixaRot}>
                          {quitadoHoje ? `✓ ${tx.quitadoHoje}` : tx.recebHoje}{ultimoHoje ? ' ' + hora(ultimoHoje) : ''}
                        </Text>
                        <Text style={R.faixaVal}>{numeroBr(valorHoje)} · {tx.parcelasN(parcelasHoje.length)}</Text>
                      </View>
                      <Text style={R.faixaAviso}>{temMultiHoje ? tx.multiAviso : tx.quitAviso}</Text>
                    </View>
                  ) : parcelasHoje.length > 0 ? (
                    <View style={R.faixaHoje}>
                      <Text style={R.faixaHojeRot}>{tx.hojeRecebido}</Text>
                      <Text style={R.faixaVal}>{numeroBr(valorHoje)} · {rotuloHoje}</Text>
                    </View>
                  ) : null}

                  {/* Lista */}
                  <View style={R.lista}>
                    {[...parcelasModal]
                      .sort((a, b) => a.numero_parcela - b.numero_parcela)
                      .map((p, i) => renderLinha(p, i))}
                  </View>

                  {mostrarRenovar && (
                    <TouchableOpacity
                      style={[R.btnLargo, renovarOff && R.btnOff]}
                      disabled={renovarOff}
                      onPress={() => onRenovar && onRenovar()}
                    >
                      <Text style={R.btnLargoTx}>{jaRenovado ? `✓ ${tx.renovado}` : `↻ ${tx.renovar}`}</Text>
                    </TouchableOpacity>
                  )}

                  {!!onAbrirFicha && (
                    <TouchableOpacity style={R.linkFicha} onPress={onAbrirFicha}>
                      <Ionicons name="document-text-outline" size={14} color="#4338CA" />
                      <Text style={R.linkFichaTx}>{tx.verFicha}</Text>
                      <Ionicons name="chevron-forward" size={13} color="#818CF8" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Popup de detalhes — fora do modal principal para sobrepor corretamente */}
      <DetalhesPopup
        visible={!!parcelaDetalhes}
        onClose={() => setParcelaDetalhes(null)}
        parcela={parcelaDetalhes}
        pagamentos={
          parcelaDetalhes && pagamentosDetalhados
            ? (pagamentosDetalhados.get(parcelaDetalhes.parcela_id) || [])
            : []
        }
        clienteId={clienteModal?.id || null}
        dataOperacional={dataOperacional}
        lang={lang}
        podeAnexar={!isViz}
        enviadoPor={vendedor?.user_id || null}
        enviadoPorNome={vendedor?.nome || null}
        t={t}
      />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
// Rótulos cedem largura (flexShrink: 1); valores ficam rígidos — dinheiro não
// quebra no meio. Ver "No mobile, linha que não cede largura CORTA o número".

const R = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  caixa: { width: '94%', maxHeight: '90%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },

  cab: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1F2937', paddingHorizontal: 14, paddingVertical: 12 },
  cabTextos: { flex: 1, flexShrink: 1 },
  cabNome: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cabSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  cabFechar: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  corpo: { flexGrow: 0 },
  corpoConteudo: { padding: 12, gap: 10 },
  vazio: { textAlign: 'center', color: '#9CA3AF', marginVertical: 40 },

  // Resumo
  topo: { backgroundColor: '#1E40AF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  topoLinha: { flexDirection: 'row', gap: 12 },
  topoEsq: { flex: 1, flexShrink: 1 },
  topoDir: { flex: 1, flexShrink: 1, justifyContent: 'center', gap: 2, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.25)', paddingLeft: 10 },
  topoRot: { fontSize: 11, color: 'rgba(255,255,255,0.75)', flexShrink: 1 },
  topoGrande: { fontSize: 20, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  topoValor: { fontSize: 13, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  barra: { height: 6, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, overflow: 'hidden' },
  barraFill: { height: '100%', backgroundColor: '#34D399' },
  topoRodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8, rowGap: 2 },
  topoRodapeTx: { fontSize: 11, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  topoCredito: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 6 },
  topoCreditoRot: { fontSize: 12, color: '#DDD6FE', flexShrink: 1 },
  topoCreditoVal: { fontSize: 12, fontWeight: '700', color: '#DDD6FE', fontVariant: ['tabular-nums'] },

  // Faixas
  faixaHoje: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  faixaHojeRot: { fontSize: 12, color: '#059669', flexShrink: 1 },
  faixaQuit: { backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  faixaRot: { fontSize: 12, fontWeight: '700', color: '#059669', flexShrink: 1 },
  faixaVal: { fontSize: 12, fontWeight: '700', color: '#059669', fontVariant: ['tabular-nums'] },
  faixaAviso: { fontSize: 11, color: '#374151' },

  // Lista
  lista: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  linhaBorda: { borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  circ: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  circTx: { fontSize: 11, fontWeight: '700' },
  cOk: { backgroundColor: '#D1FAE5' }, cOkTx: { color: '#059669' },
  cWarn: { backgroundColor: '#FEF3C7' }, cWarnTx: { color: '#D97706' },
  cBad: { backgroundColor: '#FEE2E2' }, cBadTx: { color: '#DC2626' },
  cNeu: { backgroundColor: '#E5E7EB' }, cNeuTx: { color: '#6B7280' },
  meio: { flex: 1, flexShrink: 1, minWidth: 0 },
  venc: { fontSize: 13, color: '#111827' },
  leg: { fontSize: 11, color: '#6B7280', flexShrink: 1 },
  legCred: { fontSize: 11, color: '#7C3AED', flexShrink: 1 },
  valor: { fontSize: 13, color: '#111827', fontVariant: ['tabular-nums'] },

  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  pillTx: { fontSize: 10, fontWeight: '700' },
  btn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  btnRed: { borderColor: '#DC2626' },
  btnGreen: { backgroundColor: '#059669', borderColor: '#059669' },
  btnGreenTx: { fontSize: 12, fontWeight: '700', color: '#fff' },
  btnOff: { opacity: 0.45 },

  btnLargo: { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnLargoTx: { fontSize: 14, fontWeight: '700', color: '#fff' },

  linkFicha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  linkFichaTx: { fontSize: 13, fontWeight: '600', color: '#4338CA', flexShrink: 1 },
});
