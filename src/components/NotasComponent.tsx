import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../services/supabase';

// ==================== TIPOS ====================
export interface Nota {
  id: string;
  empresa_id: string;
  rota_id: string;
  vendedor_id: string;
  autor_id: string;
  autor_nome: string;
  autor_tipo: string;
  liquidacao_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  emprestimo_id: string | null;
  parcela_id: string | null;
  numero_parcela: number | null;
  nota: string;
  prioridade: string;
  status: string;
  obs_local: string;
  data_referencia: string;
  resolvida_por: string | null;
  resolvida_nome: string | null;
  data_resolucao: string | null;
  resolucao_observacao: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

type Language = 'pt-BR' | 'es';

// ==================== TEXTOS ====================
const textos = {
  'pt-BR': {
    notas: 'Notas', notasDoDia: 'Notas do Dia', novaNota: '+ Nova Nota',
    semNotas: 'Nenhuma nota encontrada', carregando: 'Carregando...',
    escreverNota: 'Escrever nota...', salvar: 'Salvar', cancelar: 'Cancelar',
    fechar: 'Fechar', todos: 'Todos', vendedor: 'Vendedor', monitor: 'Monitor',
    prioridade: 'Prioridade', baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente',
    resolver: 'Resolver', resolvida: 'Resolvida', ativa: 'Ativa', arquivada: 'Arquivada',
    incluirNota: 'Incluir nova nota?', sim: 'Sim', nao: 'Não',
    notaSalva: 'Nota salva com sucesso', erroSalvar: 'Erro ao salvar nota',
    paraCliente: 'Para o cliente', paraParcela: 'Para a parcela', parcela: 'Parcela',
    selecioneParcela: 'Selecione a parcela', notaResolvida: 'Nota marcada como resolvida',
    cliente: 'Cliente', observacao: 'Observação de resolução...',
    confirmarResolver: 'Confirmar resolução?',
  },
  'es': {
    notas: 'Notas', notasDoDia: 'Notas del Día', novaNota: '+ Nueva Nota',
    semNotas: 'Ninguna nota encontrada', carregando: 'Cargando...',
    escreverNota: 'Escribir nota...', salvar: 'Guardar', cancelar: 'Cancelar',
    fechar: 'Cerrar', todos: 'Todos', vendedor: 'Vendedor', monitor: 'Monitor',
    prioridade: 'Prioridad', baixa: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente',
    resolver: 'Resolver', resolvida: 'Resuelta', ativa: 'Activa', arquivada: 'Archivada',
    incluirNota: '¿Incluir nueva nota?', sim: 'Sí', nao: 'No',
    notaSalva: 'Nota guardada con éxito', erroSalvar: 'Error al guardar nota',
    paraCliente: 'Para el cliente', paraParcela: 'Para la cuota', parcela: 'Cuota',
    selecioneParcela: 'Seleccione la cuota', notaResolvida: 'Nota marcada como resuelta',
    cliente: 'Cliente', observacao: 'Observación de resolución...',
    confirmarResolver: '¿Confirmar resolución?',
  },
};

// ==================== HELPERS ====================
const corPrioridade: Record<string, { bg: string; text: string; border: string }> = {
  URGENTE: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  ALTA: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  NORMAL: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  BAIXA: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
};

const iconePrioridade: Record<string, string> = {
  URGENTE: '🔴', ALTA: '🟡', NORMAL: '🔵', BAIXA: '🟢',
};

const fmtData = (d: string) => {
  if (!d) return '';
  const dt = new Date(d.includes('T') ? d : d + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const fmtHora = (d: string) => {
  if (!d) return '';
  const raw = d.includes('Z') || d.includes('+') ? d : d.replace(' ', 'T') + 'Z';
  const dt = new Date(raw);
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
  else Alert.alert(title, msg);
};

// ==================== MODAL LISTA DE NOTAS ====================
interface ModalNotasListaProps {
  visible: boolean;
  onClose: () => void;
  rotaId: string;
  empresaId: string;
  vendedorId: string;
  autorNome: string;
  autorTipo?: 'VENDEDOR' | 'MONITOR';
  liquidacaoId?: string | null;
  dataReferencia?: string; // YYYY-MM-DD
  clienteId?: string | null;
  clienteNome?: string | null;
  lang?: Language;
  coords?: { lat: number; lng: number } | null;
  // Se true, mostra botão de nova nota
  permitirCriar?: boolean;
  // obs_local padrão ao criar nova nota
  obsLocalPadrao?: string;
}

export function ModalNotasLista({
  visible, onClose, rotaId, empresaId, vendedorId, autorNome,
  autorTipo = 'VENDEDOR', liquidacaoId, dataReferencia,
  clienteId, clienteNome, lang = 'pt-BR', coords,
  permitirCriar = true, obsLocalPadrao = 'Geral',
}: ModalNotasListaProps) {
  const t = textos[lang];
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalCriarVisible, setModalCriarVisible] = useState(false);

  // Filtros
  const [filtroLocal, setFiltroLocal] = useState<string | null>(null);
  const [filtroAutor, setFiltroAutor] = useState<string | null>(null);

  const carregarNotas = useCallback(async () => {
    if (!rotaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_listar_notas', {
        p_rota_id: rotaId,
        p_data_inicio: dataReferencia || null,
        p_data_fim: dataReferencia || null,
        p_cliente_id: clienteId || null,
        p_liquidacao_id: liquidacaoId || null,
        p_status: null, // todas
        p_prioridade: null,
        p_limite: 100,
      });
      if (error) throw error;
      setNotas((data || []) as Nota[]);
    } catch (e) {
      console.error('Erro ao carregar notas:', e);
    } finally {
      setLoading(false);
    }
  }, [rotaId, dataReferencia, clienteId, liquidacaoId]);

