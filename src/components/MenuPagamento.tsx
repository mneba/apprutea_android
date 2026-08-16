import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MenuPagamentoParcela {
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_saldo?: number;
  valor_pago?: number;
  status: string;
}

interface MenuPagamentoProps {
  visible: boolean;
  onClose: () => void;
  parcela: MenuPagamentoParcela | null;
  clienteNome: string;
  totalParcelas: number;
  saldoEmprestimo: number;
  creditoDisponivel: number;
  /** Pagamentos parciais desta parcela (data/liquidação/valor). */
  pagamentosParciais?: { valor: number; dataLiq: string | null }[];
  // Ações
  onPagarValor: (valor: number) => void;   // paga um valor (saldo, cheia ou livre) em espécie
  onUsarCredito: () => void;
  onPagarMultiplas: () => void;
  onQuitarEmprestimo: () => void;
  t: {
    parcela: string;
    menuTitulo?: string;
    vencimentoLbl?: string;
    pagamentosParciaisLbl?: string;
    liquidacaoLbl?: string;
    pagarSaldo?: string;
    pagar1Cheia?: string;
    valorLivre?: string;
    digitarLbl?: string;
    confirmar?: string;
    usarCredito?: string;
    usarCreditoResumo?: string;
    selecionarParcelas?: string;
    saldoTotalLbl?: string;
    creditoLbl?: string;
    pagarVarias?: string;
    quitarEmprestimo?: string;
    quantoPagar?: string;
    valorAcimaMax?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseValor = (s: string) => parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;

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

// ─── Componente ─────────────────────────────────────────────────────────────

type OpcaoRadio = 'saldo' | 'cheia' | 'livre' | 'credito' | 'multiplas' | 'quitar' | null;

export default function MenuPagamento({
  visible,
  onClose,
  parcela,
  clienteNome,
  totalParcelas,
  saldoEmprestimo,
  creditoDisponivel,
  pagamentosParciais,
  onPagarValor,
  onUsarCredito,
  onPagarMultiplas,
  onQuitarEmprestimo,
  t,
}: MenuPagamentoProps) {
  const [opcao, setOpcao] = useState<OpcaoRadio>(null);
  const [valorLivre, setValorLivre] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) { setOpcao(null); setValorLivre(''); setErro(null); }
  }, [visible]);

  const valorCheio = Number(parcela?.valor_parcela || 0);
  const valorSaldo = Number(parcela?.valor_saldo ?? parcela?.valor_parcela ?? 0);
  const jaPago = Number(parcela?.valor_pago || 0);
  // Parcela é parcial se já tem algo pago (mas não está quitada)
  const isParcial = jaPago > 0 && valorSaldo > 0;

  const parciais = (pagamentosParciais || []).filter(p => p.valor > 0);

  // Valor cheio limitado ao saldo do empréstimo (caso "matematicamente impossível")
  const valorCheioLimitado = (saldoEmprestimo > 0 && valorCheio > saldoEmprestimo) ? saldoEmprestimo : valorCheio;

  const confirmarValorLivre = () => {
    const v = parseValor(valorLivre);
    if (v <= 0) { setErro(t.quantoPagar || 'Informe um valor'); return; }
    if (v > saldoEmprestimo + 0.001) {
      setErro(`${t.valorAcimaMax || 'Valor acima do máximo:'} ${fmt(saldoEmprestimo)}`);
      return;
    }
    onPagarValor(v);
  };

  if (!visible || !parcela) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={S.folha}>
          <View style={S.handle} />

          <ScrollView>
            {/* Cabeçalho com avatar */}
            <View style={S.header}>
              <View style={S.avatar}>
                <Text style={S.avatarTx}>{(clienteNome || '?').split(' ').slice(0, 2).map(n => (n[0] || '')).join('').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.cliente} numberOfLines={1}>{clienteNome}</Text>
                <Text style={S.sub}>{t.parcela} {parcela.numero_parcela} · {parcela.numero_parcela}/{totalParcelas}</Text>
              </View>
            </View>

            {/* Histórico de parciais (só se parcial) */}
            {isParcial && parciais.length > 0 && (
              <View style={S.parcialBox}>
                <Text style={S.parcialTit}>{t.pagamentosParciaisLbl || 'Pagamentos parciais'}</Text>
                {parciais.map((p, i) => (
                  <View key={i} style={S.parcialLinha}>
                    <Text style={S.parcialTx}>{fmtData(p.dataLiq)} {p.dataLiq ? `· ${t.liquidacaoLbl || 'Liq.'} ${fmtData(p.dataLiq)}` : ''}</Text>
                    <Text style={S.parcialVal}>{fmt(p.valor)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Grupo de radios */}
            <View style={S.grupo}>
              {/* Saldo — só se parcial */}
              {isParcial && (
                <View style={[S.opcao, opcao === 'saldo' && S.opcaoSel]}>
                  <TouchableOpacity style={S.opcaoHead} onPress={() => setOpcao('saldo')} activeOpacity={0.7}>
                    <View style={S.opcaoEsq}>
                      <View style={[S.iconeBox, { backgroundColor: opcao === 'saldo' ? '#6366F1' : '#ECFDF5' }]}>
                        <Ionicons name="cash-outline" size={17} color={opcao === 'saldo' ? '#fff' : '#10B981'} />
                      </View>
                      <Text style={[S.opcaoLbl, opcao === 'saldo' && S.opcaoLblSel]}>{t.pagarSaldo || 'Pagar saldo'}</Text>
                    </View>
                    <Text style={S.opcaoVal}>{fmt(valorSaldo)}</Text>
                  </TouchableOpacity>
                  {opcao === 'saldo' && (
                    <TouchableOpacity style={S.btnConfirmar} onPress={() => onPagarValor(valorSaldo)}>
                      <Text style={S.btnConfirmarTx}>{t.confirmar || 'Confirmar'} {fmt(valorSaldo)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Cheia */}
              <View style={[S.opcao, opcao === 'cheia' && S.opcaoSel]}>
                <TouchableOpacity style={S.opcaoHead} onPress={() => setOpcao('cheia')} activeOpacity={0.7}>
                  <View style={S.opcaoEsq}>
                    <View style={[S.iconeBox, { backgroundColor: opcao === 'cheia' ? '#6366F1' : '#ECFDF5' }]}>
                      <Ionicons name="wallet-outline" size={17} color={opcao === 'cheia' ? '#fff' : '#10B981'} />
                    </View>
                    <Text style={[S.opcaoLbl, opcao === 'cheia' && S.opcaoLblSel]}>{t.pagar1Cheia || 'Pagar 1 parcela cheia'}</Text>
                  </View>
                  <Text style={S.opcaoVal}>{fmt(valorCheioLimitado)}</Text>
                </TouchableOpacity>
                {opcao === 'cheia' && (
                  <TouchableOpacity style={S.btnConfirmar} onPress={() => onPagarValor(valorCheioLimitado)}>
                    <Text style={S.btnConfirmarTx}>{t.confirmar || 'Confirmar'} {fmt(valorCheioLimitado)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Valor livre */}
              <View style={[S.opcao, opcao === 'livre' && S.opcaoSel]}>
                <TouchableOpacity style={S.opcaoHead} onPress={() => setOpcao('livre')} activeOpacity={0.7}>
                  <View style={S.opcaoEsq}>
                    <View style={[S.iconeBox, { backgroundColor: opcao === 'livre' ? '#6366F1' : '#F3F4F6' }]}>
                      <Ionicons name="create-outline" size={17} color={opcao === 'livre' ? '#fff' : '#6B7280'} />
                    </View>
                    <Text style={[S.opcaoLbl, opcao === 'livre' && S.opcaoLblSel]}>{t.valorLivre || 'Valor livre'}</Text>
                  </View>
                  <Text style={S.opcaoHint}>{t.digitarLbl || 'digitar'}</Text>
                </TouchableOpacity>
                {opcao === 'livre' && (
                  <View style={{ marginTop: 10 }}>
                    <View style={S.inputBox}>
                      <Text style={S.currency}>$</Text>
                      <TextInput
                        style={S.input}
                        value={valorLivre}
                        onChangeText={(v) => { setValorLivre(v); if (erro) setErro(null); }}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                        underlineColorAndroid="transparent"
                      />
                    </View>
                    {erro && <Text style={S.erro}>{erro}</Text>}
                    <TouchableOpacity style={S.btnConfirmar} onPress={confirmarValorLivre}>
                      <Text style={S.btnConfirmarTx}>{t.confirmar || 'Confirmar'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Usar crédito — radio com resumo + confirmar */}
              {creditoDisponivel > 0 && (
                <View style={[S.opcao, opcao === 'credito' && S.opcaoSel]}>
                  <TouchableOpacity style={S.opcaoHead} onPress={() => setOpcao('credito')} activeOpacity={0.7}>
                    <View style={S.opcaoEsq}>
                      <View style={[S.iconeBox, { backgroundColor: opcao === 'credito' ? '#6366F1' : '#EEF2FF' }]}>
                        <Ionicons name="card-outline" size={17} color={opcao === 'credito' ? '#fff' : '#4F46E5'} />
                      </View>
                      <Text style={[S.opcaoLbl, opcao === 'credito' && S.opcaoLblSel]}>{t.usarCredito || 'Usar crédito'}</Text>
                    </View>
                    <Text style={S.opcaoCred}>{fmt(creditoDisponivel)}</Text>
                  </TouchableOpacity>
                  {opcao === 'credito' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={S.resumoTx}>{t.usarCreditoResumo || 'O crédito será aplicado a partir desta parcela.'}</Text>
                      <TouchableOpacity style={S.btnConfirmar} onPress={onUsarCredito}>
                        <Text style={S.btnConfirmarTx}>{t.confirmar || 'Confirmar'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Pagar mais de 1 — radio que abre a folha de seleção */}
              <View style={[S.opcao, opcao === 'multiplas' && S.opcaoSel]}>
                <TouchableOpacity style={S.opcaoHead} onPress={() => setOpcao('multiplas')} activeOpacity={0.7}>
                  <View style={S.opcaoEsq}>
                    <View style={[S.iconeBox, { backgroundColor: opcao === 'multiplas' ? '#6366F1' : '#F3F4F6' }]}>
                      <Ionicons name="list-outline" size={17} color={opcao === 'multiplas' ? '#fff' : '#6B7280'} />
                    </View>
                    <Text style={[S.opcaoLbl, opcao === 'multiplas' && S.opcaoLblSel]}>{t.pagarVarias || 'Pagar mais de 1 parcela'}</Text>
                  </View>
                </TouchableOpacity>
                {opcao === 'multiplas' && (
                  <TouchableOpacity style={S.btnConfirmar} onPress={onPagarMultiplas}>
                    <Text style={S.btnConfirmarTx}>{t.selecionarParcelas || 'Selecionar parcelas'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Quitar empréstimo — radio com resumo + confirmar */}
              <View style={[S.opcao, S.opcaoQuitar, opcao === 'quitar' && S.opcaoQuitarSel]}>
                <TouchableOpacity style={S.opcaoHead} onPress={() => setOpcao('quitar')} activeOpacity={0.7}>
                  <View style={S.opcaoEsq}>
                    <View style={[S.iconeBox, { backgroundColor: opcao === 'quitar' ? '#DC2626' : '#FEE2E2' }]}>
                      <Ionicons name="checkmark-done-outline" size={17} color={opcao === 'quitar' ? '#fff' : '#DC2626'} />
                    </View>
                    <Text style={[S.opcaoLbl, { color: '#991B1B' }, opcao === 'quitar' && { fontWeight: '700' }]}>{t.quitarEmprestimo || 'Quitar empréstimo'}</Text>
                  </View>
                  <Text style={[S.opcaoVal, { color: '#991B1B' }]}>{fmt(saldoEmprestimo)}</Text>
                </TouchableOpacity>
                {opcao === 'quitar' && (
                  <View style={{ marginTop: 10 }}>
                    <View style={S.resumoLinha}>
                      <Text style={S.resumoLbl}>{t.saldoTotalLbl || 'Saldo do empréstimo'}</Text>
                      <Text style={S.resumoVal}>{fmt(saldoEmprestimo)}</Text>
                    </View>
                    {creditoDisponivel > 0 && (
                      <View style={S.resumoLinha}>
                        <Text style={[S.resumoLbl, { color: '#4F46E5' }]}>{t.creditoLbl || 'Crédito disponível'}</Text>
                        <Text style={[S.resumoVal, { color: '#4F46E5' }]}>{fmt(creditoDisponivel)}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={[S.btnConfirmar, S.btnQuitar]} onPress={onQuitarEmprestimo}>
                      <Text style={S.btnConfirmarTx}>{t.confirmar || 'Confirmar'} {fmt(saldoEmprestimo)}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  folha: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 18, paddingBottom: 24, maxHeight: '88%' },
  handle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 99, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarTx: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cliente: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  parcialBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 14 },
  parcialTit: { fontSize: 11, fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  parcialLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  parcialTx: { fontSize: 12, color: '#92400E' },
  parcialVal: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  grupo: { marginTop: 12 },
  opcao: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 13, marginBottom: 9 },
  opcaoSel: { borderWidth: 2, borderColor: '#6366F1', backgroundColor: '#F5F3FF', shadowColor: '#6366F1', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  opcaoQuitar: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  opcaoQuitarSel: { borderWidth: 2, borderColor: '#DC2626', backgroundColor: '#FEF2F2', shadowColor: '#DC2626', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  opcaoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opcaoEsq: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconeBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#9CA3AF' },
  radioOn: { borderWidth: 5, borderColor: '#6366F1' },
  opcaoLbl: { fontSize: 14, color: '#1F2937' },
  opcaoLblSel: { fontWeight: '700' },
  opcaoVal: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  opcaoHint: { fontSize: 12, color: '#9CA3AF' },
  opcaoCred: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  resumoTx: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  resumoLbl: { fontSize: 13, color: '#6B7280' },
  resumoVal: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  btnConfirmar: { backgroundColor: '#10B981', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 11, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  btnConfirmarTx: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnQuitar: { backgroundColor: '#DC2626', shadowColor: '#DC2626' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8, width: '100%', overflow: 'hidden' },
  currency: { fontSize: 18, fontWeight: '700', color: '#6B7280', marginRight: 8 },
  input: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1F2937', padding: 0, height: 30, minWidth: 0 },
  erro: { fontSize: 12, color: '#DC2626', marginTop: 6 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },
  outras: {},
  outraBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  outraTx: { fontSize: 14, color: '#1F2937' },
  outraCred: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
});