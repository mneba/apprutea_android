import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Language } from '../contexts/LiquidacaoContext';

// ─── Types ──────────────────────────────────────────────────────────────────
type TabAtiva = 'liquidacao' | 'todos';
type FiltroLiquidacao = 'todos' | 'atrasados' | 'pagas';
type OrdenacaoLiquidacao = 'rota' | 'nome';

interface ClienteTodos {
  id: string;
  codigo_cliente: number | null;
  nome: string;
  telefone_celular: string | null;
  status: string;
  tem_atraso: boolean;
  permite_renegociacao: boolean;
  cliente_created_at?: string;
  emprestimos: any[];
}

interface FiltrosDrawerProps {
  visible: boolean;
  drawerAnim: Animated.Value;
  drawerWidth: number;
  onClose: () => void;
  lang: Language;
  tab: TabAtiva;
  // Liquidação filters
  ord: OrdenacaoLiquidacao;
  setOrd: (o: OrdenacaoLiquidacao) => void;
  filtro: FiltroLiquidacao;
  setFiltro: (f: FiltroLiquidacao) => void;
  cntTotal: number;
  cntAtraso: number;
  cntPagas: number;
  // Todos filters
  filtroTipo: string;
  setFiltroTipo: (f: string) => void;
  filtroStatus: string;
  setFiltroStatus: (f: string) => void;
  ocultarLiquidacao: boolean;
  setOcultarLiquidacao: (v: boolean) => void;
  liqId: string | null;
  clientesLiqIdsCount: number;
  // Reorder
  todosList: ClienteTodos[];
  ordemRotaMap: Map<string, number>;
  onReordenar: (lista: ClienteTodos[]) => void;
  // Textos
  t: {
    filtroTodos: string;
    filtroAtrasados: string;
    filtroPagas: string;
    tipoFiltro: string;
    statusFiltro: string;
    tipoTodos: string;
    tipoNovo: string;
    tipoRenovacao: string;
    tipoRenegociacao: string;
    stTodos: string;
    stAtivo: string;
    stVencido: string;
    stQuitado: string;
    stRenegociado: string;
    ocultarLiquidacao: string;
  };
}

