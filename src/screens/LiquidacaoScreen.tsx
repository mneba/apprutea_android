import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { LiquidacaoDiaria } from '../types';

type Language = 'pt-BR' | 'es';

const textos = {
  'pt-BR': {
    titulo: 'Liquidação Diária',
    aberto: 'ABERTO',
    fechado: 'FECHADO',
    verOutrasDatas: 'Ver Outras Datas',
    meta: 'META',
    atual: 'ATUAL',
    progresso: 'PROGRESSO',
    resumoClientes: 'Resumo de Clientes',
    clientesIniciais: 'Clientes Iniciais:',
    clientesNovos: 'Clientes Novos:',
    clientesRenovados: 'Clientes Renovados:',
    clientesRenegociados: 'Clientes Renegociados:',
    clientesCancelados: 'Clientes Cancelados:',
    totalClientes: 'Total de Clientes:',
    controlesFinanceiros: 'Controles Financeiros',
    caixa: 'Caixa',
    inicial: 'Inicial:',
    pagamentos: 'Pagamentos',
    pagos: 'Pagos',
    naoPagos: 'Não pagos:',
    efetividade: 'Efetividade:',
    outrasOperacoes: 'Outras Operações',
    vendas: 'Vendas',
    receitas: 'Receitas',
    despesas: 'Despesas',
    emp: 'emp.',
    pag: 'pag.',
    desp: 'desp.',
    microSeguro: 'MICRO SEGURO',
    totalDoDia: 'Total do Dia',
    quantidade: 'Quantidade',
    encerrarDia: 'Encerrar Dia',
    iniciarDia: 'Iniciar Dia',
    nenhumaLiquidacao: 'Nenhuma liquidação aberta',
  },
  'es': {
    titulo: 'Liquidación Diaria',
    aberto: 'ABIERTO',
    fechado: 'CERRADO',
    verOutrasDatas: 'Ver Otras Fechas',
    meta: 'META',
    atual: 'ACTUAL',
    progresso: 'PROGRESO',
    resumoClientes: 'Resumen de Clientes',
    clientesIniciais: 'Clientes Iniciales:',
    clientesNovos: 'Clientes Nuevos:',
    clientesRenovados: 'Clientes Renovados:',
    clientesRenegociados: 'Clientes Renegociados:',
    clientesCancelados: 'Clientes Cancelados:',
    totalClientes: 'Total de Clientes:',
    controlesFinanceiros: 'Controles Financieros',
    caixa: 'Caja',
    inicial: 'Inicial:',
    pagamentos: 'Pagos',
    pagos: 'Pagados',
    naoPagos: 'No pagados:',
    efetividade: 'Efectividad:',
    outrasOperacoes: 'Otras Operaciones',
    vendas: 'Ventas',
    receitas: 'Ingresos',
    despesas: 'Gastos',
    emp: 'emp.',
    pag: 'pag.',
    desp: 'gast.',
    microSeguro: 'MICRO SEGURO',
    totalDoDia: 'Total del Día',
    quantidade: 'Cantidad',
    encerrarDia: 'Cerrar Día',
    iniciarDia: 'Iniciar Día',
    nenhumaLiquidacao: 'Ninguna liquidación abierta',
  }
};

