import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Alert, Modal, TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import CalendarioLiquidacoes from '../components/CalendarioLiquidacoes';

interface LiquidacaoDiaria {
  id: string; vendedor_id: string; rota_id: string; empresa_id: string;
  data_abertura: string; data_fechamento: string | null;
  status: 'ABERTO' | 'FECHADO' | 'APROVADO' | 'REABERTO';
  caixa_inicial: number; caixa_final: number; carteira_inicial: number; carteira_final: number;
  valor_esperado_dia: number; valor_recebido_dia: number;
  valor_dinheiro: number; valor_transferencia: number; percentual_recebimento: number;
  clientes_iniciais: number; clientes_novos: number; clientes_renovados: number;
  clientes_renegociados: number; clientes_cancelados: number;
  pagamentos_pagos: number; pagamentos_nao_pagos: number;
  total_despesas_dia: number; qtd_despesas_dia: number;
  total_emprestado_dia: number; qtd_emprestimos_dia: number;
  total_microseguro_dia: number; qtd_microseguros_dia: number;
  observacoes: string | null;
}

interface ContaRota { id: string; saldo_atual: number; }

const textos = {
  'pt-BR': {
    titulo: 'Liquidação Diária', verOutrasDatas: 'Ver Outras Datas', voltarHoje: 'Voltar para Hoje',
    meta: 'META', atual: 'ATUAL', progresso: 'PROGRESSO',
    resumoClientes: 'Resumo de Clientes',
    clientesIniciais: 'Clientes Iniciais:', clientesNovos: 'Clientes Novos:',
    clientesRenovados: 'Clientes Renovados:', clientesRenegociados: 'Clientes Renegociados:',
    clientesCancelados: 'Clientes Cancelados:', totalClientes: 'Total de Clientes:',
    controlesFinanceiros: 'Controles Financeiros', caixa: 'Caixa', inicial: 'Inicial:',
    pagamentos: 'Pagamentos', pagos: 'Pagos:', naoPagos: 'Não Pagos:', efetividade: 'Efetividade:',
    outrasOperacoes: 'Outras Operações', vendas: 'Vendas', qtdEmprestimos: 'Qtd:',
    receitas: 'Receitas', despesas: 'Despesas', microSeguro: 'Micro Seguro',
    encerrarDia: 'Encerrar Dia', iniciarDia: 'Iniciar Dia',
    abrirLiquidacao: 'Abrir Liquidação', caixaInicial: 'Caixa Inicial', saldoConta: 'Saldo da conta:',
    cancelar: 'Cancelar', abrir: 'Abrir',
    fecharLiquidacao: 'Fechar Liquidação', confirmacaoFechar: 'Deseja realmente encerrar o dia?',
    observacoes: 'Observações (opcional)', fechar: 'Fechar',
    aberto: 'ABERTO', fechado: 'FECHADO',
    novoCliente: 'Novo Cliente', adicionarCliente: 'Adicionar cliente/empréstimo',
    novaMovimentacao: 'Nova Movimentação', adicionarDespesa: 'Adicionar despesa/receita',
    home: 'Home', clientes: 'Clientes', visualizando: 'Visualizando:',
    jaExisteAberta: 'Já existe uma liquidação aberta. Feche-a antes de abrir outra.',
  },
  'es': {
    titulo: 'Liquidación Diaria', verOutrasDatas: 'Ver Otras Fechas', voltarHoje: 'Volver a Hoy',
    meta: 'META', atual: 'ACTUAL', progresso: 'PROGRESO',
    resumoClientes: 'Resumen de Clientes',
    clientesIniciais: 'Clientes Iniciales:', clientesNovos: 'Clientes Nuevos:',
    clientesRenovados: 'Clientes Renovados:', clientesRenegociados: 'Clientes Renegociados:',
    clientesCancelados: 'Clientes Cancelados:', totalClientes: 'Total de Clientes:',
    controlesFinanceiros: 'Controles Financieros', caixa: 'Caja', inicial: 'Inicial:',
    pagamentos: 'Pagos', pagos: 'Pagados:', naoPagos: 'No Pagados:', efetividade: 'Efectividad:',
    outrasOperacoes: 'Otras Operaciones', vendas: 'Ventas', qtdEmprestimos: 'Cant:',
    receitas: 'Ingresos', despesas: 'Egresos', microSeguro: 'Micro Seguro',
    encerrarDia: 'Cerrar Día', iniciarDia: 'Iniciar Día',
    abrirLiquidacao: 'Abrir Liquidación', caixaInicial: 'Caja Inicial', saldoConta: 'Saldo de cuenta:',
    cancelar: 'Cancelar', abrir: 'Abrir',
    fecharLiquidacao: 'Cerrar Liquidación', confirmacaoFechar: '¿Desea realmente cerrar el día?',
    observacoes: 'Observaciones (opcional)', fechar: 'Cerrar',
    aberto: 'ABIERTO', fechado: 'CERRADO',
    novoCliente: 'Nuevo Cliente', adicionarCliente: 'Agregar cliente/préstamo',
    novaMovimentacao: 'Nueva Movimentación', adicionarDespesa: 'Agregar gasto/ingreso',
    home: 'Inicio', clientes: 'Clientes', visualizando: 'Visualizando:',
    jaExisteAberta: 'Ya existe una liquidación abierta. Ciérrela antes de abrir otra.',
  },
};

