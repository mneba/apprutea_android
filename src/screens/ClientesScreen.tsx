import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
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

type Language = 'pt-BR' | 'es';
type TabAtiva = 'liquidacao' | 'todos';
type FiltroLiquidacao = 'todos' | 'atrasados';
type OrdenacaoLiquidacao = 'rota' | 'nome';

interface ClienteRotaDia {
  cliente_id: string; consecutivo: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null;
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  numero_parcelas: number; status_emprestimo: string; rota_id: string;
  frequencia_pagamento: string; parcela_id: string; numero_parcela: number;
  valor_parcela: number; valor_pago_parcela: number; saldo_parcela: number;
  status_parcela: string; data_vencimento: string; ordem_visita_dia: number | null;
  liquidacao_id: string | null; tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  permite_emprestimo_adicional: boolean; is_parcela_atrasada?: boolean;
}

interface EmprestimoData {
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  numero_parcelas: number; status_emprestimo: string; frequencia_pagamento: string;
  parcela_id: string; numero_parcela: number; valor_parcela: number;
  valor_pago_parcela: number; saldo_parcela: number; status_parcela: string;
  data_vencimento: string; ordem_visita_dia: number | null;
  tem_parcelas_vencidas: boolean; total_parcelas_vencidas: number;
  valor_total_vencido: number; status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  is_parcela_atrasada?: boolean;
  pagamento_info?: { valorPago: number; creditoGerado: number; valorParcela: number };
}

interface ClienteAgrupado {
  cliente_id: string; consecutivo: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null; rota_id: string;
  emprestimos: EmprestimoData[]; qtd_emprestimos: number; tem_multiplos_vencimentos: boolean;
}

interface ClienteTodos {
  id: string; consecutivo: number | null; nome: string;
  telefone_celular: string | null; status: string; tem_atraso: boolean;
  emprestimos: EmprestimoTodos[];
}

interface EmprestimoTodos {
  id: string; valor_principal: number; saldo_emprestimo: number;
  valor_parcela: number; numero_parcelas: number; numero_parcela_atual: number;
  status: string; frequencia_pagamento: string;
  total_parcelas_vencidas: number; valor_total_vencido: number;
}

interface PagamentoParcela {
  parcela_id: string; cliente_id: string; valor_pago_atual: number;
  valor_credito_gerado: number; valor_parcela: number; data_pagamento: string;
}

interface ParcelaModal {
  parcela_id: string;
  numero_parcela: number;
  data_vencimento: string;
  valor_parcela: number;
  status: string;
  data_pagamento: string | null;
  valor_multa: number;
  valor_pago?: number;
  credito_gerado?: number;
}

const textos = {
  'pt-BR': {
    titulo: 'Meus Clientes', hoje: 'Hoje', clientes: 'clientes',
    liquidacao: 'Liquidação', todosList: 'Todos', buscar: 'Buscar...',
    ordemRota: 'Ordem rota', ordemNome: 'Nome A-Z',
    filtroTodos: 'Todos', filtroAtrasados: 'Atrasados', filtroPagas: 'Pagas',
    parcela: 'Parcela', saldoEmprestimo: 'Saldo Empréstimo',
    parcelasVencidas: 'parcela(s) vencida(s)', totalAtraso: 'Total em atraso:',
    emprestimo: 'Empréstimo', principal: 'Principal', juros: 'Juros',
    total: 'Total', jaPago: 'Já Pago', saldo: 'Saldo', parcelas: 'Parcelas',
    progresso: 'Progresso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Parcelas', contato: 'Contato', ir: 'IR',
    semClientes: 'Nenhum cliente encontrado', carregando: 'Carregando clientes...',
    statusAtraso: 'Atraso', statusInativo: 'Inativo',
    tipoFiltro: 'Tipo:...', statusFiltro: 'Status:...',
    pago: 'Pago:', original: 'Original:', credito: 'Crédito:',
    empAtivo: 'Empréstimo Ativo', empVencido: 'Empréstimo Vencido',
    valorParcela: 'Valor Parcela', saldoDevedor: 'Saldo Devedor',
    empAdicional: 'Empréstimo Adicional', detalhes: 'Detalhes',
    modoVisualizacao: 'Modo Visualização',
    modoVisualizacaoDesc: 'Visualizando dados de',
    modoVisualizacaoSair: 'Sair',
    estornar: 'Estornar', venc: 'Venc:', em: 'Em:', fechar: 'Fechar',
    creditoDisponivel: 'Crédito disponível:',
    registrarPagamento: 'Registrar Pagamento', valorAPagar: 'Valor a pagar',
    forma: 'Forma:', gpsOk: 'GPS OK', gpsErro: 'Sem GPS',
    pagarBtn: 'PAGAR', pendente: 'PENDENTE', vencimento: 'Vencimento:',
    processando: 'Processando...', sucesso: 'Pagamento registrado!',
    erro: 'Erro ao registrar pagamento',
    motivoEstorno: 'Motivo do estorno', estornarPagamento: 'Estornar Pagamento',
    confirmarEstorno: 'CONFIRMAR ESTORNO', cancelar: 'Cancelar',
    estornoSucesso: 'Estorno realizado!', estornoErro: 'Erro ao estornar',
    liquidacaoNecessaria: 'É necessário ter uma liquidação aberta para esta operação.',
    usar: 'Usar',
    saldoAnterior: 'Saldo anterior de',
    valorPendente: 'Valor pendente:',
    pagamentoBloqueado: 'Pagamento bloqueado',
    irProximaParcela: 'Ir para próxima parcela pendente',
    carregandoDados: 'Carregando dados...',
  },
  'es': {
    titulo: 'Mis Clientes', hoje: 'Hoy', clientes: 'clientes',
    liquidacao: 'Liquidación', todosList: 'Todos', buscar: 'Buscar...',
    ordemRota: 'Orden ruta', ordemNome: 'Nombre A-Z',
    filtroTodos: 'Todos', filtroAtrasados: 'Atrasados', filtroPagas: 'Pagados',
    parcela: 'Cuota', saldoEmprestimo: 'Saldo Préstamo',
    parcelasVencidas: 'cuota(s) vencida(s)', totalAtraso: 'Total en atraso:',
    emprestimo: 'Préstamo', principal: 'Principal', juros: 'Intereses',
    total: 'Total', jaPago: 'Ya Pagó', saldo: 'Saldo', parcelas: 'Cuotas',
    progresso: 'Progreso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Cuotas', contato: 'Contacto', ir: 'IR',
    semClientes: 'Ningún cliente encontrado', carregando: 'Cargando clientes...',
    statusAtraso: 'Atraso', statusInativo: 'Inactivo',
    tipoFiltro: 'Tipo:...', statusFiltro: 'Estado:...',
    pago: 'Pagado:', original: 'Original:', credito: 'Crédito:',
    empAtivo: 'Préstamo Activo', empVencido: 'Préstamo Vencido',
    valorParcela: 'Valor Cuota', saldoDevedor: 'Saldo Deudor',
    empAdicional: 'Préstamo Adicional', detalhes: 'Detalles',
    modoVisualizacao: 'Modo Visualización',
    modoVisualizacaoDesc: 'Visualizando datos de',
    modoVisualizacaoSair: 'Salir',
    estornar: 'Reversar', venc: 'Venc:', em: 'En:', fechar: 'Cerrar',
    creditoDisponivel: 'Crédito disponible:',
    registrarPagamento: 'Registrar Pago', valorAPagar: 'Valor a pagar',
    forma: 'Forma:', gpsOk: 'GPS OK', gpsErro: 'Sin GPS',
    pagarBtn: 'PAGAR', pendente: 'PENDIENTE', vencimiento: 'Vencimiento:',
    processando: 'Procesando...', sucesso: '¡Pago registrado!',
    erro: 'Error al registrar pago',
    motivoEstorno: 'Motivo de reversión', estornarPagamento: 'Reversar Pago',
    confirmarEstorno: 'CONFIRMAR REVERSIÓN', cancelar: 'Cancelar',
    estornoSucesso: '¡Reversión realizada!', estornoErro: 'Error al reversar',
    liquidacaoNecessaria: 'Es necesario tener una liquidación abierta para esta operación.',
    usar: 'Usar',
    saldoAnterior: 'Saldo anterior de',
    valorPendente: 'Valor pendiente:',
    pagamentoBloqueado: 'Pago bloqueado',
    irProximaParcela: 'Ir a próxima cuota pendiente',
    carregandoDados: 'Cargando datos...',
  },
};

