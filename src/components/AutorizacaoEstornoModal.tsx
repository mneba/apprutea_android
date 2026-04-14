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

interface ParcelaAutorizacao {
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago?: number;
}

interface AutorizacaoEstornoModalProps {
  visible: boolean;
  onClose: () => void;
  parcela: ParcelaAutorizacao | null;
  clienteNome: string;
  motivo: string;
  setMotivo: (v: string) => void;
  enviando: boolean;
  onEnviar: () => void;
  lang: Language;
  t: {
    parcela: string;
    pago: string;
    cancelar: string;
  };
}

export default function AutorizacaoEstornoModal({
  visible,
  onClose,
  parcela,
  clienteNome,
  motivo,
  setMotivo,
  enviando,
  onEnviar,
  lang,
  t,
}: AutorizacaoEstornoModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalEstorno}>
          <View style={S.estHeader}>
            <Text style={S.estHeaderIcon}>🔒</Text>
            <Text style={S.estHeaderTitle}>
              {lang === 'pt-BR' ? 'Autorização Necessária' : 'Autorización Necesaria'}
            </Text>
            <TouchableOpacity onPress={onClose} style={S.modalClose}>
              <Text style={S.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {parcela && (
            <>
              {/* Aviso */}
              <View style={S.aviso}>
                <Text style={S.avisoText}>
                  {lang === 'pt-BR'
                    ? 'Estorno de pagamento requer autorização do supervisor.'
                    : 'Reversión de pago requiere autorización del supervisor.'}
                </Text>
              </View>

              {/* Info da parcela */}
              <View style={S.estInfo}>
                <Text style={S.estInfoParcela}>{t.parcela} {parcela.numero_parcela}</Text>
                <Text style={S.estInfoCliente}>{clienteNome}</Text>
                <Text style={S.estInfoValor}>{t.pago} {fmt(parcela.valor_pago || parcela.valor_parcela)}</Text>
              </View>

              {/* Campo de motivo */}
              <View style={S.estInputBox}>
                <Text style={S.estInputLabel}>
                  {lang === 'pt-BR' ? 'Motivo da solicitação' : 'Motivo de la solicitud'}
                </Text>
                <TextInput
                  style={S.estInput}
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder={lang === 'pt-BR' ? 'Explique por que precisa estornar...' : 'Explique por qué necesita reversar...'}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Botões */}
              <View style={S.estBtns}>
                <TouchableOpacity style={S.estBtnCancel} onPress={onClose}>
                  <Text style={S.estBtnCancelTx}>{t.cancelar}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.estBtnConfirm, { backgroundColor: '#F59E0B' }, (!motivo.trim() || enviando) && S.estBtnDisabled]}
                  onPress={onEnviar}
                  disabled={!motivo.trim() || enviando}
                >
                  {enviando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={S.estBtnConfirmTx}>
                      {lang === 'pt-BR' ? 'Solicitar Autorização' : 'Solicitar Autorización'}
                    </Text>
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
  aviso: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 16, marginHorizontal: 16, marginTop: 16 },
  avisoText: { color: '#92400E', fontSize: 14, textAlign: 'center' },
  estInfo: { padding: 16, backgroundColor: '#FEF2F2', marginHorizontal: 16, borderRadius: 12 },
  estInfoParcela: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  estInfoCliente: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  estInfoValor: { fontSize: 16, fontWeight: '700', color: '#DC2626', marginTop: 8 },
  estInputBox: { marginHorizontal: 16, marginTop: 16 },
  estInputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  estInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#1F2937', minHeight: 80, textAlignVertical: 'top' },
  estBtns: { flexDirection: 'row', gap: 12, padding: 16 },
  estBtnCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6' },
  estBtnCancelTx: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  estBtnConfirm: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  estBtnDisabled: { opacity: 0.5 },
  estBtnConfirmTx: { fontSize: 14, fontWeight: '700', color: '#fff' },
});