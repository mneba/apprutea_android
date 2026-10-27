import React from 'react';
import { CORES_NIVEL } from '../utils/diasCobranca';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface LegendaCoresModalProps {
  visible: boolean;
  onClose: () => void;
  /** Dia operacional contra o qual o atraso e medido, ja formatado (DD/MM/AAAA).
   *  Vem da liquidacao em foco, nunca do relogio -- e e por nao estar escrito
   *  em lugar nenhum que o campo leu "cliente atrasado em verde" (Juan,
   *  24/10/2026) quando a rota apenas ainda nao tinha chegado no dia de hoje. */
  dataReferencia?: string | null;
  t: {
    legendaTitulo: string;
    legendaSubtitulo: string;
    legendaDataRef: string;
    legendaEntendido: string;
    legPagoLabel: string; legPagoDesc: string;
    legPendenteLabel: string; legPendenteDesc: string;
    legLeveLabel: string; legLeveDesc: string;
    legModeradoLabel: string; legModeradoDesc: string;
    legCriticoLabel: string; legCriticoDesc: string;
  };
}

export default function LegendaCoresModal({ visible, onClose, dataReferencia, t }: LegendaCoresModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={onClose}>
        <View style={S.modal} onStartShouldSetResponder={() => true}>
          <Text style={S.title}>{t.legendaTitulo}</Text>
          <Text style={S.subtitle}>{t.legendaSubtitulo}</Text>

          {!!dataReferencia && (
            <Text style={S.dataRef}>
              {t.legendaDataRef.replace('{data}', dataReferencia)}
            </Text>
          )}

          {/* As cores vêm de CORES_NIVEL, a mesma lista que pinta os cards. Quando
              estavam escritas aqui em hexadecimal, a legenda continuou mostrando
              laranja depois de o cliente pedir roxo — explicando uma cor que a
              tela já não usava. */}
          {[
            { color: CORES_NIVEL[0], label: t.legPagoLabel, desc: t.legPagoDesc },
            { color: CORES_NIVEL[1], label: t.legLeveLabel, desc: t.legLeveDesc },
            { color: CORES_NIVEL[2], label: t.legModeradoLabel, desc: t.legModeradoDesc },
            { color: CORES_NIVEL[3], label: t.legCriticoLabel, desc: t.legCriticoDesc },
          ].map((item) => (
            <View key={item.color} style={S.row}>
              <View style={[S.swatch, { backgroundColor: item.color }]} />
              <View style={S.texts}>
                <Text style={S.label}>{item.label}</Text>
                <Text style={S.desc}>{item.desc}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={S.closeBtn} onPress={onClose}>
            <Text style={S.closeBtnText}>{t.legendaEntendido}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  title: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  dataRef: {
    fontSize: 12, color: '#1D4ED8', fontWeight: '600', marginBottom: 20,
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  swatch: { width: 6, height: 44, borderRadius: 3 },
  texts: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  desc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  closeBtn: { marginTop: 8, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});