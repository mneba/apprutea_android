import React from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from './texto';
import { Language } from '../contexts/LiquidacaoContext';
import { data as fmtData, moeda } from '../utils/formato';

const fmt = (v: number) => moeda(v);

interface ParcelaEstorno {
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago?: number;
  credito_usado?: number;
}

// Um RECEBIMENTO — um ato do vendedor, 1 para 1 com o lançamento em
// `financeiro`. Uma parcela pode ter vários, de dias diferentes, e até
// 13/11/2026 o estorno apagava TODOS eles: era o desastre de 02/10/2026.
// `operacao_id` está preenchido em 41.567 de 41.567 pagamentos vivos
// (medido em 14/11/2026), por isso aqui ele não é nulável.
// Ver sql/2026-11-14_estorno_mira_a_operacao.sql
export interface RecebimentoEstorno {
  operacao_id: string;
  data_pagamento: string | null;
  valor: number;
  credito_usado: number;
  forma_pagamento: string | null;
}

interface ListaRecebimentosProps {
  recebimentos: RecebimentoEstorno[];
  escolhido: string | null;
  onEscolher: (operacaoId: string) => void;
  lang: Language;
}

// Só aparece com DOIS ou mais. Com um recebimento a tela não muda —
// 1.170 das 1.358 parcelas multi-recebimento têm exatamente dois, mas a
// cauda vai até 22, então isto é lista com rolagem e não Alert.
export function ListaRecebimentos({ recebimentos, escolhido, onEscolher, lang }: ListaRecebimentosProps) {
  if (recebimentos.length < 2) return null;
  return (
    <View style={S.recBox}>
      <Text style={S.recTitulo}>
        {lang === 'es'
          ? 'Esta cuota tiene varios recibos. Elija el que desea deshacer:'
          : 'Esta parcela tem vários recebimentos. Escolha o que quer desfazer:'}
      </Text>
      <ScrollView style={S.recLista} nestedScrollEnabled>
        {recebimentos.map((r) => {
          const sel = r.operacao_id === escolhido;
          return (
            <TouchableOpacity
              key={r.operacao_id}
              style={[S.recItem, sel && S.recItemSel]}
              onPress={() => onEscolher(r.operacao_id)}
            >
              {/* Cede largura: o número à direita não pode ser cortado. */}
              <View style={S.recEsq}>
                <Text style={[S.recData, sel && S.recTxSel]}>
                  {sel ? '◉  ' : '○  '}
                  {r.data_pagamento ? fmtData(r.data_pagamento) : '—'}
                </Text>
                {!!r.forma_pagamento && (
                  <Text style={S.recForma}>{r.forma_pagamento}</Text>
                )}
              </View>
              <Text style={[S.recValor, sel && S.recTxSel]}>{fmt(r.valor)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={S.recNota}>
        {lang === 'es'
          ? 'Los demás recibos siguen intactos.'
          : 'Os outros recebimentos continuam intactos.'}
      </Text>
    </View>
  );
}

interface EstornoModalProps {
  visible: boolean;
  onClose: () => void;
  parcela: ParcelaEstorno | null;
  clienteNome: string;
  motivoEstorno: string;
  setMotivoEstorno: (v: string) => void;
  processando: boolean;
  onConfirmar: () => void;
  recebimentos?: RecebimentoEstorno[];
  operacaoEscolhida?: string | null;
  setOperacaoEscolhida?: (operacaoId: string) => void;
  lang: Language;
  t: {
    estornarPagamento: string;
    parcela: string;
    pago: string;
    motivoEstorno: string;
    cancelar: string;
    confirmarEstorno: string;
  };
}

export default function EstornoModal({
  visible,
  onClose,
  parcela,
  clienteNome,
  motivoEstorno,
  setMotivoEstorno,
  processando,
  onConfirmar,
  recebimentos = [],
  operacaoEscolhida = null,
  setOperacaoEscolhida,
  lang,
  t,
}: EstornoModalProps) {
  const varios = recebimentos.length > 1;
  const escolhido = varios ? recebimentos.find((r) => r.operacao_id === operacaoEscolhida) : null;
  const faltaEscolher = varios && !escolhido;
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalEstorno}>
          <View style={S.estHeader}>
            <Text style={S.estHeaderIcon}>↩</Text>
            <Text style={S.estHeaderTitle}>{t.estornarPagamento}</Text>
            <TouchableOpacity onPress={onClose} style={S.modalClose}>
              <Text style={S.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>
          {parcela && (
            <>
              <View style={S.estInfo}>
                <Text style={S.estInfoParcela}>{t.parcela} {parcela.numero_parcela}</Text>
                <Text style={S.estInfoCliente}>{clienteNome}</Text>
                <Text style={S.estInfoValor}>{t.pago} {fmt(parcela.valor_pago || parcela.valor_parcela)}</Text>
                {varios && (
                  <Text style={S.estInfoDetalhe}>
                    {lang === 'es' ? 'Se deshará' : 'Será desfeito'}: {escolhido ? fmt(escolhido.valor) : '—'}
                  </Text>
                )}
                {/* Com vários recebimentos a decomposição é do ESCOLHIDO —
                    mostrar o crédito da parcela inteira aqui faria a conta
                    não fechar com o valor que vai ser desfeito. */}
                {(varios ? (escolhido?.credito_usado || 0) : (parcela.credito_usado || 0)) > 0 && (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#FCA5A5' }}>
                    <Text style={S.estInfoDetalhe}>
                      {lang === 'es' ? 'Efectivo' : 'Dinheiro'}: {fmt(
                        varios
                          ? (escolhido!.valor - escolhido!.credito_usado)
                          : ((parcela.valor_pago || 0) - (parcela.credito_usado || 0))
                      )}
                    </Text>
                    <Text style={S.estInfoDetalhe}>
                      {lang === 'es' ? 'Crédito usado (será devuelto)' : 'Crédito usado (será devolvido)'}: {fmt(
                        varios ? escolhido!.credito_usado : (parcela.credito_usado || 0)
                      )}
                    </Text>
                  </View>
                )}
              </View>
              {!!setOperacaoEscolhida && (
                <ListaRecebimentos
                  recebimentos={recebimentos}
                  escolhido={operacaoEscolhida}
                  onEscolher={setOperacaoEscolhida}
                  lang={lang}
                />
              )}
              <View style={S.estInputBox}>
                <Text style={S.estInputLabel}>{t.motivoEstorno}</Text>
                <TextInput
                  style={S.estInput}
                  value={motivoEstorno}
                  onChangeText={setMotivoEstorno}
                  placeholder={lang === 'es' ? 'Escriba el motivo...' : 'Digite o motivo...'}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={S.estBtns}>
                <TouchableOpacity style={S.estBtnCancel} onPress={onClose}>
                  <Text style={S.estBtnCancelTx}>{t.cancelar}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.estBtnConfirm, (!motivoEstorno.trim() || processando || faltaEscolher) && S.estBtnDisabled]}
                  onPress={onConfirmar}
                  disabled={!motivoEstorno.trim() || processando || faltaEscolher}
                >
                  {processando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={S.estBtnConfirmTx}>{t.confirmarEstorno}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalEstorno: { width: '90%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  estHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  estHeaderIcon: { fontSize: 20, color: '#EF4444', marginRight: 10 },
  estHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalCloseX: { fontSize: 16, color: '#6B7280' },
  estInfo: { padding: 16, backgroundColor: '#FEF2F2', margin: 16, borderRadius: 12 },
  estInfoParcela: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  estInfoCliente: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  estInfoValor: { fontSize: 16, fontWeight: '700', color: '#DC2626', marginTop: 8 },
  estInfoDetalhe: { fontSize: 12, color: '#7F1D1D', marginTop: 2 },
  // `recEsq` CEDE largura (flexShrink: 1) e `recValor` fica rígido:
  // dinheiro não quebra no meio, e no React Native o filho de linha nasce
  // com flexShrink 0 — sem isto o Android corta o número calado.
  recBox: { marginHorizontal: 16, marginBottom: 12 },
  recTitulo: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  recLista: { maxHeight: 190 },
  recItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  recItemSel: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  recEsq: { flexShrink: 1 },
  recData: { fontSize: 13, fontWeight: '600', color: '#374151' },
  recForma: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  recValor: { fontSize: 14, fontWeight: '700', color: '#374151' },
  recTxSel: { color: '#DC2626' },
  recNota: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  estInputBox: { marginHorizontal: 16 },
  estInputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  estInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#1F2937', minHeight: 80, textAlignVertical: 'top' },
  estBtns: { flexDirection: 'row', gap: 12, padding: 16 },
  estBtnCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6' },
  estBtnCancelTx: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  estBtnConfirm: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444' },
  estBtnDisabled: { opacity: 0.5 },
  estBtnConfirmTx: { fontSize: 14, fontWeight: '700', color: '#fff' },
});