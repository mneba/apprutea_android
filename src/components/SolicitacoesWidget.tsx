// SolicitacoesWidget.tsx
// Componente que mostra ícone de sino com badge e abre modal com lista de solicitações

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../services/supabase';

// ============================================================
// TIPOS
// ============================================================
interface Solicitacao {
  id: string;
  tipo_solicitacao: string;
  status: string;
  motivo_solicitacao: string;
  created_at: string;
  expira_em: string;
  data_resolucao: string | null;
  motivo_resolucao: string | null;
  cliente_nome?: string;
  parcela_numero?: number;
  valor_pago?: number;
}

interface Props {
  vendedorId: string;
  rotaId: string;
  lang?: 'pt-BR' | 'es';
}

// ============================================================
// TRADUÇÕES
// ============================================================
const translations = {
  'pt-BR': {
    titulo: 'Minhas Solicitações',
    ultimos30Dias: 'Últimos 30 dias',
    semSolicitacoes: 'Nenhuma solicitação encontrada',
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    expirado: 'Expirado',
    cancelado: 'Cancelado',
    estornoPagamento: 'Estorno de Pagamento',
    aberturaRetroativa: 'Abertura Retroativa',
    aberturaDiasFaltantes: 'Dias Faltantes',
    vendaExcedeLimite: 'Venda Excede Limite',
    renovacaoExcedeLimite: 'Renovação Excede Limite',
    despesaExcedeLimite: 'Despesa Excede Limite',
    receitaExcedeLimite: 'Receita Excede Limite',
    cancelarEmprestimo: 'Cancelar Empréstimo',
    reabrirLiquidacao: 'Reabrir Liquidação',
    quitarComDesconto: 'Quitar com Desconto',
    clienteOutraRota: 'Cliente de Outra Rota',
    parcela: 'Parcela',
    motivo: 'Motivo',
    resolucao: 'Resolução',
    aguardandoAprovacao: 'Aguardando aprovação',
    fechar: 'Fechar',
    carregando: 'Carregando...',
    erro: 'Erro ao carregar',
  },
  'es': {
    titulo: 'Mis Solicitudes',
    ultimos30Dias: 'Últimos 30 días',
    semSolicitacoes: 'Ninguna solicitud encontrada',
    pendente: 'Pendiente',
    aprovado: 'Aprobado',
    rejeitado: 'Rechazado',
    expirado: 'Expirado',
    cancelado: 'Cancelado',
    estornoPagamento: 'Reversión de Pago',
    aberturaRetroativa: 'Apertura Retroactiva',
    aberturaDiasFaltantes: 'Días Faltantes',
    vendaExcedeLimite: 'Venta Excede Límite',
    renovacaoExcedeLimite: 'Renovación Excede Límite',
    despesaExcedeLimite: 'Gasto Excede Límite',
    receitaExcedeLimite: 'Ingreso Excede Límite',
    cancelarEmprestimo: 'Cancelar Préstamo',
    reabrirLiquidacao: 'Reabrir Liquidación',
    quitarComDesconto: 'Liquidar con Descuento',
    clienteOutraRota: 'Cliente de Otra Ruta',
    parcela: 'Cuota',
    motivo: 'Motivo',
    resolucao: 'Resolución',
    aguardandoAprovacao: 'Esperando aprobación',
    fechar: 'Cerrar',
    carregando: 'Cargando...',
    erro: 'Error al cargar',
  },
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export const SolicitacoesWidget: React.FC<Props> = ({ vendedorId, rotaId, lang = 'pt-BR' }) => {
  const t = translations[lang] || translations['pt-BR'];
  
  const [modalVisible, setModalVisible] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [temNovasResolucoes, setTemNovasResolucoes] = useState(false);
  const [countPendentes, setCountPendentes] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const STORAGE_KEY = `@solicitacoes_ultima_viz_${vendedorId}`;

  // ============================================================
  // VERIFICAR NOVAS RESOLUÇÕES
  // ============================================================
  const verificarNovasResolucoes = useCallback(async () => {
    if (!vendedorId || !rotaId) return;
    
    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);
      
      // Buscar última visualização do storage
      const ultimaViz = await AsyncStorage.getItem(STORAGE_KEY);
      
      // Buscar count de pendentes
      const { count: pendentes } = await supabase
        .from('solicitacoes_autorizacao')
        .select('id', { count: 'exact', head: true })
        .eq('vendedor_id', vendedorId)
        .eq('rota_id', rotaId)
        .eq('status', 'PENDENTE')
        .gte('created_at', dataLimite.toISOString());

      setCountPendentes(pendentes || 0);

      // Buscar resoluções recentes (aprovadas/rejeitadas)
      let query = supabase
        .from('solicitacoes_autorizacao')
        .select('id, data_resolucao')
        .eq('vendedor_id', vendedorId)
        .eq('rota_id', rotaId)
        .in('status', ['APROVADO', 'REJEITADO'])
        .not('data_resolucao', 'is', null)
        .gte('created_at', dataLimite.toISOString())
        .order('data_resolucao', { ascending: false })
        .limit(1);

      // Se tem última visualização, buscar apenas resoluções mais recentes
      if (ultimaViz) {
        query = query.gt('data_resolucao', ultimaViz);
      }

      const { data: novasResolucoes } = await query;

      // Se encontrou resoluções não vistas, mostrar badge
      if (novasResolucoes && novasResolucoes.length > 0) {
        setTemNovasResolucoes(true);
      }
    } catch (e) {
      console.error('[SOLICITACOES] Erro ao verificar:', e);
    }
  }, [vendedorId, rotaId, STORAGE_KEY]);

  // ============================================================
  // MARCAR COMO VISUALIZADO
  // ============================================================
  const marcarComoVisualizado = useCallback(async () => {
    try {
      const agora = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, agora);
      setTemNovasResolucoes(false);
    } catch (e) {
      console.error('[SOLICITACOES] Erro ao salvar visualização:', e);
    }
  }, [STORAGE_KEY]);

  // ============================================================
  // CARREGAR SOLICITAÇÕES (apenas quando abre modal)
  // ============================================================
  const carregarSolicitacoes = useCallback(async () => {
    if (!vendedorId || !rotaId) return;
    
    setLoading(true);
    setErro(null);
    
    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);
      
      const { data, error } = await supabase
        .from('solicitacoes_autorizacao')
        .select(`
          id,
          tipo_solicitacao,
          status,
          motivo_solicitacao,
          created_at,
          expira_em,
          data_resolucao,
          motivo_resolucao,
          cliente_id,
          parcela_id,
          clientes:cliente_id (nome),
          emprestimo_parcelas:parcela_id (numero_parcela, valor_pago)
        `)
        .eq('vendedor_id', vendedorId)
        .eq('rota_id', rotaId)
        .gte('created_at', dataLimite.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((s: any) => ({
        ...s,
        cliente_nome: s.clientes?.nome || null,
        parcela_numero: s.emprestimo_parcelas?.numero_parcela || null,
        valor_pago: s.emprestimo_parcelas?.valor_pago || null,
      }));

      setSolicitacoes(mapped);
      
    } catch (e: any) {
      console.error('[SOLICITACOES] Erro:', e);
      setErro(e.message || t.erro);
    } finally {
      setLoading(false);
    }
  }, [vendedorId, rotaId, t.erro]);

  // ============================================================
  // EFEITOS
  // ============================================================
  // Verificar no mount
  useEffect(() => {
    verificarNovasResolucoes();
  }, [verificarNovasResolucoes]);

  // Polling a cada 2 minutos para verificar novas resoluções
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      verificarNovasResolucoes();
    }, 120000); // 2 minutos

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [verificarNovasResolucoes]);

  // Quando abre o modal
  useEffect(() => {
    if (modalVisible) {
      carregarSolicitacoes();
      marcarComoVisualizado();
    }
  }, [modalVisible, carregarSolicitacoes, marcarComoVisualizado]);

  // ============================================================
  // HELPERS
  // ============================================================
  const getTipoLabel = (tipo: string): string => {
    const map: Record<string, keyof typeof t> = {
      'ESTORNO_PAGAMENTO': 'estornoPagamento',
      'ABERTURA_RETROATIVA': 'aberturaRetroativa',
      'ABERTURA_DIAS_FALTANTES': 'aberturaDiasFaltantes',
      'VENDA_EXCEDE_LIMITE': 'vendaExcedeLimite',
      'RENOVACAO_EXCEDE_LIMITE': 'renovacaoExcedeLimite',
      'DESPESA_EXCEDE_LIMITE': 'despesaExcedeLimite',
      'RECEITA_EXCEDE_LIMITE': 'receitaExcedeLimite',
      'CANCELAR_EMPRESTIMO': 'cancelarEmprestimo',
      'REABRIR_LIQUIDACAO': 'reabrirLiquidacao',
      'QUITAR_COM_DESCONTO': 'quitarComDesconto',
      'CLIENTE_OUTRA_ROTA': 'clienteOutraRota',
    };
    return t[map[tipo] || 'estornoPagamento'] as string;
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; iconName: keyof typeof Ionicons.glyphMap }> = {
      'PENDENTE': { label: t.pendente, color: '#D97706', bg: '#FEF3C7', iconName: 'time-outline' },
      'APROVADO': { label: t.aprovado, color: '#059669', bg: '#D1FAE5', iconName: 'checkmark-circle-outline' },
      'REJEITADO': { label: t.rejeitado, color: '#DC2626', bg: '#FEE2E2', iconName: 'close-circle-outline' },
      'EXPIRADO': { label: t.expirado, color: '#6B7280', bg: '#F3F4F6', iconName: 'alert-circle-outline' },
      'CANCELADO': { label: t.cancelado, color: '#9CA3AF', bg: '#F9FAFB', iconName: 'ban-outline' },
    };
    return configs[status] || configs['PENDENTE'];
  };

  const formatarData = (data: string) => {
    const d = new Date(data);
    return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'pt-BR', {
      style: 'currency',
      currency: lang === 'es' ? 'COP' : 'BRL',
      minimumFractionDigits: 2,
    }).format(valor);
  };

  // ============================================================
  // RENDER ITEM
  // ============================================================
  const renderItem = ({ item }: { item: Solicitacao }) => {
    const statusConfig = getStatusConfig(item.status);
    
    return (
      <View style={S.card}>
        <View style={S.cardHeader}>
          <View style={S.cardTipo}>
            <Text style={S.cardTipoText}>{getTipoLabel(item.tipo_solicitacao)}</Text>
          </View>
          <View style={[S.cardStatus, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.iconName} size={14} color={statusConfig.color} />
            <Text style={[S.cardStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        {item.cliente_nome && (
          <View style={S.cardInfo}>
            <Ionicons name="person-outline" size={16} color="#6B7280" />
            <Text style={S.cardInfoText} numberOfLines={1}>{item.cliente_nome}</Text>
          </View>
        )}
        {item.parcela_numero && (
          <View style={S.cardInfo}>
            <Ionicons name="document-text-outline" size={16} color="#6B7280" />
            <Text style={S.cardInfoText}>
              {t.parcela} {item.parcela_numero}
              {item.valor_pago ? ` • ${formatarValor(item.valor_pago)}` : ''}
            </Text>
          </View>
        )}

        <View style={S.cardMotivo}>
          <Text style={S.cardMotivoLabel}>{t.motivo}:</Text>
          <Text style={S.cardMotivoText} numberOfLines={2}>{item.motivo_solicitacao}</Text>
        </View>

        {item.data_resolucao && item.motivo_resolucao && (
          <View style={[S.cardResolucao, { backgroundColor: statusConfig.bg }]}>
            <Text style={[S.cardResolucaoLabel, { color: statusConfig.color }]}>{t.resolucao}:</Text>
            <Text style={S.cardResolucaoText} numberOfLines={2}>{item.motivo_resolucao}</Text>
          </View>
        )}

        <View style={S.cardFooter}>
          <Text style={S.cardData}>{formatarData(item.created_at)}</Text>
          {item.status === 'PENDENTE' && (
            <Text style={S.cardAguardando}>{t.aguardandoAprovacao}</Text>
          )}
        </View>
      </View>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  // Badge vermelho: mostrar quando há novas resoluções OU pendentes
  const showBadge = temNovasResolucoes || countPendentes > 0;

  return (
    <>
      {/* Ícone de sino */}
      <TouchableOpacity 
        style={S.iconButton} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={temNovasResolucoes ? "notifications" : "notifications-outline"} 
          size={20} 
          color="rgba(255,255,255,0.9)" 
        />
        {showBadge && (
          <View style={[S.badge, temNovasResolucoes && S.badgeAlert]}>
            {countPendentes > 0 && !temNovasResolucoes ? (
              <Text style={S.badgeText}>{countPendentes > 9 ? '9+' : countPendentes}</Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={S.modalContainer}>
          <View style={S.modalHeader}>
            <View style={S.modalHeaderLeft}>
              <Text style={S.modalTitle}>{t.titulo}</Text>
              <Text style={S.modalSubtitle}>{t.ultimos30Dias}</Text>
            </View>
            <TouchableOpacity 
              style={S.modalClose} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={S.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={S.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={S.loadingText}>{t.carregando}</Text>
            </View>
          ) : erro ? (
            <View style={S.erroContainer}>
              <Text style={S.erroText}>{erro}</Text>
            </View>
          ) : solicitacoes.length === 0 ? (
            <View style={S.emptyContainer}>
              <Ionicons name="mail-open-outline" size={56} color="#D1D5DB" />
              <Text style={S.emptyText}>{t.semSolicitacoes}</Text>
            </View>
          ) : (
            <FlatList
              data={solicitacoes}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={S.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={S.modalFooter}>
            <TouchableOpacity 
              style={S.fecharButton} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={S.fecharButtonText}>{t.fechar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ============================================================
// ESTILOS
// ============================================================
const S = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeAlert: {
    backgroundColor: '#EF4444',
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    paddingHorizontal: 0,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  fecharButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  fecharButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  listContent: {
    padding: 16,
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTipo: {
    flex: 1,
  },
  cardTipoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  cardStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  cardInfoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  cardMotivo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardMotivoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  cardMotivoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  cardResolucao: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  cardResolucaoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardResolucaoText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardData: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardAguardando: {
    fontSize: 11,
    color: '#D97706',
    fontStyle: 'italic',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  erroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  erroText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default SolicitacoesWidget;