export default function LiquidacaoScreen({ navigation }: any) {
  const { vendedor } = useAuth();
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [modalIniciarVisible, setModalIniciarVisible] = useState(false);
  const [caixaInicial, setCaixaInicial] = useState('');
  const [salvando, setSalvando] = useState(false);

  const t = textos[language];

  useEffect(() => {
    carregarLiquidacao();
  }, []);

  const carregarLiquidacao = async () => {
    if (!vendedor) return;

    try {
      const { data, error } = await supabase
        .from('liquidacoes_diarias')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .eq('status', 'ABERTA')
        .order('data_abertura', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setLiquidacao(data);
      } else {
        setLiquidacao(null);
      }
    } catch (error) {
      console.error('Erro ao carregar liquidação:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarLiquidacao();
  };

  const toggleLanguage = () => {
    setLanguage(language === 'pt-BR' ? 'es' : 'pt-BR');
  };

  const formatarMoeda = (valor: number | null) => {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularProgresso = () => {
    if (!liquidacao || !liquidacao.valor_esperado_dia) return 0;
    const progresso = ((liquidacao.valor_recebido_dia || 0) / liquidacao.valor_esperado_dia) * 100;
    return Math.min(progresso, 100);
  };

  const calcularEfetividade = () => {
    if (!liquidacao) return 0;
    const total = (liquidacao.pagamentos_pagos || 0) + (liquidacao.pagamentos_nao_pagos || 0);
    if (total === 0) return 0;
    return ((liquidacao.pagamentos_pagos || 0) / total) * 100;
  };

  const handleIniciarDia = async () => {
    if (!vendedor) return;
    
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('fn_abrir_liquidacao_diaria', {
        p_vendedor_id: vendedor.id,
        p_rota_id: vendedor.rota_id,
        p_caixa_inicial: parseFloat(caixaInicial) || 0,
        p_user_id: vendedor.user_id,
      });

      if (error) throw error;

      setModalIniciarVisible(false);
      setCaixaInicial('');
      carregarLiquidacao();
      Alert.alert('Sucesso', 'Dia iniciado com sucesso!');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível iniciar o dia');
    } finally {
      setSalvando(false);
    }
  };

  const handleEncerrarDia = () => {
    Alert.alert(
      'Encerrar Dia',
      'Deseja realmente encerrar o dia? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: confirmarEncerramento },
      ]
    );
  };

  const confirmarEncerramento = async () => {
    if (!liquidacao || !vendedor) return;

    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('fn_fechar_liquidacao_diaria', {
        p_liquidacao_id: liquidacao.id,
        p_user_id: vendedor.user_id,
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Dia encerrado com sucesso!');
      carregarLiquidacao();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível encerrar o dia');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.titulo}</Text>
        <View style={styles.headerActions}>
          <View style={styles.statusDot} />
          <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
            <Text style={styles.langText}>🌐 {language === 'pt-BR' ? 'PT' : 'ES'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Card do Vendedor */}
        <View style={styles.vendedorCard}>
          <View style={styles.vendedorInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <View style={styles.vendedorTexts}>
              <Text style={styles.vendedorNome}>{vendedor?.nome}</Text>
              <Text style={styles.vendedorData}>
                📅 {liquidacao ? formatarData(liquidacao.data_abertura) : formatarData(new Date().toISOString())}
              </Text>
            </View>
            <View style={[styles.statusBadge, liquidacao ? styles.statusAberto : styles.statusFechado]}>
              <Text style={styles.statusText}>
                {liquidacao ? t.aberto : t.fechado}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.verDatasButton}>
            <Text style={styles.verDatasText}>{t.verOutrasDatas}</Text>
          </TouchableOpacity>
        </View>

        {liquidacao ? (
          <>
            {/* Meta / Atual / Progresso */}
            <View style={styles.metaCard}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t.meta}</Text>
                <Text style={styles.metaValue}>{formatarMoeda(liquidacao.valor_esperado_dia)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t.atual}</Text>
                <Text style={styles.metaValue}>{formatarMoeda(liquidacao.valor_recebido_dia)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t.progresso}</Text>
                <Text style={[styles.metaValue, styles.metaProgresso]}>
                  {calcularProgresso().toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Resumo de Clientes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.resumoClientes}</Text>
              <View style={styles.clientesContainer}>
                <View style={styles.clienteRow}>
                  <Text style={styles.clienteLabel}>{t.clientesIniciais}</Text>
                  <Text style={styles.clienteValue}>{liquidacao.clientes_iniciais || 0}</Text>
                </View>
                <View style={styles.clienteRow}>
                  <Text style={styles.clienteLabel}>{t.clientesNovos}</Text>
                  <Text style={styles.clienteValue}>{liquidacao.clientes_novos || 0}</Text>
                </View>
                <View style={styles.clienteRow}>
                  <Text style={styles.clienteLabel}>{t.clientesRenovados}</Text>
                  <Text style={styles.clienteValue}>{liquidacao.clientes_renovados || 0}</Text>
                </View>
                <View style={styles.clienteRow}>
                  <Text style={styles.clienteLabel}>{t.clientesRenegociados}</Text>
                  <Text style={styles.clienteValue}>{liquidacao.clientes_renegociados || 0}</Text>
                </View>
                <View style={styles.clienteRow}>
                  <Text style={styles.clienteLabel}>{t.clientesCancelados}</Text>
                  <Text style={styles.clienteValue}>{liquidacao.clientes_cancelados || 0}</Text>
                </View>
                <View style={[styles.clienteRow, styles.clienteRowTotal]}>
                  <Text style={styles.clienteLabelTotal}>{t.totalClientes}</Text>
                  <Text style={styles.clienteValueTotal}>
                    {(liquidacao.clientes_iniciais || 0) + (liquidacao.clientes_novos || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Controles Financeiros */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.controlesFinanceiros}</Text>
              
              {/* Caixa */}
              <View style={styles.financeiroCard}>
                <View style={styles.financeiroHeader}>
                  <Text style={styles.financeiroLabel}>{t.caixa}</Text>
                  <View style={styles.indicadorVerde} />
                </View>
                <Text style={styles.financeiroValor}>
                  {formatarMoeda((liquidacao.caixa_inicial || 0) + (liquidacao.valor_recebido_dia || 0) - (liquidacao.total_despesas_dia || 0))}
                </Text>
                <Text style={styles.financeiroDetalhe}>
                  {t.inicial} {formatarMoeda(liquidacao.caixa_inicial)}
                </Text>
              </View>

              {/* Pagamentos */}
              <View style={styles.financeiroCard}>
                <View style={styles.financeiroHeader}>
                  <Text style={styles.financeiroLabel}>{t.pagamentos}</Text>
                  <View style={[styles.indicadorVerde, calcularEfetividade() < 50 && styles.indicadorVermelho]} />
                </View>
                <Text style={styles.financeiroValor}>
                  {liquidacao.pagamentos_pagos || 0} {t.pagos}
                </Text>
                <Text style={styles.financeiroDetalhe}>
                  {t.naoPagos} {liquidacao.pagamentos_nao_pagos || 0} | {t.efetividade} {calcularEfetividade().toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Outras Operações */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.outrasOperacoes}</Text>
              <View style={styles.operacoesContainer}>
                <View style={[styles.operacaoCard, styles.operacaoVendas]}>
                  <Text style={styles.operacaoLabel}>{t.vendas}</Text>
                  <Text style={styles.operacaoValor}>
                    {formatarMoeda(liquidacao.total_emprestado_dia)}
                  </Text>
                  <Text style={styles.operacaoDetalhe}>
                    {liquidacao.qtd_emprestimos_dia || 0} {t.emp}
                  </Text>
                </View>
                <View style={[styles.operacaoCard, styles.operacaoReceitas]}>
                  <Text style={styles.operacaoLabel}>{t.receitas}</Text>
                  <Text style={styles.operacaoValor}>
                    {formatarMoeda(liquidacao.valor_recebido_dia)}
                  </Text>
                  <Text style={styles.operacaoDetalhe}>
                    {liquidacao.pagamentos_pagos || 0} {t.pag}
                  </Text>
                </View>
                <View style={[styles.operacaoCard, styles.operacaoDespesas]}>
                  <Text style={styles.operacaoLabel}>{t.despesas}</Text>
                  <Text style={styles.operacaoValor}>
                    {formatarMoeda(liquidacao.total_despesas_dia)}
                  </Text>
                  <Text style={styles.operacaoDetalhe}>
                    {liquidacao.qtd_despesas_dia || 0} {t.desp}
                  </Text>
                </View>
              </View>
            </View>

            {/* Micro Seguro */}
            <TouchableOpacity style={styles.microSeguroCard}>
              <View style={styles.microSeguroHeader}>
                <Text style={styles.microSeguroIcon}>🛡️</Text>
                <Text style={styles.microSeguroTitle}>{t.microSeguro}</Text>
                <Text style={styles.microSeguroArrow}>›</Text>
              </View>
              <View style={styles.microSeguroContent}>
                <View style={styles.microSeguroItem}>
                  <Text style={styles.microSeguroLabel}>{t.totalDoDia}</Text>
                  <Text style={styles.microSeguroValue}>
                    {formatarMoeda(liquidacao.total_microseguro_dia)}
                  </Text>
                </View>
                <View style={styles.microSeguroItem}>
                  <Text style={styles.microSeguroLabel}>{t.quantidade}</Text>
                  <Text style={styles.microSeguroValue}>
                    {liquidacao.qtd_microseguros_dia || 0}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Botão Encerrar Dia */}
            <TouchableOpacity
              style={styles.encerrarButton}
              onPress={handleEncerrarDia}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.encerrarIcon}>⬅️</Text>
                  <Text style={styles.encerrarText}>{t.encerrarDia}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* Sem liquidação aberta */
          <View style={styles.semLiquidacao}>
            <Text style={styles.semLiquidacaoText}>{t.nenhumaLiquidacao}</Text>
            <TouchableOpacity
              style={styles.iniciarButton}
              onPress={() => setModalIniciarVisible(true)}
            >
              <Text style={styles.iniciarText}>{t.iniciarDia}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Espaço para o bottom navigation */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal Iniciar Dia */}
      <Modal
        visible={modalIniciarVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.iniciarDia}</Text>
            <Text style={styles.modalLabel}>{t.caixa} {t.inicial}</Text>
            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputPrefix}>R$</Text>
              <TextInput
                style={styles.modalInput}
                value={caixaInicial}
                onChangeText={setCaixaInicial}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setModalIniciarVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={handleIniciarDia}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Import necessário para TextInput
import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#1E40AF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  langButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  langText: {
    color: '#fff',
    fontSize: 14,
  },
  iconButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  vendedorCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vendedorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  vendedorTexts: {
    flex: 1,
  },
  vendedorNome: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  vendedorData: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusAberto: {
    backgroundColor: '#D1FAE5',
  },
  statusFechado: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  verDatasButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  verDatasText: {
    color: '#2563EB',
    fontWeight: '500',
  },
  metaCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  metaProgresso: {
    color: '#2563EB',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  clientesContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clienteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  clienteRowTotal: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  clienteLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  clienteValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  clienteLabelTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  clienteValueTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  financeiroCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  financeiroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  financeiroLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  indicadorVerde: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },
  indicadorVermelho: {
    backgroundColor: '#EF4444',
  },
  financeiroValor: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  financeiroDetalhe: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  operacoesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  operacaoCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  operacaoVendas: {
    backgroundColor: '#EFF6FF',
    borderLeftColor: '#2563EB',
  },
  operacaoReceitas: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: '#10B981',
  },
  operacaoDespesas: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: '#EF4444',
  },
  operacaoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  operacaoValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  operacaoDetalhe: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  microSeguroCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  microSeguroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  microSeguroIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  microSeguroTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  microSeguroArrow: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  microSeguroContent: {
    flexDirection: 'row',
  },
  microSeguroItem: {
    flex: 1,
  },
  microSeguroLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  microSeguroValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  encerrarButton: {
    backgroundColor: '#F59E0B',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  encerrarIcon: {
    fontSize: 18,
  },
  encerrarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  semLiquidacao: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  semLiquidacaoText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  iniciarButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  iniciarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 24,
  },
  modalInputPrefix: {
    paddingLeft: 16,
    fontSize: 18,
    color: '#6B7280',
  },
  modalInput: {
    flex: 1,
    padding: 16,
    fontSize: 18,
    color: '#1F2937',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
