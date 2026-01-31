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
  TextInput,
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
    microSeguro: 'MICRO SEGURO',
    totalDoDia: 'Total do Dia',
    quantidade: 'Quantidade',
    encerrarDia: 'Encerrar Dia',
    diaEncerrado: 'Dia Encerrado',
    iniciarDia: 'Iniciar Dia',
    encerrando: 'Encerrando...',
    nenhumaLiquidacao: 'Nenhuma liquidação aberta',
    confirmarEncerramento: 'Deseja realmente encerrar o dia?',
    atencao: 'Atenção: Você não poderá mais adicionar movimentos nesta data após encerrar.',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
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
    microSeguro: 'MICRO SEGURO',
    totalDoDia: 'Total del Día',
    quantidade: 'Cantidad',
    encerrarDia: 'Cerrar Día',
    diaEncerrado: 'Día Cerrado',
    iniciarDia: 'Iniciar Día',
    encerrando: 'Cerrando...',
    nenhumaLiquidacao: 'Ninguna liquidación abierta',
    confirmarEncerramento: '¿Desea cerrar el día?',
    atencao: 'Atención: No podrá agregar más movimientos después de cerrar.',
    cancelar: 'Cancelar',
    confirmar: 'Confirmar',
  }
};

export default function LiquidacaoScreen({ navigation }: any) {
  const { vendedor } = useAuth();
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [fechando, setFechando] = useState(false);
  const [modalIniciarVisible, setModalIniciarVisible] = useState(false);
  const [modalFecharVisible, setModalFecharVisible] = useState(false);
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
        .in('status', ['ABERTA', 'ABERTO'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

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

  const formatarMoedaCompacta = (valor: number | null) => {
    if (valor === null || valor === undefined) return 'R$0';
    if (valor >= 1000) {
      return `R$${(valor / 1000).toFixed(1)}k`;
    }
    return `R$${valor.toFixed(0)}`;
  };

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularEfetividade = () => {
    if (!liquidacao) return 0;
    const total = (liquidacao.pagamentos_pagos || 0) + (liquidacao.pagamentos_nao_pagos || 0);
    if (total === 0) return 0;
    return Math.round(((liquidacao.pagamentos_pagos || 0) / total) * 100);
  };

  const calcularTotalClientes = () => {
    if (!liquidacao) return 0;
    return (liquidacao.clientes_iniciais || 0) + 
           (liquidacao.clientes_novos || 0) + 
           (liquidacao.clientes_renovados || 0) + 
           (liquidacao.clientes_renegociados || 0) - 
           (liquidacao.clientes_cancelados || 0);
  };

  const handleIniciarDia = async () => {
    if (!vendedor) return;
    
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('fn_abrir_liquidacao_diaria', {
        p_vendedor_id: vendedor.id,
        p_rota_id: vendedor.rota_id,
        p_caixa_inicial: parseFloat(caixaInicial.replace(',', '.')) || 0,
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

  const handleEncerrarDia = async () => {
    if (!liquidacao || !vendedor) return;

    setFechando(true);
    try {
      const { data, error } = await supabase.rpc('fn_fechar_liquidacao_diaria', {
        p_liquidacao_id: liquidacao.id,
        p_user_id: vendedor.user_id,
        p_observacoes: 'Fechamento via App Mobile'
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : data;
      
      if (!resultado || !resultado.sucesso) {
        throw new Error(resultado?.mensagem || 'Erro ao fechar liquidação');
      }

      setModalFecharVisible(false);
      Alert.alert('Sucesso', `Liquidação fechada! Recebido: ${formatarMoeda(resultado.valor_recebido_dia)}`);
      carregarLiquidacao();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível encerrar o dia');
    } finally {
      setFechando(false);
    }
  };

  const isAberto = liquidacao?.status?.toLowerCase() === 'aberto' || liquidacao?.status?.toLowerCase() === 'aberta';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.titulo}</Text>
        <View style={styles.headerActions}>
          <View style={[styles.statusDot, { backgroundColor: liquidacao ? '#10B981' : '#EF4444' }]} />
          <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
            <Text style={styles.langText}>🌐 {language === 'pt-BR' ? 'PT' : 'ES'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {liquidacao ? (
          <>
            {/* Card Vendedor + Status */}
            <View style={[styles.card, styles.cardVendedor, { borderTopColor: isAberto ? '#10B981' : '#EF4444' }]}>
              <View style={styles.vendedorRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>👤</Text>
                </View>
                <Text style={styles.vendedorNome}>{vendedor?.nome}</Text>
              </View>
              
              <View style={styles.statusRow}>
                <View style={styles.dataContainer}>
                  <Text style={styles.statusIcon}>{isAberto ? '🔓' : '🔒'}</Text>
                  <Text style={styles.dataText}>{formatarData(liquidacao.data_abertura)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isAberto ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusText, { color: isAberto ? '#047857' : '#DC2626' }]}>
                    {isAberto ? t.aberto : t.fechado}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.verDatasButton}>
                <Text style={styles.verDatasText}>{t.verOutrasDatas}</Text>
              </TouchableOpacity>
            </View>

            {/* Card Meta/Atual/Progresso */}
            <View style={styles.card}>
              <View style={styles.metaRow}>
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
                  <Text style={[styles.metaValue, styles.metaProgresso]}>{liquidacao.percentual_recebimento || 0}%</Text>
                </View>
              </View>
              {/* Progress Bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(liquidacao.percentual_recebimento || 0, 100)}%` }]} />
              </View>
            </View>

            {/* Resumo de Clientes */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t.resumoClientes}</Text>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesIniciais}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_iniciais || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesNovos}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_novos || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesRenovados}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_renovados || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesRenegociados}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_renegociados || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesCancelados}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_cancelados || 0}</Text></View>
              <View style={[styles.clienteRow, styles.clienteRowTotal]}><Text style={styles.clienteLabelTotal}>{t.totalClientes}</Text><Text style={styles.clienteValueTotal}>{calcularTotalClientes()}</Text></View>
            </View>

            {/* Controles Financeiros */}
            <Text style={styles.sectionTitleOutside}>{t.controlesFinanceiros}</Text>

            {/* Caixa */}
            <View style={[styles.card, styles.cardCaixa]}>
              <View style={styles.financeiroContent}>
                <View>
                  <Text style={styles.financeiroLabel}>{t.caixa}</Text>
                  <Text style={styles.financeiroValor}>{formatarMoeda(liquidacao.caixa_final || liquidacao.caixa_inicial)}</Text>
                  <Text style={styles.financeiroDetalhe}>{t.inicial} {formatarMoeda(liquidacao.caixa_inicial)}</Text>
                </View>
                <View style={styles.indicadorVerde} />
              </View>
            </View>

            {/* Pagamentos */}
            <View style={[styles.card, styles.cardPagamentos]}>
              <View style={styles.financeiroContent}>
                <View>
                  <Text style={styles.financeiroLabel}>{t.pagamentos}</Text>
                  <Text style={styles.financeiroValor}>{liquidacao.pagamentos_pagos || 0} {t.pagos}</Text>
                  <Text style={styles.financeiroDetalhe}>{t.naoPagos} {liquidacao.pagamentos_nao_pagos || 0} | {t.efetividade} {calcularEfetividade()}%</Text>
                </View>
                <View style={styles.indicadorVermelho} />
              </View>
            </View>

            {/* Outras Operações */}
            <Text style={styles.sectionTitleOutside}>{t.outrasOperacoes}</Text>
            <View style={styles.operacoesRow}>
              <View style={[styles.operacaoCard, styles.operacaoVendas]}>
                <Text style={styles.opLabelVerde}>{t.vendas}</Text>
                <Text style={styles.opValorVerde}>{formatarMoedaCompacta(liquidacao.total_emprestado_dia)}</Text>
                <Text style={styles.opDetalheVerde}>{liquidacao.qtd_emprestimos_dia || 0} emp.</Text>
              </View>
              <View style={[styles.operacaoCard, styles.operacaoReceitas]}>
                <Text style={styles.opLabelAzul}>{t.receitas}</Text>
                <Text style={styles.opValorAzul}>{formatarMoedaCompacta(liquidacao.valor_recebido_dia)}</Text>
                <Text style={styles.opDetalheAzul}>{liquidacao.pagamentos_pagos || 0} pag.</Text>
              </View>
              <View style={[styles.operacaoCard, styles.operacaoDespesas]}>
                <Text style={styles.opLabelVermelho}>{t.despesas}</Text>
                <Text style={styles.opValorVermelho}>{formatarMoedaCompacta(liquidacao.total_despesas_dia)}</Text>
                <Text style={styles.opDetalheVermelho}>{liquidacao.qtd_despesas_dia || 0} desp.</Text>
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
                  <Text style={styles.microSeguroValue}>{formatarMoeda(liquidacao.total_microseguro_dia)}</Text>
                </View>
                <View style={styles.microSeguroItem}>
                  <Text style={styles.microSeguroLabel}>{t.quantidade}</Text>
                  <Text style={styles.microSeguroValue}>{liquidacao.qtd_microseguros_dia || 0}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Botão Encerrar Dia */}
            <TouchableOpacity
              style={[styles.encerrarButton, !isAberto && styles.encerrarButtonDisabled]}
              onPress={() => setModalFecharVisible(true)}
              disabled={!isAberto || fechando}
            >
              {fechando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.encerrarIcon}>{isAberto ? '↩️' : '🔒'}</Text>
                  <Text style={styles.encerrarText}>{isAberto ? t.encerrarDia : t.diaEncerrado}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.semLiquidacao}>
            <Text style={styles.semLiquidacaoIcon}>📅</Text>
            <Text style={styles.semLiquidacaoText}>{t.nenhumaLiquidacao}</Text>
            <TouchableOpacity style={styles.iniciarButton} onPress={() => setModalIniciarVisible(true)}>
              <Text style={styles.iniciarText}>{t.iniciarDia}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal Iniciar Dia */}
      <Modal visible={modalIniciarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.iniciarDia}</Text>
            <Text style={styles.modalLabel}>{t.caixa} {t.inicial}</Text>
            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputPrefix}>R$</Text>
              <TextInput style={styles.modalInput} value={caixaInicial} onChangeText={setCaixaInicial} keyboardType="decimal-pad" placeholder="0,00" />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setModalIniciarVisible(false)}>
                <Text style={styles.modalButtonCancelText}>{t.cancelar}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={handleIniciarDia} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonConfirmText}>{t.confirmar}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Fechar Dia */}
      <Modal visible={modalFecharVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.encerrarDia}</Text>
            <Text style={styles.modalDescricao}>{t.confirmarEncerramento}</Text>
            <View style={styles.modalAtencao}><Text style={styles.modalAtencaoText}>⚠️ {t.atencao}</Text></View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setModalFecharVisible(false)} disabled={fechando}>
                <Text style={styles.modalButtonCancelText}>{t.cancelar}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, styles.modalButtonAmber]} onPress={handleEncerrarDia} disabled={fechando}>
                {fechando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonConfirmText}>{t.encerrarDia}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  header: { backgroundColor: '#3B82F6', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  langButton: { paddingHorizontal: 8, paddingVertical: 4 },
  langText: { color: '#fff', fontSize: 12 },
  iconButton: { padding: 6 },
  iconText: { fontSize: 16 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
  cardVendedor: { borderTopWidth: 4 },
  vendedorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20 },
  vendedorNome: { fontSize: 16, fontWeight: '600', color: '#1F2937', flex: 1 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  dataContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusIcon: { fontSize: 14 },
  dataText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  verDatasButton: { marginTop: 12, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  verDatasText: { color: '#3B82F6', fontSize: 13, fontWeight: '500' },
  metaRow: { flexDirection: 'row', marginBottom: 12 },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  metaValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  metaProgresso: { color: '#3B82F6' },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  sectionTitleOutside: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 12, marginLeft: 4 },
  clienteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  clienteRowTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 12 },
  clienteLabel: { fontSize: 14, color: '#6B7280' },
  clienteValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  clienteLabelTotal: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  clienteValueTotal: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  cardCaixa: { borderLeftWidth: 4, borderLeftColor: '#10B981' },
  cardPagamentos: { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  financeiroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  financeiroLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  financeiroValor: { fontSize: 24, fontWeight: '700', color: '#1F2937' },
  financeiroDetalhe: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  indicadorVerde: { width: 40, height: 40, backgroundColor: '#D1FAE5', borderRadius: 8 },
  indicadorVermelho: { width: 40, height: 40, backgroundColor: '#FEE2E2', borderRadius: 8 },
  operacoesRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  operacaoCard: { flex: 1, borderRadius: 8, padding: 8, borderLeftWidth: 2 },
  operacaoVendas: { backgroundColor: '#ECFDF5', borderLeftColor: '#10B981' },
  operacaoReceitas: { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' },
  operacaoDespesas: { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' },
  opLabelVerde: { fontSize: 10, fontWeight: '500', color: '#059669' },
  opValorVerde: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  opDetalheVerde: { fontSize: 10, color: '#047857' },
  opLabelAzul: { fontSize: 10, fontWeight: '500', color: '#2563EB' },
  opValorAzul: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  opDetalheAzul: { fontSize: 10, color: '#1D4ED8' },
  opLabelVermelho: { fontSize: 10, fontWeight: '500', color: '#DC2626' },
  opValorVermelho: { fontSize: 14, fontWeight: '700', color: '#991B1B' },
  opDetalheVermelho: { fontSize: 10, color: '#B91C1C' },
  microSeguroCard: { backgroundColor: '#FEF9C3', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FDE047' },
  microSeguroHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  microSeguroIcon: { fontSize: 16, marginRight: 8 },
  microSeguroTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: '#A16207' },
  microSeguroArrow: { fontSize: 20, color: '#CA8A04' },
  microSeguroContent: { flexDirection: 'row' },
  microSeguroItem: { flex: 1 },
  microSeguroLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  microSeguroValue: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  encerrarButton: { backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12 },
  encerrarButtonDisabled: { backgroundColor: '#9CA3AF' },
  encerrarIcon: { fontSize: 18 },
  encerrarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  semLiquidacao: { alignItems: 'center', paddingVertical: 80 },
  semLiquidacaoIcon: { fontSize: 64, marginBottom: 16 },
  semLiquidacaoText: { fontSize: 16, color: '#6B7280', marginBottom: 24 },
  iniciarButton: { backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  iniciarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 16, textAlign: 'center' },
  modalDescricao: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  modalAtencao: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 12, marginBottom: 20 },
  modalAtencaoText: { fontSize: 13, color: '#92400E' },
  modalLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  modalInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 24 },
  modalInputPrefix: { paddingLeft: 16, fontSize: 18, color: '#6B7280' },
  modalInput: { flex: 1, padding: 16, fontSize: 18, color: '#1F2937' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButtonCancel: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalButtonCancelText: { color: '#6B7280', fontWeight: '500' },
  modalButtonConfirm: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center' },
  modalButtonAmber: { backgroundColor: '#D97706' },
  modalButtonConfirmText: { color: '#fff', fontWeight: '600' },
});
