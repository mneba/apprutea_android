import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../styles/novaVendaStyles';
import type { Lang } from '../../constants/novaVendaConstants';

interface Props {
  visible: boolean;
  lang: Lang;
  docBusca: string;
  setDocBusca: (v: string) => void;
  buscandoDoc: boolean;
  onBuscar: () => void;
  onCancel: () => void;
}

export default function ModalBuscaDocumento({
  visible, lang, docBusca, setDocBusca, buscandoDoc, onBuscar, onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalCardTitle}>
            {lang === 'es' ? 'Nuevo préstamo' : 'Novo empréstimo'}
          </Text>
          <Text style={styles.modalCardDesc}>
            {lang === 'es'
              ? 'Informe el documento del cliente para verificar si ya tiene historial.'
              : 'Informe o documento do cliente para verificar se já tem histórico.'}
          </Text>
          <TextInput
            style={styles.modalCardInput}
            value={docBusca}
            onChangeText={setDocBusca}
            placeholder="CPF / Documento"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            autoFocus
          />
          <View style={styles.modalCardButtons}>
            <TouchableOpacity style={styles.modalCardBtnCancel} onPress={onCancel}>
              <Text style={styles.modalCardBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCardBtnConfirm, (!docBusca.trim() || buscandoDoc) && { opacity: 0.5 }]}
              onPress={onBuscar}
              disabled={!docBusca.trim() || buscandoDoc}
            >
              {buscandoDoc
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalCardBtnConfirmText}>OK</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
