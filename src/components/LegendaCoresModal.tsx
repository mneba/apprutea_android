import React from 'react';
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
  t: {
    legendaTitulo: string;
    legendaSubtitulo: string;
    legendaEntendido: string;
    legPagoLabel: string; legPagoDesc: string;
    legPendenteLabel: string; legPendenteDesc: string;
    legLeveLabel: string; legLeveDesc: string;
    legModeradoLabel: string; legModeradoDesc: string;
    legCriticoLabel: string; legCriticoDesc: string;
  };
}

export default function LegendaCoresModal({ visible, onClose, t }: LegendaCoresModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={onClose}>
        <View style={S.modal} onStartShouldSetResponder={() => true}>
          <Text style={S.title}>{t.legendaTitulo}</Text>
          <Text style={S.subtitle}>{t.legendaSubtitulo}</Text>

          {[
            { color: '#10B981', label: t.legPagoLabel, desc: t.legPagoDesc },
            { color: '#D1D5DB', label: t.legPendenteLabel, desc: t.legPendenteDesc },
            { color: '#F59E0B', label: t.legLeveLabel, desc: t.legLeveDesc },
            { color: '#F97316', label: t.legModeradoLabel, desc: t.legModeradoDesc },
            { color: '#EF4444', label: t.legCriticoLabel, desc: t.legCriticoDesc },
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
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  swatch: { width: 6, height: 44, borderRadius: 3 },
  texts: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  desc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  closeBtn: { marginTop: 8, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});