  useEffect(() => {
    if (visible) carregarNotas();
  }, [visible, carregarNotas]);

  // Locais únicos para breadcrumbs
  const locaisUnicos = [...new Set(notas.map(n => n.obs_local).filter(Boolean))];
  
  // Notas filtradas
  const notasFiltradas = notas.filter(n => {
    if (filtroLocal && n.obs_local !== filtroLocal) return false;
    if (filtroAutor && n.autor_tipo !== filtroAutor) return false;
    return true;
  });

  const handleResolver = useCallback(async (nota: Nota) => {
    const executar = async (obs?: string) => {
      try {
        const { data, error } = await supabase.rpc('fn_resolver_nota', {
          p_nota_id: nota.id,
          p_resolvida_por: vendedorId,
          p_resolvida_nome: autorNome,
          p_observacao: obs || null,
        });
        if (error) throw error;
        showAlert('✅', t.notaResolvida);
        carregarNotas();
      } catch (e: any) {
        showAlert('Erro', e.message);
      }
    };

    if (Platform.OS === 'web') {
      const obs = window.prompt(t.observacao);
      if (obs !== null) executar(obs);
    } else {
      Alert.alert(t.confirmarResolver, '', [
        { text: t.cancelar, style: 'cancel' },
        { text: t.resolver, onPress: () => executar() },
      ]);
    }
  }, [vendedorId, autorNome, t, carregarNotas]);

