import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Uma linha do detalhamento: rotulo a esquerda, valor a direita,
// alinhados em coluna. Texto corrido nao alinha em fonte proporcional,
// e quando o que esta em jogo e dinheiro o usuario precisa comparar
// os valores de olho.
export interface LinhaConfirm {
  rotulo: string;
  valor: string;
  /** Linha de resultado: negrito, verde, com traco acima. */
  total?: boolean;
  /** Valor que subtrai - exibido em azul, com o sinal ja no texto. */
  abate?: boolean;
}

interface ConfirmModalProps {
  visible: boolean;
  titulo: string;
  mensagem: string;
  /** Detalhamento em linhas, entre a mensagem e os botoes. */
  detalhes?: LinhaConfirm[];
  /** Aviso em destaque (ambar) abaixo do detalhamento. */
  aviso?: string;
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
  detalhes,
  aviso,
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
          {!!mensagem && <Text style={S.mensagem}>{mensagem}</Text>}

          {!!detalhes?.length && (
            <View style={S.detalhes}>
              {detalhes.map((d, i) => (
                <View key={i} style={[S.linha, d.total && S.linhaTotal]}>
                  <Text style={[S.rotulo, d.total && S.rotuloTotal]}>{d.rotulo}</Text>
                  <Text style={[S.valor, d.abate && S.valorAbate, d.total && S.valorTotal]}>
                    {d.valor}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!!aviso && (
            <View style={S.avisoBox}>
              <Text style={S.avisoTx}>{aviso}</Text>
            </View>
          )}
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
  mensagem: { fontSize: 15, color: '#4B5563', lineHeight: 22, marginBottom: 14 },
  detalhes: { marginBottom: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  linhaTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4, paddingTop: 9 },
  rotulo: { fontSize: 13, color: '#6B7280', flex: 1 },
  rotuloTotal: { fontSize: 14, fontWeight: '700', color: '#374151' },
  valor: { fontSize: 14, fontWeight: '600', color: '#111827' },
  valorAbate: { color: '#4F46E5' },
  valorTotal: { fontSize: 17, fontWeight: '800', color: '#059669' },
  avisoBox: {
    backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B',
    borderRadius: 8, padding: 10, marginBottom: 16,
  },
  avisoTx: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  botoes: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnCancelar: { backgroundColor: '#F3F4F6' },
  btnCancelarTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnConfirmarTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});