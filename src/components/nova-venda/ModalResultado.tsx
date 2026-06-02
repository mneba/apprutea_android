import React from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../styles/novaVendaStyles';
import { fmt, type Textos } from '../../constants/novaVendaConstants';

interface Props {
  visible: boolean;
  resultado: any;
  t: Textos;
  onClose: () => void;
}

export default function ModalResultado({ visible, resultado, t, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.resultadoOverlay}>
        <View style={styles.resultadoCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header sucesso */}
            <View style={styles.resultadoHeader}>
              <Text style={styles.resultadoHeaderIcon}>✅</Text>
              <Text style={styles.resultadoHeaderTitle}>{t.vendaRegistrada}</Text>
              <Text style={styles.resultadoHeaderMsg}>{resultado?.mensagem}</Text>
            </View>

            {/* Bloco 1 - Cliente */}
            <View style={[styles.resultadoBloco, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.resultadoBlocoTitle}>{t.secClienteConf}</Text>
              <View style={styles.resultadoRow}>
                <Text style={styles.resultadoLabel}>{t.nome}</Text>
                <Text style={styles.resultadoValue}>{resultado?.cliente_nome}</Text>
              </View>
              <View style={styles.resultadoRow}>
                <Text style={styles.resultadoLabel}>{t.codigo}</Text>
                <Text style={[styles.resultadoValue, { fontWeight: '700', color: '#2563EB' }]}>
                  #{resultado?.cliente_codigo}
                </Text>
              </View>
            </View>

            {/* Bloco 2 - Empréstimo */}
            <View style={[styles.resultadoBloco, { backgroundColor: '#F0FDF4' }]}>
              <Text style={styles.resultadoBlocoTitle}>{t.secEmprestimoConf}</Text>
              <View style={styles.resultadoRow}>
                <Text style={styles.resultadoLabel}>{t.valorTotalConf}</Text>
                <Text style={styles.resultadoValue}>$ {fmt(resultado?.valor_total || 0)}</Text>
              </View>
              <View style={styles.resultadoRow}>
                <Text style={styles.resultadoLabel}>{t.valorParcelaConf}</Text>
                <Text style={styles.resultadoValue}>$ {fmt(resultado?.valor_parcela || 0)}</Text>
              </View>
              {resultado?.microseguro_valor ? (
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>{t.lblMicroseguro}</Text>
                  <Text style={styles.resultadoValue}>$ {fmt(resultado.microseguro_valor)}</Text>
                </View>
              ) : null}
            </View>

            {/* Bloco 3 - Parcelas */}
            {resultado?.parcelas && resultado.parcelas.length > 0 && (
              <View style={[styles.resultadoBloco, { backgroundColor: '#FFFBEB' }]}>
                <Text style={styles.resultadoBlocoTitle}>
                  📅 Parcelas ({resultado.parcelas.length}x)
                </Text>
                <View style={styles.parcelaHeaderRow}>
                  <Text style={[styles.parcelaHeaderText, { width: 30 }]}>#</Text>
                  <Text style={[styles.parcelaHeaderText, { flex: 1 }]}>{t.vencimento}</Text>
                  <Text style={[styles.parcelaHeaderText, { width: 100, textAlign: 'right' }]}>{t.valor}</Text>
                </View>
                {resultado.parcelas.map((p: any) => (
                  <View key={p.numero} style={styles.parcelaRow}>
                    <Text style={[styles.parcelaText, { width: 30 }]}>{p.numero}</Text>
                    <Text style={[styles.parcelaText, { flex: 1 }]}>
                      {new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </Text>
                    <Text style={[styles.parcelaText, { width: 100, textAlign: 'right' }]}>
                      $ {fmt(p.valor)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Botão Fechar */}
          <TouchableOpacity style={styles.resultadoCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.resultadoCloseBtnText}>{t.fechar}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
