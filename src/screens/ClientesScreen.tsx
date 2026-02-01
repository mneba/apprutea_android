import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

// ============================================================
// TYPES
// ============================================================

type Language = 'pt-BR' | 'es';
type TabAtiva = 'liquidacao' | 'todos';
type FiltroLiquidacao = 'todos' | 'atrasados' | 'perto' | 'pagas';
type OrdenacaoLiquidacao = 'rota' | 'nome' | 'proximos';

interface ClienteRotaDia {
  cliente_id: string;
  consecutivo: number | null;
  nome: string;
  telefone_celular: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  emprestimo_id: string;
  saldo_emprestimo: number;
  valor_principal: number;
  numero_parcelas: number;
  status_emprestimo: string;
  rota_id: string;
  frequencia_pagamento: string;
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago_parcela: number;
  saldo_parcela: number;
  status_parcela: string;
  data_vencimento: string;
  ordem_visita_dia: number | null;
  liquidacao_id: string | null;
  tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number;
  valor_total_vencido: number;
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  permite_emprestimo_adicional: boolean;
  is_parcela_atrasada?: boolean;
}

interface EmprestimoData {
  emprestimo_id: string;
  saldo_emprestimo: number;
  valor_principal: number;
  numero_parcelas: number;
  status_emprestimo: string;
  frequencia_pagamento: string;
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago_parcela: number;
  saldo_parcela: number;
  status_parcela: string;
  data_vencimento: string;
  ordem_visita_dia: number | null;
  tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number;
  valor_total_vencido: number;
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  is_parcela_atrasada?: boolean;
  pagamento_info?: {
    valorPago: number;
    creditoGerado: number;
    valorParcela: number;
  };
}

interface ClienteAgrupado {
  cliente_id: string;
  consecutivo: number | null;
  nome: string;
  telefone_celular: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  rota_id: string;
  emprestimos: EmprestimoData[];
  qtd_emprestimos: number;
  tem_multiplos_vencimentos: boolean;
}

interface ClienteTodos {
  id: string;
  consecutivo: number | null;
  nome: string;
  telefone_celular: string | null;
  status: string;
  status_emprestimo?: string;
  tem_atraso?: boolean;
}

interface PagamentoParcela {
  parcela_id: string;
  cliente_id: string;
  valor_pago_atual: number;
  valor_credito_gerado: number;
  valor_parcela: number;
  data_pagamento: string;
}

// ============================================================
// TEXTOS i18n
// ============================================================

const textos = {
  'pt-BR': {
    titulo: 'Meus Clientes',
    hoje: 'Hoje',
    clientes: 'clientes',
    liquidacao: 'Liquidação',
    todosList: 'Todos',
    buscar: 'Buscar...',
    ordemRota: 'Ordem rota',
    ordemNome: 'Nome A-Z',
    ordemProximos: 'Próximos',
    filtroTodos: 'Todos',
    filtroAtrasados: 'Atrasados',
    filtroPerto: 'Perto',
    filtroPagas: 'Pagas',
    parcela: 'Parcela',
    saldoEmprestimo: 'Saldo Empréstimo',
    parcelasVencidas: 'parcela(s) vencida(s)',
    totalAtraso: 'Total em atraso:',
    emprestimo: 'Empréstimo',
    principal: 'Principal',
    juros: 'Juros',
    total: 'Total',
    jaPago: 'Já Pago',
    saldo: 'Saldo',
    parcelas: 'Parcelas',
    progresso: 'Progresso',
    restantes: 'restante(s)',
    pagar: 'Pagar',
    verParcelas: 'Parcelas',
    contato: 'Contato',
    ir: 'IR',
    semClientes: 'Nenhum cliente encontrado',
    carregando: 'Carregando clientes...',
    erroCarregar: 'Erro ao carregar clientes',
    statusAtraso: 'Atraso',
    statusInativo: 'Inativo',
    statusAtivo: 'Ativo',
    tipoFiltro: 'Tipo:...',
    statusFiltro: 'Status:...',
    // Frequências
    freqDiario: 'Diário',
    freqSemanal: 'Semanal',
    freqQuinzenal: 'Quinzenal',
    freqMensal: 'Mensal',
    freqFlexivel: 'Flexível',
  },
  'es': {
    titulo: 'Mis Clientes',
    hoje: 'Hoy',
    clientes: 'clientes',
    liquidacao: 'Liquidación',
    todosList: 'Todos',
    buscar: 'Buscar...',
    ordemRota: 'Orden ruta',
    ordemNome: 'Nombre A-Z',
    ordemProximos: 'Próximos',
    filtroTodos: 'Todos',
    filtroAtrasados: 'Atrasados',
    filtroPerto: 'Cerca',
    filtroPagas: 'Pagados',
    parcela: 'Cuota',
    saldoEmprestimo: 'Saldo Préstamo',
    parcelasVencidas: 'cuota(s) vencida(s)',
    totalAtraso: 'Total en atraso:',
    emprestimo: 'Préstamo',
    principal: 'Principal',
    juros: 'Intereses',
    total: 'Total',
    jaPago: 'Ya Pagó',
    saldo: 'Saldo',
    parcelas: 'Cuotas',
    progresso: 'Progreso',
    restantes: 'restante(s)',
    pagar: 'Pagar',
    verParcelas: 'Cuotas',
    contato: 'Contacto',
    ir: 'IR',
    semClientes: 'Ningún cliente encontrado',
    carregando: 'Cargando clientes...',
    erroCarregar: 'Error al cargar clientes',
    statusAtraso: 'Atraso',
    statusInativo: 'Inactivo',
    statusAtivo: 'Activo',
    tipoFiltro: 'Tipo:...',
    statusFiltro: 'Estado:...',
    freqDiario: 'Diario',
    freqSemanal: 'Semanal',
    freqQuinzenal: 'Quincenal',
    freqMensal: 'Mensual',
    freqFlexivel: 'Flexible',
  }
};

