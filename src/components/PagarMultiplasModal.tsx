import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParcelaMultipla {
  parcela_id: string;
  numero_parcela: number;
  data_vencimento: string;
  valor_parcela: number;
  valor_pago?: number;
  valor_saldo?: number;
  status: string;
}

interface PagarMultiplasModalProps {
  visible: boolean;
  onClose: () => void;
  clienteNome: string;
  totalParcelas: number;
  parcelas: ParcelaMultipla[];
  parcelaAtualId: string;
  creditoDisponivel: number;
  saldoEmprestimo: number;
  totalPagoEmprestimo: number;
  valorTotalEmprestimo: number;
  processando: boolean;
  // Recebe: parcelas selecionadas (ordem), total em espécie
  // Passa os itens calculados: cada um com a parcela, o valor a pagar em espécie
  // (exibido) e a zona ('credito' = coberta pelo crédito, não paga em espécie).
  onConfirmar: (itens: { parcela: ParcelaMultipla; valorEspecie: number; zona: string; credito: number }[], totalEspecie: number) => void;
  t: {
    parcela: string;
    pagarVariasTitulo?: string;
    parcelasLbl?: string;
    creditoDisponivelLbl?: string;
    selecioneEspecie?: string;
    pagaLbl?: string;
    creditoLbl?: string;
    parcelasEspecie?: string;
    totalPagarEspecie?: string;
    avancar?: string;
    voltar?: string;
    confirmar?: string;
    confirmarPagamento?: string;
    cancelar?: string;
    emprestimoLbl?: string;
    jaPagoLbl?: string;
    estePagamento?: string;
    novoSaldoLbl?: string;
    creditoLinhaLbl?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Componente ─────────────────────────────────────────────────────────────

export default function PagarMultiplasModal({
  visible,
  onClose,
  clienteNome,
  totalParcelas,
  parcelas,
  parcelaAtualId,
  creditoDisponivel,
  saldoEmprestimo,
  totalPagoEmprestimo,
  valorTotalEmprestimo,
  processando,
  onConfirmar,
  t,
}: PagarMultiplasModalProps) {
  const [confirmando, setConfirmando] = useState(false);
  // Quantidade de parcelas selecionadas (a partir da 1ª em aberto, contíguo).
  // 0 = nenhuma. N = as N primeiras parcelas em aberto.
  const [qtdSelecionada, setQtdSelecionada] = useState(0);

  // Parcelas pagas e em aberto (ordenadas)
  const { pagas, emAberto } = useMemo(() => {
    const pg = parcelas
      .filter(p => p.status === 'PAGO')
      .sort((a, b) => a.numero_parcela - b.numero_parcela);
    const ab = parcelas
      .filter(p => ['PENDENTE', 'PARCIAL', 'VENCIDO'].includes(p.status))
      .sort((a, b) => a.numero_parcela - b.numero_parcela);
    return { pagas: pg, emAberto: ab };
  }, [parcelas]);

  // Inicializa: 1 parcela selecionada (a atual = 1ª em aberto) ao abrir
  React.useEffect(() => {
    if (visible) {
      // Descobre a posição da parcela atual entre as em aberto
      const idx = emAberto.findIndex(p => p.parcela_id === parcelaAtualId);
      setQtdSelecionada(idx >= 0 ? idx + 1 : (emAberto.length > 0 ? 1 : 0));
      setConfirmando(false);
    }
  }, [visible, parcelaAtualId, emAberto]);

  // Ao tocar numa parcela em aberto (posição i, 0-based): seleciona da 1ª até ela
  const selecionarAte = (posicao: number) => {
    const novaQtd = posicao + 1;
    // Se tocar na última já selecionada, desmarca ela (reduz em 1)
    if (novaQtd === qtdSelecionada) {
      setQtdSelecionada(posicao); // desmarca a atual, mantém as anteriores
    } else {
      setQtdSelecionada(novaQtd);
    }
  };

  // As parcelas selecionadas são as primeiras `qtdSelecionada` em aberto
  const selecionadas = emAberto.slice(0, qtdSelecionada);

  // ── Cálculo: cada parcela mostra o SALDO. Crédito recai na ÚLTIMA parcela ──
  // do EMPRÉSTIMO (não da seleção), cascateando do fim pra trás. Só as parcelas
  // SELECIONADAS entram no total em espécie e no crédito usado.
  const calc = useMemo(() => {
    // Monta todas as em aberto com saldo e marca quais estão selecionadas
    const arr = emAberto.map((p, i) => ({
      parcela: p,
      sel: i < qtdSelecionada,
      saldo: Number(p.valor_saldo ?? p.valor_parcela),
      exibido: Number(p.valor_saldo ?? p.valor_parcela),
      zona: 'normal' as 'normal' | 'fronteira' | 'credito',
      cred: 0,
    }));
    // Cascata do crédito a partir da ÚLTIMA parcela do EMPRÉSTIMO (fim de arr)
    let rest = creditoDisponivel;
    for (let i = arr.length - 1; i >= 0 && rest > 0; i--) {
      const saldo = arr[i].saldo;
      if (rest >= saldo) {
        arr[i].exibido = 0; arr[i].zona = 'credito'; arr[i].cred = saldo; rest -= saldo;
      } else {
        arr[i].exibido = saldo - rest; arr[i].zona = 'fronteira'; arr[i].cred = rest; rest = 0;
      }
    }
    // Total e crédito usado contam SÓ as selecionadas
    const total = arr.reduce((s, x) => s + (x.sel ? x.exibido : 0), 0);
    const creditoUsado = arr.reduce((s, x) => s + (x.sel ? x.cred : 0), 0);
    return { arr, total, creditoUsado };
  }, [emAberto, qtdSelecionada, creditoDisponivel]);

  const totalEspecie = calc.total;
  const creditoUsado = calc.creditoUsado;
  const novoSaldo = Math.max(saldoEmprestimo - totalEspecie - creditoUsado, 0);
  const jaPagoDerivado = Math.max(valorTotalEmprestimo - saldoEmprestimo, 0);

  const handleAvancar = () => {
    if (qtdSelecionada === 0) return;
    setConfirmando(true);
  };

  const handleConfirmar = () => {
    const itens = calc.arr
      .filter(x => x.sel)
      .map(x => ({ parcela: x.parcela, valorEspecie: x.exibido, zona: x.zona, credito: x.cred }));
    onConfirmar(itens, totalEspecie);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={S.container}>
        <View style={S.header}>
          <Text style={S.titulo}>{t.pagarVariasTitulo || 'Pagar várias parcelas'}</Text>
          <TouchableOpacity onPress={onClose} style={S.closeBtn}>
            <Text style={S.closeX}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={S.cliente}>{clienteNome} · {totalParcelas} {t.parcelasLbl || 'parcelas'}</Text>

        {!confirmando ? (
          <>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
              {creditoDisponivel > 0 && (
                <View style={S.creditoBox}>
                  <Text style={S.creditoBoxLbl}>{t.creditoDisponivelLbl || 'Crédito disponível'}</Text>
                  <Text style={S.creditoBoxVal}>{fmt(creditoDisponivel)}</Text>
                </View>
              )}

              <Text style={S.hint}>{t.selecioneEspecie || 'Toque para selecionar até a parcela desejada'}</Text>

              {/* Parcelas pagas */}
              {pagas.map(p => (
                <View key={p.parcela_id} style={[S.linha, S.linhaPaga]}>
                  <View style={S.linhaEsq}>
                    <Text style={S.checkPaga}>✓</Text>
                    <Text style={S.linhaLbl}>{t.parcela} {p.numero_parcela}</Text>
                  </View>
                  <Text style={S.pagaTx}>{t.pagaLbl || 'Paga'}</Text>
                </View>
              ))}

              {/* Parcelas em aberto: mostram SALDO; crédito recai na última do
                  empréstimo (só visível/abatido nas parcelas SELECIONADAS) */}
              {emAberto.map((p, i) => {
                const sel = i < qtdSelecionada;
                const saldo = Number(p.valor_saldo ?? p.valor_parcela);
                const calcItem = calc.arr[i];
                // O crédito só é mostrado se a parcela está SELECIONADA.
                // Se não está selecionada, mostra o saldo normal (sem crédito).
                const valorExibido = sel ? calcItem.exibido : saldo;
                const zona = sel ? calcItem.zona : 'normal';
                const credNota = sel ? calcItem.cred : 0;
                const isCredito = zona === 'credito';
                const isFronteira = zona === 'fronteira';
                return (
                  <TouchableOpacity
                    key={p.parcela_id}
                    style={[
                      S.linha,
                      !sel && S.linhaOff,
                      sel && !isCredito && S.linhaSel,
                      sel && isCredito && S.linhaCredito,
                    ]}
                    onPress={() => selecionarAte(i)}
                    activeOpacity={0.7}
                  >
                    <View style={S.linhaEsq}>
                      <View style={[S.checkbox, sel && S.checkboxOn]}>
                        {sel && <Text style={S.checkboxIcon}>✓</Text>}
                      </View>
                      <View>
                        <Text style={[S.linhaLbl, isCredito && { color: '#4F46E5' }]}>
                          {t.parcela} {p.numero_parcela}
                          {Number(p.valor_pago || 0) > 0 && (
                            <Text style={S.pagoParcial}> ({t.pagoLbl || 'pago'} {fmt(Number(p.valor_pago))})</Text>
                          )}
                        </Text>
                        {isFronteira && credNota > 0 && (
                          <Text style={S.notaCredito}>− {fmt(credNota)} {t.creditoLinhaLbl || 'crédito'}</Text>
                        )}
                      </View>
                    </View>
                    {isCredito ? (
                      <Text style={S.creditoTag}>{t.creditoLbl || 'crédito'}</Text>
                    ) : (
                      <Text style={S.linhaValor}>{fmt(valorExibido)}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Rodapé */}
            <View style={S.rodape}>
              <View style={S.rodapeRow}>
                <Text style={S.rodapeLbl}>{t.parcelasEspecie || 'Parcelas selecionadas'}</Text>
                <Text style={S.rodapeVal}>{qtdSelecionada}</Text>
              </View>
              {creditoUsado > 0 && (
                <View style={S.rodapeRow}>
                  <Text style={[S.rodapeLbl, { color: '#4F46E5' }]}>{t.creditoLbl || 'Crédito aplicado'}</Text>
                  <Text style={[S.rodapeVal, { color: '#4F46E5' }]}>− {fmt(creditoUsado)}</Text>
                </View>
              )}
              <View style={S.rodapeTotalRow}>
                <Text style={S.rodapeTotalLbl}>{t.totalPagarEspecie || 'Total a pagar (espécie)'}</Text>
                <Text style={S.rodapeTotalVal}>{fmt(totalEspecie)}</Text>
              </View>
              <TouchableOpacity
                style={[S.btnAvancar, qtdSelecionada === 0 && S.btnDisabled]}
                onPress={handleAvancar}
                disabled={qtdSelecionada === 0}
              >
                <Text style={S.btnAvancarTx}>{t.avancar || 'Avançar'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ── Confirmação ── */
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={S.confTitulo}>{t.confirmarPagamento || 'Confirmar pagamento'}</Text>

            <View style={S.confBloco}>
              {selecionadas.map(p => (
                <View key={p.parcela_id} style={S.confLinha}>
                  <Text style={S.confLinhaLbl}>{t.parcela} {p.numero_parcela}</Text>
                  <Text style={S.confLinhaVal}>{fmt(Number(p.valor_parcela))}</Text>
                </View>
              ))}
            </View>

            <View style={S.confCenario}>
              <View style={S.confLinha}>
                <Text style={S.confLinhaLbl}>{t.emprestimoLbl || 'Empréstimo'}</Text>
                <Text style={S.confLinhaVal}>{fmt(valorTotalEmprestimo)}</Text>
              </View>
              <View style={S.confLinha}>
                <Text style={S.confLinhaLbl}>{t.jaPagoLbl || 'Já pago'}</Text>
                <Text style={S.confLinhaVal}>{fmt(jaPagoDerivado)}</Text>
              </View>
              {creditoUsado > 0 && (
                <View style={S.confLinha}>
                  <Text style={[S.confLinhaLbl, { color: '#4F46E5' }]}>{t.creditoLbl || 'Crédito usado'}</Text>
                  <Text style={[S.confLinhaVal, { color: '#4F46E5' }]}>{fmt(creditoUsado)}</Text>
                </View>
              )}
              <View style={S.confLinha}>
                <Text style={S.confLinhaLbl}>{t.estePagamento || 'Este pagamento (espécie)'}</Text>
                <Text style={[S.confLinhaVal, { fontWeight: '700' }]}>{fmt(totalEspecie)}</Text>
              </View>
              <View style={S.confDivider} />
              <View style={S.confLinha}>
                <Text style={S.confNovoLbl}>{t.novoSaldoLbl || 'Novo saldo'}</Text>
                <Text style={S.confNovoVal}>{fmt(novoSaldo)}</Text>
              </View>
            </View>

            <View style={S.confBotoes}>
              <TouchableOpacity style={S.btnVoltar} onPress={() => setConfirmando(false)} disabled={processando}>
                <Text style={S.btnVoltarTx}>{t.voltar || 'Voltar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.btnConfirmar, processando && { opacity: 0.5 }]} onPress={handleConfirmar} disabled={processando}>
                <Text style={S.btnConfirmarTx}>{t.confirmar || 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 4 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  closeX: { fontSize: 15, color: '#6B7280' },
  cliente: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginBottom: 8 },
  creditoBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 8, padding: 12, marginBottom: 14 },
  creditoBoxLbl: { fontSize: 13, color: '#4F46E5' },
  creditoBoxVal: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  hint: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 11, borderRadius: 8, marginBottom: 6 },
  linhaEsq: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linhaPaga: { backgroundColor: '#F9FAFB', opacity: 0.6 },
  linhaOff: { borderWidth: 0.5, borderColor: '#E5E7EB' },
  linhaSel: { borderWidth: 1.5, borderColor: '#6366F1' },
  linhaCredito: { borderWidth: 1.5, borderColor: '#6366F1', borderStyle: 'dashed', backgroundColor: '#EEF2FF' },
  creditoTag: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  linhaLbl: { fontSize: 14, color: '#1F2937' },
  linhaValor: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  checkPaga: { fontSize: 15, color: '#10B981' },
  pagaTx: { fontSize: 13, color: '#6B7280' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  checkboxIcon: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notaCredito: { fontSize: 11, color: '#4F46E5', marginTop: 2 },
  pagoParcial: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  rodape: { borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16 },
  rodapeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rodapeLbl: { fontSize: 14, color: '#6B7280' },
  rodapeVal: { fontSize: 14, color: '#1F2937' },
  rodapeTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  rodapeTotalLbl: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  rodapeTotalVal: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  btnAvancar: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnAvancarTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  confTitulo: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 14 },
  confBloco: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10 },
  confLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  confLinhaLbl: { fontSize: 14, color: '#6B7280' },
  confLinhaVal: { fontSize: 14, color: '#1F2937' },
  confCenario: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 16 },
  confDivider: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 6 },
  confNovoLbl: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  confNovoVal: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  confBotoes: { flexDirection: 'row', gap: 10 },
  btnVoltar: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnVoltarTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnConfirmar: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnConfirmarTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});