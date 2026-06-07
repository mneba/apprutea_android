import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../services/supabase';
import CalendarioSelector from './nova-venda/CalendarioSelector';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClienteDia {
  data_vencimento: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_foto_url: string | null;
  emprestimo_id: string;
  numero_parcela: number;
  numero_parcelas: number;
  valor_parcela: number;
  frequencia_pagamento: string;
}

interface DiaAgrupado {
  data: string;
  clientes: ClienteDia[];
  expanded: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  rotaId: string | null;
  dataLiq: string; // YYYY-MM-DD — data da liquidação em andamento
  lang: 'pt-BR' | 'es';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d: string, lang: string) => {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  const diasSemana = lang === 'es'
    ? ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    : ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${diasSemana[date.getDay()]}, ${day}/${m}/${y}`;
};

const fmtDataCurta = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getIni = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');

// ─── Componente ─────────────────────────────────────────────────────────────

export default function ProximosDiasModal({ visible, onClose, rotaId, dataLiq, lang }: Props) {
  const [dias, setDias] = useState<DiaAgrupado[]>([]);
  const [loading, setLoading] = useState(false);
  const [diasExtras, setDiasExtras] = useState<DiaAgrupado[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [ord, setOrd] = useState<'nome' | 'rota'>('rota');
  const [ordemMap, setOrdemMap] = useState<Map<string, number>>(new Map());
  const [showCalendario, setShowCalendario] = useState(false);

  const t = {
    titulo: lang === 'es' ? 'Próximos días' : 'Próximos dias',
    semClientes: lang === 'es' ? 'Sin clientes para este día' : 'Sem clientes para este dia',
    carregando: lang === 'es' ? 'Cargando...' : 'Carregando...',
    clientes: lang === 'es' ? 'clientes' : 'clientes',
    parcela: lang === 'es' ? 'Cuota' : 'Parcela',
    buscarDia: lang === 'es' ? 'Buscar día específico' : 'Buscar dia específico',
    fechar: lang === 'es' ? 'Cerrar' : 'Fechar',
  };

  // Carregar próximos 5 dias
  const carregarProximosDias = useCallback(async () => {
    if (!rotaId) return;
    setLoading(true);
    try {
      const baseLiq = new Date(dataLiq + 'T00:00:00');
      const inicio = addDays(baseLiq, 1);
      const fim = addDays(baseLiq, 7);

      const { data, error } = await supabase.rpc('fn_clientes_proximos_dias', {
        p_rota_id: rotaId,
        p_data_inicio: toDateStr(inicio),
        p_data_fim: toDateStr(fim),
      });

      if (error) throw error;

      // Agrupar por data
      const grupos = new Map<string, ClienteDia[]>();
      // Pré-popular os 7 dias (mesmo sem clientes)
      for (let i = 1; i <= 7; i++) {
        const d = toDateStr(addDays(baseLiq, i));
        grupos.set(d, []);
      }
      ((data || []) as ClienteDia[]).forEach(c => {
        const arr = grupos.get(c.data_vencimento) || [];
        arr.push(c);
        grupos.set(c.data_vencimento, arr);
      });

      const agrupados: DiaAgrupado[] = Array.from(grupos.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, clientes], idx) => ({
          data,
          clientes,
          expanded: idx === 0, // primeiro dia expandido
        }));

      setDias(agrupados);
    } catch (e) {
      console.error('Erro ao carregar próximos dias:', e);
    } finally {
      setLoading(false);
    }
  }, [rotaId]);

  // Recarregar sempre que abrir
  useEffect(() => {
    if (visible) {
      carregarProximosDias();
      carregarOrdemRota();
      setDiasExtras([]);
    }
  }, [visible, carregarProximosDias]);

  // Carregar ordem da rota
  const carregarOrdemRota = async () => {
    if (!rotaId) return;
    try {
      const { data } = await supabase
        .from('ordem_rota_cliente')
        .select('cliente_id, ordem')
        .eq('rota_id', rotaId);
      if (data && data.length > 0) {
        const m = new Map<string, number>();
        (data as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
        setOrdemMap(m);
      }
    } catch (e) {
      console.error('Erro ao carregar ordem da rota:', e);
    }
  };

  // Ordenar clientes de um dia
  const sortClientes = (clientes: ClienteDia[]): ClienteDia[] => {
    return [...clientes].sort((a, b) => {
      if (ord === 'rota') {
        const oa = ordemMap.get(a.cliente_id) ?? 9999;
        const ob = ordemMap.get(b.cliente_id) ?? 9999;
        if (oa !== ob) return oa - ob;
      }
      return a.cliente_nome.localeCompare(b.cliente_nome);
    });
  };

  // Buscar dia específico (recebe YYYY-MM-DD)
  const buscarDiaEspecifico = async (dateStr: string) => {
    if (!rotaId || !dateStr) return;

    // Verificar se já está carregado
    if (dias.some(d => d.data === dateStr) || diasExtras.some(d => d.data === dateStr)) return;

    setLoadingExtra(true);
    try {
      const { data, error } = await supabase.rpc('fn_clientes_proximos_dias', {
        p_rota_id: rotaId,
        p_data_inicio: dateStr,
        p_data_fim: dateStr,
      });

      if (error) throw error;

      const clientes = ((data || []) as ClienteDia[]);
      const novo: DiaAgrupado = { data: dateStr, clientes, expanded: true };
      setDiasExtras(prev => [...prev, novo].sort((a, b) => a.data.localeCompare(b.data)));
    } catch (e) {
      console.error('Erro ao buscar dia específico:', e);
    } finally {
      setLoadingExtra(false);
      setShowCalendario(false);
    }
  };

  // Calcular data mínima do picker (dia seguinte ao último dia visível)
  const getMinDatePicker = (): string => {
    const todasDatas = [...dias.map(d => d.data), ...diasExtras.map(d => d.data)].sort();
    if (todasDatas.length > 0) {
      const ultima = todasDatas[todasDatas.length - 1];
      const d = new Date(ultima + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return toDateStr(d);
    }
    return toDateStr(addDays(new Date(dataLiq + 'T00:00:00'), 8));
  };

  // Toggle accordion
  const toggleDia = (dataKey: string, isExtra: boolean) => {
    if (isExtra) {
      setDiasExtras(prev => prev.map(d =>
        d.data === dataKey ? { ...d, expanded: !d.expanded } : d
      ));
    } else {
      setDias(prev => prev.map(d =>
        d.data === dataKey ? { ...d, expanded: !d.expanded } : d
      ));
    }
  };

  // Renderizar um dia
  const renderDia = (dia: DiaAgrupado, isExtra: boolean) => (
    <View key={dia.data} style={S.diaCard}>
      <TouchableOpacity
        style={S.diaHeader}
        onPress={() => toggleDia(dia.data, isExtra)}
        activeOpacity={0.7}
      >
        <View style={S.diaHeaderLeft}>
          <Ionicons name="calendar-outline" size={16} color="#3B82F6" />
          <Text style={S.diaHeaderText}>{fmtData(dia.data, lang)}</Text>
        </View>
        <View style={S.diaHeaderRight}>
          <View style={[S.diaBadge, dia.clientes.length === 0 && { backgroundColor: '#F3F4F6' }]}>
            <Text style={[S.diaBadgeText, dia.clientes.length === 0 && { color: '#9CA3AF' }]}>
              {dia.clientes.length} {t.clientes}
            </Text>
          </View>
          <Ionicons
            name={dia.expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9CA3AF"
          />
        </View>
      </TouchableOpacity>

      {dia.expanded && (
        <View style={S.diaBody}>
          {dia.clientes.length === 0 ? (
            <Text style={S.semClientes}>{t.semClientes}</Text>
          ) : (
            sortClientes(dia.clientes).map((c, idx) => (
              <View key={`${c.cliente_id}-${c.emprestimo_id}-${idx}`} style={S.clienteRow}>
                {c.cliente_foto_url ? (
                  <Image source={{ uri: c.cliente_foto_url }} style={S.clienteAvatar} />
                ) : (
                  <View style={S.clienteAvatarPlaceholder}>
                    <Text style={S.clienteAvatarText}>{getIni(c.cliente_nome)}</Text>
                  </View>
                )}
                <View style={S.clienteInfo}>
                  <Text style={S.clienteNome} numberOfLines={1}>{c.cliente_nome}</Text>
                  <Text style={S.clienteParcela}>
                    {t.parcela} {c.numero_parcela}/{c.numero_parcelas}
                  </Text>
                </View>
                <Text style={S.clienteValor}>$ {fmt(c.valor_parcela)}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.container}>
          {/* Header */}
          <View style={S.header}>
            <View style={S.headerLeft}>
              <Ionicons name="calendar" size={20} color="#3B82F6" />
              <Text style={S.headerTitle}>{t.titulo}</Text>
            </View>
            <View style={S.headerRight}>
              <View style={S.sortGroup}>
                <TouchableOpacity
                  style={[S.sortOption, ord === 'rota' && S.sortOptionActive]}
                  onPress={() => setOrd('rota')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="map-outline" size={13} color={ord === 'rota' ? '#fff' : '#6B7280'} />
                  <Text style={[S.sortOptionText, ord === 'rota' && S.sortOptionTextActive]}>
                    {lang === 'es' ? 'Ruta' : 'Rota'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.sortOption, ord === 'nome' && S.sortOptionActive]}
                  onPress={() => setOrd('nome')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="text-outline" size={13} color={ord === 'nome' ? '#fff' : '#6B7280'} />
                  <Text style={[S.sortOptionText, ord === 'nome' && S.sortOptionTextActive]}>A-Z</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={onClose} style={S.headerClose}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={S.loadingBox}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={S.loadingText}>{t.carregando}</Text>
              </View>
            ) : (
              <>
                {dias.map(d => renderDia(d, false))}
                {diasExtras.map(d => renderDia(d, true))}
              </>
            )}

            {/* Buscar dia específico */}
            {!loading && (
              <TouchableOpacity
                style={S.customBtn}
                onPress={() => setShowCalendario(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                <Text style={S.customBtnText}>{t.buscarDia}</Text>
                {loadingExtra && <ActivityIndicator size={14} color="#2563EB" style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Calendário picker inline */}
          {showCalendario && (
            <View style={S.calendarioOverlay}>
              <View style={S.calendarioCard}>
                <View style={S.calendarioHeader}>
                  <Text style={S.calendarioTitle}>{t.buscarDia}</Text>
                  <TouchableOpacity onPress={() => setShowCalendario(false)}>
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <CalendarioSelector
                  dataSelecionada=""
                  onSelect={(dateStr) => buscarDiaEspecifico(dateStr)}
                  lang={lang}
                  minDate={getMinDatePicker()}
                />
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={S.footer}>
            <TouchableOpacity style={S.footerBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={S.footerBtnText}>{t.fechar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '94%', maxHeight: '85%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  sortGroup: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 2 },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  sortOptionActive: { backgroundColor: '#2563EB' },
  sortOptionText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  sortOptionTextActive: { color: '#fff' },

  // Scroll
  scroll: { padding: 12 },

  // Loading
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },

  // Dia card
  diaCard: { backgroundColor: '#FAFAFA', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  diaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  diaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diaHeaderText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  diaHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diaBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  diaBadgeText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },

  // Dia body
  diaBody: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  semClientes: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  // Cliente row
  clienteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  clienteAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', marginRight: 10 },
  clienteAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  clienteAvatarText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  clienteInfo: { flex: 1 },
  clienteNome: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  clienteParcela: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  clienteValor: { fontSize: 14, fontWeight: '700', color: '#10B981', marginLeft: 8 },

  // Botão buscar dia
  customBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingVertical: 14, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  customBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },

  // Calendário picker overlay
  calendarioOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  calendarioCard: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxHeight: '80%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  calendarioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  calendarioTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },

  // Footer
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footerBtn: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  footerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});