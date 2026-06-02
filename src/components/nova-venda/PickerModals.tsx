import React, { RefObject } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../styles/novaVendaStyles';
import CalendarioSelector from './CalendarioSelector';
import { DDI_LIST, type DDIOption, type Lang, type SegmentoGrupo, type Segmento, type Textos } from '../../constants/novaVendaConstants';

// ============================================================
// MODAL: DDI
// ============================================================
interface ModalDDIProps {
  visible: boolean;
  ddiAtivo: string;
  t: Textos;
  onSelect: (ddi: DDIOption) => void;
  onClose: () => void;
}

export function ModalDDI({ visible, ddiAtivo, t, onSelect, onClose }: ModalDDIProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t.selecionePais}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {DDI_LIST.map((ddi) => (
              <TouchableOpacity
                key={ddi.codigo}
                style={[styles.pickerItem, ddiAtivo === ddi.codigo && styles.pickerItemActive]}
                onPress={() => onSelect(ddi)}
                activeOpacity={0.6}
              >
                <Text style={[styles.pickerItemText, ddiAtivo === ddi.codigo && styles.pickerItemTextActive]}>
                  {ddi.pais}
                </Text>
                <Text style={[styles.pickerItemCode, ddiAtivo === ddi.codigo && styles.pickerItemTextActive]}>
                  {ddi.codigo}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================
// MODAL: SEGMENTO
// ============================================================
interface ModalSegmentoProps {
  visible: boolean;
  segmentos: SegmentoGrupo[];
  segmentosLoading: boolean;
  segmentoId: string | null;
  segmentoBusca: string;
  segmentoBuscaRef: RefObject<TextInput>;
  t: Textos;
  onSelect: (seg: Segmento) => void;
  onClear: () => void;
  onSetBusca: (v: string) => void;
  onClose: () => void;
}

export function ModalSegmento({
  visible, segmentos, segmentosLoading, segmentoId,
  segmentoBusca, segmentoBuscaRef, t,
  onSelect, onClear, onSetBusca, onClose,
}: ModalSegmentoProps) {
  const closeAndReset = () => { onClose(); onSetBusca(''); };

  return (
    <Modal
      visible={visible} transparent animationType="fade"
      onRequestClose={closeAndReset}
      onShow={() => setTimeout(() => segmentoBuscaRef.current?.focus(), 300)}
    >
      <Pressable style={styles.pickerOverlay} onPress={closeAndReset}>
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t.selecioneSegmento}</Text>
            <TouchableOpacity onPress={closeAndReset}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Campo de busca */}
          <View style={styles.pickerSearchWrapper}>
            <TextInput
              ref={segmentoBuscaRef}
              style={styles.pickerSearchInput}
              value={segmentoBusca}
              onChangeText={onSetBusca}
              placeholder={t.buscarSegmento}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {segmentoBusca.length > 0 && (
              <TouchableOpacity style={styles.pickerSearchClear} onPress={() => onSetBusca('')}>
                <Text style={styles.pickerSearchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {segmentosLoading ? (
            <View style={styles.pickerLoading}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.pickerLoadingText}>{t.carregandoSegmentos}</Text>
            </View>
          ) : (
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {segmentoBusca.length === 0 && (
                <TouchableOpacity
                  style={[styles.pickerItem, !segmentoId && styles.pickerItemActive]}
                  onPress={() => { onClear(); closeAndReset(); }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.pickerItemText, { fontStyle: 'italic', color: '#9CA3AF' }]}>
                    Nenhum segmento
                  </Text>
                </TouchableOpacity>
              )}

              {segmentos.map((grupo) => {
                const busca = segmentoBusca.toLowerCase().trim();
                const itensFiltrados = busca
                  ? grupo.itens.filter(seg =>
                      seg.nome_pt.toLowerCase().includes(busca) ||
                      grupo.grupo.toLowerCase().includes(busca)
                    )
                  : grupo.itens;

                if (itensFiltrados.length === 0) return null;

                return (
                  <View key={grupo.grupo}>
                    <View style={styles.pickerGroupHeader}>
                      <Text style={styles.pickerGroupTitle}>{grupo.grupo}</Text>
                    </View>
                    {itensFiltrados.map((seg) => (
                      <TouchableOpacity
                        key={seg.id}
                        style={[styles.pickerItem, styles.pickerItemIndented, segmentoId === seg.id && styles.pickerItemActive]}
                        onPress={() => { onSelect(seg); onSetBusca(''); }}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.pickerItemText, segmentoId === seg.id && styles.pickerItemTextActive]}>
                          {seg.nome_pt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}

              {segmentoBusca.length > 0 && segmentos.every(g => {
                const busca = segmentoBusca.toLowerCase().trim();
                return g.itens.filter(s => s.nome_pt.toLowerCase().includes(busca) || g.grupo.toLowerCase().includes(busca)).length === 0;
              }) && (
                <View style={styles.pickerLoading}>
                  <Text style={styles.pickerLoadingText}>{t.nenhumSegmento}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================
// MODAL: DIA DA SEMANA
// ============================================================
interface ModalDiaSemanaProps {
  visible: boolean;
  diasSemana: Array<{ value: string; label: string }>;
  diaSemanaPagamento: string;
  t: Textos;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function ModalDiaSemana({ visible, diasSemana, diaSemanaPagamento, t, onSelect, onClose }: ModalDiaSemanaProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t.diaSemana}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {diasSemana.map((dia) => (
              <TouchableOpacity
                key={dia.value}
                style={[styles.pickerItem, diaSemanaPagamento === dia.value && styles.pickerItemActive]}
                onPress={() => { onSelect(dia.value); onClose(); }}
                activeOpacity={0.6}
              >
                <Text style={[styles.pickerItemText, diaSemanaPagamento === dia.value && styles.pickerItemTextActive]}>
                  {dia.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================
// MODAL: CALENDÁRIO
// ============================================================
interface ModalCalendarioProps {
  visible: boolean;
  dataSelecionada: string;
  trabalhaDomingo: boolean;
  feriadosSet: Set<string>;
  lang: Lang;
  t: Textos;
  onSelect: (dateStr: string) => void;
  onClose: () => void;
}

export function ModalCalendario({ visible, dataSelecionada, trabalhaDomingo, feriadosSet, lang, t, onSelect, onClose }: ModalCalendarioProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <View style={[styles.pickerCard, { maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t.dataPrimVenc}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <CalendarioSelector
            dataSelecionada={dataSelecionada}
            trabalhaDomingo={trabalhaDomingo}
            feriadosSet={feriadosSet}
            lang={lang}
            onSelect={(dateStr) => { onSelect(dateStr); onClose(); }}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

// ============================================================
// MODAL: PEDIDO DE ALTERAÇÃO
// ============================================================
interface ModalAlteracaoProps {
  visible: boolean;
  lang: Lang;
  textoAlteracao: string;
  setTextoAlteracao: (v: string) => void;
  enviandoAlteracao: boolean;
  onEnviar: () => void;
  onClose: () => void;
}

export function ModalAlteracao({ visible, lang, textoAlteracao, setTextoAlteracao, enviandoAlteracao, onEnviar, onClose }: ModalAlteracaoProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalCardTitle}>
            {lang === 'es' ? 'Solicitar cambio' : 'Solicitar alteração'}
          </Text>
          <Text style={styles.modalCardDesc}>
            {lang === 'es'
              ? 'Describa qué desea cambiar. La venta volverá a análisis del administrador.'
              : 'Descreva o que deseja alterar. A venda voltará para análise do administrador.'}
          </Text>
          <TextInput
            style={[styles.modalCardInput, { minHeight: 90, textAlignVertical: 'top' }]}
            value={textoAlteracao}
            onChangeText={setTextoAlteracao}
            placeholder={lang === 'es' ? 'Ej.: quiero más crédito del aprobado...' : 'Ex.: quero mais crédito do que foi aprovado...'}
            placeholderTextColor="#9CA3AF"
            multiline numberOfLines={4} maxLength={500}
            editable={!enviandoAlteracao}
          />
          <View style={styles.modalCardButtons}>
            <TouchableOpacity style={styles.modalCardBtnCancel} onPress={onClose} disabled={enviandoAlteracao}>
              <Text style={styles.modalCardBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCardBtnConfirm, (!textoAlteracao.trim() || enviandoAlteracao) && { opacity: 0.5 }]}
              onPress={onEnviar}
              disabled={!textoAlteracao.trim() || enviandoAlteracao}
            >
              {enviandoAlteracao
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalCardBtnConfirmText}>{lang === 'es' ? 'Enviar' : 'Enviar'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