  const renderNota = ({ item: n }: { item: Nota }) => {
    const isExpanded = expanded === n.id;
    const cor = corPrioridade[n.prioridade] || corPrioridade.NORMAL;
    const isResolvida = n.status === 'RESOLVIDA';

    return (
      <TouchableOpacity
        style={[S.notaCard, { borderLeftColor: cor.text, borderLeftWidth: 4 }, isResolvida && S.notaResolvida]}
        onPress={() => setExpanded(isExpanded ? null : n.id)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={S.notaHeader}>
          <View style={S.notaHeaderLeft}>
            <Text style={S.notaPrioridadeIcon}>{iconePrioridade[n.prioridade]}</Text>
            <View style={[S.notaLocalBadge, { backgroundColor: cor.bg, borderColor: cor.border }]}>
              <Text style={[S.notaLocalText, { color: cor.text }]}>{n.obs_local}</Text>
            </View>
            {isResolvida && (
              <View style={S.notaResolvidaBadge}>
                <Text style={S.notaResolvidaText}>✓ {t.resolvida}</Text>
              </View>
            )}
          </View>
          <Text style={S.notaHora}>{fmtHora(n.created_at)}</Text>
        </View>

        {/* Nota texto (truncado se não expandido) */}
        <Text style={[S.notaTexto, isResolvida && S.notaTextoResolvida]} numberOfLines={isExpanded ? undefined : 2}>
          {n.nota}
        </Text>

        {/* Autor */}
        <View style={S.notaFooter}>
          <Text style={S.notaAutor}>
            {n.autor_tipo === 'MONITOR' ? '👁' : '👤'} {n.autor_nome}
          </Text>
          {n.cliente_nome && (
            <Text style={S.notaCliente}>👤 {n.cliente_nome}</Text>
          )}
        </View>

        {/* Detalhes expandidos */}
        {isExpanded && (
          <View style={S.notaDetalhes}>
            {n.numero_parcela && (
              <Text style={S.notaDetalheItem}>📄 {t.parcela} #{n.numero_parcela}</Text>
            )}
            {n.latitude && n.longitude && (
              <Text style={S.notaDetalheItem}>📍 {n.latitude.toFixed(4)}, {n.longitude.toFixed(4)}</Text>
            )}
            {isResolvida && n.resolvida_nome && (
              <View style={S.notaResolucaoBox}>
                <Text style={S.notaResolucaoLabel}>Resolvida por: {n.resolvida_nome}</Text>
                {n.resolucao_observacao && (
                  <Text style={S.notaResolucaoObs}>{n.resolucao_observacao}</Text>
                )}
              </View>
            )}
            {!isResolvida && (
              <TouchableOpacity style={S.btnResolver} onPress={() => handleResolver(n)}>
                <Text style={S.btnResolverText}>✓ {t.resolver}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={S.modalOverlay}>
          <View style={S.modalContainer}>
            {/* Header */}
            <View style={S.modalHeader}>
              <View>
                <Text style={S.modalTitle}>📝 {clienteNome ? `${t.notas} - ${clienteNome}` : t.notasDoDia}</Text>
                <Text style={S.modalSubtitle}>
                  {dataReferencia ? fmtData(dataReferencia) : ''} • {notasFiltradas.length} {t.notas.toLowerCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={S.modalCloseBtn}>
                <Text style={S.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Filtros breadcrumb - obs_local */}
            {locaisUnicos.length > 1 && (
              <View style={S.filtrosRow}>
                <TouchableOpacity
                  style={[S.filtroBadge, !filtroLocal && S.filtroBadgeAtivo]}
                  onPress={() => setFiltroLocal(null)}
                >
                  <Text style={[S.filtroTexto, !filtroLocal && S.filtroTextoAtivo]}>{t.todos}</Text>
                </TouchableOpacity>
                {locaisUnicos.map(local => (
                  <TouchableOpacity
                    key={local}
                    style={[S.filtroBadge, filtroLocal === local && S.filtroBadgeAtivo]}
                    onPress={() => setFiltroLocal(filtroLocal === local ? null : local)}
                  >
                    <Text style={[S.filtroTexto, filtroLocal === local && S.filtroTextoAtivo]}>{local}</Text>
                    <Text style={S.filtroCount}>
                      {notas.filter(n => n.obs_local === local).length}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Filtro autor: Vendedor / Monitor */}
            <View style={S.filtrosRow}>
              <TouchableOpacity
                style={[S.filtroBadge, !filtroAutor && S.filtroBadgeAtivo]}
                onPress={() => setFiltroAutor(null)}
              >
                <Text style={[S.filtroTexto, !filtroAutor && S.filtroTextoAtivo]}>{t.todos}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.filtroBadge, filtroAutor === 'VENDEDOR' && S.filtroBadgeAtivo]}
                onPress={() => setFiltroAutor(filtroAutor === 'VENDEDOR' ? null : 'VENDEDOR')}
              >
                <Text style={[S.filtroTexto, filtroAutor === 'VENDEDOR' && S.filtroTextoAtivo]}>👤 {t.vendedor}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.filtroBadge, filtroAutor === 'MONITOR' && S.filtroBadgeAtivo]}
                onPress={() => setFiltroAutor(filtroAutor === 'MONITOR' ? null : 'MONITOR')}
              >
                <Text style={[S.filtroTexto, filtroAutor === 'MONITOR' && S.filtroTextoAtivo]}>👁 {t.monitor}</Text>
              </TouchableOpacity>
            </View>

            {/* Lista */}
            {loading ? (
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            ) : notasFiltradas.length === 0 ? (
              <View style={S.emptyBox}>
                <Text style={S.emptyIcon}>📝</Text>
                <Text style={S.emptyText}>{t.semNotas}</Text>
              </View>
            ) : (
              <FlatList
                data={notasFiltradas}
                keyExtractor={n => n.id}
                renderItem={renderNota}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              />
            )}

            {/* Botão nova nota */}
            {permitirCriar && (
              <TouchableOpacity style={S.btnNovaNota} onPress={() => setModalCriarVisible(true)}>
                <Text style={S.btnNovaNotaText}>{t.novaNota}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Criar Nota */}
      <ModalCriarNota
        visible={modalCriarVisible}
        onClose={() => setModalCriarVisible(false)}
        onSalvar={() => { setModalCriarVisible(false); carregarNotas(); }}
        rotaId={rotaId}
        empresaId={empresaId}
        vendedorId={vendedorId}
        autorNome={autorNome}
        autorTipo={autorTipo}
        liquidacaoId={liquidacaoId}
        clienteId={clienteId}
        dataReferencia={dataReferencia}
        obsLocal={obsLocalPadrao}
        lang={lang}
        coords={coords}
      />
    </>
  );
}


// ==================== MODAL CRIAR NOTA ====================
interface ModalCriarNotaProps {
  visible: boolean;
  onClose: () => void;
  onSalvar: () => void;
  rotaId: string;
  empresaId: string;
  vendedorId: string;
  autorNome: string;
  autorTipo: 'VENDEDOR' | 'MONITOR';
  liquidacaoId?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  emprestimo_id?: string | null;
  dataReferencia?: string;
  obsLocal?: string;
  lang?: Language;
  coords?: { lat: number; lng: number } | null;
  emprestimoId?: string | null;
}

export function ModalCriarNota({
  visible, onClose, onSalvar, rotaId, empresaId, vendedorId,
  autorNome, autorTipo = 'VENDEDOR', liquidacaoId,
  clienteId, clienteNome, emprestimo_id,
  dataReferencia, obsLocal = 'Geral', lang = 'pt-BR', coords, emprestimoId,
}: ModalCriarNotaProps) {
  const t = textos[lang];
  const inputRef = useRef<TextInput>(null);
  const [notaTexto, setNotaTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  
  // Seletor de parcela removido - parcela é resolvida automaticamente
  const [parcelaAutoId, setParcelaAutoId] = useState<string | null>(null);

  // Focar no input ao abrir
  useEffect(() => {
    if (visible) {
      setNotaTexto('');
      setParcelaAutoId(null);
      setTimeout(() => inputRef.current?.focus(), 300);

      // Resolver parcela automaticamente
      if (emprestimoId) {
        (async () => {
          try {
            // Busca próxima parcela pendente do empréstimo
            const { data } = await supabase
              .from('emprestimo_parcelas')
              .select('id, numero_parcela')
              .eq('emprestimo_id', emprestimoId)
              .in('status', ['PENDENTE', 'PARCIAL', 'ABERTO'])
              .order('numero_parcela', { ascending: true })
              .limit(1);
            if (data && data.length > 0) {
              setParcelaAutoId(data[0].id);
            }
          } catch { }
        })();
      }
    }
  }, [visible, emprestimoId]);

  const handleSalvar = async () => {
    if (!notaTexto.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('fn_criar_nota', {
        p_empresa_id: empresaId,
        p_rota_id: rotaId,
        p_vendedor_id: vendedorId,
        p_autor_id: vendedorId,
        p_autor_nome: autorNome,
        p_autor_tipo: autorTipo,
        p_liquidacao_id: liquidacaoId || null,
        p_cliente_id: clienteId || null,
        p_emprestimo_id: emprestimoId || emprestimo_id || null,
        p_parcela_id: parcelaAutoId || null,
        p_nota: notaTexto.trim(),
        p_prioridade: 'NORMAL',
        p_data_referencia: dataReferencia || new Date().toISOString().split('T')[0],
        p_latitude: coords?.lat || null,
        p_longitude: coords?.lng || null,
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        // Atualizar obs_local separadamente (fn_criar_nota não tem esse param)
        if (res.nota_id) {
          await supabase.from('notas').update({ obs_local: obsLocal }).eq('id', res.nota_id);
        }
        showAlert('✅', t.notaSalva);
        onSalvar();
      } else {
        showAlert('❌', res?.mensagem || t.erroSalvar);
      }
    } catch (e: any) {
      showAlert('❌', e.message || t.erroSalvar);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={[S.modalContainer, { maxHeight: '70%' }]}>
          {/* Header */}
          <View style={S.criarHeader}>
            <Text style={S.criarTitle}>📝 {t.novaNota}</Text>
            <TouchableOpacity onPress={onClose} style={S.modalCloseBtn}>
              <Text style={S.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Info contexto */}
          {clienteNome && (
            <View style={S.criarContexto}>
              <Text style={S.criarContextoText}>👤 {clienteNome}</Text>
              <View style={[S.notaLocalBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Text style={[S.notaLocalText, { color: '#2563EB' }]}>{obsLocal}</Text>
              </View>
            </View>
          )}

          {/* Input nota */}
          <TextInput
            ref={inputRef}
            style={S.criarInput}
            placeholder={t.escreverNota}
            placeholderTextColor="#9CA3AF"
            multiline
            value={notaTexto}
            onChangeText={setNotaTexto}
            textAlignVertical="top"
          />

          {/* Botões */}
          <View style={S.criarBotoes}>
            <TouchableOpacity style={S.btnCancelar} onPress={onClose}>
              <Text style={S.btnCancelarText}>{t.cancelar}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btnSalvar, (!notaTexto.trim() || salvando) && S.btnDesabilitado]}
              onPress={handleSalvar}
              disabled={!notaTexto.trim() || salvando}
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={S.btnSalvarText}>{t.salvar}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ==================== ESTILOS ====================
const S = StyleSheet.create({
  // Modal base
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalCloseX: { fontSize: 16, color: '#6B7280', fontWeight: '600' },

  // Filtros
  filtrosRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  filtroBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 4 },
  filtroBadgeAtivo: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  filtroTexto: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  filtroTextoAtivo: { color: '#2563EB' },
  filtroCount: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', backgroundColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },

  // Nota card
  notaCard: { marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  notaResolvida: { opacity: 0.6 },
  notaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  notaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  notaPrioridadeIcon: { fontSize: 10 },
  notaLocalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  notaLocalText: { fontSize: 10, fontWeight: '600' },
  notaResolvidaBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#D1FAE5' },
  notaResolvidaText: { fontSize: 9, fontWeight: '600', color: '#059669' },
  notaHora: { fontSize: 11, color: '#9CA3AF' },
  notaTexto: { fontSize: 13, color: '#374151', lineHeight: 18 },
  notaTextoResolvida: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  notaFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  notaAutor: { fontSize: 11, color: '#6B7280' },
  notaCliente: { fontSize: 11, color: '#3B82F6' },
  notaDetalhes: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  notaDetalheItem: { fontSize: 11, color: '#6B7280', marginBottom: 3 },
  notaResolucaoBox: { backgroundColor: '#F0FDF4', padding: 8, borderRadius: 6, marginTop: 4 },
  notaResolucaoLabel: { fontSize: 11, fontWeight: '600', color: '#059669' },
  notaResolucaoObs: { fontSize: 11, color: '#374151', marginTop: 2 },

  // Botão resolver
  btnResolver: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#D1FAE5', borderRadius: 8, alignSelf: 'flex-start' },
  btnResolverText: { fontSize: 12, fontWeight: '600', color: '#059669' },

  // Empty
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  // Botão nova nota (dentro da lista)
  btnNovaNota: { marginHorizontal: 16, marginTop: 12, paddingVertical: 12, backgroundColor: '#2563EB', borderRadius: 10, alignItems: 'center' },
  btnNovaNotaText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Criar nota
  criarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  criarTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  criarContexto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  criarContextoText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  criarInput: { marginHorizontal: 16, minHeight: 100, maxHeight: 180, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#FAFAFA' },

  // Botões criar
  criarBotoes: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 10 },
  btnCancelar: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  btnCancelarText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  btnSalvar: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' },
  btnSalvarText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  btnDesabilitado: { opacity: 0.5 },
});