import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ModalExtrato, ModalFinanceiro, ModalMicroseguro, ModalPagamentos } from '../components/LiquidacaoDetalhes';
import { ModalNotasLista } from '../components/NotasComponent';
import { useAuth } from '../contexts/AuthContext';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { supabase } from '../services/supabase';
import { LiquidacaoDiaria } from '../types';

type Language = 'pt-BR' | 'es';

interface ContaRota {
  id: string;
  saldo_atual: number;
}

interface DiaCalendario {
  data: Date;
  diaNumero: number;
  mesAtual: boolean;
  ehHoje: boolean;
  ehFuturo: boolean;
  liquidacao: LiquidacaoDiaria | null;
}

const textos = {
  'pt-BR': {
    titulo: 'Liquidação Diária',
    aberto: 'ABERTO',
    fechado: 'FECHADO',
    verOutrasDatas: 'Ver Outras Datas',
    notas: 'Notas',
    voltarHoje: 'Voltar para Hoje',
    meta: 'META',
    atual: 'ATUAL',
    progresso: 'PROGRESSO',
    resumoClientes: 'Resumo de Clientes',
    clientesIniciais: 'Clientes Iniciais:',
    clientesNovos: 'Clientes Novos:',
    clientesRenovados: 'Clientes Renovados:',
    clientesRenegociados: 'Clientes Renegociados:',
    clientesQuitados: 'Clientes Quitados:',
    totalClientes: 'Total de Clientes:',
    controlesFinanceiros: 'Controles Financeiros',
    caixa: 'Caixa',
    inicial: 'Inicial:',
    pagamentos: 'Pagamentos',
    pagos: 'Clientes pagos',
    naoPagos: 'Não pagos:',
    efetividade: 'Efetividade:',
    recebido: 'Recebido:',
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
    caixaInicialAutomatico: 'Caixa inicial (automático):',
    infoSaldoConta: 'O valor do caixa inicial é automaticamente o saldo atual da conta da rota.',
    selecioneData: 'Selecione uma Data',
    semLiquidacaoCalendario: 'Não há liquidação aberta para hoje. Selecione uma data no calendário abaixo para visualizar os dados.',
    legenda: 'Legenda:',
    legendaAberto: 'Aberto',
    legendaFechado: 'Fechado',
    legendaAprovado: 'Aprovado',
    legendaSemRegistro: 'Sem registro',
    visualizando: 'Visualizando:',
    fecharCalendario: 'Voltar à Liquidação',
    meses: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    diasSemana: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
  },
  'es': {
    titulo: 'Liquidación Diaria',
    aberto: 'ABIERTO',
    fechado: 'CERRADO',
    verOutrasDatas: 'Ver Otras Fechas',
    notas: 'Notas',
    voltarHoje: 'Volver a Hoy',
    meta: 'META',
    atual: 'ACTUAL',
    progresso: 'PROGRESO',
    resumoClientes: 'Resumen de Clientes',
    clientesIniciais: 'Clientes Iniciales:',
    clientesNovos: 'Clientes Nuevos:',
    clientesRenovados: 'Clientes Renovados:',
    clientesRenegociados: 'Clientes Renegociados:',
    clientesQuitados: 'Clientes Liquidados:',
    totalClientes: 'Total de Clientes:',
    controlesFinanceiros: 'Controles Financieros',
    caixa: 'Caja',
    inicial: 'Inicial:',
    pagamentos: 'Pagos',
    pagos: 'Clientes pagados',
    naoPagos: 'No pagados:',
    efetividade: 'Efectividad:',
    recebido: 'Recaudado:',
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
    caixaInicialAutomatico: 'Caja inicial (automático):',
    infoSaldoConta: 'El valor de la caja inicial es automáticamente el saldo actual de la cuenta de la ruta.',
    selecioneData: 'Seleccione una Fecha',
    semLiquidacaoCalendario: 'No hay liquidación abierta para hoy. Seleccione una fecha en el calendario a continuación.',
    legenda: 'Leyenda:',
    legendaAberto: 'Abierto',
    legendaFechado: 'Cerrado',
    legendaAprovado: 'Aprobado',
    legendaSemRegistro: 'Sin registro',
    visualizando: 'Visualizando:',
    fecharCalendario: 'Volver a Liquidación',
    meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    diasSemana: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  }
};

