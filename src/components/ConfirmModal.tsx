import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ConfirmModalProps {
  visible: boolean;
  titulo: string;
  mensagem: string;
  textoCancelar?: string;
  textoConfirmar?: string;
  corConfirmar?: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export default function ConfirmModal({
  visible,
  titulo,
  mensagem,
  textoCancelar = 'Cancelar',
  textoConfirmar = 'Confirmar',
  corConfirmar = '#10B981',
  onCancelar,
  onConfirmar,
}: ConfirmModalProps) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={S.overlay}>
        <View style={S.box}>
          <Text style={S.titulo}>{titulo}</Text>
          <Text style={S.mensagem}>{mensagem}</Text>
          <View style={S.botoes}>
            <TouchableOpacity style={[S.btn, S.btnCancelar]} onPress={onCancelar}>
              <Text style={S.btnCancelarTx}>{textoCancelar}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.btn, { backgroundColor: corConfirmar }]} onPress={onConfirmar}>
              <Text style={S.btnConfirmarTx}>{textoConfirmar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  mensagem: { fontSize: 15, color: '#4B5563', lineHeight: 22, marginBottom: 20 },
  botoes: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnCancelar: { backgroundColor: '#F3F4F6' },
  btnCancelarTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnConfirmarTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});