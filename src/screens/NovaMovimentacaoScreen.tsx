import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { supabase } from '../services/supabase';

// ============================================================
// TIPOS
// ============================================================

interface Categoria {
  id: string;
  codigo: string;
  nome_pt: string;
  tipo_movimento: string; // "RECEBER" | "PAGAR" | "AMBOS"
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function NovaMovimentacaoScreen({ navigation }: any) {
  const { vendedor } = useAuth();
  const liqCtx = useLiquidacaoContext();

  // -----------------------------------------------------------
  // ESTADOS
  // -----------------------------------------------------------
  const [tipo, setTipo] = useState<'RECEBER' | 'PAGAR'>('RECEBER');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  // Categorias
  const [todasCategorias, setTodasCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [categoriaBusca, setCategoriaBusca] = useState('');
  const categoriaBuscaRef = useRef<TextInput>(null);

  // Submit
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [valorConfirmado, setValorConfirmado] = useState('');
  const [descConfirmada, setDescConfirmada] = useState('');

  // -----------------------------------------------------------
  // CARREGAR CATEGORIAS
  // -----------------------------------------------------------
  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    setCategoriasLoading(true);
    try {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('id, codigo, nome_pt, tipo_movimento')
        .eq('ativo', true)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw error;

      const cats = data || [];
      setTodasCategorias(cats);

      // Auto-selecionar primeira categoria compatível com RECEBER
      const primeira = cats.find(
        (c) => c.tipo_movimento === 'RECEBER' || c.tipo_movimento === 'AMBOS'
      );
      if (primeira) setCategoria(primeira.codigo);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setCategoriasLoading(false);
    }
  };

  // -----------------------------------------------------------
  // CATEGORIAS FILTRADAS PELO TIPO
  // -----------------------------------------------------------
  const categoriasFiltradas = todasCategorias.filter(
    (c) => c.tipo_movimento === tipo || c.tipo_movimento === 'AMBOS'
  );

  const categoriaNome = todasCategorias.find((c) => c.codigo === categoria)?.nome_pt || '';

  // -----------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------
  const handleTipoChange = (novoTipo: 'RECEBER' | 'PAGAR') => {
    setTipo(novoTipo);
    // Resetar categoria para primeira compatível
    const cats = todasCategorias.filter(
      (c) => c.tipo_movimento === novoTipo || c.tipo_movimento === 'AMBOS'
    );
    if (cats.length > 0) {
      setCategoria(cats[0].codigo);
    } else {
      setCategoria('');
    }
  };

  const handleValorChange = (text: string) => {
    const numeros = text.replace(/[^\d]/g, '');
    if (!numeros) {
      setValor('');
      return;
    }
    const numVal = parseInt(numeros, 10) / 100;
    setValor(numVal.toFixed(2));
  };

  const valorNumerico = parseFloat(valor) || 0;

  const formatarValor = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  // -----------------------------------------------------------
  // SUBMIT
  // -----------------------------------------------------------
  const handleSubmit = async () => {
    // Etapa 1 - Validação
    if (valorNumerico <= 0) {
      Alert.alert('Valor inválido', 'Insira um valor válido para a movimentação.');
      return;
    }

    // Etapa 2 - IDs de contexto
    const vendedorId = vendedor?.id;
    let rotaId = vendedor?.rota_id || null;
    const empresaId = vendedor?.empresa_id || null;

    if (!vendedorId || !empresaId) {
      Alert.alert('Erro de sessão', 'Dados de sessão inválidos. Faça login novamente.');
      return;
    }

    // Buscar rota se não tem
    if (!rotaId && vendedorId) {
      try {
        const { data: rotaData } = await supabase
          .from('rotas')
          .select('id')
          .eq('vendedor_id', vendedorId)
          .single();
        if (rotaData) {
          rotaId = rotaData.id;
        } else {
          Alert.alert('Erro', 'Rota não encontrada para este vendedor.');
          return;
        }
      } catch (err) {
        Alert.alert('Erro', 'Rota não encontrada para este vendedor.');
        return;
      }
    }

    setEnviando(true);
    try {
      // Etapa 3 - Buscar liquidação ABERTA
      const { data: liqData, error: liqError } = await supabase
        .from('liquidacoes_diarias')
        .select('id')
        .eq('rota_id', rotaId)
        .in('status', ['ABERTO', 'ABERTA'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liqError || !liqData) {
        Alert.alert(
          'Liquidação não encontrada',
          'Nenhuma liquidação aberta encontrada. Abra uma liquidação antes de registrar movimentações.'
        );
        return;
      }

      // Etapa 4 - RPC
      const { data, error } = await supabase.rpc('fn_criar_lancamento_financeiro', {
        p_tipo: tipo,
        p_categoria: categoria,
        p_valor: valorNumerico,
        p_rota_id: rotaId,
        p_empresa_id: empresaId,
        p_liquidacao_id: liqData.id,
        p_descricao: descricao.trim() || '',
        p_vendedor_id: vendedorId,
      });

      if (error) throw error;

      // Sucesso
      setValorConfirmado(formatarValor(valorNumerico));
      setDescConfirmada(descricao.trim() || categoriaNome);
      setSucesso(true);

      // Recarregar liquidação
      liqCtx.recarregarLiquidacao();
    } catch (err: any) {
      console.error('Erro ao registrar movimentação:', err);
      Alert.alert('Erro', err?.message || 'Erro inesperado ao registrar movimentação.');
    } finally {
      setEnviando(false);
    }
  };

  // -----------------------------------------------------------
  // FECHAR TELA
  // -----------------------------------------------------------
  const handleClose = () => {
    const temDados = valor || descricao;
    if (temDados) {
      Alert.alert('Cancelar?', 'Os dados preenchidos serão perdidos.', [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim, cancelar', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  // -----------------------------------------------------------
  // TELA DE SUCESSO
  // -----------------------------------------------------------
  if (sucesso) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MOVIMENTAÇÃO</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.sucessoContainer}>
          <View style={styles.sucessoCircle}>
            <Text style={styles.sucessoIcon}>✓</Text>
          </View>
          <Text style={styles.sucessoTitle}>Movimentação Registrada!</Text>
          <Text style={styles.sucessoSubtitle}>
            {tipo === 'RECEBER' ? '✅ Entrada' : '✅ Saída'} de R$ {valorConfirmado}
          </Text>
          {descConfirmada ? (
            <Text style={styles.sucessoDesc}>{descConfirmada}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.sucessoCloseBtn}
            onPress={() => {
              liqCtx.recarregarLiquidacao();
              navigation.goBack();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.sucessoCloseBtnText}>✓ Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------
  // RENDER FORMULÁRIO
  // -----------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NOVA MOVIMENTAÇÃO</Text>
        <TouchableOpacity style={styles.headerCloseBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={styles.headerCloseBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================== */}
        {/* TIPO DE MOVIMENTAÇÃO           */}
        {/* ============================== */}
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.fieldLabel}>
              Tipo de movimentação <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.tipoRow}>
              <TouchableOpacity
                style={[
                  styles.tipoBtn,
                  tipo === 'RECEBER' && styles.tipoBtnEntradaActive,
                ]}
                onPress={() => handleTipoChange('RECEBER')}
                activeOpacity={0.7}
              >
                <Text style={styles.tipoBtnIcon}>↓</Text>
                <Text
                  style={[
                    styles.tipoBtnText,
                    tipo === 'RECEBER' && styles.tipoBtnTextEntradaActive,
                  ]}
                >
                  ENTRADA
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tipoBtn,
                  tipo === 'PAGAR' && styles.tipoBtnSaidaActive,
                ]}
                onPress={() => handleTipoChange('PAGAR')}
                activeOpacity={0.7}
              >
                <Text style={styles.tipoBtnIcon}>↑</Text>
                <Text
                  style={[
                    styles.tipoBtnText,
                    tipo === 'PAGAR' && styles.tipoBtnTextSaidaActive,
                  ]}
                >
                  SAÍDA
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ============================== */}
        {/* CATEGORIA                      */}
        {/* ============================== */}
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.fieldLabel}>
              Categoria <Text style={styles.required}>*</Text>
            </Text>
            {categoriasLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#2563EB" size="small" />
                <Text style={styles.loadingText}>Carregando categorias...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setShowCategoriaModal(true)}
                activeOpacity={0.7}
              >
                <Text style={categoriaNome ? styles.selectFieldText : styles.selectFieldPlaceholder}>
                  {categoriaNome || 'Selecione uma categoria...'}
                </Text>
                <Text style={styles.selectFieldChevron}>▼</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ============================== */}
        {/* VALOR                          */}
        {/* ============================== */}
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.fieldLabel}>
              Valor <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.valorInputRow}>
              <Text style={styles.valorPrefix}>R$</Text>
              <TextInput
                style={styles.valorInput}
                value={valor ? formatarValor(valorNumerico) : ''}
                onChangeText={handleValorChange}
                placeholder="0,00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* ============================== */}
        {/* DESCRIÇÃO                      */}
        {/* ============================== */}
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.fieldLabel}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={descricao}
              onChangeText={setDescricao}
              placeholder={
                tipo === 'RECEBER'
                  ? 'Ex: Aporte de capital'
                  : 'Ex: Gasolina do dia'
              }
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ============================== */}
        {/* RESUMO                         */}
        {/* ============================== */}
        {valorNumerico > 0 && (
          <View style={[styles.section, styles.resumoSection]}>
            <View style={styles.sectionBody}>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Tipo:</Text>
                <Text style={styles.resumoValue}>
                  {tipo === 'RECEBER' ? '✅ Entrada' : '✅ Saída'}
                </Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Categoria:</Text>
                <Text style={styles.resumoValue}>{categoriaNome}</Text>
              </View>
              <View style={styles.resumoDivider} />
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabelBold}>Valor:</Text>
                <Text style={styles.resumoValueBold}>R$ {formatarValor(valorNumerico)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Botão REGISTRAR */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            valorNumerico > 0 ? styles.submitBtnEnabled : styles.submitBtnDisabled,
            enviando && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={enviando || valorNumerico <= 0}
        >
          {enviando ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitBtnText}>Registrando...</Text>
            </View>
          ) : (
            <Text
              style={[
                styles.submitBtnText,
                valorNumerico <= 0 && styles.submitBtnTextDisabled,
              ]}
            >
              ✓ REGISTRAR MOVIMENTAÇÃO
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ================================================ */}
      {/* MODAL: Seleção de Categoria                      */}
      {/* ================================================ */}
      <Modal
        visible={showCategoriaModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowCategoriaModal(false); setCategoriaBusca(''); }}
        onShow={() => setTimeout(() => categoriaBuscaRef.current?.focus(), 300)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => { setShowCategoriaModal(false); setCategoriaBusca(''); }}
        >
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecione a categoria</Text>
              <TouchableOpacity onPress={() => { setShowCategoriaModal(false); setCategoriaBusca(''); }}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Busca */}
            <View style={styles.pickerSearchWrapper}>
              <TextInput
                ref={categoriaBuscaRef}
                style={styles.pickerSearchInput}
                value={categoriaBusca}
                onChangeText={setCategoriaBusca}
                placeholder="Buscar categoria..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {categoriaBusca.length > 0 && (
                <TouchableOpacity
                  style={styles.pickerSearchClear}
                  onPress={() => setCategoriaBusca('')}
                >
                  <Text style={styles.pickerSearchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {categoriasFiltradas
                .filter((c) => {
                  if (!categoriaBusca.trim()) return true;
                  return c.nome_pt.toLowerCase().includes(categoriaBusca.toLowerCase().trim());
                })
                .map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.pickerItem,
                      categoria === cat.codigo && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setCategoria(cat.codigo);
                      setShowCategoriaModal(false);
                      setCategoriaBusca('');
                    }}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        categoria === cat.codigo && styles.pickerItemTextActive,
                      ]}
                    >
                      {cat.nome_pt}
                    </Text>
                    {cat.tipo_movimento === 'AMBOS' && (
                      <Text style={styles.pickerItemBadge}>↕</Text>
                    )}
                  </TouchableOpacity>
                ))}

              {categoriasFiltradas.filter((c) =>
                !categoriaBusca.trim() || c.nome_pt.toLowerCase().includes(categoriaBusca.toLowerCase().trim())
              ).length === 0 && (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>Nenhuma categoria encontrada</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  // Header
  header: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCloseBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionBody: { padding: 20 },

  // Fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  required: { color: '#EF4444', fontWeight: '700' },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: { minHeight: 64, textAlignVertical: 'top' },

  // Tipo
  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  tipoBtnEntradaActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  tipoBtnSaidaActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  tipoBtnIcon: { fontSize: 20 },
  tipoBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  tipoBtnTextEntradaActive: { color: '#16A34A' },
  tipoBtnTextSaidaActive: { color: '#DC2626' },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 14, color: '#6B7280' },

  // Select
  selectField: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectFieldText: { fontSize: 15, color: '#111827', flex: 1 },
  selectFieldPlaceholder: { fontSize: 15, color: '#9CA3AF', flex: 1 },
  selectFieldChevron: { fontSize: 10, color: '#9CA3AF', marginLeft: 8 },

  // Valor
  valorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  valorPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 8,
  },
  valorInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 14,
  },

  // Resumo
  resumoSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    backgroundColor: '#F8FAFF',
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resumoLabel: { fontSize: 14, color: '#6B7280' },
  resumoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  resumoDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  resumoLabelBold: { fontSize: 16, fontWeight: '700', color: '#374151' },
  resumoValueBold: { fontSize: 18, fontWeight: '700', color: '#2563EB' },

  // Footer / Botão
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnEnabled: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowColor: 'transparent',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  submitBtnTextDisabled: { color: '#9CA3AF' },

  // Sucesso
  sucessoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sucessoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  sucessoIcon: { fontSize: 36, color: '#fff', fontWeight: '700' },
  sucessoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sucessoSubtitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  sucessoDesc: { fontSize: 14, color: '#6B7280' },
  sucessoCloseBtn: {
    marginTop: 32,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  sucessoCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '88%',
    maxHeight: '70%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  pickerCloseText: { fontSize: 18, color: '#9CA3AF', fontWeight: '600' },
  pickerSearchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerSearchInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  pickerSearchClear: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerSearchClearText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  pickerList: { maxHeight: 400 },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerItemActive: { backgroundColor: '#EFF6FF' },
  pickerItemText: { fontSize: 15, color: '#374151' },
  pickerItemTextActive: { color: '#2563EB', fontWeight: '600' },
  pickerItemBadge: { fontSize: 14, color: '#9CA3AF' },
  pickerEmpty: { padding: 32, alignItems: 'center' },
  pickerEmptyText: { fontSize: 14, color: '#9CA3AF' },
});