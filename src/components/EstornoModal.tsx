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
import { Language } from '../contexts/LiquidacaoContext';

const fmt = (v: number) => '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ParcelaEstorno {
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago?: number;
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
  lang,
  t,
}: EstornoModalProps) {
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
              </View>
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
                  style={[S.estBtnConfirm, (!motivoEstorno.trim() || processando) && S.estBtnDisabled]}
                  onPress={onConfirmar}
                  disabled={!motivoEstorno.trim() || processando}
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