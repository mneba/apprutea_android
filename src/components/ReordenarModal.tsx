import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Language } from '../contexts/LiquidacaoContext';

interface ClienteTodos {
  id: string;
  codigo_cliente: number | null;
  nome: string;
  telefone_celular: string | null;
  tem_atraso: boolean;
  emprestimos: any[];
}

interface ReordenarModalProps {
  listaReordenar: ClienteTodos[];
  salvandoOrdem: boolean;
  lang: Language;
  onCancelar: () => void;
  onSalvar: () => void;
  onMoverItem: (fromIndex: number, toIndex: number) => void;
  onMoverParaPosicao: (fromIndex: number, novaPosicao: number) => void;
}

export default function ReordenarModal({
  listaReordenar,
  salvandoOrdem,
  lang,
  onCancelar,
  onSalvar,
  onMoverItem,
  onMoverParaPosicao,
}: ReordenarModalProps) {
  const [buscaReordenar, setBuscaReordenar] = useState('');
  const [popupOrdem, setPopupOrdem] = useState<{ cliente: ClienteTodos; index: number } | null>(null);
  const [popupNovaOrdem, setPopupNovaOrdem] = useState('');

  const listaFiltrada = buscaReordenar.trim()
    ? listaReordenar.filter(c => c.nome.toLowerCase().includes(buscaReordenar.toLowerCase().trim()))
    : listaReordenar;
  const estaBuscando = buscaReordenar.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <TouchableOpacity onPress={onCancelar} style={{ paddingVertical: 6, paddingHorizontal: 2, minWidth: 64 }}>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>{lang === 'es' ? 'Cancelar' : 'Cancelar'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{lang === 'es' ? 'Ordenar Ruta' : 'Ordem da Rota'}</Text>
          <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{lang === 'es' ? 'Use ↑↓ para mover' : 'Use ↑↓ para mover'}</Text>
        </View>
        <TouchableOpacity onPress={onSalvar} disabled={salvandoOrdem} style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: salvandoOrdem ? '#93C5FD' : '#2563EB', borderRadius: 8, minWidth: 64, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: '#FFF', fontWeight: '600' }}>{salvandoOrdem ? '...' : (lang === 'es' ? 'Guardar' : 'Salvar')}</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de busca */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#E5E7EB' }}>
          <Text style={{ fontSize: 13, marginRight: 6, opacity: 0.5 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, fontSize: 13, color: '#1F2937', padding: 0 }}
            placeholder={lang === 'es' ? 'Buscar cliente...' : 'Buscar cliente...'}
            placeholderTextColor="#9CA3AF"
            value={buscaReordenar}
            onChangeText={setBuscaReordenar}
          />
          {buscaReordenar.length > 0 && (
            <TouchableOpacity onPress={() => setBuscaReordenar('')} style={{ padding: 4 }}>
              <Text style={{ fontSize: 14, color: '#9CA3AF', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {estaBuscando ? (
          <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
            {listaFiltrada.length} {lang === 'es' ? 'resultado(s) — toque para definir posición' : 'resultado(s) — toque para definir posição'}
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: '#1D4ED8', marginTop: 6 }}>
            {listaReordenar.length} {lang === 'es' ? 'clientes • Busque o use ↑↓' : 'clientes • Busque ou use ↑↓'}
          </Text>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {listaFiltrada.map((cliente) => {
          const index = listaReordenar.findIndex(c => c.id === cliente.id);
          const empAtivo = cliente.emprestimos.find((e: any) => e.status === 'ATIVO' || e.status === 'VENCIDO');
          return (
            <View key={cliente.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: cliente.tem_atraso ? '#FCA5A5' : '#E5E7EB', paddingVertical: 10, paddingHorizontal: 12 }}>
              <TouchableOpacity
                onPress={() => { setPopupOrdem({ cliente, index }); setPopupNovaOrdem(String(index + 1)); }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{index + 1}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={estaBuscando ? 0.6 : 1}
                onPress={estaBuscando ? () => { setPopupOrdem({ cliente, index }); setPopupNovaOrdem(String(index + 1)); } : undefined}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{cliente.nome}</Text>
                <Text style={{ fontSize: 11, color: estaBuscando ? '#2563EB' : '#6B7280', marginTop: 2 }}>
                  {cliente.codigo_cliente ? `#${cliente.codigo_cliente}` : ''}
                  {empAtivo ? ` • ${empAtivo.status === 'VENCIDO' ? '⚠️ Vencido' : '✅ Ativo'}` : ''}
                  {estaBuscando ? (lang === 'es' ? ' · Toque para definir posición' : ' · Toque para definir posição') : ''}
                </Text>
              </TouchableOpacity>

              {!estaBuscando && (
                <View style={{ gap: 4 }}>
                  <TouchableOpacity onPress={() => index > 0 && onMoverItem(index, index - 1)} disabled={index === 0} style={{ width: 32, height: 28, borderRadius: 6, backgroundColor: index === 0 ? '#F3F4F6' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.6}>
                    <Text style={{ fontSize: 16, color: index === 0 ? '#D1D5DB' : '#2563EB', fontWeight: '700' }}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => index < listaReordenar.length - 1 && onMoverItem(index, index + 1)} disabled={index === listaReordenar.length - 1} style={{ width: 32, height: 28, borderRadius: 6, backgroundColor: index === listaReordenar.length - 1 ? '#F3F4F6' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.6}>
                    <Text style={{ fontSize: 16, color: index === listaReordenar.length - 1 ? '#D1D5DB' : '#2563EB', fontWeight: '700' }}>↓</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Popup posicionamento direto */}
      <Modal visible={!!popupOrdem} transparent animationType="fade" onRequestClose={() => setPopupOrdem(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setPopupOrdem(null)}>
          <View style={{ width: '100%', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden' }} onStartShouldSetResponder={() => true}>
            <View style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 2 }}>
                {lang === 'es' ? 'POSICIÓN ACTUAL' : 'POSIÇÃO ATUAL'} #{popupOrdem ? popupOrdem.index + 1 : ''}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFF' }} numberOfLines={1}>{popupOrdem?.cliente.nome}</Text>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 }}>
                {lang === 'es' ? 'Mover a la posición:' : 'Mover para a posição:'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setPopupNovaOrdem(p => String(Math.max(1, parseInt(p || '1') - 1)))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Text style={{ fontSize: 22, color: '#2563EB', fontWeight: '700', lineHeight: 26 }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ width: 100, textAlign: 'center', fontSize: 32, fontWeight: '800', color: '#1F2937', borderBottomWidth: 2.5, borderBottomColor: '#2563EB', paddingVertical: 4 }}
                  value={popupNovaOrdem}
                  onChangeText={v => setPopupNovaOrdem(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                  autoFocus
                />
                <TouchableOpacity onPress={() => setPopupNovaOrdem(p => String(Math.min(listaReordenar.length, parseInt(p || '1') + 1)))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                  <Text style={{ fontSize: 22, color: '#2563EB', fontWeight: '700', lineHeight: 26 }}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>1 – {listaReordenar.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 }}>
              <TouchableOpacity onPress={() => setPopupOrdem(null)} style={{ flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' }} activeOpacity={0.7}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>{lang === 'es' ? 'Cancelar' : 'Cancelar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const nova = parseInt(popupNovaOrdem);
                  if (!isNaN(nova) && nova >= 1 && nova <= listaReordenar.length && popupOrdem) {
                    onMoverParaPosicao(popupOrdem.index, nova);
                  }
                  setPopupOrdem(null);
                  setBuscaReordenar('');
                }}
                style={{ flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{lang === 'es' ? 'Mover' : 'Mover'} →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}