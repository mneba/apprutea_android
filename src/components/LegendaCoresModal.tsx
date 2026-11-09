import React from 'react';
import { CORES_NIVEL } from '../utils/diasCobranca';
import {
  Modal,
  ScrollView,
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
    secBotoes: string; secCores: string;
    botLiqLabel: string; botLiqDesc: string;
    botPagosLabel: string; botPagosDesc: string;
    botTodosLabel: string; botTodosDesc: string;
    botSoma: string;
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
        {/* O View de fora e quem BLOQUEIA o toque do overlay; o ScrollView de
            dentro so rola. Juntar os dois no mesmo no fazia o
            `onStartShouldSetResponder` reivindicar o gesto e a rolagem morrer. */}
        <View style={S.modal} onStartShouldSetResponder={() => true}>
        <ScrollView contentContainerStyle={S.modalConteudo}>
          <Text style={S.title}>{t.legendaTitulo}</Text>

          {/* OS TRES BOTOES.
              Relatado pelo Julio em 26/10 e de novo em 03/11/2026: ele somou
              "Liquidacao + Pagos" e comparou com "Todos", e nao fechou. Os
              numeros estavam certos -- sao tres perguntas diferentes, e a tela
              nao dizia isso em lugar nenhum.
              Medido na Madrid em 07/11/2026: 28 na carteira, 18 no dia (13
              pagos + 5 a cobrar) e 10 em dia, que nao aparecem nos dois
              primeiros. A frase do fim e a que fecha a conta. */}
          <Text style={S.secao}>{t.secBotoes}</Text>
          {[
            { label: t.botLiqLabel, desc: t.botLiqDesc, cor: '#2563EB' },
            { label: t.botPagosLabel, desc: t.botPagosDesc, cor: '#059669' },
            { label: t.botTodosLabel, desc: t.botTodosDesc, cor: '#4B5563' },
          ].map((item) => (
            <View key={item.label} style={S.row}>
              <View style={[S.ponto, { backgroundColor: item.cor }]} />
              <View style={S.texts}>
                <Text style={S.label}>{item.label}</Text>
                <Text style={S.desc}>{item.desc}</Text>
              </View>
            </View>
          ))}
          <Text style={S.soma}>{t.botSoma}</Text>

          <Text style={S.secao}>{t.secCores}</Text>
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
        </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  // O conteudo dobrou de tamanho: `maxHeight` + ScrollView, senao em tela
  // pequena o botao Entendido sai da area visivel e o modal nao fecha.
  modal: {
    backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 340,
    maxHeight: '85%', overflow: 'hidden',
  },
  modalConteudo: { padding: 24 },
  secao: {
    fontSize: 12, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 14, marginBottom: 8,
  },
  ponto: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  soma: {
    fontSize: 12, color: '#1F2937', lineHeight: 17,
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 11,
    marginTop: 2,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  dataRef: {
    fontSize: 12, color: '#1D4ED8', fontWeight: '600', marginBottom: 20,
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
  },
  // `flex-start`: a linha dos botoes tem descricao de duas linhas, e com
  // `center` o ponto flutuava no meio do paragrafo.
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  swatch: { width: 6, height: 44, borderRadius: 3 },
  texts: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  desc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  closeBtn: { marginTop: 8, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});