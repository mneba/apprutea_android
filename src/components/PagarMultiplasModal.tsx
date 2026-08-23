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
    vencLbl?: string;
    totalParcelasLbl?: string;
    receberAgoraLbl?: string;
    saldoAtualLbl?: string;
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

// Vencimento em dd/mm/aaaa. Datas puras YYYY-MM-DD são fatiadas na string (sem
// new Date) para não escorregar um dia por fuso.
const fmtVenc = (d?: string | null) => {
  if (!d) return '';
  const s = String(d).substring(0, 10);
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
};

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
  // Linhas selecionadas com o cálculo já feito (saldo/crédito), usadas na tela
  // de confirmação. `somaSaldos` = o que as parcelas realmente devem, ou seja
  // espécie + crédito — é o que abate do saldo do empréstimo.
  const selecionadasCalc = calc.arr.filter(x => x.sel);
  const somaSaldos = selecionadasCalc.reduce((s, x) => s + x.saldo, 0);
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
                    <View>
                      <Text style={S.linhaLbl}>{t.parcela} {p.numero_parcela}</Text>
                      {!!fmtVenc(p.data_vencimento) && (
                        <Text style={S.linhaVenc}>{t.vencLbl || 'Venc.'} {fmtVenc(p.data_vencimento)}</Text>
                      )}
                    </View>
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
                // O CRÉDITO é sempre mostrado (pontilhada/fronteira), mesmo que a
                // parcela não esteja selecionada — assim o vendedor vê onde está.
                // O valor exibido usa o cálculo do crédito sempre.
                const valorExibido = calcItem.exibido;
                const zona = calcItem.zona;
                const credNota = calcItem.cred;
                const isCredito = zona === 'credito';
                const isFronteira = zona === 'fronteira';
                return (
                  <TouchableOpacity
                    key={p.parcela_id}
                    style={[
                      S.linha,
                      !sel && !isCredito && S.linhaOff,
                      sel && !isCredito && S.linhaSel,
                      isCredito && S.linhaCredito,
                    ]}
                    onPress={() => selecionarAte(i)}
                    activeOpacity={0.7}
                  >
                    <View style={S.linhaEsq}>
                      {isCredito ? (
                        <View style={S.creditoIcone}>
                          <Text style={S.checkboxIcon}>✓</Text>
                        </View>
                      ) : (
                        <View style={[S.checkbox, sel && S.checkboxOn]}>
                          {sel && <Text style={S.checkboxIcon}>✓</Text>}
                        </View>
                      )}
                      <View>
                        <Text style={[S.linhaLbl, isCredito && { color: '#4F46E5' }]}>
                          {t.parcela} {p.numero_parcela}
                          {Number(p.valor_pago || 0) > 0 && (
                            <Text style={S.pagoParcial}> ({t.pagoLbl || 'pago'} {fmt(Number(p.valor_pago))})</Text>
                          )}
                        </Text>
                        {!!fmtVenc(p.data_vencimento) && (
                          <Text style={S.linhaVenc}>{t.vencLbl || 'Venc.'} {fmtVenc(p.data_vencimento)}</Text>
                        )}
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

            {/* 1) O que está sendo quitado — cada parcela pelo seu SALDO (não
                   pelo valor cheio: uma parcela parcial deve o que resta) e a
                   soma logo abaixo, para o vendedor não somar de cabeça. */}
            <View style={S.confBloco}>
              <Text style={S.confBlocoTit}>
                {t.parcelasLbl || 'Parcelas'} ({selecionadasCalc.length})
              </Text>
              {selecionadasCalc.map(x => (
                <View key={x.parcela.parcela_id} style={S.confLinha}>
                  <Text style={S.confLinhaLbl}>
                    {t.parcela} {x.parcela.numero_parcela}
                    {!!fmtVenc(x.parcela.data_vencimento) && (
                      <Text style={S.confLinhaVenc}>  ·  {fmtVenc(x.parcela.data_vencimento)}</Text>
                    )}
                  </Text>
                  <Text style={S.confLinhaVal}>{fmt(x.saldo)}</Text>
                </View>
              ))}
              <View style={S.confDivider} />
              <View style={S.confLinha}>
                <Text style={S.confSubTotLbl}>{t.totalParcelasLbl || 'Total das parcelas'}</Text>
                <Text style={S.confSubTotVal}>{fmt(somaSaldos)}</Text>
              </View>
              {creditoUsado > 0 && (
                <View style={S.confLinha}>
                  <Text style={[S.confLinhaLbl, { color: '#4F46E5' }]}>− {t.creditoLbl || 'Crédito aplicado'}</Text>
                  <Text style={[S.confLinhaVal, { color: '#4F46E5' }]}>{fmt(creditoUsado)}</Text>
                </View>
              )}
            </View>

            {/* 2) O número que importa na mão do vendedor: o dinheiro que ele
                   recebe agora. Fica sozinho, em destaque. */}
            <View style={S.confDestaque}>
              <Text style={S.confDestaqueLbl}>{t.receberAgoraLbl || 'Receber agora, em espécie'}</Text>
              <Text style={S.confDestaqueVal}>{fmt(totalEspecie)}</Text>
            </View>

            {/* 3) Efeito no saldo, como uma conta explícita. */}
            <View style={S.confCenario}>
              <View style={S.confLinha}>
                <Text style={S.confLinhaLbl}>{t.saldoAtualLbl || 'Saldo atual'}</Text>
                <Text style={S.confLinhaVal}>{fmt(saldoEmprestimo)}</Text>
              </View>
              <View style={S.confLinha}>
                <Text style={S.confLinhaLbl}>− {t.estePagamento || 'Este pagamento'}</Text>
                <Text style={S.confLinhaVal}>{fmt(somaSaldos)}</Text>
              </View>
              <View style={S.confDivider} />
              <View style={S.confLinha}>
                <Text style={S.confNovoLbl}>{t.novoSaldoLbl || 'Novo saldo'}</Text>
                <Text style={S.confNovoVal}>{fmt(novoSaldo)}</Text>
              </View>
            </View>

            {/* Contexto do empréstimo — informação de apoio, fora da conta. */}
            <Text style={S.confCtx}>
              {t.emprestimoLbl || 'Empréstimo'} {fmt(valorTotalEmprestimo)}
              {'   ·   '}
              {t.jaPagoLbl || 'Já pago'} {fmt(jaPagoDerivado)}
            </Text>

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
  creditoIcone: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  creditoTag: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  linhaLbl: { fontSize: 14, color: '#1F2937' },
  linhaVenc: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
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
  confLinhaVenc: { fontSize: 12, color: '#9CA3AF' },
  confLinhaVal: { fontSize: 14, color: '#1F2937' },
  confBlocoTit: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  confSubTotLbl: { fontSize: 14, fontWeight: '600', color: '#374151' },
  confSubTotVal: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  confDestaque: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 10, padding: 14, marginBottom: 10, alignItems: 'center' },
  confDestaqueLbl: { fontSize: 12, fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: 0.3 },
  confDestaqueVal: { fontSize: 28, fontWeight: '800', color: '#047857', marginTop: 4 },
  confCtx: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  confCenario: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 10 },
  confDivider: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 6 },
  confNovoLbl: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  confNovoVal: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  confBotoes: { flexDirection: 'row', gap: 10 },
  btnVoltar: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnVoltarTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnConfirmar: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnConfirmarTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});