// ============================================================
// HELPERS
// ============================================================

const formatarMoeda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return '$ 0,00';
  return `$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getIniciais = (nome: string): string => {
  if (!nome) return '??';
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

const formatarFrequenciaBadge = (freq: string): string => {
  const map: Record<string, string> = {
    'DIARIO': 'D',
    'SEMANAL': 'S',
    'QUINZENAL': 'Q',
    'MENSAL': 'M',
    'FLEXIVEL': 'F',
  };
  return map[freq] || freq.charAt(0);
};

const formatarFrequenciaLabel = (freq: string, t: any): string => {
  const map: Record<string, string> = {
    'DIARIO': t.freqDiario,
    'SEMANAL': t.freqSemanal,
    'QUINZENAL': t.freqQuinzenal,
    'MENSAL': t.freqMensal,
    'FLEXIVEL': t.freqFlexivel,
  };
  return map[freq] || freq;
};

const getStatusBorderColor = (emprestimo: EmprestimoData): string => {
  if (emprestimo.is_parcela_atrasada) return '#EF4444';
  switch (emprestimo.status_dia) {
    case 'PAGO': return '#10B981';
    case 'EM_ATRASO': return '#EF4444';
    case 'PARCIAL': return '#F59E0B';
    case 'PENDENTE': default: return '#D1D5DB';
  }
};

const getStatusBackgroundColor = (emprestimo: EmprestimoData): string => {
  if (emprestimo.is_parcela_atrasada) return 'rgba(239, 68, 68, 0.04)';
  switch (emprestimo.status_dia) {
    case 'PAGO': return 'rgba(16, 185, 129, 0.06)';
    case 'EM_ATRASO': return '#fff';
    case 'PARCIAL': return '#fff';
    case 'PENDENTE': default: return '#fff';
  }
};

// ============================================================
// COMPONENT
// ============================================================

export default function ClientesScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();

  // Parâmetros recebidos da LiquidacaoScreen
  const rotaId = route?.params?.rotaId || vendedor?.rota_id;
  const dataLiquidacao = route?.params?.dataLiquidacao || new Date().toISOString().split('T')[0];
  const liquidacaoId = route?.params?.liquidacaoId;
  const isVisualizacao = route?.params?.isVisualizacao || false;

  // Estado geral
  const [language, setLanguage] = useState<Language>('pt-BR');
  const [tabAtiva, setTabAtiva] = useState<TabAtiva>('liquidacao');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  // Aba Liquidação
  const [clientesRaw, setClientesRaw] = useState<ClienteRotaDia[]>([]);
  const [pagamentosDia, setPagamentosDia] = useState<Map<string, PagamentoParcela>>(new Map());
  const [filtroLiquidacao, setFiltroLiquidacao] = useState<FiltroLiquidacao>('todos');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoLiquidacao>('rota');
  const [showOrdenacao, setShowOrdenacao] = useState(false);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [empIndexMap, setEmpIndexMap] = useState<Record<string, number>>({});

  // Aba Todos
  const [clientesTodos, setClientesTodos] = useState<ClienteTodos[]>([]);
  const [loadingTodos, setLoadingTodos] = useState(false);

  const t = textos[language];

  // ============================================================
  // DATA LOADING
  // ============================================================

  const carregarClientesLiquidacao = useCallback(async () => {
    if (!rotaId || !dataLiquidacao) return;

    try {
      // 1. Buscar clientes do dia
      const { data: clientesDia, error: errDia } = await supabase
        .from('vw_clientes_rota_dia')
        .select('*')
        .eq('rota_id', rotaId)
        .eq('data_vencimento', dataLiquidacao)
        .order('ordem_visita_dia', { ascending: true, nullsFirst: false });

      if (errDia) throw errDia;

      // 2. Buscar pagamentos do dia
      const { data: pagamentos, error: errPag } = await supabase
        .from('pagamentos_parcelas')
        .select('parcela_id, cliente_id, valor_pago_atual, valor_credito_gerado, valor_parcela, data_pagamento')
        .eq('rota_id', rotaId)
        .eq('estornado', false)
        .gte('data_pagamento', dataLiquidacao);

      if (errPag) throw errPag;

      // Montar mapa de pagamentos
      const mapPag = new Map<string, PagamentoParcela>();
      (pagamentos || []).forEach((p: PagamentoParcela) => {
        mapPag.set(p.parcela_id, p);
      });

      setClientesRaw(clientesDia || []);
      setPagamentosDia(mapPag);
    } catch (error) {
      console.error('Erro ao carregar clientes liquidação:', error);
    }
  }, [rotaId, dataLiquidacao]);

  const carregarClientesTodos = useCallback(async () => {
    if (!rotaId) return;
    setLoadingTodos(true);

    try {
      // Buscar todos os clientes da rota via empréstimos (ATIVO/VENCIDO)
      const { data, error } = await supabase
        .from('emprestimos')
        .select(`
          id,
          status,
          cliente_id,
          clientes!inner (
            id,
            consecutivo,
            nome,
            telefone_celular,
            status
          )
        `)
        .eq('rota_id', rotaId)
        .in('status', ['ATIVO', 'VENCIDO']);

      if (error) throw error;

      // Agrupar por cliente (um cliente pode ter múltiplos empréstimos)
      const clienteMap = new Map<string, ClienteTodos>();
      (data || []).forEach((emp: any) => {
        const c = emp.clientes;
        if (!c) return;
        const existing = clienteMap.get(c.id);
        if (!existing) {
          clienteMap.set(c.id, {
            id: c.id,
            consecutivo: c.consecutivo,
            nome: c.nome,
            telefone_celular: c.telefone_celular,
            status: c.status,
            status_emprestimo: emp.status,
            tem_atraso: emp.status === 'VENCIDO',
          });
        } else if (emp.status === 'VENCIDO') {
          existing.tem_atraso = true;
        }
      });

      setClientesTodos(
        Array.from(clienteMap.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      );
    } catch (error) {
      console.error('Erro ao carregar todos clientes:', error);
    } finally {
      setLoadingTodos(false);
    }
  }, [rotaId]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      carregarClientesLiquidacao(),
      carregarClientesTodos(),
    ]);
    setLoading(false);
  }, [carregarClientesLiquidacao, carregarClientesTodos]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregarDados().finally(() => setRefreshing(false));
  }, [carregarDados]);

  // ============================================================
  // AGRUPAMENTO E FILTROS — ABA LIQUIDAÇÃO
  // ============================================================

  const clientesAgrupados = useMemo((): ClienteAgrupado[] => {
    const mapa = new Map<string, ClienteAgrupado>();

    clientesRaw.forEach((row) => {
      let grupo = mapa.get(row.cliente_id);
      if (!grupo) {
        grupo = {
          cliente_id: row.cliente_id,
          consecutivo: row.consecutivo,
          nome: row.nome,
          telefone_celular: row.telefone_celular,
          endereco: row.endereco,
          latitude: row.latitude,
          longitude: row.longitude,
          rota_id: row.rota_id,
          emprestimos: [],
          qtd_emprestimos: 0,
          tem_multiplos_vencimentos: false,
        };
        mapa.set(row.cliente_id, grupo);
      }

      // Evitar duplicatas de parcela
      const jaExiste = grupo.emprestimos.some(e => e.parcela_id === row.parcela_id);
      if (!jaExiste) {
        const pagInfo = pagamentosDia.get(row.parcela_id);
        grupo.emprestimos.push({
          emprestimo_id: row.emprestimo_id,
          saldo_emprestimo: row.saldo_emprestimo,
          valor_principal: row.valor_principal,
          numero_parcelas: row.numero_parcelas,
          status_emprestimo: row.status_emprestimo,
          frequencia_pagamento: row.frequencia_pagamento,
          parcela_id: row.parcela_id,
          numero_parcela: row.numero_parcela,
          valor_parcela: row.valor_parcela,
          valor_pago_parcela: row.valor_pago_parcela,
          saldo_parcela: row.saldo_parcela,
          status_parcela: row.status_parcela,
          data_vencimento: row.data_vencimento,
          ordem_visita_dia: row.ordem_visita_dia,
          tem_parcelas_vencidas: row.tem_parcelas_vencidas,
          total_parcelas_vencidas: row.total_parcelas_vencidas,
          valor_total_vencido: row.valor_total_vencido,
          status_dia: pagInfo ? 'PAGO' : row.status_dia,
          is_parcela_atrasada: row.is_parcela_atrasada,
          pagamento_info: pagInfo ? {
            valorPago: pagInfo.valor_pago_atual,
            creditoGerado: pagInfo.valor_credito_gerado,
            valorParcela: pagInfo.valor_parcela,
          } : undefined,
        });
      }
    });

    // Finalizar agrupamento
    mapa.forEach((grupo) => {
      grupo.qtd_emprestimos = grupo.emprestimos.length;
      grupo.tem_multiplos_vencimentos = grupo.emprestimos.length > 1;
    });

    return Array.from(mapa.values());
  }, [clientesRaw, pagamentosDia]);

  const clientesFiltrados = useMemo((): ClienteAgrupado[] => {
    let resultado = [...clientesAgrupados];

    // Filtro de busca
    if (busca.trim()) {
      const termoLower = busca.toLowerCase().trim();
      resultado = resultado.filter(c =>
        c.nome.toLowerCase().includes(termoLower) ||
        (c.telefone_celular && c.telefone_celular.includes(termoLower)) ||
        (c.endereco && c.endereco.toLowerCase().includes(termoLower))
      );
    }

    // Filtros de status
    switch (filtroLiquidacao) {
      case 'atrasados':
        resultado = resultado.filter(c =>
          c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas)
        );
        break;
      case 'pagas':
        resultado = resultado.filter(c =>
          c.emprestimos.every(e => e.status_dia === 'PAGO')
        );
        break;
      case 'perto':
        // TODO: filtro por proximidade GPS
        break;
    }

    // Ordenação
    switch (ordenacao) {
      case 'rota':
        resultado.sort((a, b) => {
          const ordemA = a.emprestimos[0]?.ordem_visita_dia ?? 9999;
          const ordemB = b.emprestimos[0]?.ordem_visita_dia ?? 9999;
          return ordemA - ordemB;
        });
        break;
      case 'nome':
        resultado.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case 'proximos':
        // TODO: ordenar por GPS
        break;
    }

    return resultado;
  }, [clientesAgrupados, busca, filtroLiquidacao, ordenacao]);

  // Contadores
  const totalClientesLiquidacao = clientesAgrupados.length;
  const totalAtrasados = clientesAgrupados.filter(c =>
    c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas)
  ).length;
  const totalPagas = clientesAgrupados.filter(c =>
    c.emprestimos.every(e => e.status_dia === 'PAGO')
  ).length;

  // ============================================================
  // EMPRÉSTIMO NAVIGATION (múltiplos empréstimos)
  // ============================================================

  const getEmprestimoIndex = (clienteId: string): number => {
    return empIndexMap[clienteId] || 0;
  };

  const setEmprestimoIndex = (clienteId: string, idx: number) => {
    setEmpIndexMap(prev => ({ ...prev, [clienteId]: idx }));
  };

  const getEmprestimoAtual = (cliente: ClienteAgrupado): EmprestimoData => {
    const idx = getEmprestimoIndex(cliente.cliente_id);
    return cliente.emprestimos[Math.min(idx, cliente.emprestimos.length - 1)];
  };

  // ============================================================
  // ACTIONS
  // ============================================================

  const handlePagar = (cliente: ClienteAgrupado, emprestimo: EmprestimoData) => {
    if (isVisualizacao) return;
    navigation.navigate('Pagamento', {
      clienteId: cliente.cliente_id,
      clienteNome: cliente.nome,
      parcelaId: emprestimo.parcela_id,
      emprestimoId: emprestimo.emprestimo_id,
      valorParcela: emprestimo.valor_parcela,
      saldoParcela: emprestimo.saldo_parcela,
      numeroParcela: emprestimo.numero_parcela,
      totalParcelas: emprestimo.numero_parcelas,
      liquidacaoId: liquidacaoId,
      rotaId: rotaId,
    });
  };

  const handleContato = (cliente: ClienteAgrupado) => {
    if (cliente.telefone_celular) {
      const tel = cliente.telefone_celular.replace(/\D/g, '');
      Linking.openURL(`tel:${tel}`);
    }
  };

  const handleIR = (cliente: ClienteAgrupado) => {
    if (cliente.latitude && cliente.longitude) {
      const url = Platform.OS === 'ios'
        ? `maps:?daddr=${cliente.latitude},${cliente.longitude}`
        : `google.navigation:q=${cliente.latitude},${cliente.longitude}`;
      Linking.openURL(url);
    }
  };

  const handleVerParcelas = (cliente: ClienteAgrupado, emprestimo: EmprestimoData) => {
    navigation.navigate('Parcelas', {
      emprestimoId: emprestimo.emprestimo_id,
      clienteNome: cliente.nome,
    });
  };

  const toggleExpand = (clienteId: string) => {
    setExpandedCliente(prev => prev === clienteId ? null : clienteId);
  };

  // ============================================================
  // RENDER — CARD CLIENTE LIQUIDAÇÃO
  // ============================================================

  const renderCardLiquidacao = (cliente: ClienteAgrupado) => {
    const emp = getEmprestimoAtual(cliente);
    const isExpanded = expandedCliente === cliente.cliente_id;
    const borderColor = getStatusBorderColor(emp);
    const bgColor = getStatusBackgroundColor(emp);
    const empIdx = getEmprestimoIndex(cliente.cliente_id);

    // Calcular juros
    const juros = emp.valor_parcela * emp.numero_parcelas - emp.valor_principal;
    const totalEmprestimo = emp.valor_principal + juros;

    // Parcelas pagas (estimativa via numero_parcela e status)
    const parcelasPagas = emp.numero_parcela - 1 + (emp.status_dia === 'PAGO' ? 1 : 0);
    const totalPago = emp.valor_pago_parcela + (emp.valor_principal - emp.saldo_emprestimo);
    const parcelasRestantes = emp.numero_parcelas - parcelasPagas;
    const progressoPct = emp.numero_parcelas > 0
      ? Math.min(100, Math.round((parcelasPagas / emp.numero_parcelas) * 100))
      : 0;

    return (
      <TouchableOpacity
        key={cliente.cliente_id}
        activeOpacity={0.7}
        onPress={() => toggleExpand(cliente.cliente_id)}
        style={[
          styles.clienteCard,
          { borderLeftColor: borderColor, backgroundColor: bgColor },
        ]}
      >
        {/* ===== HEADER DO CARD ===== */}
        <View style={styles.cardHeader}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: borderColor === '#D1D5DB' ? '#3B82F6' : borderColor }]}>
            <Text style={styles.avatarText}>{getIniciais(cliente.nome)}</Text>
          </View>

          {/* Info principal */}
          <View style={styles.cardHeaderInfo}>
            <View style={styles.cardHeaderTopRow}>
              <Text style={styles.clienteNome} numberOfLines={1}>
                {cliente.nome.toLowerCase()}
              </Text>
              {/* Badge vencidas */}
              {emp.tem_parcelas_vencidas && emp.total_parcelas_vencidas > 0 && (
                <View style={styles.badgeVencidas}>
                  <Text style={styles.badgeVencidasIcon}>⚠️</Text>
                  <Text style={styles.badgeVencidasText}>{emp.total_parcelas_vencidas}</Text>
                </View>
              )}
              {/* Badge múltiplos */}
              {cliente.tem_multiplos_vencimentos && (
                <View style={styles.badgeMultiplos}>
                  <Text style={styles.badgeMultiplosText}>{cliente.qtd_emprestimos}</Text>
                </View>
              )}
              {/* Menu 3 pontos */}
              <TouchableOpacity style={styles.menuDots} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.menuDotsText}>⋮</Text>
              </TouchableOpacity>
            </View>

            {/* Telefone */}
            {cliente.telefone_celular && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📞</Text>
                <Text style={styles.infoText}>{cliente.telefone_celular}</Text>
              </View>
            )}

            {/* Endereço */}
            {cliente.endereco && (
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📍</Text>
                <Text style={styles.infoText} numberOfLines={1}>{cliente.endereco}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== PARCELA + SALDO ===== */}
        <View style={styles.parcelaSaldoRow}>
          <View>
            <Text style={styles.parcelaLabel}>
              {t.parcela} {emp.numero_parcela}/{emp.numero_parcelas}
              {'  '}
              <View style={styles.freqBadge}>
                <Text style={styles.freqBadgeText}>
                  {formatarFrequenciaLabel(emp.frequencia_pagamento, t)}
                </Text>
              </View>
            </Text>
            <Text style={styles.parcelaValor}>{formatarMoeda(emp.valor_parcela)}</Text>
          </View>
          <View style={styles.saldoContainer}>
            <Text style={styles.saldoLabel}>{t.saldoEmprestimo}</Text>
            <Text style={styles.saldoValor}>{formatarMoeda(emp.saldo_emprestimo)}</Text>
          </View>
        </View>

        {/* ===== ÁREA EXPANDIDA ===== */}
        {isExpanded && (
          <View style={styles.expandedArea}>
            {/* Alerta parcelas vencidas */}
            {emp.tem_parcelas_vencidas && emp.total_parcelas_vencidas > 0 && (
              <View style={styles.alertaVencidas}>
                <Text style={styles.alertaVencidasText}>
                  ⚠️ {emp.total_parcelas_vencidas} {t.parcelasVencidas}
                </Text>
                <Text style={styles.alertaVencidasValor}>
                  {t.totalAtraso} {formatarMoeda(emp.valor_total_vencido)}
                </Text>
              </View>
            )}

            {/* Pagamento parcial */}
            {emp.status_parcela === 'PARCIAL' && (
              <View style={styles.alertaParcial}>
                <Text style={styles.alertaParcialText}>
                  Pagamento parcial: {formatarMoeda(emp.valor_pago_parcela)} / {formatarMoeda(emp.valor_parcela)}
                </Text>
                <Text style={styles.alertaParcialSaldo}>
                  Restante: {formatarMoeda(emp.saldo_parcela)}
                </Text>
              </View>
            )}

            {/* Navegação múltiplos empréstimos */}
            {cliente.tem_multiplos_vencimentos && (
              <View style={styles.empNavRow}>
                <TouchableOpacity
                  onPress={() => setEmprestimoIndex(cliente.cliente_id, Math.max(0, empIdx - 1))}
                  disabled={empIdx === 0}
                  style={[styles.empNavButton, empIdx === 0 && styles.empNavButtonDisabled]}
                >
                  <Text style={styles.empNavButtonText}>◀</Text>
                </TouchableOpacity>
                <View style={styles.empNavDots}>
                  {cliente.emprestimos.map((_, i) => (
                    <View key={i} style={[styles.empNavDot, i === empIdx && styles.empNavDotActive]} />
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => setEmprestimoIndex(cliente.cliente_id, Math.min(cliente.emprestimos.length - 1, empIdx + 1))}
                  disabled={empIdx >= cliente.emprestimos.length - 1}
                  style={[styles.empNavButton, empIdx >= cliente.emprestimos.length - 1 && styles.empNavButtonDisabled]}
                >
                  <Text style={styles.empNavButtonText}>▶</Text>
                </TouchableOpacity>
                <Text style={styles.empNavLabel}>
                  {t.emprestimo} {empIdx + 1}/{cliente.qtd_emprestimos}
                </Text>
              </View>
            )}

            {/* Resumo empréstimo */}
            <View style={styles.resumoEmprestimo}>
              <View style={styles.resumoHeader}>
                <Text style={styles.resumoTitle}>
                  {t.emprestimo} {empIdx + 1}/{cliente.qtd_emprestimos}
                </Text>
                <View style={[
                  styles.statusEmpBadge,
                  { backgroundColor: emp.status_dia === 'EM_ATRASO' ? '#FEE2E2' : emp.status_dia === 'PAGO' ? '#D1FAE5' : '#F3F4F6' }
                ]}>
                  <Text style={[
                    styles.statusEmpText,
                    { color: emp.status_dia === 'EM_ATRASO' ? '#DC2626' : emp.status_dia === 'PAGO' ? '#059669' : '#6B7280' }
                  ]}>
                    {emp.status_dia}
                  </Text>
                </View>
              </View>

              {/* Linha 1: Principal / Juros / Total */}
              <View style={styles.resumoGrid}>
                <View style={styles.resumoGridItem}>
                  <Text style={styles.resumoGridLabel}>{t.principal}</Text>
                  <Text style={styles.resumoGridValue}>{formatarMoeda(emp.valor_principal)}</Text>
                </View>
                <View style={styles.resumoGridItem}>
                  <Text style={styles.resumoGridLabel}>{t.juros}</Text>
                  <Text style={[styles.resumoGridValue, { color: '#F59E0B' }]}>{formatarMoeda(juros)}</Text>
                </View>
                <View style={styles.resumoGridItem}>
                  <Text style={styles.resumoGridLabel}>{t.total}</Text>
                  <Text style={styles.resumoGridValue}>{formatarMoeda(totalEmprestimo)}</Text>
                </View>
              </View>

              {/* Linha 2: Já Pago / Saldo / Parcelas */}
              <View style={styles.resumoGrid}>
                <View style={styles.resumoGridItem}>
                  <Text style={styles.resumoGridLabel}>{t.jaPago}</Text>
                  <Text style={[styles.resumoGridValue, { color: '#10B981' }]}>
                    {formatarMoeda(totalEmprestimo - emp.saldo_emprestimo)}
                  </Text>
                </View>
                <View style={styles.resumoGridItem}>
                  <Text style={styles.resumoGridLabel}>{t.saldo}</Text>
                  <Text style={[styles.resumoGridValue, { color: '#EF4444' }]}>{formatarMoeda(emp.saldo_emprestimo)}</Text>
                </View>
                <View style={styles.resumoGridItem}>
                  <Text style={styles.resumoGridLabel}>{t.parcelas}</Text>
                  <Text style={styles.resumoGridValue}>{parcelasPagas}/{emp.numero_parcelas}</Text>
                </View>
              </View>

              {/* Progresso */}
              <View style={styles.progressoContainer}>
                <Text style={styles.progressoLabel}>{t.progresso}</Text>
                <View style={styles.progressoBarOuter}>
                  <View style={[styles.progressoBarInner, { width: `${progressoPct}%` }]} />
                </View>
                <Text style={styles.progressoRestantes}>{parcelasRestantes} {t.restantes}</Text>
              </View>
            </View>

            {/* Botões de ação */}
            <View style={styles.acoesBotoes}>
              <TouchableOpacity
                style={[styles.botaoAcao, styles.botaoPagar, isVisualizacao && styles.botaoDisabled]}
                onPress={() => handlePagar(cliente, emp)}
                disabled={isVisualizacao || emp.status_dia === 'PAGO'}
              >
                <Text style={styles.botaoAcaoIcon}>💰</Text>
                <Text style={styles.botaoAcaoTextBranco}>{t.pagar}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.botaoAcao, styles.botaoParcelas]}
                onPress={() => handleVerParcelas(cliente, emp)}
              >
                <Text style={styles.botaoAcaoIcon}>👁</Text>
                <Text style={styles.botaoAcaoTextBranco}>{t.verParcelas}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.acoesBotoes}>
              <TouchableOpacity
                style={[styles.botaoAcao, styles.botaoContato]}
                onPress={() => handleContato(cliente)}
                disabled={!cliente.telefone_celular}
              >
                <Text style={styles.botaoAcaoIcon}>📱</Text>
                <Text style={styles.botaoAcaoTextVerde}>{t.contato}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.botaoAcao, styles.botaoIR]}
                onPress={() => handleIR(cliente)}
                disabled={!cliente.latitude || !cliente.longitude}
              >
                <Text style={styles.botaoAcaoIcon}>🧭</Text>
                <Text style={styles.botaoAcaoTextAzul}>{t.ir}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ============================================================
  // RENDER — CARD CLIENTE TODOS
  // ============================================================

  const renderCardTodos = (cliente: ClienteTodos) => {
    const isAtraso = cliente.tem_atraso;
    const isInativo = cliente.status !== 'ATIVO';
    const corBorda = isAtraso ? '#EF4444' : isInativo ? '#9CA3AF' : '#3B82F6';
    const statusLabel = isAtraso ? t.statusAtraso : isInativo ? t.statusInativo : '';
    const statusCor = isAtraso ? '#EF4444' : '#9CA3AF';

    return (
      <TouchableOpacity
        key={cliente.id}
        activeOpacity={0.7}
        style={[styles.todosCard, { borderLeftColor: corBorda }]}
        onPress={() => {
          // TODO: navegar para detalhes do cliente
        }}
      >
        <View style={[styles.todosAvatar, { backgroundColor: corBorda }]}>
          <Text style={styles.todosAvatarText}>{getIniciais(cliente.nome)}</Text>
        </View>
        <Text style={styles.todosNome} numberOfLines={1}>{cliente.nome.toLowerCase()}</Text>
        {statusLabel ? (
          <Text style={[styles.todosStatus, { color: statusCor }]}>{statusLabel}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  // ============================================================
  // FILTROS ABA TODOS
  // ============================================================

  const clientesTodosFiltrados = useMemo(() => {
    if (!busca.trim()) return clientesTodos;
    const termo = busca.toLowerCase().trim();
    return clientesTodos.filter(c =>
      c.nome.toLowerCase().includes(termo) ||
      (c.telefone_celular && c.telefone_celular.includes(termo))
    );
  }, [clientesTodos, busca]);

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>{t.carregando}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t.titulo}</Text>
          <Text style={styles.headerSubtitle}>
            {t.hoje} - {tabAtiva === 'liquidacao' ? totalClientesLiquidacao : clientesTodos.length} {t.clientes}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.headerDot} />
          <TouchableOpacity style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Text style={styles.headerIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== TABS ===== */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tabAtiva === 'liquidacao' && styles.tabButtonActive]}
          onPress={() => setTabAtiva('liquidacao')}
        >
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={[styles.tabText, tabAtiva === 'liquidacao' && styles.tabTextActive]}>
            {t.liquidacao} ({totalClientesLiquidacao})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tabAtiva === 'todos' && styles.tabButtonActive]}
          onPress={() => setTabAtiva('todos')}
        >
          <Text style={styles.tabIcon}>👥</Text>
          <Text style={[styles.tabText, tabAtiva === 'todos' && styles.tabTextActive]}>
            {t.todosList} ({clientesTodos.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===== BUSCA ===== */}
      <View style={styles.buscaContainer}>
        <View style={styles.buscaInputWrapper}>
          <Text style={styles.buscaIcon}>🔍</Text>
          <TextInput
            style={styles.buscaInput}
            placeholder={t.buscar}
            placeholderTextColor="#9CA3AF"
            value={busca}
            onChangeText={setBusca}
          />
        </View>

        {tabAtiva === 'liquidacao' && (
          <TouchableOpacity
            style={styles.ordenacaoButton}
            onPress={() => setShowOrdenacao(!showOrdenacao)}
          >
            <Text style={styles.ordenacaoIcon}>↕️</Text>
            <Text style={styles.ordenacaoText}>
              {ordenacao === 'rota' ? t.ordemRota : ordenacao === 'nome' ? t.ordemNome : t.ordemProximos}
            </Text>
            <Text style={styles.ordenacaoChevron}>▼</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown ordenação */}
      {showOrdenacao && tabAtiva === 'liquidacao' && (
        <View style={styles.ordenacaoDropdown}>
          {(['rota', 'nome', 'proximos'] as OrdenacaoLiquidacao[]).map((op) => (
            <TouchableOpacity
              key={op}
              style={[styles.ordenacaoOption, ordenacao === op && styles.ordenacaoOptionActive]}
              onPress={() => { setOrdenacao(op); setShowOrdenacao(false); }}
            >
              <Text style={[styles.ordenacaoOptionText, ordenacao === op && styles.ordenacaoOptionTextActive]}>
                {op === 'rota' ? t.ordemRota : op === 'nome' ? t.ordemNome : t.ordemProximos}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ===== SUB-FILTROS LIQUIDAÇÃO ===== */}
      {tabAtiva === 'liquidacao' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
          <View style={styles.filtrosRow}>
            {([
              { key: 'todos', label: `${t.filtroTodos} ${totalClientesLiquidacao}` },
              { key: 'atrasados', label: `${t.filtroAtrasados} ${totalAtrasados}` },
              { key: 'perto', label: t.filtroPerto },
              { key: 'pagas', label: `${t.filtroPagas} ${totalPagas}` },
            ] as { key: FiltroLiquidacao; label: string }[]).map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filtroChip, filtroLiquidacao === f.key && styles.filtroChipActive]}
                onPress={() => setFiltroLiquidacao(f.key)}
              >
                <Text style={[styles.filtroChipText, filtroLiquidacao === f.key && styles.filtroChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.filtroChevron}>▼</Text>
          </View>
        </ScrollView>
      )}

      {/* ===== SUB-FILTROS TODOS ===== */}
      {tabAtiva === 'todos' && (
        <View style={styles.todosFiltros}>
          <TouchableOpacity style={styles.todosFiltroButton}>
            <Text style={styles.todosFiltroText}>{t.tipoFiltro}</Text>
            <Text style={styles.todosFiltroChevron}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.todosFiltroButton}>
            <Text style={styles.todosFiltroText}>{t.statusFiltro}</Text>
            <Text style={styles.todosFiltroChevron}>▼</Text>
          </TouchableOpacity>
          <Text style={styles.todosCounter}>{clientesTodosFiltrados.length} {t.clientes}</Text>
          <Text style={styles.todosChevron}>▼</Text>
        </View>
      )}

      {/* ===== LISTA ===== */}
      <ScrollView
        style={styles.lista}
        contentContainerStyle={styles.listaContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {tabAtiva === 'liquidacao' ? (
          clientesFiltrados.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>{t.semClientes}</Text>
            </View>
          ) : (
            clientesFiltrados.map(renderCardLiquidacao)
          )
        ) : (
          loadingTodos ? (
            <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
          ) : clientesTodosFiltrados.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>{t.semClientes}</Text>
            </View>
          ) : (
            clientesTodosFiltrados.map(renderCardTodos)
          )
        )}

        {/* Spacer para bottom nav */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  // Layout geral
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

  // Header
  header: {
    backgroundColor: '#3B82F6', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  headerIcon: { padding: 4 },
  headerIconText: { fontSize: 18 },

  // Tabs
  tabsContainer: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: '#F3F4F6',
    borderRadius: 12, padding: 4,
  },
  tabButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, gap: 6,
  },
  tabButtonActive: { backgroundColor: '#3B82F6' },
  tabIcon: { fontSize: 14 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },

  // Busca
  buscaContainer: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 },
  buscaInputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, paddingHorizontal: 12, height: 42,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  buscaIcon: { fontSize: 14, marginRight: 8 },
  buscaInput: { flex: 1, fontSize: 14, color: '#1F2937', padding: 0 },
  ordenacaoButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, paddingHorizontal: 12, height: 42, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  ordenacaoIcon: { fontSize: 12 },
  ordenacaoText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  ordenacaoChevron: { fontSize: 8, color: '#9CA3AF' },
  ordenacaoDropdown: {
    position: 'absolute', top: 185, right: 16, zIndex: 100,
    backgroundColor: '#fff', borderRadius: 10, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  ordenacaoOption: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  ordenacaoOptionActive: { backgroundColor: '#EFF6FF' },
  ordenacaoOptionText: { fontSize: 13, color: '#6B7280' },
  ordenacaoOptionTextActive: { color: '#3B82F6', fontWeight: '600' },

  // Filtros Liquidação
  filtrosScroll: { marginTop: 10, paddingLeft: 16 },
  filtrosRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  filtroChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  filtroChipActive: { backgroundColor: '#1F2937', borderColor: '#1F2937' },
  filtroChipText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  filtroChipTextActive: { color: '#fff' },
  filtroChevron: { fontSize: 10, color: '#9CA3AF', marginLeft: 4 },

  // Filtros Todos
  todosFiltros: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8 },
  todosFiltroButton: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', gap: 4,
  },
  todosFiltroText: { fontSize: 12, color: '#6B7280' },
  todosFiltroChevron: { fontSize: 8, color: '#9CA3AF' },
  todosCounter: { flex: 1, textAlign: 'right', fontSize: 12, color: '#6B7280' },
  todosChevron: { fontSize: 10, color: '#9CA3AF' },

  // Lista
  lista: { flex: 1, marginTop: 12 },
  listaContent: { paddingHorizontal: 16 },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  // ===== CARD LIQUIDAÇÃO =====
  clienteCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardHeaderInfo: { flex: 1 },
  cardHeaderTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  clienteNome: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
  badgeVencidas: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 6,
  },
  badgeVencidasIcon: { fontSize: 10, marginRight: 2 },
  badgeVencidasText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  badgeMultiplos: {
    backgroundColor: '#FED7AA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 4,
  },
  badgeMultiplosText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  menuDots: { marginLeft: 6, padding: 2 },
  menuDotsText: { fontSize: 18, color: '#9CA3AF', fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  infoIcon: { fontSize: 11, marginRight: 4, opacity: 0.6 },
  infoText: { fontSize: 12, color: '#6B7280', flex: 1 },

  // Parcela + Saldo
  parcelaSaldoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  parcelaLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  parcelaValor: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  saldoContainer: { alignItems: 'flex-end' },
  saldoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  saldoValor: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  freqBadge: {
    backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  freqBadgeText: { fontSize: 10, fontWeight: '600', color: '#7C3AED' },

  // ===== EXPANDED AREA =====
  expandedArea: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },

  // Alerta vencidas
  alertaVencidas: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  alertaVencidasText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  alertaVencidasValor: { fontSize: 12, color: '#B91C1C', marginTop: 2 },

  // Alerta parcial
  alertaParcial: {
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  alertaParcialText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  alertaParcialSaldo: { fontSize: 12, color: '#B45309', marginTop: 2 },

  // Navegação empréstimos
  empNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 8 },
  empNavButton: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  empNavButtonDisabled: { opacity: 0.3 },
  empNavButtonText: { fontSize: 12, color: '#6B7280' },
  empNavDots: { flexDirection: 'row', gap: 4 },
  empNavDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  empNavDotActive: { backgroundColor: '#3B82F6' },
  empNavLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  // Resumo empréstimo
  resumoEmprestimo: {
    backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  resumoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  resumoTitle: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  statusEmpBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusEmpText: { fontSize: 10, fontWeight: '700' },
  resumoGrid: { flexDirection: 'row', marginBottom: 8 },
  resumoGridItem: { flex: 1 },
  resumoGridLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  resumoGridValue: { fontSize: 13, fontWeight: '700', color: '#1F2937' },

  // Progresso
  progressoContainer: { marginTop: 4 },
  progressoLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 4 },
  progressoBarOuter: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden',
  },
  progressoBarInner: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  progressoRestantes: { fontSize: 10, color: '#9CA3AF', marginTop: 3, textAlign: 'right' },

  // Botões de ação
  acoesBotoes: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  botaoAcao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, gap: 6,
  },
  botaoPagar: { backgroundColor: '#10B981' },
  botaoParcelas: { backgroundColor: '#3B82F6' },
  botaoContato: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  botaoIR: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  botaoDisabled: { opacity: 0.5 },
  botaoAcaoIcon: { fontSize: 14 },
  botaoAcaoTextBranco: { color: '#fff', fontSize: 13, fontWeight: '600' },
  botaoAcaoTextVerde: { color: '#059669', fontSize: 13, fontWeight: '600' },
  botaoAcaoTextAzul: { color: '#2563EB', fontSize: 13, fontWeight: '600' },

  // ===== CARD TODOS =====
  todosCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  todosAvatar: {
    width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  todosAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  todosNome: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1F2937' },
  todosStatus: { fontSize: 12, fontWeight: '500', marginLeft: 8 },
});