export default function LiquidacaoScreen({ navigation }: any) {
  const { vendedor, idioma } = useAuth();
  const liqCtx = useLiquidacaoContext();
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [todasLiquidacoes, setTodasLiquidacoes] = useState<LiquidacaoDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const language: Language = idioma || 'pt-BR';
  const [fechando, setFechando] = useState(false);
  const [fechandoEtapa, setFechandoEtapa] = useState<'confirmar' | 'processando' | 'gerando'>('confirmar');
  const [modalIniciarVisible, setModalIniciarVisible] = useState(false);
  const [modalFecharVisible, setModalFecharVisible] = useState(false);
  const [extratoFechamentoVisible, setExtratoFechamentoVisible] = useState(false);
  const [liqFechadaId, setLiqFechadaId] = useState<string | null>(null);
  const [liqFechadaCaixaInicial, setLiqFechadaCaixaInicial] = useState(0);
  const [liqFechadaCaixaFinal, setLiqFechadaCaixaFinal] = useState(0);
  
  // Modais dos cards
  const [modalExtratoVisible, setModalExtratoVisible] = useState(false);
  const [modalPagamentosVisible, setModalPagamentosVisible] = useState(false);
  const [modalVendasVisible, setModalVendasVisible] = useState(false);
  const [modalReceitasVisible, setModalReceitasVisible] = useState(false);
  const [modalDespesasVisible, setModalDespesasVisible] = useState(false);
  const [modalMicroseguroVisible, setModalMicroseguroVisible] = useState(false);
  const [modalNotasVisible, setModalNotasVisible] = useState(false);
  const [notasCount, setNotasCount] = useState(0);
  const [contaRota, setContaRota] = useState<ContaRota | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  // Totais calculados do financeiro (mais confiáveis que campos da liquidação)
  const [receitasFinanceiras, setReceitasFinanceiras] = useState({ total: 0, qtd: 0 });
  const [totalParcelasPagas, setTotalParcelasPagas] = useState(0);
  
  // Estados do Calendário
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [modoVisualizacao, setModoVisualizacaoLocal] = useState(false);
  const [dataVisualizacao, setDataVisualizacaoLocal] = useState<Date | null>(null);
  const [mesAtual, setMesAtual] = useState(new Date().getMonth());
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
  
  // Wrappers que sincronizam estado local → contexto compartilhado
  const setModoVisualizacao = useCallback((v: boolean) => {
    setModoVisualizacaoLocal(v);
    liqCtx.setModoVisualizacao(v);
  }, [liqCtx]);

  const setDataVisualizacao = useCallback((d: Date | null) => {
    setDataVisualizacaoLocal(d);
    liqCtx.setDataVisualizacao(d ? d.toISOString().split('T')[0] : null);
  }, [liqCtx]);

  // Sincroniza liquidacaoId no contexto quando liquidação muda
  useEffect(() => {
    liqCtx.setLiquidacaoIdVisualizacao(liquidacao?.id || null);
    // Sincronizar liquidação aberta no contexto compartilhado
    if (liquidacao && (liquidacao.status === 'ABERTO' || liquidacao.status === 'ABERTA' || liquidacao.status === 'REABERTO')) {
      liqCtx.setLiquidacaoAtual(liquidacao);
    } else if (!modoVisualizacao) {
      liqCtx.setLiquidacaoAtual(null);
    }
  }, [liquidacao?.id, liquidacao?.status]);

  // Buscar contagem de notas ativas da liquidação atual (só do vendedor)
  useEffect(() => {
    if (!vendedor?.rota_id || !liquidacao?.id) { setNotasCount(0); return; }
    (async () => {
      try {
        const { data } = await supabase.rpc('fn_contar_notas_ativas', {
          p_rota_id: vendedor.rota_id,
          p_liquidacao_id: liquidacao.id,
          p_vendedor_id: vendedor.id,
        });
        const res = Array.isArray(data) ? data[0] : data;
        setNotasCount(res?.total || 0);
      } catch { }
    })();
  }, [liquidacao?.id, vendedor?.rota_id, vendedor?.id]);

  // Buscar totais de receitas financeiras (sem cobranças) e total parcelas pagas
  useEffect(() => {
    if (!liquidacao?.id) { 
      setReceitasFinanceiras({ total: 0, qtd: 0 }); 
      setTotalParcelasPagas(0); 
      return; 
    }
    (async () => {
      try {
        // Receitas financeiras (RECEBER, excluindo cobranças e microseguros)
        const { data: recData } = await supabase
          .from('financeiro')
          .select('valor')
          .eq('liquidacao_id', liquidacao.id)
          .eq('tipo', 'RECEBER')
          .eq('status', 'PAGO')
          .not('categoria', 'in', '("COBRANCA_PARCELAS","COBRANCA_CUOTAS","VENDA_MICROSEGURO","MICROSEGURO")');
        
        const recTotal = (recData || []).reduce((s: number, r: any) => s + parseFloat(r.valor || 0), 0);
        setReceitasFinanceiras({ total: recTotal, qtd: (recData || []).length });

        // Total recebido de parcelas pagas
        const { data: pagData } = await supabase
          .from('financeiro')
          .select('valor')
          .eq('liquidacao_id', liquidacao.id)
          .eq('tipo', 'RECEBER')
          .eq('status', 'PAGO')
          .in('categoria', ['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS']);
        
        const pagTotal = (pagData || []).reduce((s: number, r: any) => s + parseFloat(r.valor || 0), 0);
        setTotalParcelasPagas(pagTotal);
      } catch { }
    })();
  }, [liquidacao?.id, liquidacao?.valor_recebido_dia, (liquidacao as any)?.clientes_pagos]);
  
  // Dados do modo visualização (dias sem liquidação)
  const [dadosVisualizacao, setDadosVisualizacao] = useState<{
    totalClientes: number;
    clientesAtivos: number;
    clientesInativos: number;
    clientesList: any[];
  } | null>(null);
  const [loadingVisualizacao, setLoadingVisualizacao] = useState(false);

  // Estado de conectividade
  const [isConnected, setIsConnected] = useState(true);

  const t = textos[language];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Bloqueia navegação para meses futuros
  const ehMesAtualOuFuturo = anoAtual > hoje.getFullYear() ||
    (anoAtual === hoje.getFullYear() && mesAtual >= hoje.getMonth());

  useFocusEffect(useCallback(() => {
    carregarLiquidacoes();
  }, []));

  // Listener de conectividade
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  const carregarLiquidacoes = async () => {
    if (!vendedor) return;

    try {
      // Buscar todas liquidações dos últimos 60 dias
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 60);
      
      const { data, error } = await supabase
        .from('liquidacoes_diarias')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .gte('data_abertura', dataInicio.toISOString())
        .order('data_abertura', { ascending: false });

      if (!error && data) {
        setTodasLiquidacoes(data);
        // Encontrar liquidação ativa: ABERTO, ABERTA ou REABERTO
        const aberta = data.find(l => {
          const s = l.status?.toUpperCase();
          return s === 'ABERTO' || s === 'ABERTA' || s === 'REABERTO' || s === 'REABERTA';
        });
        setLiquidacao(aberta || null);
        
        // Se não tem liquidação ativa, mostrar calendário
        if (!aberta && !modoVisualizacao) {
          setMostrarCalendario(true);
        }
      } else {
        setLiquidacao(null);
      }

      // Buscar saldo da conta da rota (será usado como caixa inicial automático)
      const { data: contaData } = await supabase
        .from('contas')
        .select('id, saldo_atual')
        .eq('rota_id', vendedor.rota_id)
        .eq('tipo_conta', 'ROTA')
        .eq('status', 'ATIVA')
        .maybeSingle();
      
      if (contaData) {
        setContaRota(contaData);
      }
    } catch (error) {
      console.error('Erro ao carregar liquidações:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarLiquidacoes();
  };

  // ==================== CALENDÁRIO ====================
  const gerarDiasDoMes = (): DiaCalendario[] => {
    const dias: DiaCalendario[] = [];
    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const diaSemanaInicio = primeiroDia.getDay();
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
    const totalDias = ultimoDia.getDate();

    // Dias do mês anterior
    const ultimoDiaMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const dia = ultimoDiaMesAnterior - i;
      const data = new Date(anoAtual, mesAtual - 1, dia);
      dias.push({ data, diaNumero: dia, mesAtual: false, ehHoje: false, ehFuturo: data > hoje, liquidacao: null });
    }

    // Dias do mês atual
    for (let dia = 1; dia <= totalDias; dia++) {
      const data = new Date(anoAtual, mesAtual, dia);
      data.setHours(0, 0, 0, 0);
      const ehHoje = data.getTime() === hoje.getTime();
      const ehFuturo = data > hoje;
      const liq = todasLiquidacoes.find(l => {
        // Usa data_liquidacao (DATE puro, sem timezone) como fonte primária.
        // Fallback para data_abertura pegando só YYYY-MM-DD (sem conversão UTC).
        const rawStr = l.data_liquidacao
          ? String(l.data_liquidacao).substring(0, 10)
          : String(l.data_abertura).substring(0, 10);
        const [y, m, d] = rawStr.split('-').map(Number);
        const dataLiq = new Date(y, m - 1, d); // construtor local, sem UTC
        return dataLiq.getTime() === data.getTime();
      }) || null;
      dias.push({ data, diaNumero: dia, mesAtual: true, ehHoje, ehFuturo, liquidacao: liq });
    }

    // Dias do próximo mês
    const diasRestantes = 42 - dias.length;
    for (let dia = 1; dia <= diasRestantes; dia++) {
      const data = new Date(anoAtual, mesAtual + 1, dia);
      dias.push({ data, diaNumero: dia, mesAtual: false, ehHoje: false, ehFuturo: data > hoje, liquidacao: null });
    }

    return dias;
  };

  const irMesAnterior = () => {
    if (mesAtual === 0) { setMesAtual(11); setAnoAtual(anoAtual - 1); }
    else { setMesAtual(mesAtual - 1); }
  };

  const irProximoMes = () => {
    if (ehMesAtualOuFuturo) return;
    if (mesAtual === 11) { setMesAtual(0); setAnoAtual(anoAtual + 1); }
    else { setMesAtual(mesAtual + 1); }
  };

  const handleClickDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual || dia.ehFuturo) return;
    
    if (dia.liquidacao) {
      const status = dia.liquidacao.status?.toUpperCase();
      
      // REABERTO: apenas visualização, sem movimentos (reabertura só via webapp)
      if (status === 'REABERTO' || status === 'REABERTA') {
        setLiquidacao(dia.liquidacao);
        setModoVisualizacao(true); // SEMPRE visualização - não permite movimentos
        setDataVisualizacao(dia.data);
        setDadosVisualizacao(null); // Tem liquidação, não precisa de dados dinâmicos
        setMostrarCalendario(false);
        Alert.alert('Dia Reaberto', 'Esta liquidação foi reaberta pelo administrador. Visualização apenas - novos movimentos vão para a liquidação aberta atual.');
        return;
      }
      
      // ABERTO/ABERTA: pode editar
      if (status === 'ABERTO' || status === 'ABERTA') {
        setLiquidacao(dia.liquidacao);
        setModoVisualizacao(false);
        setDataVisualizacao(null);
        setDadosVisualizacao(null);
        setMostrarCalendario(false);
        return;
      }
      
      // FECHADO/APROVADO: visualização com dados da liquidação
      setLiquidacao(dia.liquidacao);
      setModoVisualizacao(true);
      setDataVisualizacao(dia.data);
      setDadosVisualizacao(null); // Tem liquidação, dados vêm dela
      setMostrarCalendario(false);
    } else if (dia.ehHoje) {
      // Hoje sem liquidação - verificar se já existe ABERTA em outro dia
      const temAberta = todasLiquidacoes.some(l => {
        const s = l.status?.toUpperCase();
        return s === 'ABERTO' || s === 'ABERTA';
      });
      if (temAberta) {
        Alert.alert('Atenção', 'Já existe uma liquidação aberta. Feche-a antes de abrir outra.');
        return;
      }
      setModalIniciarVisible(true);
    } else {
      // Dia futuro ou passado sem liquidação → enterFutureView
      setLiquidacao(null);
      enterFutureView(dia.data);
    }
  };

  const handleAbrirCalendario = () => {
    console.log('Abrindo calendário...');
    setMostrarCalendario(true);
  };

  const handleFecharCalendario = () => {
    // Volta para a liquidação aberta (se existir)
    const aberta = todasLiquidacoes.find(l => {
      const s = l.status?.toUpperCase();
      return s === 'ABERTO' || s === 'ABERTA';
    });
    if (aberta) {
      setLiquidacao(aberta);
      setModoVisualizacao(false);
      setDataVisualizacao(null);
      setDadosVisualizacao(null);
      setMostrarCalendario(false);
    }
  };

  // === FutureRouteView Functions ===
  const enterFutureView = async (data: Date) => {
    setModoVisualizacao(true);
    setDataVisualizacao(data);
    setMostrarCalendario(false);
    
    // Buscar dados da rota para a data selecionada
    if (!vendedor) return;
    setLoadingVisualizacao(true);
    try {
      const dataFiltro = data.toISOString().split('T')[0];
      const { data: clientesDia, error } = await supabase
        .from('vw_clientes_rota_dia')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .eq('data_vencimento', dataFiltro);

      if (!error && clientesDia) {
        const total = clientesDia.length;
        const ativos = clientesDia.filter((c: any) => c.status_dia !== 'PAGO').length;
        setDadosVisualizacao({
          totalClientes: total,
          clientesAtivos: ativos,
          clientesInativos: total - ativos,
          clientesList: clientesDia,
        });
      } else {
        setDadosVisualizacao({ totalClientes: 0, clientesAtivos: 0, clientesInativos: 0, clientesList: [] });
      }
    } catch (err) {
      console.error('Erro ao buscar dados de visualização:', err);
      setDadosVisualizacao({ totalClientes: 0, clientesAtivos: 0, clientesInativos: 0, clientesList: [] });
    } finally {
      setLoadingVisualizacao(false);
    }
  };

  const exitFutureView = () => {
    setModoVisualizacao(false);
    setDataVisualizacao(null);
    setDadosVisualizacao(null);
    setMostrarCalendario(true); // Volta ao calendário, NÃO para hoje
  };

  const handleVoltarHoje = () => {
    setModoVisualizacao(false);
    setDataVisualizacao(null);
    setDadosVisualizacao(null);
    const aberta = todasLiquidacoes.find(l => l.status === 'ABERTO' || l.status === 'ABERTA');
    setLiquidacao(aberta || null);
    if (!aberta) setMostrarCalendario(true);
  };

  const getCorDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual || !dia.liquidacao) return styles.diaSemRegistro;
    const status = dia.liquidacao.status?.toUpperCase();
    if (status === 'ABERTO' || status === 'ABERTA') return styles.diaAberto;
    if (status === 'REABERTO' || status === 'REABERTA') return styles.diaReaberto;
    if (status === 'FECHADO' || status === 'FECHADA') return styles.diaFechado;
    if (status === 'APROVADO' || status === 'APROVADA') return styles.diaAprovado;
    return styles.diaSemRegistro;
  };

  const getIconeDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual || !dia.liquidacao) return '⊘';
    const status = dia.liquidacao.status?.toUpperCase();
    if (status === 'ABERTO' || status === 'ABERTA') return '○';
    if (status === 'REABERTO' || status === 'REABERTA') return '⟳';
    return '✓';
  };

  // ==================== FORMATADORES ====================
  const formatarMoeda = (valor: number | null) => {
    if (valor === null || valor === undefined) return '$ 0,00';
    return `$ ${(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatarMoedaCompacta = (valor: number | null) => {
    if (valor === null || valor === undefined) return '$ 0';
    return `$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatarData = (data: string | Date | null) => {
    if (!data) return '-';
    const d = typeof data === 'string' ? new Date(data) : data;
    return d.toLocaleDateString('pt-BR');
  };

  const calcularEfetividade = () => {
    if (!liquidacao) return 0;
    const pagos = (liquidacao as any).clientes_pagos || 0;
    const naoPagos = (liquidacao as any).clientes_nao_pagos || 0;
    const total = pagos + naoPagos;
    if (total === 0) return 0;
    return Math.round((pagos / total) * 100);
  };

  const calcularTotalClientes = () => {
    if (!liquidacao) return 0;
    return (liquidacao.clientes_iniciais || 0) + 
           (liquidacao.clientes_novos || 0) + 
           (liquidacao.clientes_renovados || 0) + 
           (liquidacao.clientes_renegociados || 0) - 
           (liquidacao.clientes_cancelados || 0) - (liquidacao.clientes_quitados || 0);
  };

  // ==================== HANDLERS ====================
  const handleIniciarDia = async () => {
    if (!vendedor) return;
    
    // CAIXA INICIAL AUTOMÁTICO = SALDO DA CONTA DA ROTA
    const valorCaixaInicial = contaRota?.saldo_atual || 0;
    
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('fn_abrir_liquidacao_diaria', {
        p_vendedor_id: vendedor.id,
        p_rota_id: vendedor.rota_id,
        p_caixa_inicial: valorCaixaInicial,
        p_user_id: vendedor.user_id,
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : data;
      if (resultado && resultado.sucesso === false) {
        // Já existe liquidação para hoje (fechada) — recarregar e mostrar ela
        if (resultado.mensagem?.includes('já existe') || resultado.mensagem?.includes('ya existe')) {
          setModalIniciarVisible(false);
          await carregarLiquidacoes();
          Alert.alert(
            'Dia já registrado',
            'Já existe uma liquidação para hoje. Se foi fechada por engano, peça ao supervisor para reabri-la pelo sistema web.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw new Error(resultado.mensagem || 'Falha ao abrir liquidação');
      }

      setModalIniciarVisible(false);
      setMostrarCalendario(false);
      setModoVisualizacao(false);
      await carregarLiquidacoes();
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
    setFechandoEtapa('processando');
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

      // Etapa 2: Gerando extrato
      setFechandoEtapa('gerando');

      // Guardar dados para extrato
      setLiqFechadaId(liquidacao.id);
      setLiqFechadaCaixaInicial(liquidacao.caixa_inicial || 0);
      setLiqFechadaCaixaFinal(resultado.caixa_final || 0);
      
      await new Promise(r => setTimeout(r, 600));
      
      // Fechar modal de progresso e abrir extrato direto
      // NÃO recarregar liquidações agora - esperar fechar extrato
      setModalFecharVisible(false);
      setFechando(false);
      setFechandoEtapa('confirmar');
      setExtratoFechamentoVisible(true);
    } catch (error: any) {
      setFechando(false);
      setFechandoEtapa('confirmar');
      Alert.alert('Erro', error.message || 'Não foi possível encerrar o dia');
    }
  };

  const handleFecharExtrato = () => {
    setExtratoFechamentoVisible(false);
    setLiqFechadaId(null);
    // Agora sim recarregar - vai mostrar calendário suavemente
    carregarLiquidacoes();
  };

  // REABERTO NÃO é considerado "aberto" para movimentos no mobile
  // Reaberturas são apenas para correções via webapp
  const isAberto = liquidacao?.status?.toUpperCase() === 'ABERTO' || liquidacao?.status?.toUpperCase() === 'ABERTA';
  const isReaberto = liquidacao?.status?.toUpperCase() === 'REABERTO' || liquidacao?.status?.toUpperCase() === 'REABERTA';
  
  // Pode editar: apenas ABERTO (não REABERTO) e não está em modo visualização
  const podeEditar = isAberto && !modoVisualizacao && !isReaberto;

  // ==================== LOADING ====================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // ==================== RENDER CALENDÁRIO ====================
  if (mostrarCalendario) {
    const diasDoMes = gerarDiasDoMes();
    
    return (
      <View style={styles.container}>
        {/* Botão fixo: Fechar calendário e voltar à liquidação aberta */}
        {todasLiquidacoes.some(l => { const s = l.status?.toUpperCase(); return s === 'ABERTO' || s === 'ABERTA'; }) && (
          <TouchableOpacity style={styles.fecharCalendarioBtn} onPress={handleFecharCalendario}>
            <Text style={styles.fecharCalendarioIcon}>←</Text>
            <Text style={styles.fecharCalendarioText}>{t.fecharCalendario}</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitulo}>📅 {t.selecioneData}</Text>
            <Text style={styles.infoTexto}>{t.semLiquidacaoCalendario}</Text>
          </View>

          {/* Calendário */}
          <View style={styles.calendarioCard}>
            <View style={styles.mesHeader}>
              <TouchableOpacity onPress={irMesAnterior} style={styles.mesNavBtn}>
                <Text style={styles.mesNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.mesTitulo}>{t.meses[mesAtual]} {anoAtual}</Text>
              <TouchableOpacity onPress={irProximoMes} style={styles.mesNavBtn} disabled={ehMesAtualOuFuturo}>
                <Text style={[styles.mesNavText, ehMesAtualOuFuturo && { color: '#D1D5DB' }]}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.diasSemanaRow}>
              {t.diasSemana.map((dia, index) => (
                <View key={index} style={[styles.diaSemanaCell, { width: '14.2857%' }]}>
                  <Text style={styles.diaSemanaText}>{dia}</Text>
                </View>
              ))}
            </View>

            <View 
              style={styles.diasGrid}
            >
              {diasDoMes.map((dia, index) => {
                return (
                <TouchableOpacity
                  key={index}
                  style={[styles.diaCell, { width: '14.2857%' }, dia.ehHoje && styles.diaCellHoje]}
                  onPress={() => handleClickDia(dia)}
                  disabled={!dia.mesAtual || dia.ehFuturo}
                >
                  <Text style={[
                    styles.diaNumero,
                    !dia.mesAtual && styles.diaNumeroOutroMes,
                    dia.ehHoje && styles.diaNumeroHoje,
                    dia.ehFuturo && dia.mesAtual && { color: '#D1D5DB' },
                  ]}>
                    {dia.diaNumero}
                  </Text>
                  
                  {dia.mesAtual && !dia.ehFuturo && (
                    <View style={[styles.diaIndicador, getCorDia(dia)]}>
                      <Text style={[
                        styles.diaIcone,
                        dia.liquidacao?.status?.toUpperCase() === 'ABERTO' && styles.iconeAberto,
                        (dia.liquidacao?.status?.toUpperCase() === 'REABERTO' || dia.liquidacao?.status?.toUpperCase() === 'REABERTA') && styles.iconeReaberto,
                        (dia.liquidacao?.status?.toUpperCase() === 'FECHADO' || dia.liquidacao?.status?.toUpperCase() === 'APROVADO') && styles.iconeFechado,
                      ]}>
                        {getIconeDia(dia)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                );
              })}
            </View>

            {/* Legenda */}
            <View style={styles.legenda}>
              <Text style={styles.legendaTitulo}>{t.legenda}</Text>
              <View style={styles.legendaItens}>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, styles.legendaCorAberto]} />
                  <Text style={styles.legendaTexto}>{t.legendaAberto}</Text>
                </View>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, styles.legendaCorFechado]} />
                  <Text style={styles.legendaTexto}>{t.legendaFechado}</Text>
                </View>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, styles.legendaCorAprovado]} />
                  <Text style={styles.legendaTexto}>{t.legendaAprovado}</Text>
                </View>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, styles.legendaCorReaberto]} />
                  <Text style={styles.legendaTexto}>{language === 'pt-BR' ? 'Reaberto' : 'Reabierto'}</Text>
                </View>
                <View style={styles.legendaItem}>
                  <View style={[styles.legendaCor, styles.legendaCorSemRegistro]} />
                  <Text style={styles.legendaTexto}>{t.legendaSemRegistro}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Modal Iniciar */}
        <Modal visible={modalIniciarVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t.iniciarDia}</Text>
              
              {/* Info: caixa inicial automático */}
              <View style={styles.caixaInicialInfo}>
                <Text style={styles.caixaInicialInfoIcon}>ℹ️</Text>
                <Text style={styles.caixaInicialInfoText}>{t.infoSaldoConta}</Text>
              </View>
              
              {/* Valor do caixa inicial (somente leitura) */}
              <View style={styles.caixaInicialReadOnly}>
                <Text style={styles.caixaInicialLabel}>{t.caixaInicialAutomatico}</Text>
                <Text style={styles.caixaInicialValor}>{formatarMoeda(contaRota?.saldo_atual || 0)}</Text>
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

        {/* Extrato pós-fechamento (também no calendário) */}
        {liqFechadaId && (
          <ModalExtrato
            visible={extratoFechamentoVisible}
            onClose={handleFecharExtrato}
            liquidacaoId={liqFechadaId}
            caixaInicial={liqFechadaCaixaInicial}
            caixaFinal={liqFechadaCaixaFinal}
          />
        )}
      </View>
    );
  }

  // ==================== RENDER PRINCIPAL ====================
  return (
    <View style={styles.container}>
      {/* Banner Visualização */}
      {modoVisualizacao && (
        <View style={styles.bannerVisualizacao}>
          <View style={styles.bannerConteudo}>
            <Text style={styles.bannerIcone}>⚠️</Text>
            <View style={styles.bannerTextos}>
              <Text style={styles.bannerTitulo}>{language === 'pt-BR' ? 'Modo Visualização' : 'Modo Visualización'}</Text>
              <Text style={styles.bannerSubtexto}>
                {t.visualizando} {dataVisualizacao ? formatarData(dataVisualizacao) : ''}
              </Text>
            </View>
          </View>
          <View style={styles.bannerBotoes}>
            <TouchableOpacity style={styles.bannerBtnSair} onPress={exitFutureView}>
              <Text style={styles.bannerBtnSairText}>{language === 'pt-BR' ? 'Sair' : 'Salir'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerBtnHoje} onPress={handleVoltarHoje}>
              <Text style={styles.bannerBtnHojeText}>{t.voltarHoje}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={!modoVisualizacao ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {liquidacao ? (
          <>
            {/* Card Vendedor + Status */}
            <View style={[styles.card, styles.cardVendedor, { borderTopColor: isReaberto ? '#F59E0B' : isAberto ? '#10B981' : '#EF4444' }]}>
              <View style={styles.vendedorRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>👤</Text></View>
                <Text style={styles.vendedorNome}>{vendedor?.nome}</Text>
              </View>
              
              <View style={styles.statusRow}>
                <View style={styles.dataContainer}>
                  <Text style={styles.statusIcon}>{isAberto ? '🔓' : isReaberto ? '🔄' : '🔒'}</Text>
                  <Text style={styles.dataText}>{formatarData(liquidacao.data_abertura)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isReaberto ? '#FEF3C7' : isAberto ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusText, { color: isReaberto ? '#D97706' : isAberto ? '#047857' : '#DC2626' }]}>
                    {isReaberto ? 'REABERTO' : isAberto ? t.aberto : t.fechado}
                  </Text>
                </View>
              </View>

              {/* Aviso REABERTO */}
              {isReaberto && (
                <View style={styles.avisoReaberto}>
                  <Text style={styles.avisoReabertoText}>⚠️ Dia reaberto pelo admin. Apenas visualização - novos movimentos vão para a liquidação aberta.</Text>
                </View>
              )}

              {/* NOTAS - Label clicável */}
              <TouchableOpacity style={styles.notasLabel} onPress={() => setModalNotasVisible(true)} activeOpacity={0.7}>
                <Text style={styles.notasLabelIcon}>📝</Text>
                <Text style={styles.notasLabelText}>{t.notas}</Text>
                {notasCount > 0 && (
                  <View style={styles.notasBadge}>
                    <Text style={styles.notasBadgeText}>{notasCount}</Text>
                  </View>
                )}
                <Text style={styles.notasLabelArrow}>›</Text>
              </TouchableOpacity>

              {/* BOTÃO VER OUTRAS DATAS - AGORA COM onPress! */}
              <TouchableOpacity style={styles.verDatasButton} onPress={handleAbrirCalendario}>
                <Text style={styles.verDatasText}>{t.verOutrasDatas}</Text>
              </TouchableOpacity>
            </View>

            {/* Card Meta/Atual/Progresso */}
            {(() => {
              const meta = liquidacao.valor_esperado_dia || 0;
              // Recebido = cobranças de parcelas (valor_recebido_dia)
              const recebido = liquidacao.valor_recebido_dia || 0;
              const percentual = meta > 0 ? Math.round((recebido / meta) * 100) : 0;
              const corProgresso = percentual >= 100 ? '#10B981' : percentual >= 70 ? '#3B82F6' : percentual >= 40 ? '#F59E0B' : '#EF4444';
              return (
                <View style={styles.card}>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>{t.meta}</Text>
                      <Text style={styles.metaValue}>{formatarMoeda(meta)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>{t.atual}</Text>
                      <Text style={[styles.metaValue, { color: corProgresso }]}>{formatarMoeda(recebido)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>{t.progresso}</Text>
                      <Text style={[styles.metaValue, { color: corProgresso }]}>{percentual}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(percentual, 100)}%`, backgroundColor: corProgresso }]} />
                  </View>
                </View>
              );
            })()}

            {/* Resumo de Clientes */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t.resumoClientes}</Text>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesIniciais}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_iniciais || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesNovos}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_novos || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesRenovados}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_renovados || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesRenegociados}</Text><Text style={styles.clienteValue}>{liquidacao.clientes_renegociados || 0}</Text></View>
              <View style={styles.clienteRow}><Text style={styles.clienteLabel}>{t.clientesQuitados}</Text><Text style={styles.clienteValue}>{(liquidacao as any).clientes_quitados || 0}</Text></View>
              <View style={[styles.clienteRow, styles.clienteRowTotal]}><Text style={styles.clienteLabelTotal}>{t.totalClientes}</Text><Text style={styles.clienteValueTotal}>{calcularTotalClientes()}</Text></View>
            </View>

            {/* Controles Financeiros */}
            <Text style={styles.sectionTitleOutside}>{t.controlesFinanceiros}</Text>

            {/* Caixa */}
            <TouchableOpacity style={[styles.card, styles.cardCaixa]} onPress={() => setModalExtratoVisible(true)} activeOpacity={0.7}>
              <View style={styles.financeiroContent}>
                <View>
                  <Text style={styles.financeiroLabel}>{t.caixa}</Text>
                  <Text style={styles.financeiroValor}>{formatarMoeda(liquidacao.caixa_final || liquidacao.caixa_inicial)}</Text>
                  <Text style={styles.financeiroDetalhe}>{t.inicial} {formatarMoeda(liquidacao.caixa_inicial)}</Text>
                </View>
                <View style={styles.indicadorVerde} />
              </View>
            </TouchableOpacity>

            {/* Pagamentos */}
            <TouchableOpacity style={[styles.card, styles.cardPagamentos]} onPress={() => setModalPagamentosVisible(true)} activeOpacity={0.7}>
              <View style={styles.financeiroContent}>
                <View>
                  <Text style={styles.financeiroLabel}>{t.pagamentos}</Text>
                  <Text style={styles.financeiroValor}>{(liquidacao as any).clientes_pagos || 0} {t.pagos}</Text>
                  <Text style={styles.financeiroDetalhe}>{t.naoPagos} {(liquidacao as any).clientes_nao_pagos || 0} | {t.efetividade} {calcularEfetividade()}%</Text>
                  <Text style={[styles.financeiroDetalhe, { color: '#059669', fontWeight: '600', marginTop: 2 }]}>{t.recebido || 'Recebido:'} {formatarMoeda(totalParcelasPagas)}</Text>
                </View>
                <View style={styles.indicadorVermelho} />
              </View>
            </TouchableOpacity>

            {/* Outras Operações */}
            <Text style={styles.sectionTitleOutside}>{t.outrasOperacoes}</Text>
            <View style={styles.operacoesRow}>
              <TouchableOpacity style={[styles.operacaoCard, styles.operacaoVendas]} onPress={() => setModalVendasVisible(true)} activeOpacity={0.7}>
                <Text style={styles.opLabelVerde}>{t.vendas}</Text>
                <Text style={styles.opValorVerde}>{formatarMoedaCompacta(liquidacao.total_emprestado_dia)}</Text>
                <Text style={styles.opDetalheVerde}>{liquidacao.qtd_emprestimos_dia || 0} emp.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.operacaoCard, styles.operacaoReceitas]} onPress={() => setModalReceitasVisible(true)} activeOpacity={0.7}>
                <Text style={styles.opLabelAzul}>{t.receitas}</Text>
                <Text style={styles.opValorAzul}>{formatarMoedaCompacta(receitasFinanceiras.total)}</Text>
                <Text style={styles.opDetalheAzul}>{receitasFinanceiras.qtd} lanç.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.operacaoCard, styles.operacaoDespesas]} onPress={() => setModalDespesasVisible(true)} activeOpacity={0.7}>
                <Text style={styles.opLabelVermelho}>{t.despesas}</Text>
                <Text style={styles.opValorVermelho}>{formatarMoedaCompacta(liquidacao.total_despesas_dia)}</Text>
                <Text style={styles.opDetalheVermelho}>{liquidacao.qtd_despesas_dia || 0} desp.</Text>
              </TouchableOpacity>
            </View>

            {/* Micro Seguro */}
            <TouchableOpacity style={styles.microSeguroCard} onPress={() => setModalMicroseguroVisible(true)} activeOpacity={0.7}>
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
              style={[styles.encerrarButton, (!podeEditar) && styles.encerrarButtonDisabled]}
              onPress={() => podeEditar && setModalFecharVisible(true)}
              disabled={!podeEditar || fechando}
            >
              {fechando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.encerrarIcon}>{podeEditar ? '↩️' : '🔒'}</Text>
                  <Text style={styles.encerrarText}>{podeEditar ? t.encerrarDia : isReaberto ? 'REABERTO (Admin)' : t.diaEncerrado}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : modoVisualizacao ? (
          /* === MODO VISUALIZAÇÃO SEM LIQUIDAÇÃO === */
          <>
            {/* Card Info Visualização */}
            <View style={styles.cardVisualizacao}>
              <View style={styles.cardVisualizacaoHeader}>
                <Text style={styles.cardVisualizacaoIcone}>👁️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardVisualizacaoTitulo}>
                    {language === 'pt-BR' ? 'Visualização de Rota' : 'Visualización de Ruta'}
                  </Text>
                  <Text style={styles.cardVisualizacaoData}>
                    {dataVisualizacao ? dataVisualizacao.toLocaleDateString(language === 'pt-BR' ? 'pt-BR' : 'es', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardVisualizacaoAviso}>
                {language === 'pt-BR' 
                  ? 'Nenhuma liquidação para esta data. Visualizando clientes e parcelas previstas.'
                  : 'Ninguna liquidación para esta fecha. Visualizando clientes y parcelas previstas.'}
              </Text>
            </View>

            {/* Totalizadores Dinâmicos */}
            {loadingVisualizacao ? (
              <View style={styles.loadingVisualizacao}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.loadingVisualizacaoText}>
                  {language === 'pt-BR' ? 'Carregando dados...' : 'Cargando datos...'}
                </Text>
              </View>
            ) : dadosVisualizacao ? (
              <>
                <View style={styles.totalizadoresRow}>
                  <View style={[styles.totalizadorCard, styles.totalizadorTotal]}>
                    <Text style={styles.totalizadorValor}>{dadosVisualizacao.totalClientes}</Text>
                    <Text style={styles.totalizadorLabel}>{language === 'pt-BR' ? 'Total' : 'Total'}</Text>
                  </View>
                  <View style={[styles.totalizadorCard, styles.totalizadorAtivo]}>
                    <Text style={[styles.totalizadorValor, { color: '#059669' }]}>{dadosVisualizacao.clientesAtivos}</Text>
                    <Text style={styles.totalizadorLabel}>{language === 'pt-BR' ? 'Ativos' : 'Activos'}</Text>
                  </View>
                  <View style={[styles.totalizadorCard, styles.totalizadorInativo]}>
                    <Text style={[styles.totalizadorValor, { color: '#DC2626' }]}>{dadosVisualizacao.clientesInativos}</Text>
                    <Text style={styles.totalizadorLabel}>{language === 'pt-BR' ? 'Inativos' : 'Inactivos'}</Text>
                  </View>
                </View>

                {/* Botão ver clientes */}
                <TouchableOpacity 
                  style={styles.verClientesBtn}
                  onPress={() => navigation.navigate('Clientes', { 
                    dataVisualizacao: dataVisualizacao?.toISOString(),
                    modoVisualizacao: true 
                  })}
                >
                  <Text style={styles.verClientesBtnIcon}>👥</Text>
                  <Text style={styles.verClientesBtnText}>
                    {language === 'pt-BR' ? 'Ver Clientes do Dia' : 'Ver Clientes del Día'}
                  </Text>
                  <Text style={styles.verClientesBtnArrow}>›</Text>
                </TouchableOpacity>

                {dadosVisualizacao.totalClientes === 0 && (
                  <View style={styles.semClientesCard}>
                    <Text style={styles.semClientesIcone}>📋</Text>
                    <Text style={styles.semClientesTexto}>
                      {language === 'pt-BR' 
                        ? 'Nenhum cliente com parcela prevista para esta data.'
                        : 'Ningún cliente con parcela prevista para esta fecha.'}
                    </Text>
                  </View>
                )}
              </>
            ) : null}

            {/* Botão Ver Outras Datas */}
            <TouchableOpacity style={[styles.verDatasButton, { marginTop: 12 }]} onPress={handleAbrirCalendario}>
              <Text style={styles.verDatasText}>{t.verOutrasDatas}</Text>
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
            
            {/* Info: caixa inicial automático */}
            <View style={styles.caixaInicialInfo}>
              <Text style={styles.caixaInicialInfoIcon}>ℹ️</Text>
              <Text style={styles.caixaInicialInfoText}>{t.infoSaldoConta}</Text>
            </View>
            
            {/* Valor do caixa inicial (somente leitura) */}
            <View style={styles.caixaInicialReadOnly}>
              <Text style={styles.caixaInicialLabel}>{t.caixaInicialAutomatico}</Text>
              <Text style={styles.caixaInicialValor}>{formatarMoeda(contaRota?.saldo_atual || 0)}</Text>
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
            {fechandoEtapa === 'confirmar' ? (
              <>
                <Text style={styles.modalTitle}>{t.encerrarDia}</Text>
                <Text style={styles.modalDescricao}>{t.confirmarEncerramento}</Text>
                <View style={styles.modalAtencao}><Text style={styles.modalAtencaoText}>⚠️ {t.atencao}</Text></View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setModalFecharVisible(false)}>
                    <Text style={styles.modalButtonCancelText}>{t.cancelar}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButtonConfirm, styles.modalButtonAmber]} onPress={handleEncerrarDia}>
                    <Text style={styles.modalButtonConfirmText}>{t.encerrarDia}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <ActivityIndicator size="large" color="#F59E0B" style={{ marginBottom: 20 }} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 }}>
                  {fechandoEtapa === 'processando' ? '🔒 Fechando liquidação...' : '📄 Gerando extrato...'}
                </Text>
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
                  {fechandoEtapa === 'processando' 
                    ? 'Calculando valores e validando caixa'
                    : 'Aguarde, preparando o comprovante'}
                </Text>
                {fechandoEtapa === 'gerando' && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>✅ Liquidação fechada com sucesso</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Extrato pós-fechamento */}
      {liqFechadaId && (
        <ModalExtrato
          visible={extratoFechamentoVisible}
          onClose={handleFecharExtrato}
          liquidacaoId={liqFechadaId}
          caixaInicial={liqFechadaCaixaInicial}
          caixaFinal={liqFechadaCaixaFinal}
        />
      )}

      {/* Modais dos cards */}
      {liquidacao && (
        <>
          <ModalExtrato
            visible={modalExtratoVisible}
            onClose={() => setModalExtratoVisible(false)}
            liquidacaoId={liquidacao.id}
            caixaInicial={liquidacao.caixa_inicial || 0}
            caixaFinal={liquidacao.caixa_final || liquidacao.caixa_inicial || 0}
          />
          <ModalPagamentos
            visible={modalPagamentosVisible}
            onClose={() => setModalPagamentosVisible(false)}
            liquidacaoId={liquidacao.id}
            totalPagos={(liquidacao as any).clientes_pagos || 0}
            totalNaoPagos={(liquidacao as any).clientes_nao_pagos || 0}
          />
          <ModalFinanceiro
            visible={modalVendasVisible}
            onClose={() => setModalVendasVisible(false)}
            liquidacaoId={liquidacao.id}
            tipo="VENDAS"
            totalValor={liquidacao.total_emprestado_dia || 0}
            totalQtd={liquidacao.qtd_emprestimos_dia || 0}
          />
          <ModalFinanceiro
            visible={modalReceitasVisible}
            onClose={() => setModalReceitasVisible(false)}
            liquidacaoId={liquidacao.id}
            tipo="RECEITAS"
            totalValor={receitasFinanceiras.total}
            totalQtd={receitasFinanceiras.qtd}
          />
          <ModalFinanceiro
            visible={modalDespesasVisible}
            onClose={() => setModalDespesasVisible(false)}
            liquidacaoId={liquidacao.id}
            tipo="DESPESAS"
            totalValor={liquidacao.total_despesas_dia || 0}
            totalQtd={liquidacao.qtd_despesas_dia || 0}
          />
          <ModalMicroseguro
            visible={modalMicroseguroVisible}
            onClose={() => setModalMicroseguroVisible(false)}
            liquidacaoId={liquidacao.id}
            totalValor={liquidacao.total_microseguro_dia || 0}
            totalQtd={liquidacao.qtd_microseguros_dia || 0}
          />

          <ModalNotasLista
            visible={modalNotasVisible}
            onClose={() => {
              setModalNotasVisible(false);
              supabase.rpc('fn_contar_notas_ativas', {
                p_rota_id: vendedor?.rota_id,
                p_liquidacao_id: liquidacao?.id || null,
                p_vendedor_id: vendedor?.id || null,
              }).then(({ data }) => {
                const res = Array.isArray(data) ? data[0] : data;
                setNotasCount(res?.total || 0);
              }).catch(() => {});
            }}
            rotaId={vendedor?.rota_id || ''}
            empresaId={vendedor?.empresa_id || ''}
            vendedorId={vendedor?.id || ''}
            autorNome={vendedor?.nome || ''}
            autorTipo="VENDEDOR"
            liquidacaoId={liquidacao.id}
            dataReferencia={liquidacao.data_abertura?.split('T')[0]}
            lang={language}
            permitirCriar={true}
            obsLocalPadrao="Geral"
          />
        </>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');
// cellSize removido - usando porcentagem

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
  avatarButton: { marginLeft: 4 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  avatarSmallPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  avatarSmallText: { fontSize: 16 },
  fecharCalendarioBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', marginHorizontal: 16, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#93C5FD' },
  fecharCalendarioIcon: { fontSize: 18, color: '#2563EB', fontWeight: '700', marginRight: 10 },
  fecharCalendarioText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  
  // Banner Visualização
  bannerVisualizacao: { backgroundColor: '#FEF3C7', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  bannerConteudo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bannerIcone: { fontSize: 18, marginRight: 10 },
  bannerTextos: { flex: 1 },
  bannerTitulo: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  bannerSubtexto: { fontSize: 12, color: '#A16207', marginTop: 2 },
  bannerBotoes: { flexDirection: 'row', gap: 8 },
  bannerBtnSair: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B', alignItems: 'center' },
  bannerBtnSairText: { color: '#D97706', fontSize: 13, fontWeight: '600' },
  bannerBtnHoje: { flex: 1, backgroundColor: '#F59E0B', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  bannerBtnHojeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  
  // Card Visualização (sem liquidação)
  cardVisualizacao: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  cardVisualizacaoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardVisualizacaoIcone: { fontSize: 24, marginRight: 12 },
  cardVisualizacaoTitulo: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  cardVisualizacaoData: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardVisualizacaoAviso: { fontSize: 13, color: '#6B7280', lineHeight: 20, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8 },
  
  // Loading Visualização
  loadingVisualizacao: { alignItems: 'center', paddingVertical: 40 },
  loadingVisualizacaoText: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  
  // Totalizadores
  totalizadoresRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  totalizadorCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  totalizadorTotal: { borderTopWidth: 3, borderTopColor: '#3B82F6' },
  totalizadorAtivo: { borderTopWidth: 3, borderTopColor: '#10B981' },
  totalizadorInativo: { borderTopWidth: 3, borderTopColor: '#EF4444' },
  totalizadorValor: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  totalizadorLabel: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 4, textTransform: 'uppercase' },
  
  // Ver Clientes
  verClientesBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  verClientesBtnIcon: { fontSize: 20, marginRight: 12 },
  verClientesBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#3B82F6' },
  verClientesBtnArrow: { fontSize: 24, color: '#9CA3AF' },
  
  // Sem Clientes
  semClientesCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 12 },
  semClientesIcone: { fontSize: 32, marginBottom: 8 },
  semClientesTexto: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  
  // Info Card (Calendário)
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  infoTitulo: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  infoTexto: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  
  // Calendário
  calendarioCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  mesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  mesNavBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  mesNavText: { fontSize: 28, color: '#6B7280', fontWeight: '300' },
  mesTitulo: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  diasSemanaRow: { flexDirection: 'row', marginBottom: 8 },
  diaSemanaCell: { alignItems: 'center', paddingVertical: 8 },
  diaSemanaText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  diasGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  diaCell: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, paddingBottom: 6, minHeight: 52 },
  diaCellHoje: { backgroundColor: '#EFF6FF', borderRadius: 8 },
  diaNumero: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  diaNumeroOutroMes: { color: '#D1D5DB' },
  diaNumeroHoje: { color: '#3B82F6', fontWeight: '700' },
  diaIndicador: { width: 20, height: 20, borderRadius: 10, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  diaIcone: { fontSize: 10, color: '#9CA3AF' },
  diaAberto: { backgroundColor: '#D1FAE5', borderWidth: 2, borderColor: '#10B981' },
  diaFechado: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#3B82F6' },
  diaAprovado: { backgroundColor: '#E9D5FF', borderWidth: 2, borderColor: '#8B5CF6' },
  diaReaberto: { backgroundColor: '#FEF3C7', borderWidth: 2, borderColor: '#F59E0B' },
  diaSemRegistro: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  iconeAberto: { color: '#10B981' },
  iconeFechado: { color: '#3B82F6' },
  iconeReaberto: { color: '#F59E0B' },
  
  // Legenda
  legenda: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  legendaTitulo: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  legendaItens: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 16, height: 16, borderRadius: 8 },
  legendaCorAberto: { backgroundColor: '#D1FAE5', borderWidth: 2, borderColor: '#10B981' },
  legendaCorFechado: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#3B82F6' },
  legendaCorAprovado: { backgroundColor: '#E9D5FF', borderWidth: 2, borderColor: '#8B5CF6' },
  legendaCorReaberto: { backgroundColor: '#FEF3C7', borderWidth: 2, borderColor: '#F59E0B' },
  legendaCorSemRegistro: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  legendaTexto: { fontSize: 12, color: '#6B7280' },
  
  // Aviso Reaberto
  avisoReaberto: { marginTop: 12, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10 },
  avisoReabertoText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  
  // Cards originais
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
  notasLabel: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8 },
  notasLabelIcon: { fontSize: 14, marginRight: 6 },
  notasLabelText: { fontSize: 13, fontWeight: '600', color: '#92400E', flex: 1 },
  notasBadge: { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, marginRight: 6 },
  notasBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  notasLabelArrow: { fontSize: 18, color: '#D97706', fontWeight: '300' },
  verDatasButton: { marginTop: 12, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F0F9FF' },
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
  // Caixa Inicial Automático (somente leitura)
  caixaInicialInfo: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE' },
  caixaInicialInfoIcon: { fontSize: 14, marginRight: 8 },
  caixaInicialInfoText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 },
  caixaInicialReadOnly: { backgroundColor: '#F0FDF4', borderWidth: 2, borderColor: '#86EFAC', borderRadius: 12, padding: 20, marginBottom: 24, alignItems: 'center' },
  caixaInicialLabel: { fontSize: 13, color: '#166534', marginBottom: 8 },
  caixaInicialValor: { fontSize: 28, fontWeight: '700', color: '#10B981' },
});