const FREQ: Record<string, string> = { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' };
const getIni = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '$ ');
const fmtData = (d: string) => { if (!d) return ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const fmtTel = (t: string) => t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
const borderOf = (e: EmprestimoData, paga: boolean) => {
  if (paga) return '#10B981';
  if (e.is_parcela_atrasada) return '#EF4444';
  return ({ PAGO: '#10B981', EM_ATRASO: '#EF4444', PARCIAL: '#F59E0B', PENDENTE: '#D1D5DB' } as any)[e.status_dia] || '#D1D5DB';
};
const bgOf = (_e: EmprestimoData, paga: boolean) => paga ? 'rgba(16,185,129,0.07)' : '#fff';
const isPaga = (pid: string, sd: string, set: Set<string>) => set.has(pid) || sd === 'PAGO';

export default function ClientesScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();
  const liqCtx = useLiquidacaoContext();
  const rotaId = route?.params?.rotaId || vendedor?.rota_id;
  const dataLiq = liqCtx.dataVisualizacao || route?.params?.dataLiquidacao || new Date().toISOString().split('T')[0];
  const liqId = liqCtx.liquidacaoIdVisualizacao || route?.params?.liquidacaoId;
  const isViz = liqCtx.modoVisualizacao || route?.params?.isVisualizacao || false;

  const [lang] = useState<Language>('pt-BR');
  const [tab, setTab] = useState<TabAtiva>('liquidacao');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  const [raw, setRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [empIdxMap, setEmpIdxMap] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<FiltroLiquidacao>('todos');
  const [ord, setOrd] = useState<OrdenacaoLiquidacao>('rota');
  const [showOrd, setShowOrd] = useState(false);
  const [mostrarPagas, setMostrarPagas] = useState(false);

  const [todosList, setTodosList] = useState<ClienteTodos[]>([]);
  const [loadTodos, setLoadTodos] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<string | null>(null);
  const [empIdxTodos, setEmpIdxTodos] = useState<Record<string, number>>({});

  // Estados dos Modais
  const [modalParcelasVisible, setModalParcelasVisible] = useState(false);
  const [modalPagamentoVisible, setModalPagamentoVisible] = useState(false);
  const [modalEstornoVisible, setModalEstornoVisible] = useState(false);
  const [parcelasModal, setParcelasModal] = useState<ParcelaModal[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);
  const [clienteModal, setClienteModal] = useState<{ id: string; nome: string; emprestimo_id: string } | null>(null);
  
  const [parcelaPagamento, setParcelaPagamento] = useState<ParcelaModal | null>(null);
  const [dadosPagamento, setDadosPagamento] = useState<any>(null);
  const [loadingDadosPagamento, setLoadingDadosPagamento] = useState(false);
  const [valorPagamento, setValorPagamento] = useState('');
  const [usarCredito, setUsarCredito] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO');
  const [gpsStatus, setGpsStatus] = useState<'ok' | 'erro' | 'carregando'>('carregando');
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [processando, setProcessando] = useState(false);

  const [parcelaEstorno, setParcelaEstorno] = useState<ParcelaModal | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');

  const t = textos[lang];

  const carregarGPS = useCallback(async () => {
    setGpsStatus('carregando');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsStatus('erro'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
      setGpsStatus('ok');
    } catch { setGpsStatus('erro'); }
  }, []);

  const loadLiq = useCallback(async () => {
    if (!rotaId) return;
    try {
      const { data, error } = await supabase.from('vw_clientes_rota_dia').select('*').eq('rota_id', rotaId).eq('data_vencimento', dataLiq);
      if (error) throw error;
      setRaw((data || []) as ClienteRotaDia[]);
      const ids = (data || []).map((r: any) => r.parcela_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: pags } = await supabase.from('pagamentos_parcelas').select('parcela_id, cliente_id, valor_pago_atual, valor_credito_gerado, valor_parcela, data_pagamento').in('parcela_id', ids);
        const m = new Map<string, PagamentoParcela>();
        const s = new Set<string>();
        (pags || []).forEach((p: any) => { m.set(p.parcela_id, p); if (p.valor_pago_atual >= p.valor_parcela) s.add(p.parcela_id); });
        setPagMap(m); setPagasSet(s);
      } else { setPagMap(new Map()); setPagasSet(new Set()); }
    } catch (e) { console.error('Erro loadLiq:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [rotaId, dataLiq]);

  const loadTodosClientes = useCallback(async () => {
    if (!rotaId || todosList.length > 0) return;
    setLoadTodos(true);
    try {
      const { data: emps } = await supabase.from('emprestimos').select(`id, valor_principal, valor_saldo, valor_parcela, numero_parcelas, status, frequencia_pagamento, clientes!inner(id, nome, telefone_celular, status, consecutivo)`).eq('rota_id', rotaId).in('status', ['ATIVO', 'VENCIDO']);
      if (!emps) return;
      const cliMap = new Map<string, ClienteTodos>();
      for (const e of emps as any[]) {
        const c = e.clientes; if (!c) continue;
        let cli = cliMap.get(c.id);
        if (!cli) { cli = { id: c.id, consecutivo: c.consecutivo, nome: c.nome, telefone_celular: c.telefone_celular, status: c.status, tem_atraso: false, emprestimos: [] }; cliMap.set(c.id, cli); }
        const { data: parc } = await supabase.from('emprestimo_parcelas').select('numero_parcela').eq('emprestimo_id', e.id).order('numero_parcela', { ascending: false }).limit(1);
        const np = parc?.[0]?.numero_parcela || 1;
        const { count: vcnt } = await supabase.from('emprestimo_parcelas').select('*', { count: 'exact', head: true }).eq('emprestimo_id', e.id).eq('status', 'VENCIDO');
        const { data: vsum } = await supabase.from('emprestimo_parcelas').select('valor_parcela').eq('emprestimo_id', e.id).eq('status', 'VENCIDO');
        const vtot = (vsum || []).reduce((a: number, p: any) => a + (p.valor_parcela || 0), 0);
        if ((vcnt || 0) > 0) cli.tem_atraso = true;
        cli.emprestimos.push({ id: e.id, valor_principal: e.valor_principal, saldo_emprestimo: e.valor_saldo, valor_parcela: e.valor_parcela, numero_parcelas: e.numero_parcelas, numero_parcela_atual: np, status: e.status, frequencia_pagamento: e.frequencia_pagamento, total_parcelas_vencidas: vcnt || 0, valor_total_vencido: vtot });
      }
      setTodosList(Array.from(cliMap.values()));
    } catch (e) { console.error('Erro loadTodos:', e); }
    finally { setLoadTodos(false); }
  }, [rotaId, todosList.length]);

  useEffect(() => { loadLiq(); }, [loadLiq]);
  useEffect(() => { if (tab === 'todos') loadTodosClientes(); }, [tab, loadTodosClientes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (tab === 'liquidacao') loadLiq();
    else { setTodosList([]); loadTodosClientes(); }
  }, [tab, loadLiq, loadTodosClientes]);

  const abrirParcelas = useCallback(async (clienteId: string, clienteNome: string, emprestimoId: string) => {
    setClienteModal({ id: clienteId, nome: clienteNome, emprestimo_id: emprestimoId });
    setModalParcelasVisible(true);
    setLoadingParcelas(true);
    setParcelasModal([]);
    setCreditoDisponivel(0);
    try {
      const { data: parcelas, error: errP } = await supabase.from('vw_parcelas_emprestimo').select('*').eq('emprestimo_id', emprestimoId).order('numero_parcela', { ascending: true });
      if (errP) throw errP;
      if (!parcelas || parcelas.length === 0) { setParcelasModal([]); setLoadingParcelas(false); return; }
      const ids = parcelas.map((p: any) => p.parcela_id);
      const { data: pagamentos } = await supabase.from('pagamentos_parcelas').select('parcela_id, valor_pago_atual, valor_credito_gerado').in('parcela_id', ids);
      const pMap = new Map<string, { valorPago: number; creditoGerado: number }>();
      let creditoTotal = 0;
      (pagamentos || []).forEach((p: any) => { pMap.set(p.parcela_id, { valorPago: p.valor_pago_atual, creditoGerado: p.valor_credito_gerado }); creditoTotal += p.valor_credito_gerado || 0; });
      setCreditoDisponivel(creditoTotal);
      setParcelasModal(parcelas.map((p: any) => { const pag = pMap.get(p.parcela_id); return { parcela_id: p.parcela_id, numero_parcela: p.numero_parcela, data_vencimento: p.data_vencimento, valor_parcela: p.valor_parcela, status: p.status, data_pagamento: p.data_pagamento, valor_multa: p.valor_multa || 0, valor_pago: pag?.valorPago || 0, credito_gerado: pag?.creditoGerado || 0 }; }));
    } catch (e) { console.error('Erro parcelas:', e); Alert.alert('Erro', 'Não foi possível carregar as parcelas.'); }
    finally { setLoadingParcelas(false); }
  }, []);

  // FUNÇÃO ATUALIZADA - Busca dados completos via RPC antes de abrir modal
  const abrirPagamento = useCallback(async (parcela: ParcelaModal) => {
    if (!liqId && !isViz) { Alert.alert('Atenção', t.liquidacaoNecessaria); return; }
    
    setParcelaPagamento(parcela);
    setDadosPagamento(null);
    setLoadingDadosPagamento(true);
    setUsarCredito(false);
    setFormaPagamento('DINHEIRO');
    setModalPagamentoVisible(true);
    carregarGPS();
    
    try {
      const { data, error } = await supabase.rpc('fn_consultar_parcela_para_pagamento', { p_parcela_id: parcela.parcela_id });
      if (error) throw error;
      
      const dados = Array.isArray(data) ? data[0] : data;
      if (dados) {
        setDadosPagamento(dados);
        setValorPagamento((dados.valor_saldo_parcela || parcela.valor_parcela).toFixed(2).replace('.', ','));
      } else {
        setValorPagamento(parcela.valor_parcela.toFixed(2).replace('.', ','));
      }
    } catch (e) {
      console.error('Erro ao consultar parcela:', e);
      setValorPagamento(parcela.valor_parcela.toFixed(2).replace('.', ','));
    } finally {
      setLoadingDadosPagamento(false);
    }
  }, [liqId, isViz, t, carregarGPS]);

  // Função para ir para próxima parcela pendente
  const irParaProximaParcela = useCallback(async () => {
    if (!clienteModal) return;
    setLoadingDadosPagamento(true);
    try {
      const { data, error } = await supabase.rpc('fn_buscar_proxima_parcela_a_pagar', { p_emprestimo_id: clienteModal.emprestimo_id });
      if (error) throw error;
      const proxima = Array.isArray(data) ? data[0] : data;
      if (proxima && proxima.parcela_id) {
        const novaParcela: ParcelaModal = {
          parcela_id: proxima.parcela_id, numero_parcela: proxima.numero_parcela,
          data_vencimento: proxima.data_vencimento, valor_parcela: proxima.valor_parcela,
          status: proxima.status, data_pagamento: null, valor_multa: proxima.valor_multa || 0,
        };
        setParcelaPagamento(novaParcela);
        const { data: dadosNova } = await supabase.rpc('fn_consultar_parcela_para_pagamento', { p_parcela_id: proxima.parcela_id });
        const dados = Array.isArray(dadosNova) ? dadosNova[0] : dadosNova;
        if (dados) {
          setDadosPagamento(dados);
          setValorPagamento((dados.valor_saldo_parcela || proxima.valor_parcela).toFixed(2).replace('.', ','));
        }
      }
    } catch (e) { console.error('Erro ao buscar próxima parcela:', e); }
    finally { setLoadingDadosPagamento(false); }
  }, [clienteModal]);

  // FUNÇÃO ATUALIZADA - Registra pagamento com suporte a crédito
  const registrarPagamento = useCallback(async () => {
    if (!parcelaPagamento || processando) return;
    if (dadosPagamento && !dadosPagamento.permite_pagamento) {
      Alert.alert('Atenção', dadosPagamento.mensagem_bloqueio || 'Pagamento não permitido');
      return;
    }
    const valorNum = parseFloat(valorPagamento.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) { Alert.alert('Erro', 'Valor inválido'); return; }
    const valorCredito = usarCredito && dadosPagamento?.credito_disponivel ? dadosPagamento.credito_disponivel : 0;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_registrar_pagamento', { 
        p_parcela_id: parcelaPagamento.parcela_id, 
        p_valor_pagamento: valorNum, 
        p_valor_credito: valorCredito, 
        p_forma_pagamento: formaPagamento, 
        p_observacoes: null, 
        p_latitude: coords?.lat || null, 
        p_longitude: coords?.lng || null, 
        p_precisao_gps: coords?.acc || null, 
        p_liquidacao_id: liqId || null 
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        Alert.alert('Sucesso', t.sucesso);
        setModalPagamentoVisible(false);
        setParcelaPagamento(null);
        setDadosPagamento(null);
        if (clienteModal) abrirParcelas(clienteModal.id, clienteModal.nome, clienteModal.emprestimo_id);
        loadLiq();
      } else { Alert.alert('Erro', res?.mensagem || t.erro); }
    } catch (e: any) { console.error('Erro pagamento:', e); Alert.alert('Erro', e.message || t.erro); }
    finally { setProcessando(false); }
  }, [parcelaPagamento, dadosPagamento, valorPagamento, usarCredito, formaPagamento, coords, liqId, t, clienteModal, abrirParcelas, loadLiq, processando]);

  const abrirEstorno = useCallback((parcela: ParcelaModal) => {
    if (!liqId) { Alert.alert('Atenção', t.liquidacaoNecessaria); return; }
    setParcelaEstorno(parcela);
    setMotivoEstorno('');
    setModalEstornoVisible(true);
  }, [liqId, t]);

  const confirmarEstorno = useCallback(async () => {
    if (!parcelaEstorno || !motivoEstorno.trim() || processando) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_estornar_pagamento', { p_parcela_id: parcelaEstorno.parcela_id, p_motivo: motivoEstorno.trim() });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        Alert.alert('Sucesso', t.estornoSucesso);
        setModalEstornoVisible(false);
        setParcelaEstorno(null);
        if (clienteModal) abrirParcelas(clienteModal.id, clienteModal.nome, clienteModal.emprestimo_id);
        loadLiq();
      } else { Alert.alert('Erro', res?.mensagem || t.estornoErro); }
    } catch (e: any) { console.error('Erro estorno:', e); Alert.alert('Erro', e.message || t.estornoErro); }
    finally { setProcessando(false); }
  }, [parcelaEstorno, motivoEstorno, t, clienteModal, abrirParcelas, loadLiq, processando]);

  const grouped = useMemo((): ClienteAgrupado[] => {
    const m = new Map<string, ClienteAgrupado>();
    raw.forEach(r => {
      let g = m.get(r.cliente_id);
      if (!g) { g = { cliente_id: r.cliente_id, consecutivo: r.consecutivo, nome: r.nome, telefone_celular: r.telefone_celular, endereco: r.endereco, latitude: r.latitude, longitude: r.longitude, rota_id: r.rota_id, emprestimos: [], qtd_emprestimos: 0, tem_multiplos_vencimentos: false }; m.set(r.cliente_id, g); }
      if (!g.emprestimos.some(e => e.parcela_id === r.parcela_id)) {
        const pi = pagMap.get(r.parcela_id);
        g.emprestimos.push({ emprestimo_id: r.emprestimo_id, saldo_emprestimo: r.saldo_emprestimo, valor_principal: r.valor_principal, numero_parcelas: r.numero_parcelas, status_emprestimo: r.status_emprestimo, frequencia_pagamento: r.frequencia_pagamento, parcela_id: r.parcela_id, numero_parcela: r.numero_parcela, valor_parcela: r.valor_parcela, valor_pago_parcela: r.valor_pago_parcela, saldo_parcela: r.saldo_parcela, status_parcela: r.status_parcela, data_vencimento: r.data_vencimento, ordem_visita_dia: r.ordem_visita_dia, tem_parcelas_vencidas: r.tem_parcelas_vencidas, total_parcelas_vencidas: r.total_parcelas_vencidas, valor_total_vencido: r.valor_total_vencido, status_dia: r.status_dia, is_parcela_atrasada: r.is_parcela_atrasada, pagamento_info: pi ? { valorPago: pi.valor_pago_atual, creditoGerado: pi.valor_credito_gerado, valorParcela: pi.valor_parcela } : undefined });
      }
    });
    m.forEach(g => { g.qtd_emprestimos = g.emprestimos.length; g.tem_multiplos_vencimentos = g.emprestimos.length > 1; });
    return Array.from(m.values());
  }, [raw, pagMap]);

  const isCliPago = useCallback((c: ClienteAgrupado) => c.emprestimos.every(e => isPaga(e.parcela_id, e.status_dia, pagasSet)), [pagasSet]);

  const filtered = useMemo(() => {
    let r = [...grouped];
    if (!mostrarPagas) r = r.filter(c => !isCliPago(c));
    if (busca.trim()) { const b = busca.toLowerCase().trim(); r = r.filter(c => c.nome.toLowerCase().includes(b) || (c.telefone_celular && c.telefone_celular.includes(b)) || (c.endereco && c.endereco.toLowerCase().includes(b))); }
    if (filtro === 'atrasados') r = r.filter(c => c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas));
    r.sort(ord === 'rota' ? (a, b) => (a.emprestimos[0]?.ordem_visita_dia ?? 9999) - (b.emprestimos[0]?.ordem_visita_dia ?? 9999) : (a, b) => a.nome.localeCompare(b.nome));
    return r;
  }, [grouped, busca, filtro, ord, mostrarPagas, isCliPago]);

  const cntTotal = grouped.length;
  const cntAtraso = grouped.filter(c => c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas)).length;
  const cntPagas = grouped.filter(c => isCliPago(c)).length;
  const eIdx = (cid: string) => empIdxMap[cid] || 0;
  const eSet = (cid: string, i: number) => setEmpIdxMap(p => ({ ...p, [cid]: i }));
  const eAtual = (c: ClienteAgrupado) => c.emprestimos[Math.min(eIdx(c.cliente_id), c.emprestimos.length - 1)];

  const renderParcelaItem = (p: ParcelaModal) => {
    const isPago = p.status === 'PAGO';
    const isVencida = p.status === 'VENCIDO' || p.status === 'VENCIDA';
    const iconColor = isPago ? '#10B981' : isVencida ? '#EF4444' : '#F59E0B';
    const iconBg = isPago ? '#D1FAE5' : isVencida ? '#FEE2E2' : '#FEF3C7';
    const statusColor = isPago ? '#10B981' : isVencida ? '#EF4444' : '#F97316';
    const statusBg = isPago ? '#D1FAE5' : isVencida ? '#FEE2E2' : '#FFEDD5';
    const statusText = isPago ? 'PAGO' : isVencida ? 'VENCIDA' : 'PENDENTE';
    return (
      <View key={p.parcela_id} style={[S.mParcela, { borderLeftColor: iconColor }]}>
        <View style={S.mParcelaRow}>
          <View style={[S.mParcelaIcon, { backgroundColor: iconBg }]}><Text style={{ color: iconColor, fontSize: 14 }}>{isPago ? '✓' : '📅'}</Text></View>
          <View style={S.mParcelaInfo}><Text style={S.mParcelaNum}>{t.parcela} {p.numero_parcela}</Text><Text style={S.mParcelaVenc}>{t.venc} {fmtData(p.data_vencimento)}</Text></View>
          <View style={S.mParcelaValores}>
            <Text style={S.mParcelaOriginal}>{t.original} {fmt(p.valor_parcela)}</Text>
            {isPago && p.valor_pago ? (<><Text style={S.mParcelaPago}>{t.pago} {fmt(p.valor_pago)}</Text>{(p.credito_gerado || 0) > 0 && <Text style={S.mParcelaCredito}>{t.credito} {fmt(p.credito_gerado || 0)}</Text>}</>) : (<Text style={S.mParcelaValor}>{fmt(p.valor_parcela)}</Text>)}
            <View style={[S.mParcelaStatus, { backgroundColor: statusBg }]}><Text style={[S.mParcelaStatusTx, { color: statusColor }]}>{statusText}</Text></View>
            {isPago && p.data_pagamento && <Text style={S.mParcelaDataPg}>{t.em} {fmtData(p.data_pagamento)}</Text>}
          </View>
        </View>
        <View style={S.mParcelaBtns}>
          {!isPago && p.parcela_id && <TouchableOpacity style={S.mBtnPagar} onPress={() => abrirPagamento(p)} disabled={isViz}><Text style={S.mBtnPagarIcon}>💰</Text><Text style={S.mBtnPagarTx}>{t.pagar}</Text></TouchableOpacity>}
          {isPago && p.parcela_id && liqId && !isViz && <TouchableOpacity style={S.mBtnEstornar} onPress={() => abrirEstorno(p)}><Text style={S.mBtnEstornarIcon}>↩</Text><Text style={S.mBtnEstornarTx}>{t.estornar}</Text></TouchableOpacity>}
        </View>
      </View>
    );
  };

  const renderCard = (c: ClienteAgrupado) => {
    const e = eAtual(c); const ex = expanded === c.cliente_id; const ei = eIdx(c.cliente_id);
    const pg = isPaga(e.parcela_id, e.status_dia, pagasSet); const bc = borderOf(e, pg); const bg = bgOf(e, pg);
    const pi = e.pagamento_info; const juros = e.valor_parcela * e.numero_parcelas - e.valor_principal;
    const totalE = e.valor_principal + juros; const pp = e.numero_parcela - 1 + (pg ? 1 : 0);
    const pr = e.numero_parcelas - pp; const pct = e.numero_parcelas > 0 ? Math.min(100, Math.round((pp / e.numero_parcelas) * 100)) : 0;
    return (
      <TouchableOpacity key={c.cliente_id} activeOpacity={0.7} onPress={() => setExpanded(p => p === c.cliente_id ? null : c.cliente_id)} style={[S.card, { borderLeftColor: bc, backgroundColor: bg }]}>
        <View style={S.cardRow}>
          <View style={[S.av, { backgroundColor: bc === '#D1D5DB' ? '#3B82F6' : bc }]}><Text style={S.avTx}>{getIni(c.nome)}</Text></View>
          <View style={S.cardInfo}>
            <View style={S.nameRow}><Text style={S.nome} numberOfLines={1}>{c.nome.toLowerCase()}</Text>{e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 && <View style={S.bWarn}><Text style={S.bWarnI}>⚠</Text><Text style={S.bWarnT}>{e.total_parcelas_vencidas}</Text></View>}{c.tem_multiplos_vencimentos && <View style={S.bMul}><Text style={S.bMulT}>{c.qtd_emprestimos}</Text></View>}<Text style={S.dots}>⋮</Text></View>
            {c.telefone_celular ? <Text style={S.sub}>📞 {fmtTel(c.telefone_celular)}</Text> : null}
            {c.endereco ? <Text style={S.sub} numberOfLines={1}>📍 {c.endereco}</Text> : null}
          </View>
        </View>
        <View style={S.pRow}>
          <View><View style={S.pLblR}><Text style={S.pLbl}>{t.parcela} {e.numero_parcela}/{e.numero_parcelas}</Text><View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[e.frequencia_pagamento] || e.frequencia_pagamento}</Text></View></View>{pg && pi ? (<><Text style={S.pgVal}>{t.pago} {fmt(pi.valorPago)}</Text><Text style={S.pgOrig}>{t.original} {fmt(pi.valorParcela)}</Text>{pi.creditoGerado > 0 && <Text style={S.pgCred}>{t.credito} {fmt(pi.creditoGerado)}</Text>}</>) : (<Text style={S.pVal}>{fmt(e.valor_parcela)}</Text>)}</View>
          <View style={S.sCol}><Text style={S.sLbl}>{t.saldoEmprestimo}</Text><Text style={S.sVal}>{fmt(e.saldo_emprestimo)}</Text></View>
        </View>
        {ex && (<View style={S.exp}>
          {e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 && <View style={S.aR}><Text style={S.aRT}>⚠ {e.total_parcelas_vencidas} {t.parcelasVencidas}</Text><Text style={S.aRS}>{t.totalAtraso} {fmt(e.valor_total_vencido)}</Text></View>}
          {e.status_parcela === 'PARCIAL' && !pg && <View style={S.aY}><Text style={S.aYT}>Parcial: {fmt(e.valor_pago_parcela)} / {fmt(e.valor_parcela)}</Text><Text style={S.aYS}>Restante: {fmt(e.saldo_parcela)}</Text></View>}
          {c.tem_multiplos_vencimentos && (<View style={S.eNav}><TouchableOpacity onPress={() => eSet(c.cliente_id, Math.max(0, ei - 1))} disabled={ei === 0} style={[S.eNBtn, ei === 0 && S.eNOff]}><Text style={S.eNBTx}>◀</Text></TouchableOpacity>{c.emprestimos.map((_, i) => <View key={i} style={[S.eDot, i === ei && S.eDotOn]} />)}<TouchableOpacity onPress={() => eSet(c.cliente_id, Math.min(c.emprestimos.length - 1, ei + 1))} disabled={ei >= c.emprestimos.length - 1} style={[S.eNBtn, ei >= c.emprestimos.length - 1 && S.eNOff]}><Text style={S.eNBTx}>▶</Text></TouchableOpacity><Text style={S.eNLbl}> {t.emprestimo} {ei + 1}/{c.qtd_emprestimos}</Text></View>)}
          <View style={S.res}><View style={S.resH}><Text style={S.resT}>{t.emprestimo} {ei + 1}/{c.qtd_emprestimos}</Text><View style={[S.stB, { backgroundColor: e.status_dia === 'EM_ATRASO' ? '#FEE2E2' : pg ? '#D1FAE5' : '#F3F4F6' }]}><Text style={[S.stBT, { color: e.status_dia === 'EM_ATRASO' ? '#DC2626' : pg ? '#059669' : '#6B7280' }]}>{pg ? 'PAGO' : e.status_dia}</Text></View></View><View style={S.g3}><View style={S.gi}><Text style={S.gl}>{t.principal}</Text><Text style={S.gv}>{fmt(e.valor_principal)}</Text></View><View style={S.gi}><Text style={S.gl}>{t.juros}</Text><Text style={[S.gv, { color: '#F59E0B' }]}>{fmt(juros)}</Text></View><View style={S.gi}><Text style={S.gl}>{t.total}</Text><Text style={S.gv}>{fmt(totalE)}</Text></View></View><View style={S.g3}><View style={S.gi}><Text style={S.gl}>{t.jaPago}</Text><Text style={[S.gv, { color: '#10B981' }]}>{fmt(totalE - e.saldo_emprestimo)}</Text></View><View style={S.gi}><Text style={S.gl}>{t.saldo}</Text><Text style={[S.gv, { color: '#EF4444' }]}>{fmt(e.saldo_emprestimo)}</Text></View><View style={S.gi}><Text style={S.gl}>{t.parcelas}</Text><Text style={S.gv}>{pp}/{e.numero_parcelas}</Text></View></View><Text style={S.prL}>{t.progresso}</Text><View style={S.prB}><View style={[S.prF, { width: `${pct}%` }]} /></View><Text style={S.prR}>{pr} {t.restantes}</Text></View>
          <View style={S.btR}><TouchableOpacity style={[S.bt, S.btG, (isViz || pg) && S.btOff]} onPress={() => { if (!isViz && !pg) abrirPagamento({ parcela_id: e.parcela_id, numero_parcela: e.numero_parcela, data_vencimento: e.data_vencimento, valor_parcela: e.valor_parcela, status: e.status_parcela, data_pagamento: null, valor_multa: 0 }); }} disabled={isViz || pg}><Text style={S.btI}>💰</Text><Text style={S.btW}>{t.pagar}</Text></TouchableOpacity><TouchableOpacity style={[S.bt, S.btBl]} onPress={() => abrirParcelas(c.cliente_id, c.nome, e.emprestimo_id)}><Text style={S.btI}>👁</Text><Text style={S.btW}>{t.verParcelas}</Text></TouchableOpacity></View>
          <View style={S.btR}><TouchableOpacity style={[S.bt, S.btOG]} onPress={() => c.telefone_celular && Linking.openURL(`tel:${c.telefone_celular.replace(/\D/g, '')}`)} disabled={!c.telefone_celular}><Text style={S.btI}>📱</Text><Text style={S.btTG}>{t.contato}</Text></TouchableOpacity><TouchableOpacity style={[S.bt, S.btOB]} onPress={() => { if (c.latitude && c.longitude) Linking.openURL(Platform.OS === 'ios' ? `maps:?daddr=${c.latitude},${c.longitude}` : `google.navigation:q=${c.latitude},${c.longitude}`); }} disabled={!c.latitude}><Text style={S.btI}>🧭</Text><Text style={S.btTB}>{t.ir}</Text></TouchableOpacity></View>
        </View>)}
      </TouchableOpacity>);
  };

  const todosFilt = useMemo(() => { if (!busca.trim()) return todosList; const b = busca.toLowerCase().trim(); return todosList.filter(c => c.nome.toLowerCase().includes(b) || (c.telefone_celular && c.telefone_celular.includes(b))); }, [todosList, busca]);

  const renderTodos = (c: ClienteTodos) => {
    const a = c.tem_atraso; const cor = a ? '#EF4444' : '#3B82F6';
    const ex = expandedTodos === c.id; const ei = empIdxTodos[c.id] || 0;
    const emp = c.emprestimos[Math.min(ei, c.emprestimos.length - 1)];
    const isVencido = emp?.status === 'VENCIDO';
    return (
      <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => setExpandedTodos(p => p === c.id ? null : c.id)} style={[S.card, { borderLeftColor: cor }]}>
        <View style={S.cardRow}><View style={[S.av, { backgroundColor: cor }]}><Text style={S.avTx}>{getIni(c.nome)}</Text></View><View style={S.cardInfo}><View style={S.nameRow}><Text style={S.nome} numberOfLines={1}>{c.nome.toLowerCase()}</Text>{a && <Text style={[S.tSt, { color: '#EF4444' }]}>{t.statusAtraso}</Text>}<Text style={S.dots}>⋮</Text></View></View></View>
        {ex && emp && (<View style={S.exp}>
          {emp.total_parcelas_vencidas > 0 && <View style={S.aR}><Text style={S.aRT}>⚠ {emp.total_parcelas_vencidas} {t.parcelasVencidas}</Text><Text style={S.aRS}>{t.totalAtraso} {fmt(emp.valor_total_vencido)}</Text></View>}
          <View style={S.tEmpCard}><View style={S.tEmpHead}><Text style={S.tEmpTitle}>{isVencido ? t.empVencido : t.empAtivo}</Text><Text style={S.tEmpParcela}>{emp.numero_parcela_atual}/{emp.numero_parcelas}</Text></View><View style={S.tEmpBody}><View><Text style={S.tEmpLbl}>{t.valorParcela}</Text><Text style={S.tEmpVal}>{fmt(emp.valor_parcela)}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={S.tEmpLbl}>{t.saldoDevedor}</Text><Text style={[S.tEmpVal, { color: emp.saldo_emprestimo > 0 ? '#F59E0B' : '#10B981' }]}>{fmt(emp.saldo_emprestimo)}</Text></View></View></View>
          {c.emprestimos.length > 1 && (<View style={S.eNav}><TouchableOpacity onPress={() => setEmpIdxTodos(p => ({ ...p, [c.id]: Math.max(0, ei - 1) }))} disabled={ei === 0} style={[S.eNBtn, ei === 0 && S.eNOff]}><Text style={S.eNBTx}>◀</Text></TouchableOpacity>{c.emprestimos.map((_, i) => <View key={i} style={[S.eDot, i === ei && S.eDotOn]} />)}<TouchableOpacity onPress={() => setEmpIdxTodos(p => ({ ...p, [c.id]: Math.min(c.emprestimos.length - 1, ei + 1) }))} disabled={ei >= c.emprestimos.length - 1} style={[S.eNBtn, ei >= c.emprestimos.length - 1 && S.eNOff]}><Text style={S.eNBTx}>▶</Text></TouchableOpacity><Text style={S.eNLbl}> {t.emprestimo} {ei + 1}/{c.emprestimos.length}</Text></View>)}
          {c.emprestimos.length === 1 && <View style={S.tAddRow}><Text style={S.tAddIcon}>⊕</Text><Text style={S.tAddText}>{t.empAdicional}</Text></View>}
          <View style={S.btR}><TouchableOpacity style={[S.bt, S.btRed]} onPress={() => c.telefone_celular && Linking.openURL(`tel:${c.telefone_celular.replace(/\D/g, '')}`)} disabled={!c.telefone_celular}><Text style={S.btI}>💬</Text><Text style={S.btW}>{t.contato}</Text></TouchableOpacity><TouchableOpacity style={[S.bt, S.btBl]} onPress={() => abrirParcelas(c.id, c.nome, emp.id)}><Text style={S.btI}>👁</Text><Text style={S.btW}>{t.detalhes}</Text></TouchableOpacity></View>
        </View>)}
      </TouchableOpacity>);
  };

  if (loading) return (<View style={S.lW}><ActivityIndicator size="large" color="#3B82F6" /><Text style={S.lT}>{t.carregando}</Text></View>);

  return (
    <View style={S.c}>
      <View style={S.hd}><View><Text style={S.hdT}>{t.titulo}</Text><Text style={S.hdS}>{isViz ? fmtData(dataLiq) : t.hoje} - {tab === 'liquidacao' ? filtered.length : todosList.length} {t.clientes}</Text></View><View style={S.hdR}><View style={S.hdDot} /><Text style={S.hdI}>🔔</Text><Text style={S.hdI}>⚙️</Text></View></View>
      {isViz && (<View style={S.vizBanner}><View style={S.vizBannerContent}><Text style={S.vizBannerIcon}>⚠️</Text><View style={S.vizBannerTexts}><Text style={S.vizBannerTitle}>{t.modoVisualizacao}</Text><Text style={S.vizBannerDesc}>{t.modoVisualizacaoDesc} {fmtData(dataLiq)}</Text></View></View></View>)}
      <View style={S.tabs}><TouchableOpacity style={[S.tb, tab === 'liquidacao' && S.tbOn]} onPress={() => setTab('liquidacao')}><Text style={S.tbI}>📅</Text><Text style={[S.tbTx, tab === 'liquidacao' && S.tbTxOn]}>{t.liquidacao} ({cntTotal})</Text></TouchableOpacity><TouchableOpacity style={[S.tb, tab === 'todos' && S.tbOn]} onPress={() => setTab('todos')}><Text style={S.tbI}>👥</Text><Text style={[S.tbTx, tab === 'todos' && S.tbTxOn]}>{t.todosList} ({todosList.length})</Text></TouchableOpacity></View>
      <View style={S.srR}><View style={S.srB}><Text style={S.srI}>🔍</Text><TextInput style={S.srIn} placeholder={t.buscar} placeholderTextColor="#9CA3AF" value={busca} onChangeText={setBusca} /></View>{tab === 'liquidacao' && <TouchableOpacity style={S.orB} onPress={() => setShowOrd(!showOrd)}><Text style={S.orI}>↕️</Text><Text style={S.orTx}>{ord === 'rota' ? t.ordemRota : t.ordemNome}</Text><Text style={S.orCh}>▼</Text></TouchableOpacity>}</View>
      {showOrd && tab === 'liquidacao' && <View style={S.orDr}>{(['rota', 'nome'] as OrdenacaoLiquidacao[]).map(o => (<TouchableOpacity key={o} style={[S.orOp, ord === o && S.orOpOn]} onPress={() => { setOrd(o); setShowOrd(false); }}><Text style={[S.orOpTx, ord === o && S.orOpTxOn]}>{o === 'rota' ? t.ordemRota : t.ordemNome}</Text></TouchableOpacity>))}</View>}
      {tab === 'liquidacao' && (<View style={S.chs}><TouchableOpacity style={[S.ch, filtro === 'todos' && S.chOn]} onPress={() => setFiltro('todos')}><Text style={[S.chTx, filtro === 'todos' && S.chTxOn]}>{t.filtroTodos} {filtered.length}</Text></TouchableOpacity><TouchableOpacity style={[S.ch, filtro === 'atrasados' && S.chOn]} onPress={() => setFiltro('atrasados')}><Text style={[S.chTx, filtro === 'atrasados' && S.chTxOn]}>{t.filtroAtrasados} {cntAtraso}</Text></TouchableOpacity><TouchableOpacity style={[S.ch, mostrarPagas ? S.chPOn : S.chPOff]} onPress={() => setMostrarPagas(!mostrarPagas)}><Text style={[S.chTx, mostrarPagas ? S.chPTxOn : S.chPTxOff]}>{t.filtroPagas} {cntPagas}</Text></TouchableOpacity><Text style={S.chCh}>▼</Text></View>)}
      {tab === 'todos' && (<View style={S.tF}><TouchableOpacity style={S.tFB}><Text style={S.tFBT}>{t.tipoFiltro}</Text><Text style={S.tFC}>▼</Text></TouchableOpacity><TouchableOpacity style={S.tFB}><Text style={S.tFBT}>{t.statusFiltro}</Text><Text style={S.tFC}>▼</Text></TouchableOpacity><Text style={S.tCnt}>{todosFilt.length} {t.clientes}</Text><Text style={S.tChv}>▼</Text></View>)}
      <ScrollView style={S.ls} contentContainerStyle={S.lsI} refreshControl={!isViz ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined} showsVerticalScrollIndicator={false}>
        {tab === 'liquidacao' ? (filtered.length === 0 ? <View style={S.em}><Text style={S.emI}>📋</Text><Text style={S.emT}>{t.semClientes}</Text></View> : filtered.map(renderCard)) : (loadTodos ? <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} /> : todosFilt.length === 0 ? <View style={S.em}><Text style={S.emI}>📋</Text><Text style={S.emT}>{t.semClientes}</Text></View> : todosFilt.map(renderTodos))}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* MODAL PARCELAS */}
      <Modal visible={modalParcelasVisible} animationType="slide" transparent={true} onRequestClose={() => setModalParcelasVisible(false)}>
        <View style={S.modalOverlay}><View style={S.modalContainer}>
          <View style={S.modalHeader}><Text style={S.modalTitle}>{clienteModal?.nome || ''}</Text><TouchableOpacity onPress={() => setModalParcelasVisible(false)} style={S.modalClose}><Text style={S.modalCloseX}>✕</Text></TouchableOpacity></View>
          {creditoDisponivel > 0 && (<View style={S.creditoBanner}><Text style={S.creditoIcon}>💳</Text><Text style={S.creditoText}>{t.creditoDisponivel} {fmt(creditoDisponivel)}</Text></View>)}
          <ScrollView style={S.modalScroll} showsVerticalScrollIndicator={false}>
            {loadingParcelas ? (<ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />) : parcelasModal.length === 0 ? (<Text style={S.modalEmpty}>Nenhuma parcela encontrada</Text>) : (parcelasModal.map(p => renderParcelaItem(p)))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View></View>
      </Modal>

      {/* MODAL PAGAMENTO - COM CRÉDITO E VALIDAÇÕES */}
      <Modal visible={modalPagamentoVisible} animationType="fade" transparent={true} onRequestClose={() => setModalPagamentoVisible(false)}>
        <View style={S.modalOverlay}><View style={S.modalPagamento}>
          <View style={S.pgHeader}><Text style={S.pgHeaderIcon}>💰</Text><Text style={S.pgHeaderTitle}>{t.registrarPagamento}</Text><TouchableOpacity onPress={() => setModalPagamentoVisible(false)} style={S.modalClose}><Text style={S.modalCloseX}>✕</Text></TouchableOpacity></View>
          
          {loadingDadosPagamento ? (
            <View style={S.pgLoading}><ActivityIndicator size="large" color="#3B82F6" /><Text style={S.pgLoadingText}>{t.carregandoDados || 'Carregando...'}</Text></View>
          ) : parcelaPagamento && (
            <>
              <View style={S.pgInfoRow}>
                <Text style={S.pgInfoParcela}>{t.parcela} {dadosPagamento?.numero_parcela || parcelaPagamento.numero_parcela}/{dadosPagamento?.total_parcelas || parcelasModal.length || '?'}</Text>
                <View style={S.pgInfoStatus}><Text style={S.pgInfoStatusTx}>{t.pendente}</Text></View>
              </View>
              <Text style={S.pgInfoCliente}>{dadosPagamento?.cliente_nome || clienteModal?.nome || ''}</Text>
              <Text style={S.pgInfoVenc}>{t.vencimento} {fmtData(dadosPagamento?.data_vencimento || parcelaPagamento.data_vencimento)}</Text>
              
              {/* Input de valor com linha de crédito */}
              <View style={S.pgInputBox}>
                <Text style={S.pgInputLabel}>{t.valorAPagar}</Text>
                <View style={S.pgInputRow}>
                  <Text style={S.pgInputCurrency}>$</Text>
                  <TextInput 
                    style={S.pgInput} 
                    value={valorPagamento} 
                    onChangeText={setValorPagamento} 
                    keyboardType="decimal-pad" 
                    placeholder="0,00"
                    editable={dadosPagamento?.permite_pagamento !== false}
                  />
                </View>
                
                {/* Linha de crédito disponível */}
                {dadosPagamento?.tem_credito && dadosPagamento.credito_disponivel > 0 && (
                  <View style={S.pgCreditoRow}>
                    <Text style={S.pgCreditoIcon}>💳</Text>
                    <Text style={S.pgCreditoText}>{t.credito} {fmt(dadosPagamento.credito_disponivel)}</Text>
                    <TouchableOpacity 
                      style={[S.pgCreditoBtn, usarCredito && S.pgCreditoBtnOn]} 
                      onPress={() => setUsarCredito(!usarCredito)}
                    >
                      <View style={[S.pgCreditoCheck, usarCredito && S.pgCreditoCheckOn]}>
                        {usarCredito && <Text style={S.pgCreditoCheckIcon}>✓</Text>}
                      </View>
                      <Text style={[S.pgCreditoBtnTx, usarCredito && S.pgCreditoBtnTxOn]}>{t.usar || 'Usar'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {/* Alerta amarelo - saldo anterior pendente */}
              {dadosPagamento?.tem_saldo_anterior && dadosPagamento.qtd_parcelas_anteriores_pendentes > 0 && (
                <View style={S.pgAlertYellow}>
                  <Text style={S.pgAlertYellowIcon}>⚠</Text>
                  <View style={S.pgAlertYellowTexts}>
                    <Text style={S.pgAlertYellowTitle}>{t.saldoAnterior || 'Saldo anterior de'} {dadosPagamento.qtd_parcelas_anteriores_pendentes} {t.parcela}(s)</Text>
                    <Text style={S.pgAlertYellowDesc}>{t.valorPendente || 'Valor pendente:'} {fmt(dadosPagamento.saldo_parcelas_anteriores)}</Text>
                  </View>
                </View>
              )}
              
              {/* Alerta vermelho - bloqueio */}
              {dadosPagamento && !dadosPagamento.permite_pagamento && dadosPagamento.mensagem_bloqueio && (
                <View style={S.pgAlertRed}>
                  <Text style={S.pgAlertRedIcon}>⛔</Text>
                  <View style={S.pgAlertRedTexts}>
                    <Text style={S.pgAlertRedTitle}>{t.pagamentoBloqueado || 'Pagamento bloqueado'}</Text>
                    <Text style={S.pgAlertRedDesc}>{dadosPagamento.mensagem_bloqueio}</Text>
                  </View>
                  <TouchableOpacity style={S.pgAlertRedBtn} onPress={irParaProximaParcela}>
                    <Text style={S.pgAlertRedBtnTx}>{t.irProximaParcela || 'Ir para próxima parcela pendente'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={S.pgFormRow}>
                <Text style={S.pgFormLabel}>{t.forma}</Text>
                <TouchableOpacity style={S.pgFormSelect} onPress={() => setFormaPagamento(formaPagamento === 'DINHEIRO' ? 'TRANSFERENCIA' : 'DINHEIRO')}>
                  <Text style={S.pgFormSelectTx}>{formaPagamento === 'DINHEIRO' ? 'Dinheiro' : 'Transferência'}</Text>
                  <Text style={S.pgFormSelectChev}>▼</Text>
                </TouchableOpacity>
                <View style={[S.pgGpsStatus, gpsStatus === 'ok' ? S.pgGpsOk : S.pgGpsErro]}>
                  <Text style={S.pgGpsIcon}>{gpsStatus === 'ok' ? '◉' : '○'}</Text>
                  <Text style={[S.pgGpsTx, gpsStatus === 'ok' ? S.pgGpsTxOk : S.pgGpsTxErro]}>{gpsStatus === 'ok' ? t.gpsOk : t.gpsErro}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={[S.pgBtnPagar, (processando || (dadosPagamento && !dadosPagamento.permite_pagamento)) && S.pgBtnDisabled]} 
                onPress={registrarPagamento} 
                disabled={processando || (dadosPagamento && !dadosPagamento.permite_pagamento)}
              >
                {processando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={S.pgBtnIcon}>✓</Text>
                    <Text style={S.pgBtnTx}>{t.pagarBtn} {fmt((parseFloat(valorPagamento.replace(',', '.')) || 0) + (usarCredito && dadosPagamento?.credito_disponivel ? dadosPagamento.credito_disponivel : 0))}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View></View>
      </Modal>

      {/* MODAL ESTORNO */}
      <Modal visible={modalEstornoVisible} animationType="fade" transparent={true} onRequestClose={() => setModalEstornoVisible(false)}>
        <View style={S.modalOverlay}><View style={S.modalEstorno}>
          <View style={S.estHeader}><Text style={S.estHeaderIcon}>↩</Text><Text style={S.estHeaderTitle}>{t.estornarPagamento}</Text><TouchableOpacity onPress={() => setModalEstornoVisible(false)} style={S.modalClose}><Text style={S.modalCloseX}>✕</Text></TouchableOpacity></View>
          {parcelaEstorno && (<>
            <View style={S.estInfo}><Text style={S.estInfoParcela}>{t.parcela} {parcelaEstorno.numero_parcela}</Text><Text style={S.estInfoCliente}>{clienteModal?.nome || ''}</Text><Text style={S.estInfoValor}>{t.pago} {fmt(parcelaEstorno.valor_pago || parcelaEstorno.valor_parcela)}</Text></View>
            <View style={S.estInputBox}><Text style={S.estInputLabel}>{t.motivoEstorno}</Text><TextInput style={S.estInput} value={motivoEstorno} onChangeText={setMotivoEstorno} placeholder="Digite o motivo..." multiline numberOfLines={3} /></View>
            <View style={S.estBtns}><TouchableOpacity style={S.estBtnCancel} onPress={() => setModalEstornoVisible(false)}><Text style={S.estBtnCancelTx}>{t.cancelar}</Text></TouchableOpacity><TouchableOpacity style={[S.estBtnConfirm, (!motivoEstorno.trim() || processando) && S.estBtnDisabled]} onPress={confirmarEstorno} disabled={!motivoEstorno.trim() || processando}>{processando ? (<ActivityIndicator color="#fff" />) : (<Text style={S.estBtnConfirmTx}>{t.confirmarEstorno}</Text>)}</TouchableOpacity></View>
          </>)}
        </View></View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#EEF2FF' },
  lW: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  lT: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  hd: { backgroundColor: '#3B82F6', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hdT: { color: '#fff', fontSize: 18, fontWeight: '700' }, hdS: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  hdR: { flexDirection: 'row', alignItems: 'center', gap: 10 }, hdDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }, hdI: { fontSize: 18 },
  vizBanner: { backgroundColor: '#FEF3C7', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  vizBannerContent: { flexDirection: 'row', alignItems: 'center' },
  vizBannerIcon: { fontSize: 16, marginRight: 10 },
  vizBannerTexts: { flex: 1 },
  vizBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  vizBannerDesc: { fontSize: 11, color: '#B45309', marginTop: 1 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: '#E8EBF7', borderRadius: 12, padding: 3 },
  tb: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, gap: 5 }, tbOn: { backgroundColor: '#3B82F6' },
  tbI: { fontSize: 13 }, tbTx: { fontSize: 13, fontWeight: '600', color: '#6B7280' }, tbTxOn: { color: '#fff' },
  srR: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, gap: 8 },
  srB: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: '#E5E7EB' },
  srI: { fontSize: 13, marginRight: 6, opacity: 0.5 }, srIn: { flex: 1, fontSize: 13, color: '#1F2937', padding: 0 },
  orB: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  orI: { fontSize: 11 }, orTx: { fontSize: 12, color: '#6B7280' }, orCh: { fontSize: 8, color: '#9CA3AF' },
  orDr: { position: 'absolute', top: 175, right: 16, zIndex: 100, backgroundColor: '#fff', borderRadius: 10, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  orOp: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }, orOpOn: { backgroundColor: '#EFF6FF' },
  orOpTx: { fontSize: 13, color: '#6B7280' }, orOpTxOn: { color: '#3B82F6', fontWeight: '600' },
  chs: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8 },
  ch: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' }, chOn: { backgroundColor: '#1F2937', borderColor: '#1F2937' },
  chTx: { fontSize: 12, fontWeight: '500', color: '#6B7280' }, chTxOn: { color: '#fff' },
  chPOn: { backgroundColor: '#059669', borderColor: '#059669' }, chPOff: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  chPTxOn: { color: '#fff' }, chPTxOff: { color: '#6B7280' }, chCh: { fontSize: 10, color: '#9CA3AF' },
  tF: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8 },
  tFB: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', gap: 4 },
  tFBT: { fontSize: 12, color: '#6B7280' }, tFC: { fontSize: 8, color: '#9CA3AF' },
  tCnt: { flex: 1, textAlign: 'right', fontSize: 12, color: '#6B7280' }, tChv: { fontSize: 10, color: '#9CA3AF' },
  ls: { flex: 1, marginTop: 10 }, lsI: { paddingHorizontal: 16 },
  em: { alignItems: 'center', paddingTop: 60 }, emI: { fontSize: 48, marginBottom: 12 }, emT: { fontSize: 14, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 }, avTx: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardInfo: { flex: 1 }, nameRow: { flexDirection: 'row', alignItems: 'center' },
  nome: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  bWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, marginLeft: 4, borderWidth: 1, borderColor: '#FECACA' },
  bWarnI: { fontSize: 10, color: '#F59E0B', marginRight: 2 }, bWarnT: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  bMul: { backgroundColor: '#FED7AA', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, marginLeft: 3 }, bMulT: { fontSize: 10, fontWeight: '700', color: '#C2410C' },
  dots: { fontSize: 18, color: '#9CA3AF', marginLeft: 4, fontWeight: '700' }, sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pLblR: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }, pLbl: { fontSize: 11, color: '#6B7280' },
  fBdg: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, fBdgT: { fontSize: 9, fontWeight: '600', color: '#7C3AED' },
  pVal: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  sCol: { alignItems: 'flex-end' }, sLbl: { fontSize: 11, color: '#6B7280', marginBottom: 2 }, sVal: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  pgVal: { fontSize: 14, fontWeight: '700', color: '#059669' }, pgOrig: { fontSize: 10, color: '#9CA3AF' }, pgCred: { fontSize: 10, color: '#2563EB' },
  exp: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  aR: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 10, marginBottom: 10 }, aRT: { fontSize: 12, fontWeight: '600', color: '#DC2626' }, aRS: { fontSize: 11, color: '#B91C1C', marginTop: 2 },
  aY: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginBottom: 10 }, aYT: { fontSize: 12, fontWeight: '600', color: '#D97706' }, aYS: { fontSize: 11, color: '#B45309', marginTop: 2 },
  eNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 6 },
  eNBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }, eNOff: { opacity: 0.3 }, eNBTx: { fontSize: 11, color: '#6B7280' },
  eDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' }, eDotOn: { backgroundColor: '#3B82F6' }, eNLbl: { fontSize: 10, color: '#6B7280' },
  res: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  resH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, resT: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  stB: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }, stBT: { fontSize: 9, fontWeight: '700' },
  g3: { flexDirection: 'row', marginBottom: 6 }, gi: { flex: 1 }, gl: { fontSize: 9, color: '#9CA3AF', marginBottom: 1 }, gv: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  prL: { fontSize: 9, color: '#9CA3AF', marginTop: 4, marginBottom: 3 }, prB: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }, prF: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 }, prR: { fontSize: 9, color: '#9CA3AF', marginTop: 2, textAlign: 'right' },
  btR: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, gap: 5 },
  btG: { backgroundColor: '#10B981' }, btBl: { backgroundColor: '#3B82F6' }, btRed: { backgroundColor: '#EF4444' },
  btOG: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }, btOB: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }, btOff: { opacity: 0.4 },
  btI: { fontSize: 13 }, btW: { color: '#fff', fontSize: 12, fontWeight: '600' }, btTG: { color: '#059669', fontSize: 12, fontWeight: '600' }, btTB: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  tSt: { fontSize: 11, fontWeight: '500', marginLeft: 8 },
  tEmpCard: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  tEmpHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tEmpTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937' }, tEmpParcela: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  tEmpBody: { flexDirection: 'row', justifyContent: 'space-between' },
  tEmpLbl: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 }, tEmpVal: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  tAddRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 10, opacity: 0.35 },
  tAddIcon: { fontSize: 16, color: '#9CA3AF', marginRight: 6 }, tAddText: { fontSize: 12, color: '#9CA3AF' },
  // MODAIS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', maxHeight: '85%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalCloseX: { fontSize: 16, color: '#6B7280' },
  modalScroll: { padding: 16 },
  modalEmpty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  creditoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#93C5FD' },
  creditoIcon: { fontSize: 18, marginRight: 10 },
  creditoText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  mParcela: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 4 },
  mParcelaRow: { flexDirection: 'row', alignItems: 'flex-start' },
  mParcelaIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mParcelaInfo: { flex: 1 },
  mParcelaNum: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  mParcelaVenc: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  mParcelaValores: { alignItems: 'flex-end' },
  mParcelaOriginal: { fontSize: 10, color: '#9CA3AF' },
  mParcelaValor: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  mParcelaPago: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  mParcelaCredito: { fontSize: 10, color: '#2563EB' },
  mParcelaStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  mParcelaStatusTx: { fontSize: 9, fontWeight: '700' },
  mParcelaDataPg: { fontSize: 9, color: '#6B7280', marginTop: 2 },
  mParcelaBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  mBtnPagar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
  mBtnPagarIcon: { fontSize: 14 },
  mBtnPagarTx: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mBtnEstornar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', gap: 6 },
  mBtnEstornarIcon: { fontSize: 14, color: '#EF4444' },
  mBtnEstornarTx: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  modalPagamento: { width: '90%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  pgHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pgHeaderIcon: { fontSize: 20, marginRight: 10 },
  pgHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  pgInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  pgInfoParcela: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  pgInfoStatus: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pgInfoStatusTx: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  pgInfoCliente: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginTop: 4 },
  pgInfoVenc: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: 16, marginTop: 2 },
  pgInputBox: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  pgInputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  pgInputRow: { flexDirection: 'row', alignItems: 'center' },
  pgInputCurrency: { fontSize: 20, fontWeight: '700', color: '#6B7280', marginRight: 8 },
  pgInput: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1F2937', padding: 0 },
  pgFormRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  pgFormLabel: { fontSize: 12, color: '#6B7280' },
  pgFormSelect: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 8 },
  pgFormSelectTx: { fontSize: 13, color: '#1F2937' },
  pgFormSelectChev: { fontSize: 10, color: '#9CA3AF' },
  pgGpsStatus: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  pgGpsOk: { backgroundColor: '#D1FAE5' },
  pgGpsErro: { backgroundColor: '#FEE2E2' },
  pgGpsIcon: { fontSize: 10 },
  pgGpsTx: { fontSize: 11, fontWeight: '500' },
  pgGpsTxOk: { color: '#059669' },
  pgGpsTxErro: { color: '#DC2626' },
  pgBtnPagar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', marginHorizontal: 16, marginVertical: 16, paddingVertical: 14, borderRadius: 12, gap: 8 },
  pgBtnDisabled: { opacity: 0.5 },
  pgBtnIcon: { fontSize: 16, color: '#fff' },
  pgBtnTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modalEstorno: { width: '90%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  estHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  estHeaderIcon: { fontSize: 20, color: '#EF4444', marginRight: 10 },
  estHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  estInfo: { padding: 16, backgroundColor: '#FEF2F2', margin: 16, borderRadius: 12 },
  estInfoParcela: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  estInfoCliente: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  estInfoValor: { fontSize: 16, fontWeight: '700', color: '#DC2626', marginTop: 8 },
  estInputBox: { marginHorizontal: 16 },
  estInputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  estInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#1F2937', minHeight: 80, textAlignVertical: 'top' },
  estBtns: { flexDirection: 'row', gap: 12, padding: 16 },
  estBtnCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6' },
  estBtnCancelTx: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  estBtnConfirm: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444' },
  estBtnDisabled: { opacity: 0.5 },
  estBtnConfirmTx: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // Loading do modal pagamento
  pgLoading: { padding: 40, alignItems: 'center' },
  pgLoadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  // Linha de crédito disponível
  pgCreditoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  pgCreditoIcon: { fontSize: 16, marginRight: 8 },
  pgCreditoText: { flex: 1, fontSize: 13, color: '#6B7280' },
  pgCreditoBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  pgCreditoBtnOn: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  pgCreditoCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 6, justifyContent: 'center', alignItems: 'center' },
  pgCreditoCheckOn: { borderColor: '#10B981', backgroundColor: '#10B981' },
  pgCreditoCheckIcon: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pgCreditoBtnTx: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  pgCreditoBtnTxOn: { color: '#059669' },
  // Alerta amarelo (saldo anterior)
  pgAlertYellow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' },
  pgAlertYellowIcon: { fontSize: 16, marginRight: 10, marginTop: 2 },
  pgAlertYellowTexts: { flex: 1 },
  pgAlertYellowTitle: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  pgAlertYellowDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },
  // Alerta vermelho (bloqueio)
  pgAlertRed: { backgroundColor: '#FEF2F2', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  pgAlertRedIcon: { fontSize: 16, marginRight: 10 },
  pgAlertRedTexts: { marginBottom: 10 },
  pgAlertRedTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  pgAlertRedDesc: { fontSize: 12, color: '#B91C1C', marginTop: 4 },
  pgAlertRedBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DC2626', backgroundColor: '#fff' },
  pgAlertRedBtnTx: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
});