export default function HomeScreen({ navigation }: any) {
  const { vendedor, idioma = 'pt-BR' } = useAuth();
  const t = textos[idioma as keyof typeof textos] || textos['pt-BR'];

  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [todasLiquidacoes, setTodasLiquidacoes] = useState<LiquidacaoDiaria[]>([]);
  const [contaRota, setContaRota] = useState<ContaRota | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [modoVisualizacao, setModoVisualizacao] = useState(false);
  const [dataVisualizacao, setDataVisualizacao] = useState<Date | null>(null);
  const [modalAbrirVisible, setModalAbrirVisible] = useState(false);
  const [modalFecharVisible, setModalFecharVisible] = useState(false);
  const [caixaInicial, setCaixaInicial] = useState('');
  const [observacoesFechamento, setObservacoesFechamento] = useState('');
  const [processando, setProcessando] = useState(false);

  const obterLiquidacaoAberta = (lqs: LiquidacaoDiaria[]) => 
    lqs.find(l => l.status === 'ABERTO' || l.status === 'REABERTO') || null;

  const carregarDados = useCallback(async () => {
    if (!vendedor) return;
    try {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 60);
      
      const { data: liqData, error: liqError } = await supabase
        .from('liquidacoes_diarias').select('*')
        .eq('rota_id', vendedor.rota_id)
        .gte('data_abertura', dataInicio.toISOString())
        .order('data_abertura', { ascending: false });

      if (!liqError) {
        setTodasLiquidacoes(liqData || []);
        const liqAberta = obterLiquidacaoAberta(liqData || []);
        setLiquidacao(liqAberta);
        if (!liqAberta && !modoVisualizacao) setMostrarCalendario(true);
      }

      const { data: contaData } = await supabase
        .from('contas').select('id, saldo_atual')
        .eq('rota_id', vendedor.rota_id).eq('tipo_conta', 'ROTA').eq('status', 'ATIVA')
        .maybeSingle();
      if (contaData) setContaRota(contaData);
    } catch (error) { console.error('Erro:', error); }
    finally { setLoading(false); setRefreshing(false); }
  }, [vendedor, modoVisualizacao]);

  useEffect(() => { carregarDados(); }, [carregarDados]);
  const onRefresh = () => { setRefreshing(true); carregarDados(); };

  const handleSelecionarDia = (liq: LiquidacaoDiaria | null, data: Date) => {
    if (liq) {
      setLiquidacao(liq);
      setModoVisualizacao(liq.status !== 'ABERTO' && liq.status !== 'REABERTO');
    } else {
      setLiquidacao(null);
      setModoVisualizacao(true);
    }
    setDataVisualizacao(data);
    setMostrarCalendario(false);
  };

  const handleVerRotaFutura = (data: Date) => {
    setLiquidacao(null); setModoVisualizacao(true); setDataVisualizacao(data); setMostrarCalendario(false);
  };

  const handleAbrirHoje = (data: Date) => {
    if (obterLiquidacaoAberta(todasLiquidacoes)) {
      Alert.alert('Atenção', t.jaExisteAberta); return;
    }
    setDataVisualizacao(data); setModalAbrirVisible(true);
  };

  const handleVoltarHoje = () => {
    setModoVisualizacao(false); setDataVisualizacao(null);
    const liqAberta = obterLiquidacaoAberta(todasLiquidacoes);
    setLiquidacao(liqAberta);
    if (!liqAberta) setMostrarCalendario(true);
  };

  const handleAbrirLiquidacao = async () => {
    if (!vendedor) return;
    const valorCaixa = parseFloat(caixaInicial.replace(',', '.')) || 0;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_abrir_liquidacao_diaria', {
        p_vendedor_id: vendedor.id, p_rota_id: vendedor.rota_id,
        p_caixa_inicial: valorCaixa, p_user_id: null,
        p_latitude: null, p_longitude: null, p_precisao_gps: null,
      });
      if (error) throw error;
      if (data?.[0]?.sucesso) {
        Alert.alert('Sucesso', 'Liquidação aberta!');
        setModalAbrirVisible(false); setCaixaInicial('');
        setModoVisualizacao(false); setDataVisualizacao(null); setMostrarCalendario(false);
        carregarDados();
      } else { Alert.alert('Erro', data?.[0]?.mensagem || 'Erro ao abrir'); }
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setProcessando(false); }
  };

  const handleFecharLiquidacao = async () => {
    if (!liquidacao) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_fechar_liquidacao_diaria', {
        p_liquidacao_id: liquidacao.id, p_user_id: null, p_observacoes: observacoesFechamento || null,
      });
      if (error) throw error;
      if (data?.[0]?.sucesso) {
        Alert.alert('Sucesso', `Dia encerrado!\nRecebido: R$ ${data[0].valor_recebido_dia?.toFixed(2) || '0,00'}`);
        setModalFecharVisible(false); setObservacoesFechamento(''); carregarDados();
      } else { Alert.alert('Erro', data?.[0]?.mensagem || 'Erro ao fechar'); }
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setProcessando(false); }
  };

  const formatarMoeda = (v: number | null | undefined) => 
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatarData = (d: string | Date) => 
    (typeof d === 'string' ? new Date(d) : d).toLocaleDateString('pt-BR');
  const calcularTotalClientes = () => liquidacao ? 
    (liquidacao.clientes_iniciais||0)+(liquidacao.clientes_novos||0)+(liquidacao.clientes_renovados||0)+
    (liquidacao.clientes_renegociados||0)-(liquidacao.clientes_cancelados||0) : 0;
  const calcularCaixaAtual = () => liquidacao ?
    (liquidacao.caixa_inicial||0)+(liquidacao.valor_recebido_dia||0)-(liquidacao.total_despesas_dia||0)-(liquidacao.total_emprestado_dia||0) : 0;
  const calcularEfetividade = () => {
    if (!liquidacao) return '0%';
    const total = (liquidacao.pagamentos_pagos||0)+(liquidacao.pagamentos_nao_pagos||0);
    return total === 0 ? '0%' : ((liquidacao.pagamentos_pagos/total)*100).toFixed(0)+'%';
  };
  const temLiquidacaoAberta = () => obterLiquidacaoAberta(todasLiquidacoes) !== null;
  const podeEditar = () => liquidacao && (liquidacao.status === 'ABERTO' || liquidacao.status === 'REABERTO') && !modoVisualizacao;

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.loadingText}>Carregando...</Text>
    </View>
  );

  // CALENDÁRIO
  if (mostrarCalendario) return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.titulo}</Text>
        <View style={styles.headerRight}>
          <View style={styles.onlineIndicator} />
          <Text style={styles.headerLang}>{idioma === 'pt-BR' ? 'PT' : 'ES'}</Text>
        </View>
      </View>
      <ScrollView style={styles.content}>
        <CalendarioLiquidacoes liquidacoes={todasLiquidacoes} onSelecionarDia={handleSelecionarDia}
          onVerRotaFutura={handleVerRotaFutura} onAbrirHoje={handleAbrirHoje}
          temLiquidacaoAberta={temLiquidacaoAberta()} idioma={idioma as 'pt-BR'|'es'}
          onVoltar={() => setMostrarCalendario(false)} />
        <View style={{height:100}} />
      </ScrollView>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Text style={styles.bottomNavIcon}>🏠</Text>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>{t.home}</Text>
        </TouchableOpacity>
        <View style={styles.fabButtonDisabled}><Text style={styles.fabButtonIcon}>+</Text></View>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => navigation.navigate('Clientes')}>
          <Text style={styles.bottomNavIcon}>👥</Text>
          <Text style={styles.bottomNavLabel}>{t.clientes}</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={modalAbrirVisible} transparent animationType="slide" onRequestClose={() => setModalAbrirVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.abrirLiquidacao}</Text>
            <Text style={styles.modalLabel}>{t.caixaInicial}</Text>
            <TextInput style={styles.modalInput} value={caixaInicial} onChangeText={setCaixaInicial}
              keyboardType="numeric" placeholder="0,00" placeholderTextColor="#9CA3AF" />
            <Text style={styles.modalSaldo}>{t.saldoConta} {formatarMoeda(contaRota?.saldo_atual)}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancelar]} onPress={() => setModalAbrirVisible(false)} disabled={processando}>
                <Text style={styles.modalBtnCancelarText}>{t.cancelar}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirmar]} onPress={handleAbrirLiquidacao} disabled={processando}>
                {processando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnConfirmarText}>{t.abrir}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  // TELA PRINCIPAL
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.titulo}</Text>
        <View style={styles.headerRight}>
          <View style={styles.onlineIndicator} />
          <Text style={styles.headerLang}>{idioma === 'pt-BR' ? 'PT' : 'ES'}</Text>
        </View>
      </View>

      {modoVisualizacao && (
        <View style={styles.bannerVisualizacao}>
          <Text style={styles.bannerTexto}>{t.visualizando} {dataVisualizacao ? formatarData(dataVisualizacao) : ''}</Text>
          <TouchableOpacity style={styles.bannerBtn} onPress={handleVoltarHoje}>
            <Text style={styles.bannerBtnText}>{t.voltarHoje}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}>
        {/* Card Vendedor */}
        <View style={styles.vendedorCard}>
          <View style={styles.vendedorInfo}>
            <View style={styles.vendedorAvatar}>
              <Text style={styles.vendedorAvatarText}>{vendedor?.nome?.charAt(0)?.toUpperCase() || 'V'}</Text>
            </View>
            <View style={styles.vendedorDados}>
              <Text style={styles.vendedorNome}>{vendedor?.nome}</Text>
              <Text style={styles.vendedorData}>📅 {liquidacao ? formatarData(liquidacao.data_abertura) : formatarData(new Date())}</Text>
            </View>
            <View style={[styles.statusBadge, podeEditar() ? styles.statusAberto : styles.statusFechado]}>
              <Text style={[styles.statusText, podeEditar() ? styles.statusTextoAberto : styles.statusTextoFechado]}>
                {liquidacao?.status === 'ABERTO' || liquidacao?.status === 'REABERTO' ? t.aberto : t.fechado}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.verOutrasDatasBtn} onPress={() => setMostrarCalendario(true)}>
            <Text style={styles.verOutrasDatasText}>{t.verOutrasDatas}</Text>
          </TouchableOpacity>
        </View>

        {/* META / ATUAL / PROGRESSO */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>{t.meta}</Text><Text style={styles.metaValue}>{formatarMoeda(liquidacao?.valor_esperado_dia)}</Text></View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}><Text style={styles.metaLabel}>{t.atual}</Text><Text style={styles.metaValue}>{formatarMoeda(liquidacao?.valor_recebido_dia)}</Text></View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}><Text style={styles.metaLabel}>{t.progresso}</Text><Text style={[styles.metaValue,styles.metaProgressoText]}>{liquidacao?.percentual_recebimento?.toFixed(0)||0}%</Text></View>
        </View>

        {/* Resumo Clientes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.resumoClientes}</Text>
          <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesIniciais}</Text><Text style={styles.clienteValue}>{liquidacao?.clientes_iniciais||0}</Text></View>
          <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesNovos}</Text><Text style={styles.clienteValue}>{liquidacao?.clientes_novos||0}</Text></View>
          <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesRenovados}</Text><Text style={styles.clienteValue}>{liquidacao?.clientes_renovados||0}</Text></View>
          <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesRenegociados}</Text><Text style={styles.clienteValue}>{liquidacao?.clientes_renegociados||0}</Text></View>
          <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesCancelados}</Text><Text style={styles.clienteValue}>{liquidacao?.clientes_cancelados||0}</Text></View>
          <View style={[styles.clienteRow, styles.clienteRowTotal]}><Text style={styles.clienteLabelTotal}>{t.totalClientes}</Text><Text style={styles.clienteValueTotal}>{calcularTotalClientes()}</Text></View>
        </View>

        {/* Controles Financeiros */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.controlesFinanceiros}</Text>
          <View style={[styles.financeiroCard, styles.financeiroCardCaixa]}>
            <View style={styles.financeiroHeader}><Text style={styles.financeiroTitulo}>{t.caixa}</Text><View style={styles.toggleContainer}><View style={[styles.toggle, styles.toggleAtivo]} /></View></View>
            <Text style={styles.financeiroValorGrande}>{formatarMoeda(calcularCaixaAtual())}</Text>
            <Text style={styles.financeiroSubtexto}>{t.inicial} {formatarMoeda(liquidacao?.caixa_inicial)}</Text>
          </View>
          <View style={[styles.financeiroCard, styles.financeiroCardPagamentos]}>
            <Text style={styles.financeiroTitulo}>{t.pagamentos}</Text>
            <View style={styles.pagamentosRow}>
              <View style={styles.pagamentoItem}><Text style={styles.pagamentoLabel}>{t.pagos}</Text><Text style={styles.pagamentoValue}>{liquidacao?.pagamentos_pagos||0}</Text></View>
              <View style={styles.pagamentoItem}><Text style={styles.pagamentoLabel}>{t.naoPagos}</Text><Text style={styles.pagamentoValue}>{liquidacao?.pagamentos_nao_pagos||0}</Text></View>
              <View style={styles.pagamentoItem}><Text style={styles.pagamentoLabel}>{t.efetividade}</Text><Text style={styles.pagamentoValue}>{calcularEfetividade()}</Text></View>
            </View>
          </View>
        </View>

        {/* Outras Operações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.outrasOperacoes}</Text>
          <View style={styles.operacoesGrid}>
            <View style={[styles.operacaoCard, styles.operacaoCardVendas]}><Text style={styles.operacaoTitulo}>{t.vendas}</Text><Text style={styles.operacaoValor}>{formatarMoeda(liquidacao?.total_emprestado_dia)}</Text><Text style={styles.operacaoSubtexto}>{t.qtdEmprestimos} {liquidacao?.qtd_emprestimos_dia||0}</Text></View>
            <View style={[styles.operacaoCard, styles.operacaoCardReceitas]}><Text style={styles.operacaoTitulo}>{t.receitas}</Text><Text style={styles.operacaoValor}>{formatarMoeda(liquidacao?.valor_recebido_dia)}</Text><Text style={styles.operacaoSubtexto}>{t.qtdEmprestimos} {liquidacao?.pagamentos_pagos||0}</Text></View>
            <View style={[styles.operacaoCard, styles.operacaoCardDespesas]}><Text style={styles.operacaoTitulo}>{t.despesas}</Text><Text style={styles.operacaoValor}>{formatarMoeda(liquidacao?.total_despesas_dia)}</Text><Text style={styles.operacaoSubtexto}>{t.qtdEmprestimos} {liquidacao?.qtd_despesas_dia||0}</Text></View>
          </View>
        </View>

        {/* Micro Seguro */}
        <View style={styles.section}>
          <View style={styles.microSeguroCard}><Text style={styles.microSeguroTitulo}>{t.microSeguro}</Text><View style={styles.microSeguroRow}><Text style={styles.microSeguroValor}>{formatarMoeda(liquidacao?.total_microseguro_dia)}</Text><Text style={styles.microSeguroQtd}>{t.qtdEmprestimos} {liquidacao?.qtd_microseguros_dia||0}</Text></View></View>
        </View>

        {/* Botão Encerrar/Iniciar */}
        {!modoVisualizacao && (
          <View style={styles.section}>
            {podeEditar() ? (
              <TouchableOpacity style={styles.encerrarDiaBtn} onPress={() => setModalFecharVisible(true)}>
                <Text style={styles.encerrarDiaBtnText}>{t.encerrarDia}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.iniciarDiaBtn} onPress={() => setMostrarCalendario(true)}>
                <Text style={styles.iniciarDiaBtnText}>{t.iniciarDia}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={{height:100}} />
      </ScrollView>

      {/* FAB Menu */}
      {fabExpanded && (
        <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setFabExpanded(false)}>
          <View style={styles.fabMenu}>
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabExpanded(false); navigation.navigate('NovoEmprestimo'); }}>
              <View style={[styles.fabMenuIcon, {backgroundColor:'#10B981'}]}><Text style={styles.fabMenuIconText}>👤+</Text></View>
              <View style={styles.fabMenuTexts}><Text style={styles.fabMenuTitle}>{t.novoCliente}</Text><Text style={styles.fabMenuSubtitle}>{t.adicionarCliente}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabExpanded(false); navigation.navigate('Despesas'); }}>
              <View style={[styles.fabMenuIcon, {backgroundColor:'#F59E0B'}]}><Text style={styles.fabMenuIconText}>💰</Text></View>
              <View style={styles.fabMenuTexts}><Text style={styles.fabMenuTitle}>{t.novaMovimentacao}</Text><Text style={styles.fabMenuSubtitle}>{t.adicionarDespesa}</Text></View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomNavItem}><Text style={styles.bottomNavIcon}>🏠</Text><Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>{t.home}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fabButton, !podeEditar() && styles.fabButtonDisabledStyle]} onPress={() => podeEditar() && setFabExpanded(!fabExpanded)} disabled={!podeEditar()}>
          <Text style={styles.fabButtonIcon}>{fabExpanded ? '✕' : '+'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => navigation.navigate('Clientes')}><Text style={styles.bottomNavIcon}>👥</Text><Text style={styles.bottomNavLabel}>{t.clientes}</Text></TouchableOpacity>
      </View>

      {/* Modal Fechar */}
      <Modal visible={modalFecharVisible} transparent animationType="slide" onRequestClose={() => setModalFecharVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t.fecharLiquidacao}</Text>
          <Text style={styles.modalConfirmacao}>{t.confirmacaoFechar}</Text>
          <Text style={styles.modalLabel}>{t.observacoes}</Text>
          <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={observacoesFechamento} onChangeText={setObservacoesFechamento} multiline numberOfLines={3} placeholder="..." placeholderTextColor="#9CA3AF" />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancelar]} onPress={() => setModalFecharVisible(false)} disabled={processando}><Text style={styles.modalBtnCancelarText}>{t.cancelar}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnFechar]} onPress={handleFecharLiquidacao} disabled={processando}>
              {processando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnConfirmarText}>{t.fechar}</Text>}
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 16 },
  header: { backgroundColor: '#3B82F6', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  headerLang: { color: '#fff', fontSize: 14, fontWeight: '500' },
  bannerVisualizacao: { backgroundColor: '#FEF3C7', paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerTexto: { color: '#92400E', fontSize: 14, fontWeight: '500' },
  bannerBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16 },
  vendedorCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, borderLeftWidth: 4, borderLeftColor: '#10B981', elevation: 2 },
  vendedorInfo: { flexDirection: 'row', alignItems: 'center' },
  vendedorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  vendedorAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
  vendedorDados: { flex: 1, marginLeft: 12 },
  vendedorNome: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  vendedorData: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusAberto: { backgroundColor: '#D1FAE5' },
  statusFechado: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextoAberto: { color: '#059669' },
  statusTextoFechado: { color: '#DC2626' },
  verOutrasDatasBtn: { marginTop: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, alignItems: 'center' },
  verOutrasDatasText: { color: '#6B7280', fontSize: 14 },
  metaContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginTop: 16, padding: 16, elevation: 2 },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, backgroundColor: '#E5E7EB' },
  metaLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  metaValue: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  metaProgressoText: { color: '#10B981' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 },
  clienteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  clienteRowTotal: { borderBottomWidth: 0, marginTop: 4, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#E5E7EB' },
  clienteLabel: { fontSize: 14, color: '#6B7280' },
  clienteValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  clienteLabelTotal: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  clienteValueTotal: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  financeiroCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  financeiroCardCaixa: { backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#10B981' },
  financeiroCardPagamentos: { backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  financeiroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  financeiroTitulo: { fontSize: 14, fontWeight: '600', color: '#374151' },
  financeiroValorGrande: { fontSize: 28, fontWeight: 'bold', color: '#10B981', marginTop: 8 },
  financeiroSubtexto: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  toggleContainer: { width: 44, height: 24, backgroundColor: '#D1FAE5', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 2 },
  toggle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleAtivo: { alignSelf: 'flex-end', backgroundColor: '#10B981' },
  pagamentosRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  pagamentoItem: { alignItems: 'center' },
  pagamentoLabel: { fontSize: 12, color: '#6B7280' },
  pagamentoValue: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  operacoesGrid: { flexDirection: 'row', gap: 10 },
  operacaoCard: { flex: 1, borderRadius: 12, padding: 12, borderLeftWidth: 3 },
  operacaoCardVendas: { backgroundColor: '#DBEAFE', borderLeftColor: '#3B82F6' },
  operacaoCardReceitas: { backgroundColor: '#D1FAE5', borderLeftColor: '#10B981' },
  operacaoCardDespesas: { backgroundColor: '#FEE2E2', borderLeftColor: '#EF4444' },
  operacaoTitulo: { fontSize: 12, fontWeight: '600', color: '#374151' },
  operacaoValor: { fontSize: 14, fontWeight: 'bold', color: '#1F2937', marginTop: 4 },
  operacaoSubtexto: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  microSeguroCard: { backgroundColor: '#FEF9C3', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  microSeguroTitulo: { fontSize: 14, fontWeight: '600', color: '#92400E' },
  microSeguroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  microSeguroValor: { fontSize: 20, fontWeight: 'bold', color: '#92400E' },
  microSeguroQtd: { fontSize: 13, color: '#92400E' },
  encerrarDiaBtn: { backgroundColor: '#D97706', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  encerrarDiaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  iniciarDiaBtn: { backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  iniciarDiaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: 10 },
  bottomNavItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  bottomNavIcon: { fontSize: 24 },
  bottomNavLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  bottomNavLabelActive: { color: '#3B82F6', fontWeight: '600' },
  fabButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginTop: -28, elevation: 8 },
  fabButtonDisabled: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center', marginTop: -28 },
  fabButtonDisabledStyle: { backgroundColor: '#9CA3AF' },
  fabButtonIcon: { color: '#fff', fontSize: 28, fontWeight: '300' },
  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 70, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  fabMenu: { backgroundColor: '#fff', borderRadius: 16, padding: 8, width: width - 80, elevation: 10 },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  fabMenuIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  fabMenuIconText: { fontSize: 20 },
  fabMenuTexts: { marginLeft: 12 },
  fabMenuTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  fabMenuSubtitle: { fontSize: 13, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 20, textAlign: 'center' },
  modalLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#1F2937', backgroundColor: '#F9FAFB' },
  modalInputMultiline: { height: 80, textAlignVertical: 'top' },
  modalSaldo: { fontSize: 13, color: '#6B7280', marginTop: 8, marginBottom: 20 },
  modalConfirmacao: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnCancelar: { backgroundColor: '#F3F4F6' },
  modalBtnCancelarText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  modalBtnConfirmar: { backgroundColor: '#10B981' },
  modalBtnFechar: { backgroundColor: '#D97706' },
  modalBtnConfirmarText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