export default function FiltrosDrawer({
  visible,
  drawerAnim,
  drawerWidth,
  onClose,
  lang,
  tab,
  ord,
  setOrd,
  filtro,
  setFiltro,
  cntTotal,
  cntAtraso,
  cntPagas,
  filtroTipo,
  setFiltroTipo,
  filtroStatus,
  setFiltroStatus,
  ocultarLiquidacao,
  setOcultarLiquidacao,
  liqId,
  clientesLiqIdsCount,
  todosList,
  ordemRotaMap,
  onReordenar,
  t,
}: FiltrosDrawerProps) {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={S.drawerOverlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View 
        style={[
          S.drawer, 
          { 
            width: drawerWidth, 
            right: 0,
            transform: [{ translateX: drawerAnim }] 
          }
        ]}
      >
        <View style={S.drawerHeader}>
          <Text style={S.drawerTitle}>{lang === 'es' ? 'Filtros' : 'Filtros'}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={S.drawerContent} showsVerticalScrollIndicator={false}>
          {/* ─── Seção: Ordenação (apenas no modo Liquidação) ─── */}
          {tab === 'liquidacao' && (
            <View style={S.drawerSection}>
              <Text style={S.drawerSectionTitle}>
                <Ionicons name="swap-vertical-outline" size={16} color="#6B7280" /> {lang === 'es' ? 'Ordenar por' : 'Ordenar por'}
              </Text>
              {(['rota', 'nome'] as OrdenacaoLiquidacao[]).map(o => (
                <TouchableOpacity
                  key={o}
                  style={[S.drawerOption, ord === o && S.drawerOptionActive]}
                  onPress={() => { setOrd(o); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={o === 'rota' ? 'map-outline' : 'person-outline'}
                    size={18}
                    color={ord === o ? '#2563EB' : '#6B7280'}
                  />
                  <Text style={[S.drawerOptionText, ord === o && S.drawerOptionTextActive]}>
                    {o === 'rota' ? (lang === 'es' ? 'Orden de ruta' : 'Ordem da rota') : (lang === 'es' ? 'Nombre' : 'Nome')}
                  </Text>
                  {ord === o && <Ionicons name="checkmark" size={18} color="#2563EB" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ─── Seção: Filtros de Status (modo Liquidação) ─── */}
          {tab === 'liquidacao' && (
            <View style={S.drawerSection}>
              <Text style={S.drawerSectionTitle}>
                <Ionicons name="funnel-outline" size={16} color="#6B7280" /> {lang === 'es' ? 'Filtrar por' : 'Filtrar por'}
              </Text>
              {[
                { k: 'todos' as FiltroLiquidacao, l: t.filtroTodos, cnt: cntTotal, icon: 'people-outline' as const },
                { k: 'atrasados' as FiltroLiquidacao, l: t.filtroAtrasados, cnt: cntAtraso, icon: 'alert-circle-outline' as const },
                { k: 'pagas' as FiltroLiquidacao, l: t.filtroPagas, cnt: cntPagas, icon: 'checkmark-circle-outline' as const },
              ].map(f => (
                <TouchableOpacity
                  key={f.k}
                  style={[S.drawerOption, filtro === f.k && S.drawerOptionActive]}
                  onPress={() => { setFiltro(f.k); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={f.icon} size={18} color={filtro === f.k ? '#2563EB' : '#6B7280'} />
                  <Text style={[S.drawerOptionText, filtro === f.k && S.drawerOptionTextActive]}>
                    {f.l}
                  </Text>
                  <View style={[S.drawerBadge, filtro === f.k && S.drawerBadgeActive]}>
                    <Text style={[S.drawerBadgeText, filtro === f.k && S.drawerBadgeTextActive]}>{f.cnt}</Text>
                  </View>
                  {filtro === f.k && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ─── Seção: Filtros (modo Todos) ─── */}
          {tab === 'todos' && (
            <>
              <View style={S.drawerSection}>
                <Text style={S.drawerSectionTitle}>
                  <Ionicons name="pricetag-outline" size={16} color="#6B7280" /> {t.tipoFiltro || 'Tipo'}
                </Text>
                {[
                  { k: 'todos', l: t.tipoTodos },
                  { k: 'NOVO', l: t.tipoNovo },
                  { k: 'RENOVACAO', l: t.tipoRenovacao },
                  { k: 'RENEGOCIACAO', l: t.tipoRenegociacao },
                ].map(o => (
                  <TouchableOpacity
                    key={o.k}
                    style={[S.drawerOption, filtroTipo === o.k && S.drawerOptionActive]}
                    onPress={() => { setFiltroTipo(o.k); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.drawerOptionText, filtroTipo === o.k && S.drawerOptionTextActive]}>{o.l}</Text>
                    {filtroTipo === o.k && <Ionicons name="checkmark" size={18} color="#2563EB" style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={S.drawerSection}>
                <Text style={S.drawerSectionTitle}>
                  <Ionicons name="flag-outline" size={16} color="#6B7280" /> {t.statusFiltro || 'Status'}
                </Text>
                {[
                  { k: 'todos', l: t.stTodos },
                  { k: 'ATIVO', l: t.stAtivo },
                  { k: 'VENCIDO', l: t.stVencido },
                  { k: 'QUITADO', l: t.stQuitado },
                  { k: 'RENEGOCIADO', l: t.stRenegociado },
                ].map(o => (
                  <TouchableOpacity
                    key={o.k}
                    style={[S.drawerOption, filtroStatus === o.k && S.drawerOptionActive]}
                    onPress={() => { setFiltroStatus(o.k); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.drawerOptionText, filtroStatus === o.k && S.drawerOptionTextActive]}>{o.l}</Text>
                    {filtroStatus === o.k && <Ionicons name="checkmark" size={18} color="#2563EB" style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Ocultar da liquidação */}
              {liqId && (
                <View style={S.drawerSection}>
                  <TouchableOpacity
                    style={S.drawerToggleRow}
                    onPress={() => setOcultarLiquidacao(!ocultarLiquidacao)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={S.drawerToggleLabel}>{t.ocultarLiquidacao || 'Ocultar clientes da liquidação'}</Text>
                      {ocultarLiquidacao && clientesLiqIdsCount > 0 && (
                        <Text style={S.drawerToggleSub}>-{clientesLiqIdsCount} clientes</Text>
                      )}
                    </View>
                    <Switch
                      value={ocultarLiquidacao}
                      onValueChange={setOcultarLiquidacao}
                      trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                      thumbColor="#FFF"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Botão Reordenar */}
              <View style={S.drawerSection}>
                <TouchableOpacity
                  style={S.drawerReorderBtn}
                  onPress={() => {
                    const lista = [...todosList].sort((a, b) => {
                      const oa = ordemRotaMap.get(a.id) ?? 9999;
                      const ob = ordemRotaMap.get(b.id) ?? 9999;
                      if (oa !== ob) return oa - ob;
                      return a.nome.localeCompare(b.nome);
                    });
                    onReordenar(lista);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="reorder-four-outline" size={20} color="#2563EB" />
                  <Text style={S.drawerReorderText}>{lang === 'es' ? 'Reordenar clientes' : 'Reordenar clientes'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Botão Aplicar/Fechar */}
          <TouchableOpacity style={S.drawerApplyBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={S.drawerApplyText}>{lang === 'es' ? 'Aplicar' : 'Aplicar'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  drawerSection: {
    marginBottom: 24,
  },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  drawerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  drawerOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  drawerOptionText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  drawerOptionTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  drawerBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  drawerBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  drawerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  drawerBadgeTextActive: {
    color: '#2563EB',
  },
  drawerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  drawerToggleLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  drawerToggleSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  drawerReorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  drawerReorderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  drawerApplyBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  drawerApplyText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});