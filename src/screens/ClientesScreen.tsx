import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ClienteDetalhesModal from '../components/ClienteDetalhesModal';
import { ModalCriarNota, ModalNotasLista, buscarNotasCountPorClientes } from '../components/NotasComponent';
import { useAuth } from '../contexts/AuthContext';
import { Language, useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { supabase } from '../services/supabase';

// Language importado do LiquidacaoContext
type TabAtiva = 'liquidacao' | 'todos';
type FiltroLiquidacao = 'todos' | 'atrasados' | 'pagas';
type OrdenacaoLiquidacao = 'rota' | 'nome';

interface ClienteRotaDia {
  cliente_id: string; codigo_cliente: number | null; nome: string;
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
  data_emprestimo?: string; cliente_created_at?: string;
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
  data_emprestimo?: string;
}

interface ClienteAgrupado {
  cliente_id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null; rota_id: string;
  emprestimos: EmprestimoData[]; qtd_emprestimos: number; tem_multiplos_vencimentos: boolean;
}

interface ClienteTodos {
  id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; status: string; tem_atraso: boolean;
  permite_renegociacao: boolean; cliente_created_at?: string;
  emprestimos: EmprestimoTodos[];
}

interface EmprestimoTodos {
  id: string; valor_principal: number; saldo_emprestimo: number;
  valor_parcela: number; numero_parcelas: number; numero_parcela_atual: number;
  status: string; frequencia_pagamento: string; tipo_emprestimo: string;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  data_emprestimo?: string;
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
  valor_saldo?: number;
  credito_gerado?: number;
  saldo_excedente?: number;
  liquidacao_id?: string | null;
  data_liquidacao?: string | null;
  observacoes?: string | null;
}

const textos = {
  'pt-BR': {
    titulo: 'Meus Clientes', hoje: 'Hoje', clientes: 'clientes',
    liquidacao: 'Liquidação', todosList: 'Todos', buscar: 'Buscar...',
    ordemRota: 'Ordem rota', ordemNome: 'Nome A-Z',
    filtroTodos: 'Todos', filtroAtrasados: 'Atrasados', filtroPagas: 'Pagas',
    ocultarLiquidacao: 'Ocultar clientes da liquidação',
    parcela: 'Parcela', saldoEmprestimo: 'Saldo Empréstimo',
    parcelasVencidas: 'parcela(s) vencida(s)', totalAtraso: 'Total em atraso:',
    emprestimo: 'Empréstimo', principal: 'Principal', juros: 'Juros',
    total: 'Total', jaPago: 'Já Pago', saldo: 'Saldo', parcelas: 'Parcelas',
    progresso: 'Progresso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Parcelas', contato: 'Contato', ir: 'IR', notas: 'Notas',
    semClientes: 'Nenhum cliente encontrado', carregando: 'Carregando clientes...',
    statusAtraso: 'Atraso', statusInativo: 'Inativo',
    tipoFiltro: 'Tipo:...', statusFiltro: 'Status:...',
    tipoTodos: 'Todos', tipoNovo: 'Novo', tipoRenovacao: 'Renovação', tipoRenegociacao: 'Renegociação',
    stTodos: 'Todos', stAtivo: 'Ativo', stVencido: 'Vencido', stQuitado: 'Quitado', stRenegociado: 'Renegociado',
    pago: 'Pago:', original: 'Original:', credito: 'Crédito:',
    empAtivo: 'Empréstimo Ativo', empVencido: 'Empréstimo Vencido',
    empRenegociado: 'Renegociado', empQuitado: 'Quitado',
    valorParcela: 'Valor Parcela', saldoDevedor: 'Saldo Devedor', saldoRenegociado: 'Saldo Renegociado',
    empAdicional: 'Empréstimo Adicional', detalhes: 'Detalhes',
    novoEmprestimo: 'Novo Empréstimo',
    confirmarNovoEmprestimo: 'Deseja criar um novo empréstimo para este cliente? Os dados cadastrais serão pré-preenchidos.',
    sim: 'Sim', nao: 'Não',
    renegociar: 'Renegociar',
    renegociacaoNaoPermitida: 'Renegociação não autorizada para este cliente. Solicite autorização ao administrador.',
    modoVisualizacao: 'Modo Visualização',
    modoVisualizacaoDesc: 'Visualizando dados de',
    modoVisualizacaoSair: 'Sair',
    estornar: 'Estornar', venc: 'Venc:', em: 'Pago em:', liq: 'Liquidação:', fechar: 'Fechar',
    quitarTudo: 'QUITAR TUDO', confirmar: 'Confirmar', cancelar: 'Cancelar',
    atencaoQuitacao: '⚠️ Quitação de Empréstimo',
    confirmarQuitar: 'Sim, Quitar',
    creditoDisponivel: 'Crédito disponível:',
    registrarPagamento: 'Registrar Pagamento', valorAPagar: 'Valor a pagar',
    maxPermitido: 'Máx:',
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
    liquidacaoFechada: 'Liquidação fechada',
    semLiquidacaoAberta: 'Nenhuma liquidação aberta',
    abrirLiquidacao: 'Abra uma liquidação para operar',
    // Strings adicionais para Alerts e popups
    atencao: 'Atenção', erroGenerico: 'Erro', sucessoGenerico: 'Sucesso', aviso: 'Aviso',
    erroCarregarParcelas: 'Não foi possível carregar as parcelas.',
    dadosClienteIndisponiveis: 'Dados do cliente não disponíveis',
    nenhumaParcela: 'Nenhuma parcela pendente encontrada',
    erroBuscarParcela: 'Não foi possível buscar a próxima parcela',
    pagamentoNaoPermitido: 'Pagamento não permitido',
    valorInvalido: 'Valor inválido',
    informeValor: 'Informe um valor para pagar ou use o crédito disponível',
    nenhumaParcelaEncontrada: 'Nenhuma parcela encontrada',
    dinheiro: 'Dinheiro', transferencia: 'Transf/PIX',
    pagoStatus: 'PAGO', parcialStatus: 'PARCIAL', vencidaStatus: 'VENCIDA',
    creditoUsado: 'Crédito usado:', creditoGerado: 'Crédito gerado:',
    semNumero: 'Sem número',
    existemParcelas: 'Existem',
    parcelasAnteriores: 'parcela(s) anterior(es) pendente(s) com saldo de',
    quitarPrimeiro: 'É necessário quitar as parcelas mais antigas primeiro.',
    saldoAnteriorParcelas: 'parcela(s)',
    incluirAtraso: 'Incluir atraso',
    quitacaoAntecipada: 'Quitação antecipada',
    quitadoPorCredito: 'Quitado por crédito',
    restante: 'Restante:',
    toqueDetalhes: 'Toque para ver detalhes',
    legendaTitulo: 'Significado das Cores',
    legendaSubtitulo: 'Borda esquerda de cada card',
    legendaEntendido: 'Entendido',
    legPagoLabel: 'Pago / Em dia', legPagoDesc: 'Sem parcelas vencidas',
    legPendenteLabel: 'Pendente', legPendenteDesc: 'Ainda não é dia de cobrança',
    legLeveLabel: 'Atraso leve (1–3)', legLeveDesc: '1 a 3 parcelas vencidas',
    legModeradoLabel: 'Atraso moderado (4–7)', legModeradoDesc: '4 a 7 parcelas vencidas',
    legCriticoLabel: 'Atraso crítico (8+)', legCriticoDesc: '8 ou mais parcelas vencidas',
  },  'es': {
    titulo: 'Mis Clientes', hoje: 'Hoy', clientes: 'clientes',
    liquidacao: 'Liquidación', todosList: 'Todos', buscar: 'Buscar...',
    ordemRota: 'Orden ruta', ordemNome: 'Nombre A-Z',
    filtroTodos: 'Todos', filtroAtrasados: 'Atrasados', filtroPagas: 'Pagados',
    ocultarLiquidacao: 'Ocultar clientes de la liquidación',
    parcela: 'Cuota', saldoEmprestimo: 'Saldo Préstamo',
    parcelasVencidas: 'cuota(s) vencida(s)', totalAtraso: 'Total en atraso:',
    emprestimo: 'Préstamo', principal: 'Principal', juros: 'Intereses',
    total: 'Total', jaPago: 'Ya Pagó', saldo: 'Saldo', parcelas: 'Cuotas',
    progresso: 'Progreso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Cuotas', contato: 'Contacto', ir: 'IR', notas: 'Notas',
    semClientes: 'Ningún cliente encontrado', carregando: 'Cargando clientes...',
    statusAtraso: 'Atraso', statusInativo: 'Inactivo',
    tipoFiltro: 'Tipo:...', statusFiltro: 'Estado:...',
    tipoTodos: 'Todos', tipoNovo: 'Nuevo', tipoRenovacao: 'Renovación', tipoRenegociacao: 'Renegociación',
    stTodos: 'Todos', stAtivo: 'Activo', stVencido: 'Vencido', stQuitado: 'Liquidado', stRenegociado: 'Renegociado',
    pago: 'Pagado:', original: 'Original:', credito: 'Crédito:',
    empAtivo: 'Préstamo Activo', empVencido: 'Préstamo Vencido',
    empRenegociado: 'Renegociado', empQuitado: 'Liquidado',
    valorParcela: 'Valor Cuota', saldoDevedor: 'Saldo Deudor', saldoRenegociado: 'Saldo Renegociado',
    empAdicional: 'Préstamo Adicional', detalhes: 'Detalles',
    novoEmprestimo: 'Nuevo Préstamo',
    confirmarNovoEmprestimo: '¿Desea crear un nuevo préstamo para este cliente? Los datos de registro se completarán automáticamente.',
    sim: 'Sí', nao: 'No',
    renegociar: 'Renegociar',
    renegociacaoNaoPermitida: 'Renegociación no autorizada para este cliente. Solicite autorización al administrador.',
    modoVisualizacao: 'Modo Visualización',
    modoVisualizacaoDesc: 'Visualizando datos de',
    modoVisualizacaoSair: 'Salir',
    estornar: 'Reversar', venc: 'Venc:', em: 'Pagado:', liq: 'Liquidación:', fechar: 'Cerrar',
    quitarTudo: 'LIQUIDAR TODO', confirmar: 'Confirmar', cancelar: 'Cancelar',
    atencaoQuitacao: '⚠️ Liquidación de Préstamo',
    confirmarQuitar: 'Sí, Liquidar',
    creditoDisponivel: 'Crédito disponible:',
    registrarPagamento: 'Registrar Pago', valorAPagar: 'Valor a pagar',
    maxPermitido: 'Máx:',
    forma: 'Forma:', gpsOk: 'GPS OK', gpsErro: 'Sin GPS',
    pagarBtn: 'PAGAR', pendente: 'PENDIENTE', vencimento: 'Vencimiento:',
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
    liquidacaoFechada: 'Liquidación cerrada',
    semLiquidacaoAberta: 'Ninguna liquidación abierta',
    abrirLiquidacao: 'Abra una liquidación para operar',
    // Strings adicionais para Alerts e popups
    atencao: 'Atención', erroGenerico: 'Error', sucessoGenerico: 'Éxito', aviso: 'Aviso',
    erroCarregarParcelas: 'No fue posible cargar las cuotas.',
    dadosClienteIndisponiveis: 'Datos del cliente no disponibles',
    nenhumaParcela: 'Ninguna cuota pendiente encontrada',
    erroBuscarParcela: 'No fue posible buscar la próxima cuota',
    pagamentoNaoPermitido: 'Pago no permitido',
    valorInvalido: 'Valor inválido',
    informeValor: 'Informe un valor para pagar o use el crédito disponible',
    nenhumaParcelaEncontrada: 'Ninguna cuota encontrada',
    dinheiro: 'Efectivo', transferencia: 'Transf/PIX',
    pagoStatus: 'PAGADO', parcialStatus: 'PARCIAL', vencidaStatus: 'VENCIDA',
    creditoUsado: 'Crédito usado:', creditoGerado: 'Crédito generado:',
    semNumero: 'Sin número',
    existemParcelas: 'Existen',
    parcelasAnteriores: 'cuota(s) anterior(es) pendiente(s) con saldo de',
    quitarPrimeiro: 'Es necesario pagar las cuotas más antiguas primero.',
    saldoAnteriorParcelas: 'cuota(s)',
    incluirAtraso: 'Incluir atraso',
    quitacaoAntecipada: 'Liquidación anticipada',
    quitadoPorCredito: 'Liquidado por crédito',
    restante: 'Restante:',
    toqueDetalhes: 'Toque para ver detalles',
    legendaTitulo: 'Significado de los Colores',
    legendaSubtitulo: 'Borde izquierdo de cada tarjeta',
    legendaEntendido: 'Entendido',
    legPagoLabel: 'Pago / Al día', legPagoDesc: 'Sin parcelas vencidas',
    legPendenteLabel: 'Pendiente', legPendenteDesc: 'Aún no es día de cobro',
    legLeveLabel: 'Atraso leve (1–3)', legLeveDesc: '1 a 3 cuotas vencidas',
    legModeradoLabel: 'Atraso moderado (4–7)', legModeradoDesc: '4 a 7 cuotas vencidas',
    legCriticoLabel: 'Atraso crítico (8+)', legCriticoDesc: '8 o más cuotas vencidas',
  },
};

const FREQ: Record<Language, Record<string, string>> = { 
  'pt-BR': { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' },
  'es': { DIARIO: 'Diario', SEMANAL: 'Semanal', QUINZENAL: 'Quincenal', MENSAL: 'Mensual', FLEXIVEL: 'Flexible' },
};
const getIni = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
const fmt = (v: number) => '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Busca crédito acumulado (saldo_excedente) por empréstimo
// Saldo real = valor_saldo - credito_acumulado
const buscarCreditoMap = async (empIds: string[]): Promise<Map<string, number>> => {
  if (empIds.length === 0) return new Map();
  const { data } = await supabase
    .from('emprestimo_parcelas')
    .select('emprestimo_id, saldo_excedente')
    .in('emprestimo_id', empIds)
    .gt('saldo_excedente', 0);
  const creditoMap = new Map<string, number>();
  (data || []).forEach((p: any) => {
    const atual = creditoMap.get(p.emprestimo_id) || 0;
    creditoMap.set(p.emprestimo_id, atual + parseFloat(p.saldo_excedente || 0));
  });
  return creditoMap;
};
const fmtData = (d: string | null | undefined) => { 
  if (!d) return ''; 
  // Se é só data (YYYY-MM-DD), formata direto
  if (d.length === 10 && d.includes('-')) {
    const [y, m, day] = d.split('-'); 
    return `${day}/${m}/${y}`; 
  }
  // Se é timestamp, converte para data local
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('pt-BR');
};
const fmtTel = (t: string) => t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
// Cor da borda por nível de atraso:
// Verde: 0 parcelas de atraso (em dia)
// Amarelo: 1-3 parcelas de atraso (leve)
// Laranja: 4-7 parcelas de atraso (moderado)
// Vermelho: 8+ parcelas de atraso (crítico)
const corAtraso = (vencidas: number): string => {
  if (vencidas <= 0) return '#10B981'; // verde
  if (vencidas <= 3) return '#F59E0B'; // amarelo
  if (vencidas <= 7) return '#F97316'; // laranja
  return '#EF4444'; // vermelho
};

const borderOf = (e: EmprestimoData, paga: boolean) => {
  if (paga) return '#10B981';
  const vencidas = e.total_parcelas_vencidas || 0;
  if (vencidas > 0) return corAtraso(vencidas);
  if (e.is_parcela_atrasada) return '#F59E0B';
  return ({ PAGO: '#10B981', EM_ATRASO: '#F59E0B', PARCIAL: '#F59E0B', PENDENTE: '#D1D5DB' } as any)[e.status_dia] || '#D1D5DB';
};
const bgOf = (_e: EmprestimoData, paga: boolean) => paga ? 'rgba(16,185,129,0.05)' : '#fff';
const isPaga = (pid: string, sd: string, set: Set<string>) => set.has(pid) || sd === 'PAGO';
const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') { window.alert(`${title}\n${msg}`); }
  else { Alert.alert(title, msg); }
};

export default function ClientesScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();
  const liqCtx = useLiquidacaoContext();
  const rotaId = route?.params?.rotaId || vendedor?.rota_id;
  // data_liquidacao = campo DATE puro sem timezone (adicionado na migration 09)
  // Fallback: data_abertura.substring(0,10) sem conversão UTC
  // Último fallback: data local do dispositivo
  const _liqAtual = liqCtx.liquidacaoAtual as any;
  const dataLiq = liqCtx.dataVisualizacao
    || route?.params?.dataLiquidacao
    || _liqAtual?.data_liquidacao?.substring(0, 10)
    || (_liqAtual?.data_abertura ? _liqAtual.data_abertura.substring(0, 10) : null)
    || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
  const liqId = liqCtx.liquidacaoIdVisualizacao || route?.params?.liquidacaoId || (liqCtx.temLiquidacaoAberta ? liqCtx.liquidacaoAtual?.id : null);
  const isViz = liqCtx.modoVisualizacao || route?.params?.isVisualizacao || false;

  // DEBUG TEMPORÁRIO - REMOVER DEPOIS
  console.log('🔍 DEBUG ClientesScreen:', JSON.stringify({
    liqId: liqId || 'NULL',
    ctxAtualId: liqCtx.liquidacaoAtual?.id || 'NULL',
    ctxAtualStatus: liqCtx.liquidacaoAtual?.status || 'NULL',
    ctxTemAberta: liqCtx.temLiquidacaoAberta,
    ctxLoading: liqCtx.loadingLiquidacao,
    ctxIdViz: liqCtx.liquidacaoIdVisualizacao || 'NULL',
    vendedorRotaId: vendedor?.rota_id || 'NULL',
  }));

  const lang = liqCtx.language || 'pt-BR';
  // Se não há liquidação aberta, força tab "todos"
  const [tab, setTab] = useState<TabAtiva>(!liqId ? 'todos' : 'liquidacao');
  const [modalLegendaVisible, setModalLegendaVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  const [raw, setRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [clientesPagosNaLiq, setClientesPagosNaLiq] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [empIdxMap, setEmpIdxMap] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<FiltroLiquidacao>('todos');
  const [ord, setOrd] = useState<OrdenacaoLiquidacao>('rota');
  const [showOrd, setShowOrd] = useState(false);

  const [todosList, setTodosList] = useState<ClienteTodos[]>([]);
  const [loadTodos, setLoadTodos] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [showFiltroTipo, setShowFiltroTipo] = useState(false);
  const [showFiltroStatus, setShowFiltroStatus] = useState(false);
  const [ocultarLiquidacao, setOcultarLiquidacao] = useState(false);

  // Reordenação de clientes
  const [ordemRotaMap, setOrdemRotaMap] = useState<Map<string, number>>(new Map());
  const [modoReordenar, setModoReordenar] = useState(false);
  const [listaReordenar, setListaReordenar] = useState<ClienteTodos[]>([]);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [popupOrdem, setPopupOrdem] = useState<{ cliente: ClienteTodos; index: number } | null>(null);
  const [popupNovaOrdem, setPopupNovaOrdem] = useState('');
  const [buscaReordenar, setBuscaReordenar] = useState('');

  // Refs das FlatLists para alphabet sidebar
  const flatListLiqRef = useRef<FlatList>(null);
  const flatListTodosRef = useRef<FlatList>(null);

  // Alphabet sidebar
  const [activeLetterLiq, setActiveLetterLiq] = useState<string | null>(null);
  const [activeLetterTodos, setActiveLetterTodos] = useState<string | null>(null);
  const alphabetTimeoutRef = useRef<any>(null);

  const getAvailableLetters = useCallback((data: { nome: string }[]) => {
    const letters = new Set<string>();
    data.forEach(item => {
      const first = item.nome.trim().charAt(0).toUpperCase();
      if (first && /[A-ZÀ-Ü]/.test(first)) letters.add(first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0));
    });
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => letters.has(l));
  }, []);

  const scrollToLetter = useCallback((
    letter: string, 
    ref: React.RefObject<FlatList>, 
    data: { nome: string }[],
    setActive: (l: string | null) => void
  ) => {
    const normalLetter = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
    const targetIndex = data.findIndex(item => {
      const first = item.nome.trim().charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
      return first >= normalLetter;
    });
    if (targetIndex >= 0 && ref.current) {
      ref.current.scrollToOffset({ offset: targetIndex * 92, animated: false });
    }
    setActive(letter);
    if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
    alphabetTimeoutRef.current = setTimeout(() => setActive(null), 1200);
  }, []);

  const AlphabetSidebar = useCallback(({ 
    data, flatRef, activeLetter, setActive 
  }: { 
    data: { nome: string }[]; 
    flatRef: React.RefObject<FlatList>; 
    activeLetter: string | null;
    setActive: (l: string | null) => void;
  }) => {
    const letters = getAvailableLetters(data);
    const sidebarRef = useRef<View>(null);
    const sidebarYRef = useRef(0);
    const letterHeightRef = useRef(0);

    return (
      <View 
        ref={sidebarRef}
        style={S.alphaBar}
        onLayout={(e) => {
          sidebarRef.current?.measureInWindow((_x, y, _w, h) => {
            sidebarYRef.current = y;
            letterHeightRef.current = h / letters.length;
          });
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          const idx = Math.floor((e.nativeEvent.pageY - sidebarYRef.current) / letterHeightRef.current);
          if (idx >= 0 && idx < letters.length) scrollToLetter(letters[idx], flatRef, data, setActive);
        }}
        onResponderMove={(e) => {
          const idx = Math.floor((e.nativeEvent.pageY - sidebarYRef.current) / letterHeightRef.current);
          if (idx >= 0 && idx < letters.length) scrollToLetter(letters[idx], flatRef, data, setActive);
        }}
        onResponderRelease={() => {
          if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
          alphabetTimeoutRef.current = setTimeout(() => setActive(null), 800);
        }}
      >
        {letters.map(l => (
          <Text key={l} style={[S.alphaLetter, activeLetter === l && S.alphaLetterActive]}>{l}</Text>
        ))}
      </View>
    );
  }, [getAvailableLetters, scrollToLetter]);
  const [empIdxTodos, setEmpIdxTodos] = useState<Record<string, number>>({});
  const [todosCount, setTodosCount] = useState<number | null>(null);

  // Estados dos Modais
  const [modalParcelasVisible, setModalParcelasVisible] = useState(false);
  const [modalPagamentoVisible, setModalPagamentoVisible] = useState(false);
  const [modalEstornoVisible, setModalEstornoVisible] = useState(false);
  const [parcelasModal, setParcelasModal] = useState<ParcelaModal[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);
  const [clienteModal, setClienteModal] = useState<{ id: string; nome: string; emprestimo_id: string; emprestimo_status?: string; saldo_emprestimo?: number } | null>(null);
  
  const [parcelaPagamento, setParcelaPagamento] = useState<ParcelaModal | null>(null);
  const [dadosPagamento, setDadosPagamento] = useState<any>(null);
  const [loadingDadosPagamento, setLoadingDadosPagamento] = useState(false);
  const [valorPagamento, setValorPagamento] = useState('');
  const [usarCredito, setUsarCredito] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO');
  const [gpsStatus, setGpsStatus] = useState<'ok' | 'erro' | 'carregando'>('carregando');
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [processando, setProcessando] = useState(false);

  // Notas
  const [modalNotaVisible, setModalNotaVisible] = useState(false);
  const [notaClienteId, setNotaClienteId] = useState<string | null>(null);
  const [notaClienteNome, setNotaClienteNome] = useState<string | null>(null);
  const [notaEmprestimoId, setNotaEmprestimoId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notasCountMap, setNotasCountMap] = useState<Map<string, number>>(new Map());
  const [modalNotasClienteVisible, setModalNotasClienteVisible] = useState(false);
  const [notasClienteId, setNotasClienteId] = useState<string | null>(null);
  const [notasClienteNome, setNotasClienteNome] = useState<string | null>(null);
  const [modalDetalhesVisible, setModalDetalhesVisible] = useState(false);
  const [detalhesCliente, setDetalhesCliente] = useState<{ id: string; nome: string; telefone?: string | null; documento?: string | null; endereco?: string | null; codigo_cliente?: string | number | null } | null>(null);

  const [parcelaEstorno, setParcelaEstorno] = useState<ParcelaModal | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');

  const t = textos[lang];

  const carregarGPS = useCallback(async () => {
    setGpsStatus('carregando');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsStatus('erro'); return; }
      
      // Tenta com precisão alta primeiro (timeout 5s)
      try {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
        setGpsStatus('ok');
        return;
      } catch {
        // Alta precisão falhou, tenta com precisão balanceada
        console.log('⚠️ GPS High falhou, tentando Balanced...');
      }
      
      // Fallback: precisão balanceada (mais rápido)
      try {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
        setGpsStatus('ok');
        return;
      } catch {
        console.log('⚠️ GPS Balanced falhou, tentando última posição conhecida...');
      }
      
      // Último recurso: última posição conhecida
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setCoords({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude, acc: lastKnown.coords.accuracy || 999 });
        setGpsStatus('ok');
      } else {
        setGpsStatus('erro');
      }
    } catch { setGpsStatus('erro'); }
  }, []);

  // Iniciar GPS ao montar a tela (não esperar abrir modal)
  const gpsInicializado = useRef(false);
  useEffect(() => {
    if (!gpsInicializado.current) {
      gpsInicializado.current = true;
      carregarGPS();
    }
    // Watch contínuo para manter coords atualizadas
    let watchSub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        watchSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 },
          (loc) => {
            setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
            setGpsStatus('ok');
          }
        );
      } catch (e) { console.log('⚠️ watchPosition falhou:', e); }
    })();
    return () => { watchSub?.remove(); };
  }, [carregarGPS]);

  // ─── REORDENAÇÃO DE CLIENTES ─────────────────────────────────────────────

  const moverItem = useCallback((fromIndex: number, toIndex: number) => {
    setListaReordenar(prev => {
      const lista = [...prev];
      const [item] = lista.splice(fromIndex, 1);
      lista.splice(toIndex, 0, item);
      return lista;
    });
  }, []);

  const moverParaPosicao = useCallback((fromIndex: number, novaPosicao: number) => {
    const toIndex = Math.max(0, Math.min(novaPosicao - 1, listaReordenar.length - 1));
    moverItem(fromIndex, toIndex);
  }, [listaReordenar.length, moverItem]);

  const cancelarReordenar = useCallback(() => {
    setModoReordenar(false);
    setListaReordenar([]);
    setBuscaReordenar('');
  }, []);

  const salvarOrdem = useCallback(async () => {
    if (!rotaId || listaReordenar.length === 0) return;
    setSalvandoOrdem(true);
    try {
      const upserts = listaReordenar.map((c, i) => ({
        rota_id: rotaId,
        cliente_id: c.id,
        ordem: i + 1,
      }));
      const { error } = await supabase
        .from('ordem_rota_cliente')
        .upsert(upserts, { onConflict: 'rota_id,cliente_id' });
      if (error) throw error;
      const m = new Map<string, number>();
      listaReordenar.forEach((c, i) => m.set(c.id, i + 1));
      setOrdemRotaMap(m);
      setModoReordenar(false);
      setListaReordenar([]);
      setBuscaReordenar('');
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar a ordem: ' + (e.message || ''));
    } finally {
      setSalvandoOrdem(false);
    }
  }, [rotaId, listaReordenar]);

  // ─────────────────────────────────────────────────────────────────────────

  const loadLiq = useCallback(async () => {
    if (!rotaId) {
      console.log('❌ loadLiq: rotaId não definido');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    console.log('🔍 loadLiq: Buscando clientes...', { rotaId, dataLiq, liqId });
    try {
      // 1. Busca clientes para a liquidação do dia via function
      // A function fn_clientes_liquidacao_dia recebe a data como parâmetro
      // para calcular corretamente dia da semana/mês:
      //   DIARIO: aparece todo dia
      //   SEMANAL: aparece se mesmo dia da semana da data de referência
      //   MENSAL/QUINZENAL/FLEXIVEL: aparece se mesmo dia do mês
      const { data, error } = await supabase
        .rpc('fn_clientes_liquidacao_dia', {
          p_rota_id: rotaId,
          p_data_referencia: dataLiq
        });
      
      if (error) throw error;
      
      let allData = ((data || []) as any[]).map(r => ({
        ...r,
        codigo_cliente: r.codigo_cliente ?? r.consecutivo ?? null,
      })) as ClienteRotaDia[];
      const existingParcelaIds = new Set(allData.map(r => r.parcela_id));

      // Enriquecer com data_emprestimo (RPC não retorna esse campo)
      const empIdsUnicos = [...new Set(allData.map(r => r.emprestimo_id).filter(Boolean))];
      if (empIdsUnicos.length > 0) {
        const { data: empsData } = await supabase
          .from('emprestimos')
          .select('id, data_emprestimo')
          .in('id', empIdsUnicos);
        if (empsData && empsData.length > 0) {
          const empDataMap = new Map((empsData as any[]).map(e => [e.id, e.data_emprestimo]));
          allData = allData.map(r => ({ ...r, data_emprestimo: empDataMap.get(r.emprestimo_id) || null }));
        }

        // Descontar crédito acumulado do saldo do empréstimo
        const creditoMap = await buscarCreditoMap(empIdsUnicos);
        if (creditoMap.size > 0) {
          allData = allData.map(r => ({
            ...r,
            saldo_emprestimo: Math.max(0, (r.saldo_emprestimo || 0) - (creditoMap.get(r.emprestimo_id) || 0)),
          }));
        }
      }
      
      // 2. Busca parcelas que foram pagas NA liquidação atual (para mostrar como "pagas")
      if (liqId) {
        console.log('🔍 Buscando parcelas pagas na liquidação:', liqId);
        
        // Busca diretamente de pagamentos_parcelas que tem todos os dados
        const { data: pagamentos, error: errPag } = await supabase
          .from('pagamentos_parcelas')
          .select('parcela_id, cliente_id, emprestimo_id, liquidacao_id, numero_parcela, valor_parcela, valor_pago_atual, valor_credito_gerado, estornado')
          .eq('liquidacao_id', liqId)
          .eq('estornado', false);
        
        console.log('📦 Pagamentos na liquidação:', { count: pagamentos?.length, error: errPag?.message });
        
        if (pagamentos && pagamentos.length > 0) {
          // Filtra parcelas que não estão na lista (view não retornou pq já estão pagas)
          const pagamentosNovos = pagamentos.filter(p => !existingParcelaIds.has(p.parcela_id));
          
          console.log('📋 Pagamentos não listados:', pagamentosNovos.length);
          
          if (pagamentosNovos.length > 0) {
            // Busca dados dos clientes
            const clienteIds = [...new Set(pagamentosNovos.map(p => p.cliente_id))];
            const { data: clientes } = await supabase
              .from('clientes')
              .select('id, nome, telefone_celular, endereco, latitude, longitude, codigo_cliente')
              .in('id', clienteIds);
            const cliMap = new Map((clientes || []).map(c => [c.id, c]));
            
            // Busca dados dos empréstimos
            const empIds = [...new Set(pagamentosNovos.map(p => p.emprestimo_id))];
            const { data: emps } = await supabase
              .from('emprestimos')
              .select('id, valor_principal, valor_saldo, numero_parcelas, status, frequencia_pagamento, rota_id, data_emprestimo')
              .in('id', empIds);
            const empMap = new Map((emps || []).map(e => [e.id, e]));
            
            // Busca dados das parcelas (para data_vencimento)
            const parcIds = pagamentosNovos.map(p => p.parcela_id);
            const { data: parcs } = await supabase
              .from('emprestimo_parcelas')
              .select('id, data_vencimento, status')
              .in('id', parcIds);
            const parcMap = new Map((parcs || []).map(p => [p.id, p]));
            
            // Monta os registros
            pagamentosNovos.forEach(pag => {
              const cli = cliMap.get(pag.cliente_id);
              const emp = empMap.get(pag.emprestimo_id);
              const parc = parcMap.get(pag.parcela_id);
              if (!cli || !emp) return;
              
              const pagaRow: ClienteRotaDia = {
                cliente_id: cli.id,
                nome: cli.nome,
                telefone_celular: cli.telefone_celular,
                endereco: cli.endereco,
                latitude: cli.latitude,
                longitude: cli.longitude,
                codigo_cliente: cli.codigo_cliente,
                emprestimo_id: emp.id,
                saldo_emprestimo: emp.valor_saldo,
                valor_principal: emp.valor_principal,
                numero_parcelas: emp.numero_parcelas,
                status_emprestimo: emp.status,
                rota_id: emp.rota_id,
                frequencia_pagamento: emp.frequencia_pagamento,
                parcela_id: pag.parcela_id,
                numero_parcela: pag.numero_parcela,
                valor_parcela: pag.valor_parcela,
                valor_pago_parcela: pag.valor_pago_atual,
                saldo_parcela: 0,
                status_parcela: parc?.status || 'PAGO',
                data_vencimento: parc?.data_vencimento || new Date().toISOString(),
                ordem_visita_dia: null,
                liquidacao_id: pag.liquidacao_id,
                tem_parcelas_vencidas: false,
                total_parcelas_vencidas: 0,
                valor_total_vencido: 0,
                status_dia: 'PAGO',
                permite_emprestimo_adicional: false,
                is_parcela_atrasada: false,
                data_emprestimo: (emp as any).data_emprestimo || null,
              };
              allData.push(pagaRow);
              existingParcelaIds.add(pag.parcela_id);
              console.log('✅ Adicionado cliente pago:', cli.nome, 'parcela:', pag.numero_parcela);
            });
          }
        }
      }
      
      console.log('📊 loadLiq resultado:', { 
        countOriginal: data?.length || 0,
        countTotal: allData.length,
        rotaId,
        dataLiq,
        liqId
      });
      
      setRaw(allData);
      const ids = allData.map((r: any) => r.parcela_id).filter(Boolean);
      if (ids.length > 0) {
        // Busca pagamentos NÃO estornados
        const { data: pags } = await supabase
          .from('pagamentos_parcelas')
          .select('parcela_id, cliente_id, valor_pago_atual, valor_credito_gerado, valor_parcela, data_pagamento, liquidacao_id')
          .in('parcela_id', ids)
          .eq('estornado', false);
        
        const m = new Map<string, PagamentoParcela>();
        const s = new Set<string>();
        const cliPagos = new Set<string>();
        
        (pags || []).forEach((p: any) => { 
          m.set(p.parcela_id, p); 
          if (p.valor_pago_atual >= p.valor_parcela) s.add(p.parcela_id);
          // Se o pagamento foi feito NA liquidação atual → cliente "visitado/pago"
          if (liqId && p.liquidacao_id === liqId) {
            cliPagos.add(p.cliente_id);
          }
        });
        
        // Também busca clientes pagos que NÃO estão no allData (parcelas já saíram da view)
        if (liqId) {
          const { data: todosPagLiq } = await supabase
            .from('pagamentos_parcelas')
            .select('cliente_id')
            .eq('liquidacao_id', liqId)
            .eq('estornado', false);
          (todosPagLiq || []).forEach((p: any) => cliPagos.add(p.cliente_id));
        }
        
        // Também adiciona ao pagasSet as parcelas que vieram como PAGO no allData
        allData.forEach((r: any) => {
          if (r.status_dia === 'PAGO' || r.status_parcela === 'PAGO') {
            s.add(r.parcela_id);
          }
        });
        
        console.log('📋 PagasSet:', { total: s.size, ids: Array.from(s).slice(0, 5) });
        console.log('📋 ClientesPagosNaLiq:', { total: cliPagos.size, ids: Array.from(cliPagos).slice(0, 5) });
        setPagMap(m); 
        setPagasSet(s);
        setClientesPagosNaLiq(cliPagos);
      } else { setPagMap(new Map()); setPagasSet(new Set()); setClientesPagosNaLiq(new Set()); }

      // Carregar ordem da rota para aba Liquidação
      if (rotaId) {
        const clienteIds = [...new Set(allData.map(r => r.cliente_id))];
        if (clienteIds.length > 0) {
          const { data: ordens } = await supabase
            .from('ordem_rota_cliente')
            .select('cliente_id, ordem')
            .eq('rota_id', rotaId)
            .in('cliente_id', clienteIds);
          if (ordens && ordens.length > 0) {
            const m = new Map<string, number>();
            (ordens as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
            setOrdemRotaMap(m);
          }
        }
      }
    } catch (e) { console.error('Erro loadLiq:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [rotaId, dataLiq, liqId]);

  const loadTodosClientes = useCallback(async (forceReload = false) => {
    if (!rotaId || (!forceReload && todosList.length > 0)) { setRefreshing(false); return; }
    setLoadTodos(true);
    try {
      // Query 1: Todos os empréstimos da rota com dados do cliente
      const { data: emps } = await supabase.from('emprestimos').select(`id, valor_principal, valor_saldo, valor_parcela, numero_parcelas, status, frequencia_pagamento, tipo_emprestimo, data_emprestimo, clientes!inner(id, nome, telefone_celular, status, codigo_cliente, permite_renegociacao, created_at)`).eq('rota_id', rotaId).in('status', ['ATIVO', 'VENCIDO', 'QUITADO', 'RENEGOCIADO']);
      if (!emps || emps.length === 0) { setTodosList([]); return; }

      // Query 2: Todas as parcelas dos empréstimos de uma vez
      const empIds = (emps as any[]).map(e => e.id);
      const { data: allParcs } = await supabase.from('emprestimo_parcelas').select('emprestimo_id, numero_parcela, valor_parcela, status').in('emprestimo_id', empIds);

      // Agrupa parcelas por empréstimo
      const parcMap = new Map<string, { maxParcela: number; vencidas: number; totalVencido: number }>();
      (allParcs || []).forEach((p: any) => {
        let info = parcMap.get(p.emprestimo_id);
        if (!info) { info = { maxParcela: 0, vencidas: 0, totalVencido: 0 }; parcMap.set(p.emprestimo_id, info); }
        if (p.numero_parcela > info.maxParcela) info.maxParcela = p.numero_parcela;
        if (p.status === 'VENCIDO' || p.status === 'VENCIDA') { info.vencidas++; info.totalVencido += (p.valor_parcela || 0); }
      });

      // Monta clientes
      const cliMap = new Map<string, ClienteTodos>();
      for (const e of emps as any[]) {
        const c = e.clientes; if (!c) continue;
        let cli = cliMap.get(c.id);
        if (!cli) { cli = { id: c.id, codigo_cliente: c.codigo_cliente, nome: c.nome, telefone_celular: c.telefone_celular, status: c.status, tem_atraso: false, permite_renegociacao: c.permite_renegociacao || false, cliente_created_at: c.created_at || null, emprestimos: [] }; cliMap.set(c.id, cli); }
        const info = parcMap.get(e.id) || { maxParcela: 1, vencidas: 0, totalVencido: 0 };
        if (info.vencidas > 0) cli.tem_atraso = true;
        cli.emprestimos.push({ id: e.id, valor_principal: e.valor_principal, saldo_emprestimo: e.valor_saldo, valor_parcela: e.valor_parcela, numero_parcelas: e.numero_parcelas, numero_parcela_atual: info.maxParcela, status: e.status, frequencia_pagamento: e.frequencia_pagamento, tipo_emprestimo: (e as any).tipo_emprestimo || 'NOVO', total_parcelas_vencidas: info.vencidas, valor_total_vencido: info.totalVencido, data_emprestimo: (e as any).data_emprestimo || null });
      }
      // Descontar crédito acumulado do saldo de cada empréstimo
      const empIdsTodos = (emps as any[]).map(e => e.id);
      const creditoMapTodos = await buscarCreditoMap(empIdsTodos);
      if (creditoMapTodos.size > 0) {
        Array.from(cliMap.values()).forEach(cli => {
          cli.emprestimos.forEach(emp => {
            const credito = creditoMapTodos.get(emp.id) || 0;
            if (credito > 0) emp.saldo_emprestimo = Math.max(0, emp.saldo_emprestimo - credito);
          });
        });
      }
      setTodosList(Array.from(cliMap.values()));

      // Carregar ordem da rota
      if (rotaId) {
        const clienteIds = Array.from(cliMap.keys());
        const { data: ordens } = await supabase
          .from('ordem_rota_cliente')
          .select('cliente_id, ordem')
          .eq('rota_id', rotaId)
          .in('cliente_id', clienteIds);
        if (ordens && ordens.length > 0) {
          const m = new Map<string, number>();
          (ordens as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
          setOrdemRotaMap(m);
        }
      }
    } catch (e) { console.error('Erro loadTodos:', e); }
    finally { setLoadTodos(false); setRefreshing(false); }
  }, [rotaId, todosList.length]);

  useEffect(() => { loadLiq(); }, [loadLiq]);
  useEffect(() => { if (tab === 'todos') loadTodosClientes(); }, [tab, loadTodosClientes]);

  // Buscar contagem de notas por cliente quando lista muda
  useEffect(() => {
    const ids = new Set<string>();
    raw.forEach(r => ids.add(r.cliente_id));
    todosList.forEach(c => ids.add(c.id));
    if (ids.size === 0) return;
    buscarNotasCountPorClientes(Array.from(ids), vendedor?.id).then(setNotasCountMap);
  }, [raw.length, todosList.length]);
  
  // Quando o contexto carrega a liquidação aberta, ativar aba liquidação
  useEffect(() => {
    if (liqCtx.temLiquidacaoAberta && liqCtx.liquidacaoAtual?.id && tab === 'todos') {
      setTab('liquidacao');
    }
  }, [liqCtx.temLiquidacaoAberta, liqCtx.liquidacaoAtual?.id]);
  
  // Contagem rápida de clientes para exibir no tab "Todos" antes de carregar
  useEffect(() => {
    if (!rotaId || todosCount !== null) return;
    (async () => {
      try {
        const { count } = await supabase
          .from('emprestimos')
          .select('cliente_id', { count: 'exact', head: true })
          .eq('rota_id', rotaId)
          .in('status', ['ATIVO', 'VENCIDO', 'QUITADO']);
        setTodosCount(count || 0);
      } catch { }
    })();
  }, [rotaId, todosCount]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (tab === 'liquidacao') loadLiq();
    else { setTodosList([]); loadTodosClientes(true); }
  }, [tab, loadLiq, loadTodosClientes]);

  const abrirParcelas = useCallback(async (clienteId: string, clienteNome: string, emprestimoId: string, empStatus?: string) => {
    // Buscar status do empréstimo se não informado
    let statusFinal = empStatus;
    if (!statusFinal) {
      const { data: empData } = await supabase.from('emprestimos').select('status').eq('id', emprestimoId).single();
      statusFinal = empData?.status;
    }
    setClienteModal({ id: clienteId, nome: clienteNome, emprestimo_id: emprestimoId, emprestimo_status: statusFinal });
    setModalParcelasVisible(true);
    setLoadingParcelas(true);
    setParcelasModal([]);
    setCreditoDisponivel(0);
    try {
      const { data: parcelas, error: errP } = await supabase.from('emprestimo_parcelas').select('id, emprestimo_id, numero_parcela, valor_parcela, valor_pago, valor_saldo, valor_multa, data_vencimento, data_pagamento, status, saldo_excedente, liquidacao_id, observacoes, ordem_visita_dia').eq('emprestimo_id', emprestimoId).order('numero_parcela', { ascending: true });
      if (errP) throw errP;
      if (!parcelas || parcelas.length === 0) { setParcelasModal([]); setLoadingParcelas(false); return; }
      const ids = parcelas.map((p: any) => p.id);
      
      // Busca pagamentos com liquidacao_id (tabela pagamentos_parcelas tem tudo)
      const { data: pagamentos } = await supabase
        .from('pagamentos_parcelas')
        .select('parcela_id, valor_pago_atual, valor_credito_gerado, liquidacao_id, estornado')
        .in('parcela_id', ids)
        .eq('estornado', false);
      
      const pMap = new Map<string, { valorPago: number; creditoGerado: number; liquidacaoId: string | null }>();
      (pagamentos || []).forEach((p: any) => { 
        pMap.set(p.parcela_id, { 
          valorPago: p.valor_pago_atual || 0, 
          creditoGerado: p.valor_credito_gerado || 0, 
          liquidacaoId: p.liquidacao_id 
        }); 
      });
      
      // Buscar datas das liquidações referenciadas
      const liqIds = [...new Set([
        ...parcelas.filter((p: any) => p.liquidacao_id).map((p: any) => p.liquidacao_id),
        ...(pagamentos || []).filter((p: any) => p.liquidacao_id).map((p: any) => p.liquidacao_id)
      ])].filter(Boolean);
      
      const liqDataMap = new Map<string, string>();
      if (liqIds.length > 0) {
        const { data: liqDatas } = await supabase
          .from('liquidacoes_diarias')
          .select('id, data_abertura, data_liquidacao')
          .in('id', liqIds);
        (liqDatas || []).forEach((l: any) => {
          // Prefere data_liquidacao (DATE puro), fallback para data_abertura.substring(0,10)
          const dl = l.data_liquidacao?.substring(0, 10) || l.data_abertura?.substring(0, 10);
          liqDataMap.set(l.id, dl);
        });
      }
      
      // Crédito disponível = soma dos saldo_excedente reais das parcelas (não do histórico de geração)
      const creditoTotal = (parcelas || []).reduce((sum: number, p: any) => sum + (p.saldo_excedente || 0), 0);
      setCreditoDisponivel(creditoTotal);
      setParcelasModal(parcelas.map((p: any) => { 
        const pag = pMap.get(p.id); 
        const vPago = p.valor_pago || 0;
        const vSaldo = p.valor_saldo || 0;
        const creditoGerado = pag?.creditoGerado || 0;
        const liqPag = pag?.liquidacaoId || p.liquidacao_id || null;
        const dataLiquidacao = liqPag ? (liqDataMap.get(liqPag) || null) : null;
        return { 
          parcela_id: p.id, 
          numero_parcela: p.numero_parcela, 
          data_vencimento: p.data_vencimento, 
          valor_parcela: p.valor_parcela, 
          status: p.status, 
          data_pagamento: p.data_pagamento, 
          valor_multa: p.valor_multa || 0, 
          valor_pago: vPago, 
          valor_saldo: vSaldo,
          credito_gerado: creditoGerado,
          saldo_excedente: p.saldo_excedente || 0,
          liquidacao_id: liqPag,
          data_liquidacao: dataLiquidacao,
          observacoes: p.observacoes || null
        }; 
      }));
    } catch (e) { console.error('Erro parcelas:', e); Alert.alert(t.erroGenerico, t.erroCarregarParcelas); }
    finally { setLoadingParcelas(false); }
  }, []);

  // FUNÇÃO ATUALIZADA - Busca dados completos via RPC antes de abrir modal
  const abrirPagamento = useCallback(async (parcela: ParcelaModal, clienteInfo?: { id: string; nome: string; emprestimo_id: string; saldo_emprestimo?: number; emprestimo_status?: string }) => {
    if (!liqId && !isViz) { Alert.alert(t.atencao, t.liquidacaoNecessaria); return; }
    
    // Atualizar clienteModal se info do cliente foi passada (evita dados stale do cliente anterior)
    if (clienteInfo) {
      setClienteModal({ 
        id: clienteInfo.id, nome: clienteInfo.nome, emprestimo_id: clienteInfo.emprestimo_id, 
        saldo_emprestimo: clienteInfo.saldo_emprestimo, emprestimo_status: clienteInfo.emprestimo_status 
      });
    }
    
    setParcelaPagamento(parcela);
    setDadosPagamento(null);
    setLoadingDadosPagamento(true);
    setUsarCredito(false);
    setFormaPagamento('DINHEIRO');
    setModalPagamentoVisible(true);
    // GPS já roda em background via watchPosition, mas força refresh rápido
    if (gpsStatus !== 'ok') carregarGPS();
    
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
    if (!clienteModal) {
      Alert.alert(t.erroGenerico, t.dadosClienteIndisponiveis);
      return;
    }
    
    console.log('🔄 irParaProximaParcela - buscando para emprestimo:', clienteModal.emprestimo_id);
    setLoadingDadosPagamento(true);
    
    try {
      const { data, error } = await supabase.rpc('fn_buscar_proxima_parcela_a_pagar', { p_emprestimo_id: clienteModal.emprestimo_id });
      console.log('📦 Resposta fn_buscar_proxima_parcela_a_pagar:', { data, error });
      
      if (error) throw error;
      const proxima = Array.isArray(data) ? data[0] : data;
      console.log('📦 Próxima parcela:', proxima);
      
      if (proxima && proxima.parcela_id) {
        // A function retorna valor_saldo (não valor_saldo_parcela)
        const valorSaldo = proxima.valor_saldo || proxima.valor_parcela;
        console.log('💰 Valor saldo da parcela:', valorSaldo);
        
        const novaParcela: ParcelaModal = {
          parcela_id: proxima.parcela_id, 
          numero_parcela: proxima.numero_parcela,
          data_vencimento: proxima.data_vencimento, 
          valor_parcela: proxima.valor_parcela,
          status: proxima.status, 
          data_pagamento: null, 
          valor_multa: proxima.valor_multa || 0,
          valor_pago: proxima.valor_pago || 0,
        };
        
        console.log('📝 Nova parcela a exibir:', novaParcela);
        setParcelaPagamento(novaParcela);
        
        // Busca dados completos via fn_consultar_parcela_para_pagamento
        const { data: dadosNova, error: errConsulta } = await supabase.rpc('fn_consultar_parcela_para_pagamento', { p_parcela_id: proxima.parcela_id });
        console.log('📋 Resposta fn_consultar_parcela_para_pagamento:', { dadosNova, errConsulta });
        
        const dados = Array.isArray(dadosNova) ? dadosNova[0] : dadosNova;
        console.log('📋 Dados processados:', dados);
        
        if (dados) {
          setDadosPagamento(dados);
          // Usa valor_saldo_parcela se disponível, senão valor_saldo da fn_buscar
          const valorAPagar = dados.valor_saldo_parcela || valorSaldo;
          setValorPagamento(valorAPagar.toFixed(2).replace('.', ','));
          console.log('✅ Modal atualizado! Parcela:', dados.numero_parcela, 'Valor:', valorAPagar);
        } else {
          // Fallback se fn_consultar não retornar dados
          setValorPagamento(valorSaldo.toFixed(2).replace('.', ','));
          console.log('⚠️ Usando fallback - Valor:', valorSaldo);
        }
      } else {
        console.log('⚠️ Nenhuma parcela pendente encontrada');
        Alert.alert(t.aviso, proxima?.mensagem_status || t.nenhumaParcela);
      }
    } catch (e: any) { 
      console.error('❌ Erro ao buscar próxima parcela:', e); 
      Alert.alert(t.erroGenerico, e.message || t.erroBuscarParcela);
    }
    finally { setLoadingDadosPagamento(false); }
  }, [clienteModal]);

  // FUNÇÃO ATUALIZADA - Registra pagamento com suporte a crédito
  const registrarPagamento = useCallback(async () => {
    if (!parcelaPagamento || processando) return;
    if (dadosPagamento && !dadosPagamento.permite_pagamento) {
      Alert.alert(t.atencao, dadosPagamento.mensagem_bloqueio || t.pagamentoNaoPermitido);
      return;
    }
    const valorNum = parseFloat(valorPagamento.replace(',', '.'));
    if (isNaN(valorNum) || valorNum < 0) { showAlert(t.erroGenerico, t.valorInvalido); return; }
    
    // Calcula crédito a usar: no máximo o disponível, mas limitado ao saldo da parcela
    let valorCredito = 0;
    if (usarCredito && dadosPagamento?.credito_disponivel > 0) {
      const valorSaldoParcela = dadosPagamento.valor_saldo_parcela || parcelaPagamento.valor_parcela;
      valorCredito = Math.min(dadosPagamento.credito_disponivel, valorSaldoParcela);
    }
    
    // Validação: pelo menos um valor deve ser informado (dinheiro OU crédito)
    if (valorNum === 0 && valorCredito === 0) {
      showAlert(t.erroGenerico, t.informeValor);
      return;
    }
    
    // ⭐ Verificar se este pagamento vai quitar o empréstimo
    const saldoEmp = clienteModal?.saldo_emprestimo ?? 0;
    const totalPagando = valorNum + valorCredito;
    const vaiQuitar = saldoEmp > 0 && totalPagando >= saldoEmp;
    
    const executarPagamento = async () => {
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
          p_liquidacao_id: liqId || null,
          p_user_id: vendedor?.user_id || null
        });
        if (error) throw error;
        const res = Array.isArray(data) ? data[0] : data;
        if (res?.sucesso) {
          setModalPagamentoVisible(false);
          setModalParcelasVisible(false);
          setParcelaPagamento(null);
          setDadosPagamento(null);
          setUsarCredito(false);
          setClienteModal(null);
          loadLiq();
          showAlert(t.sucessoGenerico || 'Sucesso', res.mensagem || t.sucesso);
        } else { showAlert(t.erroGenerico, res?.mensagem || t.erro); }
      } catch (e: any) { console.error('Erro pagamento:', e); showAlert(t.erroGenerico, e.message || t.erro); }
      finally { setProcessando(false); }
    };
    
    // Se vai quitar, pedir confirmação
    if (vaiQuitar) {
      const msgQuitar = t.confirmarQuitacao || 
        `Este pagamento irá QUITAR o empréstimo.\n\nSaldo: ${fmt(saldoEmp)}\nPagando: ${fmt(totalPagando)}\n\nTodas as parcelas restantes serão marcadas como pagas.\n\n⚠️ Esta ação é irreversível.`;
      
      if (Platform.OS === 'web') {
        if (window.confirm(msgQuitar)) executarPagamento();
      } else {
        Alert.alert(
          t.atencaoQuitacao || '⚠️ Quitação de Empréstimo',
          msgQuitar,
          [
            { text: t.cancelar || 'Cancelar', style: 'cancel' },
            { text: t.confirmarQuitar || 'Sim, Quitar', style: 'destructive', onPress: executarPagamento }
          ]
        );
      }
    } else {
      executarPagamento();
    }
  }, [parcelaPagamento, dadosPagamento, valorPagamento, usarCredito, formaPagamento, coords, liqId, t, clienteModal, abrirParcelas, loadLiq, processando]);

  const abrirEstorno = useCallback((parcela: ParcelaModal) => {
    if (!liqId) { Alert.alert(t.atencao, t.liquidacaoNecessaria); return; }
    setParcelaEstorno(parcela);
    setMotivoEstorno('');
    setModalEstornoVisible(true);
  }, [liqId, t]);

  const confirmarEstorno = useCallback(async () => {
    if (!parcelaEstorno || !motivoEstorno.trim() || processando) return;
    
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_estornar_pagamento', { 
        p_parcela_id: parcelaEstorno.parcela_id, 
        p_motivo: motivoEstorno.trim(),
        p_vendedor_id: vendedor?.id  // Passa o ID do vendedor logado
      });
      
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      
      if (res?.sucesso) {
        setModalEstornoVisible(false);
        setParcelaEstorno(null);
        // Usa a mensagem retornada pela function que já inclui o nome do responsável
        Alert.alert(t.sucessoGenerico, res.mensagem || t.estornoSucesso);
        if (clienteModal) abrirParcelas(clienteModal.id, clienteModal.nome, clienteModal.emprestimo_id);
        loadLiq();
      } else { 
        setModalEstornoVisible(false);
        Alert.alert(t.erroGenerico, res?.mensagem || t.estornoErro); 
      }
    } catch (e: any) { 
      console.error('Erro estorno:', e); 
      Alert.alert(t.erroGenerico, e.message || t.estornoErro); 
    }
    finally { setProcessando(false); }
  }, [parcelaEstorno, motivoEstorno, vendedor, t, clienteModal, abrirParcelas, loadLiq, processando]);

  const grouped = useMemo((): ClienteAgrupado[] => {
    const m = new Map<string, ClienteAgrupado>();
    raw.forEach(r => {
      let g = m.get(r.cliente_id);
      if (!g) { g = { cliente_id: r.cliente_id, codigo_cliente: r.codigo_cliente, nome: r.nome, telefone_celular: r.telefone_celular, endereco: r.endereco, latitude: r.latitude, longitude: r.longitude, rota_id: r.rota_id, emprestimos: [], qtd_emprestimos: 0, tem_multiplos_vencimentos: false }; m.set(r.cliente_id, g); }
      
      // Verifica se já existe uma entrada para este empréstimo
      const existente = g.emprestimos.find(e => e.emprestimo_id === r.emprestimo_id);
      
      if (existente) {
        // Mesmo empréstimo — prefere parcela PENDENTE sobre PAGO
        const pi = pagMap.get(r.parcela_id);
        const rPago = isPaga(r.parcela_id, r.status_dia, pagasSet);
        const existentePago = isPaga(existente.parcela_id, existente.status_dia, pagasSet);
        
        // Substitui se a existente é paga e esta é pendente, ou se esta tem menor número de parcela e ambas são pendentes
        if ((existentePago && !rPago) || (!existentePago && !rPago && r.numero_parcela < existente.numero_parcela)) {
          Object.assign(existente, {
            parcela_id: r.parcela_id, numero_parcela: r.numero_parcela,
            valor_parcela: r.valor_parcela, valor_pago_parcela: r.valor_pago_parcela,
            saldo_parcela: r.saldo_parcela, status_parcela: r.status_parcela,
            data_vencimento: r.data_vencimento, ordem_visita_dia: r.ordem_visita_dia,
            tem_parcelas_vencidas: r.tem_parcelas_vencidas,
            total_parcelas_vencidas: r.total_parcelas_vencidas,
            valor_total_vencido: r.valor_total_vencido,
            status_dia: r.status_dia, is_parcela_atrasada: r.is_parcela_atrasada,
            saldo_emprestimo: r.saldo_emprestimo,
            pagamento_info: pi ? { valorPago: pi.valor_pago_atual, creditoGerado: pi.valor_credito_gerado, valorParcela: pi.valor_parcela } : undefined,
          });
        }
        // Acumula atrasadas
        if (r.tem_parcelas_vencidas && r.total_parcelas_vencidas > existente.total_parcelas_vencidas) {
          existente.tem_parcelas_vencidas = r.tem_parcelas_vencidas;
          existente.total_parcelas_vencidas = r.total_parcelas_vencidas;
          existente.valor_total_vencido = r.valor_total_vencido;
        }
      } else {
        // Novo empréstimo para este cliente
        const pi = pagMap.get(r.parcela_id);
        g.emprestimos.push({ emprestimo_id: r.emprestimo_id, saldo_emprestimo: r.saldo_emprestimo, valor_principal: r.valor_principal, numero_parcelas: r.numero_parcelas, status_emprestimo: r.status_emprestimo, frequencia_pagamento: r.frequencia_pagamento, parcela_id: r.parcela_id, numero_parcela: r.numero_parcela, valor_parcela: r.valor_parcela, valor_pago_parcela: r.valor_pago_parcela, saldo_parcela: r.saldo_parcela, status_parcela: r.status_parcela, data_vencimento: r.data_vencimento, ordem_visita_dia: r.ordem_visita_dia, tem_parcelas_vencidas: r.tem_parcelas_vencidas, total_parcelas_vencidas: r.total_parcelas_vencidas, valor_total_vencido: r.valor_total_vencido, status_dia: r.status_dia, is_parcela_atrasada: r.is_parcela_atrasada, pagamento_info: pi ? { valorPago: pi.valor_pago_atual, creditoGerado: pi.valor_credito_gerado, valorParcela: pi.valor_parcela } : undefined, data_emprestimo: (r as any).data_emprestimo || null });
      }
    });
    m.forEach(g => { g.qtd_emprestimos = g.emprestimos.length; g.tem_multiplos_vencimentos = g.emprestimos.length > 1; });
    return Array.from(m.values());
  }, [raw, pagMap, pagasSet]);

  // Cliente é considerado "pago/visitado" se recebeu QUALQUER pagamento na liquidação atual
  // Regra de negócio: vendedor visitou, cobrou (mesmo parcial/atrasada) → sai da lista
  const isCliPago = useCallback((c: ClienteAgrupado) => clientesPagosNaLiq.has(c.cliente_id), [clientesPagosNaLiq]);

  const filtered = useMemo(() => {
    let r = [...grouped];
    if (busca.trim()) { const b = busca.toLowerCase().trim(); r = r.filter(c => c.nome.toLowerCase().includes(b) || (c.telefone_celular && c.telefone_celular.includes(b)) || (c.endereco && c.endereco.toLowerCase().includes(b))); }
    if (filtro === 'atrasados') r = r.filter(c => !isCliPago(c) && c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas));
    else if (filtro === 'pagas') r = r.filter(c => isCliPago(c));
    else r = r.filter(c => !isCliPago(c)); // 'todos' mostra apenas pendentes (não pagos)
    r.sort(ord === 'rota'
      ? (a, b) => {
          const oa = ordemRotaMap.get(a.cliente_id) ?? 9999;
          const ob = ordemRotaMap.get(b.cliente_id) ?? 9999;
          if (oa !== ob) return oa - ob;
          return a.nome.localeCompare(b.nome);
        }
      : (a, b) => a.nome.localeCompare(b.nome));
    return r;
  }, [grouped, busca, filtro, ord, isCliPago, ordemRotaMap]);

  const cntTotal = grouped.filter(c => !isCliPago(c)).length;
  const cntAtraso = grouped.filter(c => c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas)).length;
  const cntPagas = grouped.filter(c => isCliPago(c)).length;
  const clientesLiqIds = useMemo(() => new Set(grouped.map(c => c.cliente_id)), [grouped]);
  const eIdx = (cid: string) => empIdxMap[cid] || 0;
  const eSet = (cid: string, i: number) => setEmpIdxMap(p => ({ ...p, [cid]: i }));
  const eAtual = (c: ClienteAgrupado) => c.emprestimos[Math.min(eIdx(c.cliente_id), c.emprestimos.length - 1)];

  const renderParcelaItem = (p: ParcelaModal) => {
    const isPago = p.status === 'PAGO';
    const isParcial = p.status === 'PARCIAL';
    const isVencida = p.status === 'VENCIDO' || p.status === 'VENCIDA';
    const isCancelado = p.status === 'CANCELADO';
    const isAutoQuitacao = (p.observacoes || '').includes('[AUTO-QUITAÇÃO]');
    const isQuitacaoOrigem = isPago && (p.credito_gerado || 0) > 0 && clienteModal?.emprestimo_status === 'QUITADO';
    
    const iconColor = isPago ? '#10B981' : isParcial ? '#F59E0B' : isCancelado ? '#9CA3AF' : isVencida ? '#EF4444' : '#6B7280';
    const iconBg = isPago ? '#D1FAE5' : isParcial ? '#FEF3C7' : isCancelado ? '#F3F4F6' : isVencida ? '#FEE2E2' : '#F3F4F6';
    const statusColor = isPago ? '#10B981' : isParcial ? '#D97706' : isCancelado ? '#9CA3AF' : isVencida ? '#EF4444' : '#F97316';
    const statusBg = isPago ? '#D1FAE5' : isParcial ? '#FEF3C7' : isCancelado ? '#F3F4F6' : isVencida ? '#FEE2E2' : '#FFEDD5';
    const statusText = isPago ? t.pagoStatus : isParcial ? t.parcialStatus : isCancelado ? 'CANCELADO' : isVencida ? t.vencidaStatus : t.pendente;
    
    const valorPago = p.valor_pago || 0;
    const valorSaldo = p.valor_saldo ?? (p.valor_parcela - valorPago);
    const temPagamentoParcial = !isPago && valorPago > 0;
    
    return (
      <View key={p.parcela_id} style={[S.mParcela, { borderLeftColor: iconColor }]}>
        <View style={S.mParcelaRow}>
          {/* Lado esquerdo: ícone + info + valores */}
          <View style={[S.mParcelaIcon, { backgroundColor: iconBg }]}>
            <Text style={{ color: iconColor, fontSize: 14 }}>
              {isPago ? '✓' : temPagamentoParcial ? '◐' : isParcial ? '◐' : '📅'}
            </Text>
          </View>
          <View style={S.mParcelaInfo}>
            {/* Linha 1: Parcela X + badge status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={S.mParcelaNum}>{t.parcela} {p.numero_parcela}</Text>
              <View style={[S.mParcelaStatus, { backgroundColor: statusBg }]}>
                <Text style={[S.mParcelaStatusTx, { color: statusColor }]}>{statusText}</Text>
              </View>
            </View>
            {/* Linha 2: Datas */}
            <View style={{ marginTop: 3 }}>
              <Text style={S.mParcelaVenc}>📅 {t.venc} {fmtData(p.data_vencimento)}</Text>
              {p.data_pagamento && (
                <Text style={[S.mParcelaDataPg, { marginTop: 1 }]}>💰 {t.em} {fmtData(p.data_pagamento)}</Text>
              )}
              {p.data_liquidacao && (
                <Text style={[S.mParcelaDataPg, { marginTop: 1, color: '#6366F1' }]}>📋 {t.liq} {fmtData(p.data_liquidacao)}</Text>
              )}
            </View>
            
            {/* PAGO: valor pago + original + crédito + indicador quitação */}
            {isPago && (
              <View style={{ marginTop: 2 }}>
                {/* Badge quitação antecipada (parcela que originou) */}
                {isQuitacaoOrigem && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>⚡ {t.quitacaoAntecipada}</Text>
                  </View>
                )}
                {/* Badge auto-quitação */}
                {isAutoQuitacao && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600' }}>🔄 {t.quitadoPorCredito}</Text>
                  </View>
                )}
                {valorPago !== p.valor_parcela ? (
                  <>
                    <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                    <Text style={S.mParcelaOriginal}>{t.original} {fmt(p.valor_parcela)}</Text>
                  </>
                ) : (
                  <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                )}
                {(p.credito_gerado || 0) > 0 && !isAutoQuitacao && (
                  <Text style={S.mParcelaCredito}>{t.credito} {fmt(p.credito_gerado || 0)}</Text>
                )}
                {(p.saldo_excedente || 0) > 0 && (p.credito_gerado || 0) === 0 && !isAutoQuitacao && (
                  <Text style={S.mParcelaCredito}>{t.credito} {fmt(p.saldo_excedente || 0)}</Text>
                )}
              </View>
            )}
            
            {/* PARCIAL / VENCIDA com pagamento parcial */}
            {temPagamentoParcial && (
              <View style={{ marginTop: 2 }}>
                <Text style={S.mParcelaPago}>{t.pago} {fmt(valorPago)}</Text>
                <Text style={S.mParcelaRestante}>{t.restante} {fmt(valorSaldo)}</Text>
              </View>
            )}
            
            {/* SEM PAGAMENTO: só valor */}
            {!isPago && !temPagamentoParcial && (
              <Text style={S.mParcelaValor}>{fmt(p.valor_parcela)}</Text>
            )}
          </View>
          {/* Lado direito: botões */}
          <View style={S.mParcelaBtns}>
            {!isPago && p.parcela_id && !['RENEGOCIADO', 'QUITADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && p.status !== 'CANCELADO' && (
              <TouchableOpacity 
                style={[S.mBtnPagar, (!liqId || isViz) && S.mBtnPagarDisabled]} 
                onPress={() => abrirPagamento(p)} 
                disabled={!liqId || isViz}
              >
                <Text style={S.mBtnPagarIcon}>💰</Text>
                <Text style={S.mBtnPagarTx}>{t.pagar}</Text>
              </TouchableOpacity>
            )}
            {/* Estorno: PAGO ou qualquer parcela com pagamento (parcial) na liquidação atual */}
            {/* Não permite estorno se empréstimo foi quitado (auto-quitação) */}
            {(isPago || valorPago > 0) && p.parcela_id && liqId && !isViz && p.liquidacao_id === liqId && !['QUITADO', 'RENEGOCIADO', 'CANCELADO'].includes(clienteModal?.emprestimo_status || '') && (
              <TouchableOpacity style={S.mBtnEstornar} onPress={() => abrirEstorno(p)}>
                <Text style={S.mBtnEstornarIcon}>↩</Text>
                <Text style={S.mBtnEstornarTx}>{t.estornar}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderCard = (c: ClienteAgrupado) => {
    const e = eAtual(c); const ex = expanded === c.cliente_id; const ei = eIdx(c.cliente_id);
    const pg = isPaga(e.parcela_id, e.status_dia, pagasSet); const bc = borderOf(e, pg); const bg = bgOf(e, pg);
    const pi = e.pagamento_info;
    const valorAPagar = e.valor_pago_parcela > 0 && !pg ? e.saldo_parcela : e.valor_parcela;
    const notasCli = notasCountMap.get(c.cliente_id) || 0;
    return (
      <TouchableOpacity key={c.cliente_id} activeOpacity={0.7} 
        onPress={() => setExpanded(p => p === c.cliente_id ? null : c.cliente_id)} 
        style={[S.card, { borderLeftColor: bc, backgroundColor: bg }]}>
        {/* === LINHA 1: Avatar + Nome + Badges === */}
        <View style={S.cardRow}>
          <View style={[S.av, { backgroundColor: pg ? '#10B981' : e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 ? '#EF4444' : '#3B82F6' }]}>
            <Text style={S.avTx}>{getIni(c.nome)}</Text>
          </View>
          <View style={S.cardInfo}>
            <View style={S.nameRow}>
              <Text style={S.nome} numberOfLines={1}>{c.nome}</Text>
              {e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 && (
                <View style={S.bWarnNew}><Text style={S.bWarnNewI}>⚠</Text><Text style={S.bWarnNewT}>{e.total_parcelas_vencidas}</Text></View>
              )}
            </View>
            <Text style={S.sub} numberOfLines={1}>
              {c.telefone_celular ? `📞 ${fmtTel(c.telefone_celular)}` : ''}{c.telefone_celular && c.endereco ? '  ◦  ' : ''}{c.endereco ? `📍 ${c.endereco}` : ''}
            </Text>
          </View>
        </View>

        {/* === LINHA 2: Parcela + Frequência + Valor === */}
        <View style={S.pRow}>
          <View>
            <View style={S.pLblR}>
              <Text style={S.pLbl}>{t.parcela} {e.numero_parcela}/{e.numero_parcelas}</Text>
              <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[lang][e.frequencia_pagamento] || e.frequencia_pagamento}</Text></View>
            </View>
            {e.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(e.data_emprestimo)}</Text> : null}
          </View>
          <View style={S.sCol}>
            {pg && pi ? (
              <Text style={[S.pValBig, { color: '#10B981' }]}>{fmt(pi.valorPago)}</Text>
            ) : (
              <Text style={S.pValBig}>{fmt(valorAPagar)}</Text>
            )}
            <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(e.saldo_emprestimo)}</Text>
          </View>
        </View>

        {/* === EXPANDIDO (1 clique) === */}
        {ex && (
          <View style={S.exp}>
            {/* Pagar (flex) + Parcelas + Notas na mesma linha */}
            <View style={S.expActRow}>
              <TouchableOpacity 
                style={[S.btPagarGrande, (pg || !liqId || isViz) && S.btPagarDisabled]}
                onPress={() => { 
                  if (liqId && !isViz && !pg) abrirPagamento(
                    { parcela_id: e.parcela_id, numero_parcela: e.numero_parcela, data_vencimento: e.data_vencimento, valor_parcela: e.valor_parcela, status: e.status_parcela, data_pagamento: null, valor_multa: 0, valor_pago: e.valor_pago_parcela || 0, valor_saldo: e.saldo_parcela || e.valor_parcela },
                    { id: c.cliente_id, nome: c.nome, emprestimo_id: e.emprestimo_id, saldo_emprestimo: e.saldo_emprestimo, emprestimo_status: e.status_emprestimo }
                  ); 
                }} 
                disabled={pg || !liqId || isViz}
              >
                <Text style={S.btPagarIcon}>$</Text>
                <Text style={S.btPagarText}>{t.pagar}</Text>
                {!pg && <View style={S.btPagarValor}><Text style={S.btPagarValorText}>${Math.round(valorAPagar)}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={S.btSecVerde} onPress={() => abrirParcelas(c.cliente_id, c.nome, e.emprestimo_id)}>
                <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>☰</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={S.btSecAmarelo} onPress={() => { setNotasClienteId(c.cliente_id); setNotasClienteNome(c.nome); setModalNotasClienteVisible(true); }}>
                <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>✎</Text></View>
                {notasCli > 0 && <View style={S.btSecBadge}><Text style={S.btSecBadgeT}>{notasCli}</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Link para detalhes */}
            <TouchableOpacity style={S.linkDetalhes} onPress={() => {
              setDetalhesCliente({ id: c.cliente_id, nome: c.nome, telefone: c.telefone_celular, endereco: c.endereco, codigo_cliente: c.codigo_cliente });
              setModalDetalhesVisible(true);
            }}>
              <Text style={S.linkDetalhesTx}>{t.toqueDetalhes} ▽</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const todosFilt = useMemo(() => {
    let r = [...todosList];
    // Ocultar clientes da liquidação atual
    if (ocultarLiquidacao && clientesLiqIds.size > 0) { r = r.filter(c => !clientesLiqIds.has(c.id)); }
    // Busca por texto
    if (busca.trim()) { const b = busca.toLowerCase().trim(); r = r.filter(c => c.nome.toLowerCase().includes(b) || (c.telefone_celular && c.telefone_celular.includes(b))); }
    // Filtro por tipo de empréstimo
    if (filtroTipo !== 'todos') { r = r.filter(c => c.emprestimos.some(e => e.tipo_emprestimo === filtroTipo)); }
    // Filtro por status do empréstimo
    if (filtroStatus !== 'todos') { r = r.filter(c => c.emprestimos.some(e => e.status === filtroStatus)); }
    // Ordenação: por ordem da rota se disponível, senão A-Z
    r.sort((a, b) => {
      const oa = ordemRotaMap.get(a.id) ?? 9999;
      const ob = ordemRotaMap.get(b.id) ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.nome.localeCompare(b.nome);
    });
    return r;
  }, [todosList, busca, filtroTipo, filtroStatus, ocultarLiquidacao, clientesLiqIds, ordemRotaMap]);

  const renderTodos = (c: ClienteTodos) => {
    const a = c.tem_atraso; 
    const ei = empIdxTodos[c.id] || 0;
    const emp = c.emprestimos[Math.min(ei, c.emprestimos.length - 1)];
    const vencidas = emp?.total_parcelas_vencidas || 0;
    const cor = a ? corAtraso(vencidas) : '#D1D5DB';
    const ex = expandedTodos === c.id;
    const notasCli = notasCountMap.get(c.id) || 0;
    return (
      <TouchableOpacity key={c.id} activeOpacity={0.7} 
        onPress={() => { if (!modoReordenar) setExpandedTodos(p => p === c.id ? null : c.id); }} 
        onPressIn={() => {
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            const lista = [...todosList].sort((a, b) => {
              const oa = ordemRotaMap.get(a.id) ?? 9999;
              const ob = ordemRotaMap.get(b.id) ?? 9999;
              if (oa !== ob) return oa - ob;
              return a.nome.localeCompare(b.nome);
            });
            setListaReordenar(lista);
            setModoReordenar(true);
          }, 600);
        }}
        onPressOut={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
        style={[S.card, { borderLeftColor: cor }]}>

        {/* === LINHA 1: Avatar + Nome + Badges === */}
        <View style={S.cardRow}>
          <View style={[S.av, { backgroundColor: a ? '#EF4444' : '#64748B' }]}>
            <Text style={S.avTx}>{getIni(c.nome)}</Text>
          </View>
          <View style={S.cardInfo}>
            <View style={S.nameRow}>
              <Text style={S.nome} numberOfLines={1}>{c.nome}</Text>
              {vencidas > 0 && <View style={S.bWarnNew}><Text style={S.bWarnNewI}>⚠</Text><Text style={S.bWarnNewT}>{vencidas}</Text></View>}
            </View>
            {c.telefone_celular && <Text style={S.sub} numberOfLines={1}>📞 {fmtTel(c.telefone_celular)}</Text>}
          </View>
        </View>

        {/* === LINHA 2: Info empréstimo === */}
        {emp && (
          <View style={S.pRow}>
            <View>
              <View style={S.pLblR}>
                <Text style={S.pLbl}>{t.parcela} {emp.numero_parcela_atual}/{emp.numero_parcelas}</Text>
                <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[lang][emp.frequencia_pagamento] || emp.frequencia_pagamento}</Text></View>
              </View>
              {emp.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(emp.data_emprestimo)}</Text> : null}
            </View>
            <View style={S.sCol}>
              <Text style={S.pValBig}>{fmt(emp.valor_parcela)}</Text>
              <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(emp.saldo_emprestimo)}</Text>
            </View>
          </View>
        )}

        {/* === EXPANDIDO (1 clique) === */}
        {ex && emp && (
          <View style={S.exp}>
            {/* Alerta vencidas */}
            {emp.total_parcelas_vencidas > 0 && <View style={S.aR}><Text style={S.aRT}>⚠ {emp.total_parcelas_vencidas} {t.parcelasVencidas}</Text><Text style={S.aRS}>{t.totalAtraso} {fmt(emp.valor_total_vencido)}</Text></View>}

            {/* Navegação múltiplos empréstimos */}
            {c.emprestimos.length > 1 && (<View style={S.eNav}><TouchableOpacity onPress={() => setEmpIdxTodos(p => ({ ...p, [c.id]: Math.max(0, ei - 1) }))} disabled={ei === 0} style={[S.eNBtn, ei === 0 && S.eNOff]}><Text style={S.eNBTx}>◀</Text></TouchableOpacity>{c.emprestimos.map((_, i) => <View key={i} style={[S.eDot, i === ei && S.eDotOn]} />)}<TouchableOpacity onPress={() => setEmpIdxTodos(p => ({ ...p, [c.id]: Math.min(c.emprestimos.length - 1, ei + 1) }))} disabled={ei >= c.emprestimos.length - 1} style={[S.eNBtn, ei >= c.emprestimos.length - 1 && S.eNOff]}><Text style={S.eNBTx}>▶</Text></TouchableOpacity><Text style={S.eNLbl}> {t.emprestimo} {ei + 1}/{c.emprestimos.length}</Text></View>)}

            {/* Ações: Renovação / Renegociação */}
            {(() => {
              const temAtivo = c.emprestimos.some(e => e.status === 'ATIVO' || e.status === 'VENCIDO');
              const temAtraso = c.tem_atraso;
              if (!temAtivo) {
                return (<TouchableOpacity style={S.tAddRowActive} onPress={() => {
                  const confirmar = () => { const nav = navigation.getParent() || navigation; nav.navigate('NovoCliente', { clienteExistente: { id: c.id, nome: c.nome, telefone_celular: c.telefone_celular, documento: c.codigo_cliente?.toString() || '' } }); };
                  if (Platform.OS === 'web') { if (window.confirm(t.confirmarNovoEmprestimo)) confirmar(); }
                  else { Alert.alert(t.novoEmprestimo, t.confirmarNovoEmprestimo, [{ text: t.nao, style: 'cancel' }, { text: t.sim, onPress: confirmar }]); }
                }}><Text style={S.tAddIconActive}>＋</Text><Text style={S.tAddTextActive}>{t.novoEmprestimo}</Text></TouchableOpacity>);
              }
              if (temAtivo && temAtraso) {
                if (!c.permite_renegociacao) return (<View style={[S.btReneg, { opacity: 0.4 }]}><Text style={S.btRenegI}>🔄</Text><Text style={S.btRenegT}>{t.renegociar}</Text></View>);
                return (<TouchableOpacity style={S.btReneg} onPress={() => { const nav = navigation.getParent() || navigation; nav.navigate('NovoCliente', { renegociacao: { emprestimo_id: emp.id, cliente_id: c.id, cliente_nome: c.nome, saldo_devedor: emp.saldo_emprestimo, telefone_celular: c.telefone_celular, codigo_cliente: c.codigo_cliente } }); }}><Text style={S.btRenegI}>🔄</Text><Text style={S.btRenegT}>{t.renegociar}</Text></TouchableOpacity>);
              }
              return null;
            })()}

            {/* Parcelas + Notas na mesma linha */}
            <View style={S.expActRow}>
              <TouchableOpacity style={S.btSecVerde} onPress={() => abrirParcelas(c.id, c.nome, emp.id, emp.status)}>
                <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>☰</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={S.btSecAmarelo} onPress={() => { setNotasClienteId(c.id); setNotasClienteNome(c.nome); setModalNotasClienteVisible(true); }}>
                <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>✎</Text></View>
                {notasCli > 0 && <View style={S.btSecBadge}><Text style={S.btSecBadgeT}>{notasCli}</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Link detalhes */}
            <TouchableOpacity style={S.linkDetalhes} onPress={() => {
              setDetalhesCliente({ id: c.id, nome: c.nome, telefone: c.telefone_celular, codigo_cliente: c.codigo_cliente });
              setModalDetalhesVisible(true);
            }}>
              <Text style={S.linkDetalhesTx}>{t.toqueDetalhes} ▽</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>);
  };

  // ─── TELA DE REORDENAÇÃO ─────────────────────────────────────────────────
  if (modoReordenar) {
    const listaFiltrada = buscaReordenar.trim()
      ? listaReordenar.filter(c => c.nome.toLowerCase().includes(buscaReordenar.toLowerCase().trim()))
      : listaReordenar;
    const estaBuscando = buscaReordenar.trim().length > 0;

    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <TouchableOpacity onPress={cancelarReordenar} style={{ paddingVertical: 6, paddingHorizontal: 2, minWidth: 64 }}>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>{lang === 'es' ? 'Cancelar' : 'Cancelar'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{lang === 'es' ? 'Ordenar Ruta' : 'Ordem da Rota'}</Text>
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{lang === 'es' ? 'Use ↑↓ para mover' : 'Use ↑↓ para mover'}</Text>
          </View>
          <TouchableOpacity onPress={salvarOrdem} disabled={salvandoOrdem} style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: salvandoOrdem ? '#93C5FD' : '#2563EB', borderRadius: 8, minWidth: 64, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#FFF', fontWeight: '600' }}>{salvandoOrdem ? '...' : (lang === 'es' ? 'Guardar' : 'Salvar')}</Text>
          </TouchableOpacity>
        </View>

        {/* Barra de busca */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#E5E7EB' }}>
            <Text style={{ fontSize: 13, marginRight: 6, opacity: 0.5 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, fontSize: 13, color: '#1F2937', padding: 0 }}
              placeholder={lang === 'es' ? 'Buscar cliente...' : 'Buscar cliente...'}
              placeholderTextColor="#9CA3AF"
              value={buscaReordenar}
              onChangeText={setBuscaReordenar}
            />
            {buscaReordenar.length > 0 && (
              <TouchableOpacity onPress={() => setBuscaReordenar('')} style={{ padding: 4 }}>
                <Text style={{ fontSize: 14, color: '#9CA3AF', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {estaBuscando ? (
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
              {listaFiltrada.length} {lang === 'es' ? 'resultado(s) — toque para definir posición' : 'resultado(s) — toque para definir posição'}
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: '#1D4ED8', marginTop: 6 }}>
              {listaReordenar.length} {lang === 'es' ? 'clientes • Busque o use ↑↓' : 'clientes • Busque ou use ↑↓'}
            </Text>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {listaFiltrada.map((cliente) => {
            const index = listaReordenar.findIndex(c => c.id === cliente.id);
            const empAtivo = cliente.emprestimos.find((e: any) => e.status === 'ATIVO' || e.status === 'VENCIDO');
            return (
              <View key={cliente.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: cliente.tem_atraso ? '#FCA5A5' : '#E5E7EB', paddingVertical: 10, paddingHorizontal: 12 }}>
                {/* Badge posição — clicável */}
                <TouchableOpacity
                  onPress={() => { setPopupOrdem({ cliente, index }); setPopupNovaOrdem(String(index + 1)); }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>{index + 1}</Text>
                </TouchableOpacity>

                {/* Info — toque abre popup quando está buscando */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={estaBuscando ? 0.6 : 1}
                  onPress={estaBuscando ? () => { setPopupOrdem({ cliente, index }); setPopupNovaOrdem(String(index + 1)); } : undefined}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{cliente.nome}</Text>
                  <Text style={{ fontSize: 11, color: estaBuscando ? '#2563EB' : '#6B7280', marginTop: 2 }}>
                    {cliente.codigo_cliente ? `#${cliente.codigo_cliente}` : ''}
                    {empAtivo ? ` • ${empAtivo.status === 'VENCIDO' ? '⚠️ Vencido' : '✅ Ativo'}` : ''}
                    {estaBuscando ? (lang === 'es' ? ' · Toque para definir posición' : ' · Toque para definir posição') : ''}
                  </Text>
                </TouchableOpacity>

                {/* Botões ↑↓ — ocultos durante busca */}
                {!estaBuscando && (
                  <View style={{ gap: 4 }}>
                    <TouchableOpacity onPress={() => index > 0 && moverItem(index, index - 1)} disabled={index === 0} style={{ width: 32, height: 28, borderRadius: 6, backgroundColor: index === 0 ? '#F3F4F6' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.6}>
                      <Text style={{ fontSize: 16, color: index === 0 ? '#D1D5DB' : '#2563EB', fontWeight: '700' }}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => index < listaReordenar.length - 1 && moverItem(index, index + 1)} disabled={index === listaReordenar.length - 1} style={{ width: 32, height: 28, borderRadius: 6, backgroundColor: index === listaReordenar.length - 1 ? '#F3F4F6' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.6}>
                      <Text style={{ fontSize: 16, color: index === listaReordenar.length - 1 ? '#D1D5DB' : '#2563EB', fontWeight: '700' }}>↓</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Popup posicionamento direto */}
        <Modal visible={!!popupOrdem} transparent animationType="fade" onRequestClose={() => setPopupOrdem(null)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setPopupOrdem(null)}>
            <View style={{ width: '100%', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden' }} onStartShouldSetResponder={() => true}>
              <View style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 2 }}>
                  {lang === 'es' ? 'POSICIÓN ACTUAL' : 'POSIÇÃO ATUAL'} #{popupOrdem ? popupOrdem.index + 1 : ''}
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFF' }} numberOfLines={1}>{popupOrdem?.cliente.nome}</Text>
              </View>
              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 }}>
                  {lang === 'es' ? 'Mover a la posición:' : 'Mover para a posição:'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => setPopupNovaOrdem(p => String(Math.max(1, parseInt(p || '1') - 1)))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                    <Text style={{ fontSize: 22, color: '#2563EB', fontWeight: '700', lineHeight: 26 }}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={{ width: 100, textAlign: 'center', fontSize: 32, fontWeight: '800', color: '#1F2937', borderBottomWidth: 2.5, borderBottomColor: '#2563EB', paddingVertical: 4 }}
                    value={popupNovaOrdem}
                    onChangeText={v => setPopupNovaOrdem(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                    selectTextOnFocus
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => setPopupNovaOrdem(p => String(Math.min(listaReordenar.length, parseInt(p || '1') + 1)))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                    <Text style={{ fontSize: 22, color: '#2563EB', fontWeight: '700', lineHeight: 26 }}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>1 – {listaReordenar.length}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 }}>
                <TouchableOpacity onPress={() => setPopupOrdem(null)} style={{ flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>{lang === 'es' ? 'Cancelar' : 'Cancelar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const nova = parseInt(popupNovaOrdem);
                    if (!isNaN(nova) && nova >= 1 && nova <= listaReordenar.length && popupOrdem) {
                      moverParaPosicao(popupOrdem.index, nova);
                    }
                    setPopupOrdem(null);
                    setBuscaReordenar('');
                  }}
                  style={{ flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{lang === 'es' ? 'Mover' : 'Mover'} →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (<View style={S.lW}><ActivityIndicator size="large" color="#3B82F6" /><Text style={S.lT}>{t.carregando}</Text></View>);

  return (
    <View style={S.c}>
      {/* Modal Legenda de Cores */}
      <Modal visible={modalLegendaVisible} transparent animationType="fade" onRequestClose={() => setModalLegendaVisible(false)}>
        <TouchableOpacity style={S.legendaOverlay} activeOpacity={1} onPress={() => setModalLegendaVisible(false)}>
          <View style={S.legendaModal} onStartShouldSetResponder={() => true}>
            <Text style={S.legendaTitle}>{t.legendaTitulo}</Text>
            <Text style={S.legendaSubtitle}>{t.legendaSubtitulo}</Text>

            {[
              { color: '#10B981', label: t.legPagoLabel, desc: t.legPagoDesc },
              { color: '#D1D5DB', label: t.legPendenteLabel, desc: t.legPendenteDesc },
              { color: '#F59E0B', label: t.legLeveLabel, desc: t.legLeveDesc },
              { color: '#F97316', label: t.legModeradoLabel, desc: t.legModeradoDesc },
              { color: '#EF4444', label: t.legCriticoLabel, desc: t.legCriticoDesc },
            ].map((item) => (
              <View key={item.color} style={S.legendaRow}>
                <View style={[S.legendaSwatch, { backgroundColor: item.color }]} />
                <View style={S.legendaTexts}>
                  <Text style={S.legendaLabel}>{item.label}</Text>
                  <Text style={S.legendaDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={S.legendaClose} onPress={() => setModalLegendaVisible(false)}>
              <Text style={S.legendaCloseText}>{t.legendaEntendido}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {isViz && (<View style={S.vizBanner}><View style={S.vizBannerContent}><Text style={S.vizBannerIcon}>⚠️</Text><View style={S.vizBannerTexts}><Text style={S.vizBannerTitle}>{t.modoVisualizacao}</Text><Text style={S.vizBannerDesc}>{t.modoVisualizacaoDesc} {fmtData(dataLiq)}</Text></View></View></View>)}
      
      {/* Banner de liquidação fechada quando não há liqId */}
      {!liqId && !isViz && (
        <View style={S.semLiqBanner}>
          <Text style={S.semLiqIcon}>🔒</Text>
          <View style={S.semLiqTexts}>
            <Text style={S.semLiqTitle}>{t.semLiquidacaoAberta}</Text>
            <Text style={S.semLiqDesc}>{t.abrirLiquidacao}</Text>
          </View>
        </View>
      )}
      
      {/* Tabs - Liquidação desabilitada se não há liqId */}
      <View style={S.tabs}>
        <TouchableOpacity 
          style={[S.tb, tab === 'liquidacao' && S.tbOn, !liqId && S.tbDisabled]} 
          onPress={() => liqId && setTab('liquidacao')}
          disabled={!liqId}
        >
          <Text style={S.tbI}>{liqId ? '📅' : '🔒'}</Text>
          <Text style={[S.tbTx, tab === 'liquidacao' && S.tbTxOn, !liqId && S.tbTxDisabled]}>
            {t.liquidacao} {liqId ? `(${cntTotal})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[S.tb, tab === 'todos' && S.tbOn]} 
          onPress={() => setTab('todos')}
        >
          <Text style={S.tbI}>👥</Text>
          <Text style={[S.tbTx, tab === 'todos' && S.tbTxOn]}>{t.todosList} ({todosList.length > 0 ? todosList.length : todosCount ?? '...'})</Text>
        </TouchableOpacity>
      </View>
      <View style={S.srR}><View style={S.srB}><Text style={S.srI}>🔍</Text><TextInput style={S.srIn} placeholder={t.buscar} placeholderTextColor="#9CA3AF" value={busca} onChangeText={setBusca} /></View>{tab === 'liquidacao' && <TouchableOpacity style={S.orB} onPress={() => setShowOrd(!showOrd)}><Text style={S.orI}>↕️</Text><Text style={S.orTx}>{ord === 'rota' ? t.ordemRota : t.ordemNome}</Text><Text style={S.orCh}>▼</Text></TouchableOpacity>}<TouchableOpacity style={S.hdHelp} onPress={() => setModalLegendaVisible(true)}><Text style={S.hdHelpText}>?</Text></TouchableOpacity></View>
      {showOrd && tab === 'liquidacao' && <View style={S.orDr}>{(['rota', 'nome'] as OrdenacaoLiquidacao[]).map(o => (<TouchableOpacity key={o} style={[S.orOp, ord === o && S.orOpOn]} onPress={() => { setOrd(o); setShowOrd(false); }}><Text style={[S.orOpTx, ord === o && S.orOpTxOn]}>{o === 'rota' ? t.ordemRota : t.ordemNome}</Text></TouchableOpacity>))}</View>}
      {tab === 'liquidacao' && (<View style={S.chs}><TouchableOpacity style={[S.ch, filtro === 'todos' && S.chOn]} onPress={() => setFiltro('todos')}><Text style={[S.chTx, filtro === 'todos' && S.chTxOn]}>{t.filtroTodos} {cntTotal}</Text></TouchableOpacity><TouchableOpacity style={[S.ch, filtro === 'atrasados' && S.chOn]} onPress={() => setFiltro('atrasados')}><Text style={[S.chTx, filtro === 'atrasados' && S.chTxOn]}>{t.filtroAtrasados} {cntAtraso}</Text></TouchableOpacity><TouchableOpacity style={[S.ch, filtro === 'pagas' && S.chPOn, filtro !== 'pagas' && S.chPOff]} onPress={() => setFiltro(filtro === 'pagas' ? 'todos' : 'pagas')}><Text style={[S.chTx, filtro === 'pagas' ? S.chPTxOn : S.chPTxOff]}>{t.filtroPagas} {cntPagas}</Text></TouchableOpacity><Text style={S.chCh}>▼</Text></View>)}
      {tab === 'todos' && (<View style={S.tF}>
        <View style={{ position: 'relative' as const }}>
          <TouchableOpacity style={[S.tFB, filtroTipo !== 'todos' && { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' }]} onPress={() => { setShowFiltroTipo(!showFiltroTipo); setShowFiltroStatus(false); }}>
            <Text style={[S.tFBT, filtroTipo !== 'todos' && { color: '#3B82F6' }]}>{filtroTipo === 'todos' ? t.tipoFiltro : filtroTipo === 'NOVO' ? t.tipoNovo : filtroTipo === 'RENOVACAO' ? t.tipoRenovacao : t.tipoRenegociacao}</Text><Text style={S.tFC}>▼</Text>
          </TouchableOpacity>
          {showFiltroTipo && (<View style={S.tDD}>{[
            { k: 'todos', l: t.tipoTodos }, { k: 'NOVO', l: t.tipoNovo }, { k: 'RENOVACAO', l: t.tipoRenovacao }, { k: 'RENEGOCIACAO', l: t.tipoRenegociacao }
          ].map(o => (<TouchableOpacity key={o.k} style={[S.tDDI, filtroTipo === o.k && S.tDDISel]} onPress={() => { setFiltroTipo(o.k); setShowFiltroTipo(false); }}><Text style={[S.tDDIT, filtroTipo === o.k && S.tDDITSel]}>{o.l}</Text></TouchableOpacity>))}</View>)}
        </View>
        <View style={{ position: 'relative' as const }}>
          <TouchableOpacity style={[S.tFB, filtroStatus !== 'todos' && { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' }]} onPress={() => { setShowFiltroStatus(!showFiltroStatus); setShowFiltroTipo(false); }}>
            <Text style={[S.tFBT, filtroStatus !== 'todos' && { color: '#3B82F6' }]}>{filtroStatus === 'todos' ? t.statusFiltro : filtroStatus === 'ATIVO' ? t.stAtivo : filtroStatus === 'VENCIDO' ? t.stVencido : filtroStatus === 'QUITADO' ? t.stQuitado : t.stRenegociado}</Text><Text style={S.tFC}>▼</Text>
          </TouchableOpacity>
          {showFiltroStatus && (<View style={S.tDD}>{[
            { k: 'todos', l: t.stTodos }, { k: 'ATIVO', l: t.stAtivo }, { k: 'VENCIDO', l: t.stVencido }, { k: 'QUITADO', l: t.stQuitado }, { k: 'RENEGOCIADO', l: t.stRenegociado }
          ].map(o => (<TouchableOpacity key={o.k} style={[S.tDDI, filtroStatus === o.k && S.tDDISel]} onPress={() => { setFiltroStatus(o.k); setShowFiltroStatus(false); }}><Text style={[S.tDDIT, filtroStatus === o.k && S.tDDITSel]}>{o.l}</Text></TouchableOpacity>))}</View>)}
        </View>
        <Text style={S.tCnt}>{todosFilt.length} {t.clientes}</Text>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', gap: 4 }}
          onPress={() => {
            const lista = [...todosList].sort((a, b) => {
              const oa = ordemRotaMap.get(a.id) ?? 9999;
              const ob = ordemRotaMap.get(b.id) ?? 9999;
              if (oa !== ob) return oa - ob;
              return a.nome.localeCompare(b.nome);
            });
            setListaReordenar(lista);
            setModoReordenar(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14 }}>⇅</Text>
          <Text style={{ fontSize: 12, color: '#374151', fontWeight: '500' }}>{lang === 'es' ? 'Ordenar' : 'Ordenar'}</Text>
        </TouchableOpacity>
      </View>)}
      {tab === 'todos' && liqId && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', alignItems: 'center', 
              paddingVertical: 8, paddingHorizontal: 12,
              backgroundColor: ocultarLiquidacao ? '#EFF6FF' : '#F9FAFB',
              borderRadius: 8, borderWidth: 1,
              borderColor: ocultarLiquidacao ? '#3B82F6' : '#E5E7EB',
            }} 
            onPress={() => setOcultarLiquidacao(!ocultarLiquidacao)}
            activeOpacity={0.7}
          >
            <View style={{ 
              width: 18, height: 18, borderRadius: 4, borderWidth: 2, 
              borderColor: ocultarLiquidacao ? '#3B82F6' : '#9CA3AF', 
              backgroundColor: ocultarLiquidacao ? '#3B82F6' : 'transparent', 
              alignItems: 'center', justifyContent: 'center', marginRight: 8 
            }}>
              {ocultarLiquidacao && <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700', marginTop: -1 }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 12, color: ocultarLiquidacao ? '#2563EB' : '#6B7280', fontWeight: ocultarLiquidacao ? '600' : '400', flex: 1 }}>
              {t.ocultarLiquidacao || 'Ocultar clientes da liquidação'}
            </Text>
            {ocultarLiquidacao && clientesLiqIds.size > 0 && (
              <View style={{ backgroundColor: '#3B82F6', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 }}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>-{clientesLiqIds.size}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
      {tab === 'liquidacao' ? (
        filtered.length === 0 ? (
          <View style={S.em}><Text style={S.emI}>📋</Text><Text style={S.emT}>{t.semClientes}</Text></View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListLiqRef}
              data={filtered}
              keyExtractor={(item) => item.cliente_id}
              renderItem={({ item }) => renderCard(item)}
              style={S.ls}
              contentContainerStyle={S.lsI}
              refreshControl={!isViz ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => { setShowFiltroTipo(false); setShowFiltroStatus(false); }}
              ListFooterComponent={<View style={{ height: 90 }} />}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            />
            {ord === 'nome' && filtered.length > 10 && (
              <AlphabetSidebar data={filtered} flatRef={flatListLiqRef} activeLetter={activeLetterLiq} setActive={setActiveLetterLiq} />
            )}
            {activeLetterLiq && (
              <View style={S.alphaIndicator}><Text style={S.alphaIndicatorText}>{activeLetterLiq}</Text></View>
            )}
          </View>
        )
      ) : (
        loadTodos ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
        ) : todosFilt.length === 0 ? (
          <View style={S.em}><Text style={S.emI}>📋</Text><Text style={S.emT}>{t.semClientes}</Text></View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListTodosRef}
              data={todosFilt}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderTodos(item)}
              style={S.ls}
              contentContainerStyle={S.lsI}
              refreshControl={!isViz ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => { setShowFiltroTipo(false); setShowFiltroStatus(false); }}
              ListFooterComponent={<View style={{ height: 90 }} />}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            />
            {todosFilt.length > 10 && (
              <AlphabetSidebar data={todosFilt} flatRef={flatListTodosRef} activeLetter={activeLetterTodos} setActive={setActiveLetterTodos} />
            )}
            {activeLetterTodos && (
              <View style={S.alphaIndicator}><Text style={S.alphaIndicatorText}>{activeLetterTodos}</Text></View>
            )}
          </View>
        )
      )}

      {/* MODAL PARCELAS */}
      <Modal visible={modalParcelasVisible} animationType="slide" transparent={true} onRequestClose={() => setModalParcelasVisible(false)}>
        <View style={S.modalOverlay}><View style={S.modalContainer}>
          <View style={S.modalHeader}><Text style={S.modalTitle}>{clienteModal?.nome || ''}</Text><TouchableOpacity onPress={() => setModalParcelasVisible(false)} style={S.modalClose}><Text style={S.modalCloseX}>✕</Text></TouchableOpacity></View>
          {creditoDisponivel > 0 && (<View style={S.creditoBanner}><Text style={S.creditoIcon}>💳</Text><Text style={S.creditoText}>{t.creditoDisponivel} {fmt(creditoDisponivel)}</Text></View>)}
          <ScrollView style={S.modalScroll} showsVerticalScrollIndicator={false}>
            {loadingParcelas ? (<ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />) : parcelasModal.length === 0 ? (<Text style={S.modalEmpty}>{ t.nenhumaParcelaEncontrada }</Text>) : (parcelasModal.map(p => renderParcelaItem(p)))}
            <View style={{ height: 10 }} />
          </ScrollView>
          <View style={S.mBtnFecharWrap}>
            <TouchableOpacity style={S.mBtnFechar} onPress={() => setModalParcelasVisible(false)}>
              <Text style={S.mBtnFecharTx}>{t.fechar}</Text>
            </TouchableOpacity>
          </View>
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
                <View style={[
                  S.pgInfoStatus, 
                  (dadosPagamento?.status_parcela || parcelaPagamento.status) === 'PARCIAL' && { backgroundColor: '#FEF3C7' }
                ]}>
                  <Text style={[
                    S.pgInfoStatusTx,
                    (dadosPagamento?.status_parcela || parcelaPagamento.status) === 'PARCIAL' && { color: '#D97706' }
                  ]}>
                    {(dadosPagamento?.status_parcela || parcelaPagamento.status) === 'PARCIAL' ? 'PARCIAL' : t.pendente}
                  </Text>
                </View>
              </View>
              <Text style={S.pgInfoCliente}>{dadosPagamento?.cliente_nome || clienteModal?.nome || ''}</Text>
              <Text style={S.pgInfoVenc}>{t.vencimento} {fmtData(dadosPagamento?.data_vencimento || parcelaPagamento.data_vencimento)}</Text>
              
              {/* CENÁRIO A: Parcela NÃO é a próxima - BLOQUEIA (qtd_parcelas_anteriores_pendentes > 0) */}
              {dadosPagamento && dadosPagamento.qtd_parcelas_anteriores_pendentes > 0 && (
                <>
                  {/* Alerta amarelo - saldo anterior pendente */}
                  <View style={S.pgAlertYellow}>
                    <Text style={S.pgAlertYellowIcon}>⚠</Text>
                    <View style={S.pgAlertYellowTexts}>
                      <Text style={S.pgAlertYellowTitle}>{t.saldoAnterior || 'Saldo anterior de'} {dadosPagamento.qtd_parcelas_anteriores_pendentes} {t.parcela}(s)</Text>
                      <Text style={S.pgAlertYellowDesc}>{t.valorPendente || 'Valor pendente:'} {fmt(dadosPagamento.saldo_parcelas_anteriores)}</Text>
                    </View>
                  </View>
                  
                  {/* Alerta vermelho - bloqueio */}
                  <View style={S.pgAlertRed}>
                    <Text style={S.pgAlertRedIcon}>⛔</Text>
                    <View style={S.pgAlertRedTexts}>
                      <Text style={S.pgAlertRedTitle}>{t.pagamentoBloqueado || 'Pagamento bloqueado'}</Text>
                      <Text style={S.pgAlertRedDesc}>
                        {`${t.existemParcelas} ${dadosPagamento.qtd_parcelas_anteriores_pendentes} ${t.parcelasAnteriores} ${fmt(dadosPagamento.saldo_parcelas_anteriores)}. ${t.quitarPrimeiro}`}
                      </Text>
                    </View>
                    <TouchableOpacity style={S.pgAlertRedBtn} onPress={irParaProximaParcela}>
                      <Text style={S.pgAlertRedBtnTx}>{t.irProximaParcela || 'Ir para próxima parcela pendente'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              
              {/* CENÁRIO B: Parcela É a próxima - Mostra formulário (qtd_parcelas_anteriores_pendentes === 0) */}
              {(!dadosPagamento || dadosPagamento.qtd_parcelas_anteriores_pendentes === 0) && (
                <>
                  {/* Aviso amarelo se tem saldo anterior parcial (parcelas com pagamento parcial) */}
                  {dadosPagamento?.tem_saldo_anterior && dadosPagamento.saldo_parcelas_anteriores > 0 && (
                    <View style={S.pgAlertYellow}>
                      <Text style={S.pgAlertYellowIcon}>⚠</Text>
                      <View style={S.pgAlertYellowTexts}>
                        <Text style={S.pgAlertYellowTitle}>{t.saldoAnterior} {t.saldoAnteriorParcelas}</Text>
                        <Text style={S.pgAlertYellowDesc}>{t.valorPendente} {fmt(dadosPagamento.saldo_parcelas_anteriores)}</Text>
                      </View>
                      {/* Botão para incluir atrasos no pagamento */}
                      <TouchableOpacity 
                        style={S.pgAlertYellowBtn} 
                        onPress={() => {
                          const valorTotal = dadosPagamento.valor_total_sugerido || (dadosPagamento.valor_saldo_parcela + dadosPagamento.saldo_parcelas_anteriores);
                          const valorFinal = usarCredito && dadosPagamento.credito_disponivel > 0 
                            ? Math.max(0, valorTotal - dadosPagamento.credito_disponivel)
                            : valorTotal;
                          setValorPagamento(valorFinal.toFixed(2).replace('.', ','));
                        }}
                      >
                        <Text style={S.pgAlertYellowBtnTx}>+ {t.incluirAtraso} ({fmt(dadosPagamento.saldo_parcelas_anteriores)})</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Input de valor */}
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
                    {/* Indicador de máximo permitido */}
                    {clienteModal?.saldo_emprestimo != null && (
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {t.maxPermitido || 'Máx:'} {fmt(clienteModal.saldo_emprestimo)}
                      </Text>
                    )}
                    
                    {/* Linha de crédito disponível */}
                    {dadosPagamento?.tem_credito && dadosPagamento.credito_disponivel > 0 && (
                      <View style={S.pgCreditoRow}>
                        <Text style={S.pgCreditoIcon}>💳</Text>
                        <Text style={S.pgCreditoText}>{t.credito} {fmt(dadosPagamento.credito_disponivel)}</Text>
                        <TouchableOpacity 
                          style={[S.pgCreditoBtn, usarCredito && S.pgCreditoBtnOn]} 
                          onPress={() => {
                            const novoUsarCredito = !usarCredito;
                            setUsarCredito(novoUsarCredito);
                            const valorSaldoParcela = dadosPagamento.valor_saldo_parcela || parcelaPagamento.valor_parcela;
                            const saldoEmp = clienteModal?.saldo_emprestimo ?? valorSaldoParcela;
                            if (novoUsarCredito) {
                              const creditoAplicado = Math.min(dadosPagamento.credito_disponivel, valorSaldoParcela);
                              const maxDinheiro = Math.max(saldoEmp - creditoAplicado, 0);
                              const valorSugerido = Math.min(valorSaldoParcela - creditoAplicado, maxDinheiro);
                              setValorPagamento(Math.max(0, valorSugerido).toFixed(2).replace('.', ','));
                            } else {
                              setValorPagamento(valorSaldoParcela.toFixed(2).replace('.', ','));
                            }
                          }}
                        >
                          <View style={[S.pgCreditoCheck, usarCredito && S.pgCreditoCheckOn]}>
                            {usarCredito && <Text style={S.pgCreditoCheckIcon}>✓</Text>}
                          </View>
                          <Text style={[S.pgCreditoBtnTx, usarCredito && S.pgCreditoBtnTxOn]}>{t.usar || 'Usar'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  
                  {/* Alerta de bloqueio por status (PAGO/CANCELADO) */}
                  {dadosPagamento && !dadosPagamento.permite_pagamento && dadosPagamento.mensagem_bloqueio && (
                    <View style={S.pgAlertRed}>
                      <Text style={S.pgAlertRedIcon}>⛔</Text>
                      <View style={S.pgAlertRedTexts}>
                        <Text style={S.pgAlertRedTitle}>{t.pagamentoBloqueado || 'Pagamento bloqueado'}</Text>
                        <Text style={S.pgAlertRedDesc}>{dadosPagamento.mensagem_bloqueio}</Text>
                      </View>
                    </View>
                  )}
                  
                  <View style={S.pgFormRow}>
                    <Text style={S.pgFormLabel}>{t.forma}</Text>
                    <TouchableOpacity style={S.pgFormSelect} onPress={() => setFormaPagamento(formaPagamento === 'DINHEIRO' ? 'TRANSFERENCIA' : 'DINHEIRO')}>
                      <Text style={S.pgFormSelectTx}>{formaPagamento === 'DINHEIRO' ? t.dinheiro : t.transferencia}</Text>
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
                        <Text style={S.pgBtnTx}>{t.pagarBtn} {fmt(
                          (parseFloat(valorPagamento.replace(',', '.')) || 0) + 
                          (usarCredito && dadosPagamento?.credito_disponivel 
                            ? Math.min(dadosPagamento.credito_disponivel, dadosPagamento.valor_saldo_parcela || parcelaPagamento?.valor_parcela || 0) 
                            : 0)
                        )}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
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
            <View style={S.estInputBox}><Text style={S.estInputLabel}>{t.motivoEstorno}</Text><TextInput style={S.estInput} value={motivoEstorno} onChangeText={setMotivoEstorno} placeholder={lang === 'es' ? 'Escriba el motivo...' : 'Digite o motivo...'} multiline numberOfLines={3} /></View>
            <View style={S.estBtns}><TouchableOpacity style={S.estBtnCancel} onPress={() => setModalEstornoVisible(false)}><Text style={S.estBtnCancelTx}>{t.cancelar}</Text></TouchableOpacity><TouchableOpacity style={[S.estBtnConfirm, (!motivoEstorno.trim() || processando) && S.estBtnDisabled]} onPress={confirmarEstorno} disabled={!motivoEstorno.trim() || processando}>{processando ? (<ActivityIndicator color="#fff" />) : (<Text style={S.estBtnConfirmTx}>{t.confirmarEstorno}</Text>)}</TouchableOpacity></View>
          </>)}
        </View></View>
      </Modal>

      {/* Modal Criar Nota via Long Press */}
      <ModalCriarNota
        visible={modalNotaVisible}
        onClose={() => { setModalNotaVisible(false); setNotaClienteId(null); setNotaClienteNome(null); setNotaEmprestimoId(null); }}
        onSalvar={() => { 
          setModalNotaVisible(false); setNotaClienteId(null); setNotaClienteNome(null); setNotaEmprestimoId(null);
          // Recarregar contagem de notas
          const ids = new Set<string>(); raw.forEach(r => ids.add(r.cliente_id)); todosList.forEach(c => ids.add(c.id));
          if (ids.size > 0) buscarNotasCountPorClientes(Array.from(ids), vendedor?.id).then(setNotasCountMap);
        }}
        rotaId={vendedor?.rota_id || ''}
        empresaId={vendedor?.empresa_id || ''}
        vendedorId={vendedor?.id || ''}
        autorNome={vendedor?.nome || ''}
        autorTipo="VENDEDOR"
        liquidacaoId={liqId || undefined}
        clienteId={notaClienteId}
        clienteNome={notaClienteNome}
        emprestimoId={notaEmprestimoId}
        dataReferencia={new Date().toISOString().split('T')[0]}
        obsLocal="Cliente"
        lang={lang}
        coords={coords}
      />

      {/* Modal Lista Notas do Cliente */}
      <ModalNotasLista
        visible={modalNotasClienteVisible}
        onClose={() => { 
          setModalNotasClienteVisible(false); setNotasClienteId(null); setNotasClienteNome(null);
          const ids = new Set<string>(); raw.forEach(r => ids.add(r.cliente_id)); todosList.forEach(c => ids.add(c.id));
          if (ids.size > 0) buscarNotasCountPorClientes(Array.from(ids), vendedor?.id).then(setNotasCountMap);
        }}
        rotaId={vendedor?.rota_id || ''}
        empresaId={vendedor?.empresa_id || ''}
        vendedorId={vendedor?.id || ''}
        autorNome={vendedor?.nome || ''}
        autorTipo="VENDEDOR"
        liquidacaoId={liqId || undefined}
        clienteId={notasClienteId}
        clienteNome={notasClienteNome}
        lang={lang}
        coords={coords}
        permitirCriar={true}
        obsLocalPadrao="Cliente"
      />

      {/* Modal Detalhes do Cliente */}
      <ClienteDetalhesModal
        visible={modalDetalhesVisible}
        onClose={() => { setModalDetalhesVisible(false); setDetalhesCliente(null); }}
        cliente={detalhesCliente}
        lang={lang}
      />
    </View>
  );
}

const S = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#EEF2FF' },
  lW: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  lT: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  hd: { backgroundColor: '#3B82F6', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hdHelp: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  hdHelpText: { color: '#2563EB', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  legendaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  legendaModal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  legendaTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  legendaSubtitle: { fontSize: 12, color: '#6B7280', marginBottom: 20 },
  legendaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  legendaSwatch: { width: 6, height: 44, borderRadius: 3 },
  legendaTexts: { flex: 1 },
  legendaLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  legendaDesc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  legendaClose: { marginTop: 8, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  legendaCloseText: { color: '#fff', fontWeight: '600', fontSize: 15 },
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
  tF: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8, zIndex: 1000 },
  tFB: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', gap: 4 },
  tFBT: { fontSize: 12, color: '#6B7280' }, tFC: { fontSize: 8, color: '#9CA3AF' },
  tCnt: { flex: 1, textAlign: 'right', fontSize: 12, color: '#6B7280' }, tChv: { fontSize: 10, color: '#9CA3AF' },
  tDD: { position: 'absolute', top: 36, left: 0, zIndex: 999, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 8, minWidth: 130 },
  tDDI: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tDDISel: { backgroundColor: '#EFF6FF' },
  tDDIT: { fontSize: 13, color: '#374151' },
  tDDITSel: { color: '#3B82F6', fontWeight: '600' },
  ls: { flex: 1, marginTop: 10, zIndex: 1 }, lsI: { paddingHorizontal: 16 },
  em: { alignItems: 'center', paddingTop: 60 }, emI: { fontSize: 48, marginBottom: 12 }, emT: { fontSize: 14, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 }, avTx: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardInfo: { flex: 1 }, nameRow: { flexDirection: 'row', alignItems: 'center' },
  nome: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  bWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, marginLeft: 4, borderWidth: 1, borderColor: '#FECACA' },
  bWarnNew: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 6, gap: 2 },
  bWarnNewI: { fontSize: 10, color: '#EF4444' },
  bWarnNewT: { fontSize: 10, fontWeight: '700', color: '#EF4444' },

  // Linha de ação expandida
  expActRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'center' },

  // Botão grande Pagar
  btPagarGrande: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, gap: 8 },
  btPagarDisabled: { backgroundColor: '#D1D5DB' },
  btPagarIcon: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  btPagarText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btPagarValor: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8 },
  btPagarValorText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Botões secundários (parcelas + notas)
  btSecRow: { flexDirection: 'row', gap: 8 },
  btSecVerde: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btSecAmarelo: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  btSecIcon: { fontSize: 18 },
  btSecIconBox: { alignItems: 'center', justifyContent: 'center' },
  btSecIconTx: { fontSize: 20, color: '#FFF', fontWeight: '700' },
  btSecBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  btSecBadgeT: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  // Link detalhes
  linkDetalhes: { alignItems: 'center', paddingVertical: 4 },
  linkDetalhesTx: { fontSize: 12, color: '#9CA3AF' },
  bWarnI: { fontSize: 10, color: '#F59E0B', marginRight: 2 }, bWarnT: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  bMul: { backgroundColor: '#FED7AA', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, marginLeft: 3 }, bMulT: { fontSize: 10, fontWeight: '700', color: '#C2410C' },
  bNota: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4, gap: 2, borderWidth: 1, borderColor: '#BFDBFE' }, bNotaI: { fontSize: 8 }, bNotaT: { fontSize: 9, fontWeight: '700', color: '#2563EB' },
  dots: { fontSize: 18, color: '#9CA3AF', marginLeft: 4, fontWeight: '700' }, sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pLblR: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }, pLbl: { fontSize: 11, color: '#6B7280' },
  fBdg: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, fBdgT: { fontSize: 9, fontWeight: '600', color: '#7C3AED' },
  dataEmpLbl: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  pVal: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  pValBig: { fontSize: 18, fontWeight: '800', color: '#1F2937', textAlign: 'right' },
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
  btG: { backgroundColor: '#10B981' }, btBl: { backgroundColor: '#3B82F6' }, btRed: { backgroundColor: '#EF4444' }, btOY: { backgroundColor: '#F59E0B' },
  btDetalhes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginTop: 6, backgroundColor: '#F5F3FF', borderRadius: 8, borderWidth: 1, borderColor: '#DDD6FE', gap: 6 },
  btDetalhesIcon: { fontSize: 12 },
  btDetalhesTx: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
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
  tAddRowActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 10, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6' },
  tAddIconActive: { fontSize: 16, color: '#3B82F6', marginRight: 6, fontWeight: '700' as const }, tAddTextActive: { fontSize: 13, color: '#3B82F6', fontWeight: '600' as const },
  btReneg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 10, backgroundColor: '#FFF7ED', borderRadius: 8, borderWidth: 1, borderColor: '#F97316' },
  btRenegI: { fontSize: 16, marginRight: 6 }, btRenegT: { fontSize: 13, color: '#F97316', fontWeight: '600' as const },
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
  mParcelaRow: { flexDirection: 'row', alignItems: 'center' },
  mParcelaIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mParcelaInfo: { flex: 1 },
  mParcelaNum: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  mParcelaVenc: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  mParcelaValores: { alignItems: 'flex-end' },
  mParcelaOriginal: { fontSize: 10, color: '#9CA3AF' },
  mParcelaValor: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  mParcelaPago: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  mParcelaRestante: { fontSize: 11, fontWeight: '600', color: '#D97706', marginTop: 1 },
  mParcelaCredito: { fontSize: 10, color: '#2563EB' },
  mParcelaStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mParcelaStatusTx: { fontSize: 9, fontWeight: '700' },
  mParcelaDataPg: { fontSize: 9, color: '#6B7280', marginTop: 1 },
  mParcelaBtns: { marginLeft: 8, justifyContent: 'center' },
  mBtnPagar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
  mBtnPagarIcon: { fontSize: 14 },
  mBtnPagarTx: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mBtnEstornar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444', gap: 6 },
  mBtnFecharWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  mBtnFechar: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  mBtnFecharTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
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
  pgAlertYellowBtn: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F59E0B' },
  pgAlertYellowBtnTx: { fontSize: 12, fontWeight: '600', color: '#fff' },
  // Alerta vermelho (bloqueio)
  pgAlertRed: { backgroundColor: '#FEF2F2', marginHorizontal: 16, marginTop: 12, marginBottom: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  pgAlertRedIcon: { fontSize: 16, marginRight: 10 },
  pgAlertRedTexts: { marginBottom: 10 },
  pgAlertRedTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  pgAlertRedDesc: { fontSize: 12, color: '#B91C1C', marginTop: 4 },
  pgAlertRedBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DC2626', backgroundColor: '#fff' },
  pgAlertRedBtnTx: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  // Banner sem liquidação
  semLiqBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  semLiqIcon: { fontSize: 18, marginRight: 10 },
  semLiqTexts: { flex: 1 },
  semLiqTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  semLiqDesc: { fontSize: 11, color: '#B91C1C', marginTop: 1 },
  // Tab desabilitada
  tbDisabled: { backgroundColor: '#E5E7EB', opacity: 0.6 },
  tbTxDisabled: { color: '#9CA3AF' },
  // Botão Pagar desabilitado no modal
  mBtnPagarDisabled: { backgroundColor: '#E5E7EB', opacity: 0.5 },
  // Alphabet sidebar
  alphaBar: { position: 'absolute', right: 2, top: 15, bottom: 100, justifyContent: 'center', alignItems: 'center', width: 22, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 11, paddingVertical: 4 },
  alphaLetter: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', paddingVertical: 1.5, paddingHorizontal: 4, textAlign: 'center' },
  alphaLetterActive: { color: '#3B82F6', fontWeight: '800', fontSize: 12, backgroundColor: '#EFF6FF', borderRadius: 8, overflow: 'hidden' },
  alphaIndicator: { position: 'absolute', left: '50%', top: '45%', marginLeft: -30, marginTop: -30, width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  alphaIndicatorText: { color: '#fff', fontSize: 28, fontWeight: '800' },
});