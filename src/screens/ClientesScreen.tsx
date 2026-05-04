import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AlphabetSidebar from '../components/AlphabetSidebar';
import AutorizacaoEstornoModal from '../components/AutorizacaoEstornoModal';
import ClienteCardLiquidacao from '../components/ClienteCardLiquidacao';
import ClienteCardTodos from '../components/ClienteCardTodos';
import ClienteDetalhesModal from '../components/ClienteDetalhesModal';
import EstornoModal from '../components/EstornoModal';
import FiltrosDrawer from '../components/FiltrosDrawer';
import LegendaCoresModal from '../components/LegendaCoresModal';
import { ModalCriarNota, ModalNotasLista, buscarNotasCountPorClientes } from '../components/NotasComponent';
import PagamentoModal from '../components/PagamentoModal';
import ParcelasModal from '../components/ParcelasModal';
import ReordenarModal from '../components/ReordenarModal';
import { useAuth } from '../contexts/AuthContext';
import { Language, useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import useClientesLiquidacao from '../hooks/useClientesLiquidacao';
import useClientesTodos from '../hooks/useClientesTodos';
import useGPSTracking from '../hooks/useGPSTracking';
import { supabase } from '../services/supabase';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

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
    pagoComAtraso: 'Pago com atraso',
    diasAtraso: 'dias de atraso',
    diaAtraso: 'dia de atraso',
    pagoNoDia: 'No dia',
    pagoAdiantado: 'Adiantado',
    dinheiro: 'Dinheiro',
    creditoUsado: 'Crédito usado',
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
    pagoComAtraso: 'Pagado con atraso',
    diasAtraso: 'días de atraso',
    diaAtraso: 'día de atraso',
    pagoNoDia: 'A tiempo',
    pagoAdiantado: 'Adelantado',
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
  // ⭐ FIX: Fallback direto pelo status (evita problema de timing com temLiquidacaoAberta)
  const statusLiq = liqCtx.liquidacaoAtual?.status;
  const liqIdFallback = (statusLiq === 'ABERTO' || statusLiq === 'ABERTA' || statusLiq === 'REABERTO') ? liqCtx.liquidacaoAtual?.id : null;
  const liqId = liqCtx.liquidacaoIdVisualizacao || route?.params?.liquidacaoId || (liqCtx.temLiquidacaoAberta ? liqCtx.liquidacaoAtual?.id : null) || liqIdFallback;
  const isViz = liqCtx.modoVisualizacao || route?.params?.isVisualizacao || false;
  const {
    raw, setRaw,
    pagasSet, pagMap, clientesPagosNaLiq,
    ordemRotaMap, setOrdemRotaMap,
    loading, setLoading,
    refreshing, setRefreshing,
    loadLiq,
    atualizarSaldoLocalLiq,
  } = useClientesLiquidacao({ rotaId, dataLiq, liqId });

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

  const {
    todosList, setTodosList,
    loadTodos,
    todosCount,
    loadTodosClientes,
    atualizarSaldoLocalTodos,
  } = useClientesTodos({ rotaId, tab, setOrdemRotaMap, setRefreshing });
  const [modalLegendaVisible, setModalLegendaVisible] = useState(false);
  const [busca, setBusca] = useState('');

  // Drawer de filtros
  const [drawerVisible, setDrawerVisible] = useState(false);
  // Drawer animação: começa fora (DRAWER_WIDTH) e anima para 0 (visível)
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  const openDrawer = useCallback(() => {
    setDrawerVisible(true);
    Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 200, useNativeDriver: true }).start(() => setDrawerVisible(false));
  }, [drawerAnim]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [empIdxMap, setEmpIdxMap] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<FiltroLiquidacao>('todos');
  const [ord, setOrd] = useState<OrdenacaoLiquidacao>('rota');
  const [showOrd, setShowOrd] = useState(false);

  const [expandedTodos, setExpandedTodos] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [showFiltroTipo, setShowFiltroTipo] = useState(false);
  const [showFiltroStatus, setShowFiltroStatus] = useState(false);
  const [ocultarLiquidacao, setOcultarLiquidacao] = useState(false);

  // Reordenação de clientes
  const [modoReordenar, setModoReordenar] = useState(false);
  const [listaReordenar, setListaReordenar] = useState<ClienteTodos[]>([]);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);

  // Refs das FlatLists para alphabet sidebar
  const flatListLiqRef = useRef<FlatList>(null);
  const flatListTodosRef = useRef<FlatList>(null);

  // Alphabet sidebar
  const [activeLetterLiq, setActiveLetterLiq] = useState<string | null>(null);
  const [activeLetterTodos, setActiveLetterTodos] = useState<string | null>(null);
  const [empIdxTodos, setEmpIdxTodos] = useState<Record<string, number>>({});

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
  const { gpsStatus, coords, carregarGPS } = useGPSTracking();
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

  // ⭐ Estados para "Não Pago"
  const [naoPagosSet, setNaoPagosSet] = useState<Set<string>>(new Set());
  const [modalNaoPagoVisible, setModalNaoPagoVisible] = useState(false);
  const [naoPagoParcelaInfo, setNaoPagoParcelaInfo] = useState<{
    parcela_id: string;
    numero_parcela: number;
    valor_parcela: number;
    valor_saldo: number;
    emprestimo_id: string;
  } | null>(null);
  const [naoPagoClienteInfo, setNaoPagoClienteInfo] = useState<{ id: string; nome: string } | null>(null);
  const [naoPagoObservacao, setNaoPagoObservacao] = useState('');
  const [salvandoNaoPago, setSalvandoNaoPago] = useState(false);

  const [parcelaEstorno, setParcelaEstorno] = useState<ParcelaModal | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');

  // Configurações do vendedor e autorização de estorno
  const [configVendedor, setConfigVendedor] = useState<{ permitir_exclusao_parcelas: boolean } | null>(null);
  const [modalAutorizacaoEstornoVisible, setModalAutorizacaoEstornoVisible] = useState(false);
  const [motivoSolicitacaoEstorno, setMotivoSolicitacaoEstorno] = useState('');
  const [enviandoSolicitacaoEstorno, setEnviandoSolicitacaoEstorno] = useState(false);
  const [parcelaAguardandoAutorizacao, setParcelaAguardandoAutorizacao] = useState<ParcelaModal | null>(null);

  const t = textos[lang];

  // Helper para alertas que funciona no web e mobile
  const showAlert = useCallback((titulo: string, mensagem: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${titulo}\n\n${mensagem}`);
    } else {
      Alert.alert(titulo, mensagem);
    }
  }, []);


  // Carregar configurações do vendedor (permitir_exclusao_parcelas)
  useEffect(() => {
    const carregarConfigVendedor = async () => {
      if (!vendedor?.id) {
        console.log('[CONFIG] Vendedor não disponível ainda');
        return;
      }
      console.log('[CONFIG] Carregando config para vendedor:', vendedor.id);
      try {
        const { data, error } = await supabase
          .from('configuracoes_vendedor')
          .select('permitir_exclusao_parcelas')
          .eq('vendedor_id', vendedor.id)
          .maybeSingle();
        
        console.log('[CONFIG] Resposta:', { data, error });
        
        if (!error && data) {
          console.log('[CONFIG] permitir_exclusao_parcelas =', data.permitir_exclusao_parcelas);
          setConfigVendedor({ permitir_exclusao_parcelas: data.permitir_exclusao_parcelas ?? true });
        } else {
          // Se não existir configuração, permitir por padrão
          console.log('[CONFIG] Sem config, usando default true');
          setConfigVendedor({ permitir_exclusao_parcelas: true });
        }
      } catch (e) {
        console.log('[CONFIG] Erro ao carregar config vendedor:', e);
        setConfigVendedor({ permitir_exclusao_parcelas: true });
      }
    };
    carregarConfigVendedor();
  }, [vendedor?.id]);

  // Iniciar GPS ao montar a tela (não esperar abrir modal)
  
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
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar a ordem: ' + (e.message || ''));
    } finally {
      setSalvandoOrdem(false);
    }
  }, [rotaId, listaReordenar]);

  // ⭐ Carregar não pagos da liquidação atual
  const carregarNaoPagos = useCallback(async () => {
    if (!liqId) {
      setNaoPagosSet(new Set());
      return;
    }
    try {
      const { data, error } = await supabase.rpc('fn_listar_nao_pagos_liquidacao', {
        p_liquidacao_id: liqId
      });
      if (!error && data) {
        const set = new Set<string>();
        data.forEach((np: any) => set.add(np.parcela_id));
        setNaoPagosSet(set);
      }
    } catch (e) {
      console.error('Erro ao carregar não pagos:', e);
    }
  }, [liqId]);

  // Carregar não pagos quando liquidação mudar
  useEffect(() => {
    carregarNaoPagos();
  }, [carregarNaoPagos]);

  // ⭐ Abrir modal de não pago
  const abrirNaoPago = useCallback((
    parcelaInfo: { parcela_id: string; numero_parcela: number; valor_parcela: number; valor_saldo: number; emprestimo_id: string },
    clienteInfo: { id: string; nome: string }
  ) => {
    setNaoPagoParcelaInfo(parcelaInfo);
    setNaoPagoClienteInfo(clienteInfo);
    setNaoPagoObservacao('');
    setModalNaoPagoVisible(true);
  }, []);

  // ⭐ Registrar não pago
  const registrarNaoPago = useCallback(async () => {
    if (!liqId || !naoPagoParcelaInfo || !naoPagoClienteInfo) return;
    
    setSalvandoNaoPago(true);
    try {
      const { data, error } = await supabase.rpc('fn_registrar_nao_pago', {
        p_liquidacao_id: liqId,
        p_cliente_id: naoPagoClienteInfo.id,
        p_emprestimo_id: naoPagoParcelaInfo.emprestimo_id,
        p_parcela_id: naoPagoParcelaInfo.parcela_id,
        p_observacao: naoPagoObservacao.trim() || null,
        p_latitude: coords?.lat || null,
        p_longitude: coords?.lng || null,
        p_user_id: vendedor?.user_id || null,
      });

      if (error) throw error;

      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        // Atualizar set local
        setNaoPagosSet(prev => new Set([...prev, naoPagoParcelaInfo.parcela_id]));
        setModalNaoPagoVisible(false);
        showAlert('✓', res.mensagem || (lang === 'es' ? 'Cliente registrado como no pagó' : 'Cliente registrado como não pagou'));
      } else {
        showAlert('Erro', res?.mensagem || 'Erro ao registrar');
      }
    } catch (e: any) {
      showAlert('Erro', e.message || 'Erro ao registrar não pago');
    } finally {
      setSalvandoNaoPago(false);
    }
  }, [liqId, naoPagoParcelaInfo, naoPagoClienteInfo, naoPagoObservacao, coords, vendedor?.user_id, lang, showAlert]);


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

  // ⭐ Recarregar lista ao voltar para a tela (após criar novo empréstimo, renovar, etc)
  const isFirstMount = useRef(true);
  
  useFocusEffect(
    useCallback(() => {
      // Na primeira montagem, não recarrega (os outros useEffects já fazem isso)
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      
      // Ao voltar para a tela, recarrega a lista ativa
      console.log('🔄 useFocusEffect: Tela recebeu foco, recarregando lista...');
      if (tab === 'liquidacao') {
        loadLiq();
      } else {
        setTodosList([]);
        loadTodosClientes(true);
      }
    }, [tab, loadLiq, loadTodosClientes])
  );

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
        .select('parcela_id, valor_pago_atual, valor_credito_usado, valor_credito_gerado, liquidacao_id, estornado')
        .in('parcela_id', ids)
        .eq('estornado', false);
      
      const pMap = new Map<string, { valorPago: number; creditoUsado: number; creditoGerado: number; liquidacaoId: string | null }>();
      (pagamentos || []).forEach((p: any) => { 
        pMap.set(p.parcela_id, { 
          valorPago: p.valor_pago_atual || 0, 
          creditoUsado: p.valor_credito_usado || 0,
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
        const creditoUsado = pag?.creditoUsado || 0;
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
          credito_usado: creditoUsado,
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
          if (clienteModal?.emprestimo_id) { atualizarSaldoLocalLiq(clienteModal.emprestimo_id); atualizarSaldoLocalTodos(clienteModal.emprestimo_id); }
          setClienteModal(null);
          // ⭐ Aguardar 300ms para o banco processar triggers antes de recarregar
          await new Promise(resolve => setTimeout(resolve, 300));
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

  const abrirEstorno = useCallback(async (parcela: ParcelaModal) => {
    console.log('[ESTORNO] abrirEstorno chamada, parcela:', parcela.parcela_id, 'numero:', parcela.numero_parcela);
    console.log('[ESTORNO] configVendedor:', configVendedor);
    
    if (!liqId) { showAlert(t.atencao, t.liquidacaoNecessaria); return; }
    if (!vendedor?.id || !vendedor?.rota_id) { showAlert(t.atencao, 'Vendedor não identificado'); return; }
    if (!clienteModal?.emprestimo_id) { showAlert(t.atencao, 'Empréstimo não identificado'); return; }

    // ============================================================
    // VALIDAÇÃO DE ORDEM LINEAR: Só pode estornar a última parcela paga
    // ============================================================
    try {
      // Buscar todas as parcelas pagas deste empréstimo na liquidação atual
      const { data: parcelasPagas, error: erroParcelas } = await supabase
        .from('emprestimo_parcelas')
        .select('id, numero_parcela, valor_pago, liquidacao_id')
        .eq('emprestimo_id', clienteModal.emprestimo_id)
        .eq('liquidacao_id', liqId)
        .gt('valor_pago', 0)
        .order('numero_parcela', { ascending: false });

      if (erroParcelas) {
        console.error('[ESTORNO] Erro ao buscar parcelas pagas:', erroParcelas);
      } else if (parcelasPagas && parcelasPagas.length > 0) {
        // A primeira da lista (ordem DESC) é a última parcela paga
        const ultimaParcelaPaga = parcelasPagas[0];
        console.log('[ESTORNO] Última parcela paga:', ultimaParcelaPaga.numero_parcela, 'Tentando estornar:', parcela.numero_parcela);
        
        if (parcela.numero_parcela < ultimaParcelaPaga.numero_parcela) {
          // Tentando estornar uma parcela anterior à última paga
          showAlert(
            lang === 'pt-BR' ? 'Ordem de Estorno' : 'Orden de Reversión',
            lang === 'pt-BR' 
              ? `Você deve estornar a parcela ${ultimaParcelaPaga.numero_parcela} primeiro, antes de estornar a parcela ${parcela.numero_parcela}.`
              : `Debe reversar la cuota ${ultimaParcelaPaga.numero_parcela} primero, antes de reversar la cuota ${parcela.numero_parcela}.`
          );
          return;
        }
      }
    } catch (e) {
      console.error('[ESTORNO] Erro na validação de ordem:', e);
    }

    // ============================================================
    // VERIFICAÇÃO DE PERMISSÃO
    // ============================================================
    
    // Se permitir_exclusao_parcelas = true, abre direto
    console.log('[ESTORNO] permitir_exclusao_parcelas =', configVendedor?.permitir_exclusao_parcelas);
    if (configVendedor?.permitir_exclusao_parcelas === true) {
      console.log('[ESTORNO] Permitido, abrindo modal direto');
      setParcelaEstorno(parcela);
      setMotivoEstorno('');
      setModalEstornoVisible(true);
      return;
    }

    // Se permitir_exclusao_parcelas = false, verificar autorização
    console.log('[ESTORNO] Não permitido, verificando autorização...');
    try {
      const { data, error } = await supabase.rpc('fn_verificar_autorizacao', {
        p_vendedor_id: vendedor.id,
        p_rota_id: vendedor.rota_id,
        p_tipo: 'ESTORNO_PAGAMENTO',
        p_emprestimo_id: clienteModal?.emprestimo_id || null,
        p_parcela_id: parcela.parcela_id,  // Parcela específica
      });

      console.log('[ESTORNO] Resposta fn_verificar_autorizacao:', { data, error });

      if (error) {
        console.error('[ESTORNO] Erro ao verificar autorização:', error);
        showAlert(t.erroGenerico, 'Não foi possível verificar autorização');
        return;
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      console.log('[ESTORNO] Resultado processado:', resultado);

      // Se autorizado, abre modal de estorno direto
      if (resultado?.autorizado) {
        console.log('[ESTORNO] Autorizado, abrindo modal de estorno');
        setParcelaEstorno(parcela);
        setMotivoEstorno('');
        setModalEstornoVisible(true);
        return;
      }

      // Se requer solicitação, abrir modal de solicitação de autorização
      if (resultado?.requer_solicitacao) {
        console.log('[ESTORNO] Requer solicitação');
        // Verificar se já existe solicitação pendente
        if (resultado.solicitacao_pendente_id) {
          console.log('[ESTORNO] Já existe solicitação pendente:', resultado.solicitacao_pendente_id);
          showAlert(
            lang === 'pt-BR' ? 'Solicitação Pendente' : 'Solicitud Pendiente',
            lang === 'pt-BR' 
              ? 'Já existe uma solicitação de estorno pendente. Aguarde a aprovação do supervisor.'
              : 'Ya existe una solicitud de estorno pendiente. Espere la aprobación del supervisor.'
          );
          return;
        }

        // Abrir modal para criar solicitação
        console.log('[ESTORNO] Abrindo modal de solicitação de autorização...');
        setParcelaAguardandoAutorizacao(parcela);
        setMotivoSolicitacaoEstorno('');
        setModalAutorizacaoEstornoVisible(true);
        console.log('[ESTORNO] Modal deveria estar visível agora');
        return;
      }

      // Bloqueio sem opção de solicitar
      showAlert(
        lang === 'pt-BR' ? 'Não permitido' : 'No permitido',
        resultado?.motivo || (lang === 'pt-BR' ? 'Estorno não permitido' : 'Estorno no permitido')
      );

    } catch (e: any) {
      console.error('Erro ao verificar autorização estorno:', e);
      showAlert(t.erroGenerico, e.message || 'Erro ao verificar autorização');
    }
  }, [liqId, t, vendedor, configVendedor, clienteModal, lang, showAlert]);

  // Função para enviar solicitação de autorização de estorno
  const enviarSolicitacaoEstorno = useCallback(async () => {
    if (!vendedor?.id || !vendedor?.rota_id || !parcelaAguardandoAutorizacao) return;
    
    if (!motivoSolicitacaoEstorno.trim()) {
      showAlert(t.atencao, lang === 'pt-BR' ? 'Informe o motivo da solicitação' : 'Informe el motivo de la solicitud');
      return;
    }

    setEnviandoSolicitacaoEstorno(true);
    try {
      const { data, error } = await supabase.rpc('fn_criar_solicitacao_autorizacao', {
        p_vendedor_id: vendedor.id,
        p_rota_id: vendedor.rota_id,
        p_tipo_solicitacao: 'ESTORNO_PAGAMENTO',
        p_motivo: motivoSolicitacaoEstorno.trim(),
        p_cliente_id: clienteModal?.id || null,  // Cliente (clienteModal.id é o cliente_id)
        p_emprestimo_id: clienteModal?.emprestimo_id || null,
        p_parcela_id: parcelaAguardandoAutorizacao?.parcela_id || null,  // Parcela específica
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : data;

      if (!resultado?.sucesso) {
        showAlert(t.erroGenerico, resultado?.mensagem || 'Não foi possível criar solicitação');
        return;
      }

      // Sucesso
      setModalAutorizacaoEstornoVisible(false);
      setParcelaAguardandoAutorizacao(null);
      setMotivoSolicitacaoEstorno('');
      
      showAlert(
        lang === 'pt-BR' ? 'Solicitação Enviada' : 'Solicitud Enviada',
        lang === 'pt-BR' 
          ? 'Sua solicitação foi enviada. Aguarde a aprovação do supervisor.'
          : 'Su solicitud ha sido enviada. Espere la aprobación del supervisor.'
      );

    } catch (e: any) {
      console.error('Erro ao criar solicitação:', e);
      showAlert(t.erroGenerico, e.message || 'Erro ao enviar solicitação');
    } finally {
      setEnviandoSolicitacaoEstorno(false);
    }
  }, [vendedor, parcelaAguardandoAutorizacao, motivoSolicitacaoEstorno, clienteModal, t, lang, showAlert]);

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
        Alert.alert(t.sucessoGenerico, res.mensagem || t.estornoSucesso);
        if (clienteModal?.emprestimo_id) { atualizarSaldoLocalLiq(clienteModal.emprestimo_id); atualizarSaldoLocalTodos(clienteModal.emprestimo_id); }
        if (clienteModal) abrirParcelas(clienteModal.id, clienteModal.nome, clienteModal.emprestimo_id);
        // ⭐ Aguardar 300ms para o banco processar triggers antes de recarregar
        await new Promise(resolve => setTimeout(resolve, 300));
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

 const renderCard = (c: ClienteAgrupado) => {
    const e = eAtual(c);
    const clienteEstaPago = isCliPago(c);
    return (
      <ClienteCardLiquidacao
        key={c.cliente_id}
        cliente={c}
        emprestimo={e}
        expanded={expanded === c.cliente_id}
        pagasSet={pagasSet}
        naoPagosSet={naoPagosSet}
        liqId={liqId}
        isViz={isViz}
        isClientePago={clienteEstaPago}
        lang={lang}
        notasCount={notasCountMap.get(c.cliente_id) || 0}
        t={t}
        onToggleExpand={() => setExpanded(p => p === c.cliente_id ? null : c.cliente_id)}
        onPagar={abrirPagamento}
        onAbrirParcelas={abrirParcelas}
        onAbrirNotas={(id, nome) => { setNotasClienteId(id); setNotasClienteNome(nome); setModalNotasClienteVisible(true); }}
        onAbrirDetalhes={(cli) => { setDetalhesCliente(cli); setModalDetalhesVisible(true); }}
        onNaoPago={abrirNaoPago}
      />
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
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'QUITADO') {
        // Cliente quitado = tem empréstimo QUITADO e NÃO tem nenhum ATIVO ou VENCIDO
        r = r.filter(c =>
          c.emprestimos.some(e => e.status === 'QUITADO') &&
          !c.emprestimos.some(e => e.status === 'ATIVO' || e.status === 'VENCIDO')
        );
      } else {
        r = r.filter(c => c.emprestimos.some(e => e.status === filtroStatus));
      }
    }
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
    const ei = empIdxTodos[c.id] || 0;
    const emp = c.emprestimos[Math.min(ei, c.emprestimos.length - 1)];
    return (
      <ClienteCardTodos
        key={c.id}
        cliente={c}
        emprestimo={emp}
        empIdx={ei}
        expanded={expandedTodos === c.id}
        modoReordenar={modoReordenar}
        lang={lang}
        notasCount={notasCountMap.get(c.id) || 0}
        t={t}
        onToggleExpand={() => setExpandedTodos(p => p === c.id ? null : c.id)}
        onLongPressStart={() => {
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
        onLongPressEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
        onChangeEmpIdx={(newIdx) => setEmpIdxTodos(p => ({ ...p, [c.id]: newIdx }))}
        onAbrirParcelas={abrirParcelas}
        onAbrirNotas={(id, nome) => { setNotasClienteId(id); setNotasClienteNome(nome); setModalNotasClienteVisible(true); }}
        onAbrirDetalhes={(cli) => { setDetalhesCliente(cli); setModalDetalhesVisible(true); }}
      />
    );
  };


  if (modoReordenar) {
    return (
      <ReordenarModal
        listaReordenar={listaReordenar}
        salvandoOrdem={salvandoOrdem}
        lang={lang}
        onCancelar={cancelarReordenar}
        onSalvar={salvarOrdem}
        onMoverItem={moverItem}
        onMoverParaPosicao={moverParaPosicao}
      />
    );
  }

  if (loading) return (<View style={S.lW}><ActivityIndicator size="large" color="#3B82F6" /><Text style={S.lT}>{t.carregando}</Text></View>);

return (
    <View style={S.c}>
      <LegendaCoresModal
        visible={modalLegendaVisible}
        onClose={() => setModalLegendaVisible(false)}
        t={t}
      />

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
      
      {/* ═══════════════════════════════════════════════════════════════════════
          NOVO HEADER REDESENHADO
          ═══════════════════════════════════════════════════════════════════════ */}
      
      {/* Linha 1: Título + Toggle Todos */}
      <View style={S.newHeader}>
        <Text style={S.newTitle}>{t.titulo || 'Clientes'}</Text>
        <View style={S.toggleContainer}>
          <Switch
            value={tab === 'todos'}
            onValueChange={(v) => {
              if (v) setTab('todos');
              else if (liqId) setTab('liquidacao');
            }}
            trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
            thumbColor="#FFF"
            disabled={!liqId && tab === 'liquidacao'}
          />
          <Text style={S.toggleLabel}>{t.todosList || 'Todos'}</Text>
        </View>
      </View>

      {/* Linha 2: Barra de Busca */}
      <View style={S.searchRow}>
        <View style={S.searchBox}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput 
            style={S.searchInput} 
            placeholder={t.buscar} 
            placeholderTextColor="#9CA3AF" 
            value={busca} 
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Linha 3: Contador + Badge Pagas + Botão Filtro */}
      <View style={S.filterRow}>
        <View style={S.filterLeft}>
          {tab === 'liquidacao' ? (
            <Text style={S.counterText}>
              {t.liquidacao} {cntTotal - cntPagas}/{cntTotal}
            </Text>
          ) : (
            <Text style={S.counterText}>
              {t.todosList} {todosFilt.length}
            </Text>
          )}
          {tab === 'liquidacao' && cntPagas > 0 && (
            <TouchableOpacity 
              style={[S.badgePagas, filtro === 'pagas' && S.badgePagasActive]} 
              onPress={() => setFiltro(filtro === 'pagas' ? 'todos' : 'pagas')}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={14} color={filtro === 'pagas' ? '#FFF' : '#10B981'} />
              <Text style={[S.badgePagasText, filtro === 'pagas' && S.badgePagasTextActive]}>
                {t.filtroPagas} {cntPagas}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={S.filterRight}>
          <TouchableOpacity style={S.filterBtn} onPress={openDrawer} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={S.helpBtn} onPress={() => setModalLegendaVisible(true)} activeOpacity={0.7}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          DRAWER LATERAL DE FILTROS
          ═══════════════════════════════════════════════════════════════════════ */}
      <FiltrosDrawer
        visible={drawerVisible}
        drawerAnim={drawerAnim}
        drawerWidth={DRAWER_WIDTH}
        onClose={closeDrawer}
        lang={lang}
        tab={tab}
        ord={ord}
        setOrd={setOrd}
        filtro={filtro}
        setFiltro={setFiltro}
        cntTotal={cntTotal}
        cntAtraso={cntAtraso}
        cntPagas={cntPagas}
        filtroTipo={filtroTipo}
        setFiltroTipo={setFiltroTipo}
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        ocultarLiquidacao={ocultarLiquidacao}
        setOcultarLiquidacao={setOcultarLiquidacao}
        liqId={liqId}
        clientesLiqIdsCount={clientesLiqIds.size}
        todosList={todosList}
        ordemRotaMap={ordemRotaMap}
        onReordenar={(lista) => {
          setListaReordenar(lista);
          setModoReordenar(true);
        }}
        t={t}
      />
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
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  if (flatListLiqRef.current && info.index < filtered.length) {
                    flatListLiqRef.current.scrollToIndex({ index: info.index, animated: false });
                  }
                }, 100);
              }}
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
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  if (flatListTodosRef.current && info.index < todosFilt.length) {
                    flatListTodosRef.current.scrollToIndex({ index: info.index, animated: false });
                  }
                }, 100);
              }}
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
      <ParcelasModal
        visible={modalParcelasVisible}
        onClose={() => setModalParcelasVisible(false)}
        clienteModal={clienteModal}
        parcelasModal={parcelasModal}
        loadingParcelas={loadingParcelas}
        creditoDisponivel={creditoDisponivel}
        liqId={liqId}
        isViz={isViz}
        isClientePago={clienteModal ? clientesPagosNaLiq.has(clienteModal.id) : false}
        onPagar={abrirPagamento}
        onEstornar={abrirEstorno}
        t={t}
      />

      {/* MODAL PAGAMENTO - COM CRÉDITO E VALIDAÇÕES */}
      <PagamentoModal
        visible={modalPagamentoVisible}
        onClose={() => setModalPagamentoVisible(false)}
        parcelaPagamento={parcelaPagamento}
        clienteModal={clienteModal}
        dadosPagamento={dadosPagamento}
        parcelasModalLength={parcelasModal.length}
        loadingDadosPagamento={loadingDadosPagamento}
        valorPagamento={valorPagamento}
        setValorPagamento={setValorPagamento}
        usarCredito={usarCredito}
        setUsarCredito={setUsarCredito}
        formaPagamento={formaPagamento}
        setFormaPagamento={setFormaPagamento}
        gpsStatus={gpsStatus}
        processando={processando}
        onIrProximaParcela={irParaProximaParcela}
        onRegistrarPagamento={registrarPagamento}
        t={t}
      />

      <EstornoModal
        visible={modalEstornoVisible}
        onClose={() => setModalEstornoVisible(false)}
        parcela={parcelaEstorno}
        clienteNome={clienteModal?.nome || ''}
        motivoEstorno={motivoEstorno}
        setMotivoEstorno={setMotivoEstorno}
        processando={processando}
        onConfirmar={confirmarEstorno}
        lang={lang}
        t={t}
      />

      {/* Modal Solicitação de Autorização de Estorno */}
       <AutorizacaoEstornoModal
        visible={modalAutorizacaoEstornoVisible}
        onClose={() => { setModalAutorizacaoEstornoVisible(false); setParcelaAguardandoAutorizacao(null); }}
        parcela={parcelaAguardandoAutorizacao}
        clienteNome={clienteModal?.nome || ''}
        motivo={motivoSolicitacaoEstorno}
        setMotivo={setMotivoSolicitacaoEstorno}
        enviando={enviandoSolicitacaoEstorno}
        onEnviar={enviarSolicitacaoEstorno}
        lang={lang}
        t={t}
      />


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
        liquidacaoId={liqId || liqCtx.liquidacaoAtual?.id || undefined}
        liquidacaoStatus={liqCtx.liquidacaoAtual?.status || null}
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
        liquidacaoId={liqId || liqCtx.liquidacaoAtual?.id || undefined}
        liquidacaoStatus={liqCtx.liquidacaoAtual?.status || null}
        clienteId={notasClienteId}
        clienteNome={notasClienteNome}
        lang={lang}
        coords={coords}
        permitirCriar={!!(liqId || liqCtx.liquidacaoAtual?.id)}
        mensagemSemLiq={lang === 'es' ? 'Abra una liquidación para crear notas' : 'Abra uma liquidação para criar notas'}
        obsLocalPadrao="Cliente"
      />

      {/* Modal Detalhes do Cliente */}
      <ClienteDetalhesModal
        visible={modalDetalhesVisible}
        onClose={() => { setModalDetalhesVisible(false); setDetalhesCliente(null); }}
        cliente={detalhesCliente}
        lang={lang}
        onNovoEmprestimo={(cli) => {
          // Mesmo fluxo do onNovoEmprestimo do ClienteCardTodos
          const confirmar = () => { 
            const nav = navigation.getParent() || navigation; 
            nav.navigate('NovoCliente', { 
              clienteExistente: { 
                id: cli.id, 
                nome: cli.nome, 
                telefone_celular: (cli as any).telefone_celular || '', 
                documento: (cli as any).codigo_cliente?.toString() || '' 
              } 
            }); 
          };
          if (Platform.OS === 'web') { 
            if (window.confirm(t.confirmarNovoEmprestimo)) confirmar(); 
          } else { 
            Alert.alert(t.novoEmprestimo, t.confirmarNovoEmprestimo, [
              { text: t.nao, style: 'cancel' }, 
              { text: t.sim, onPress: confirmar }
            ]); 
          }
        }}
        onRenegociar={(cli, emp) => {
          // Mesmo fluxo do onRenegociar do ClienteCardTodos
          const nav = navigation.getParent() || navigation;
          nav.navigate('NovoCliente', { 
            renegociacao: { 
              emprestimo_id: emp.id, 
              cliente_id: cli.id, 
              cliente_nome: cli.nome, 
              saldo_devedor: (emp as any).valor_saldo || 0,
              telefone_celular: (cli as any).telefone_celular || '', 
              codigo_cliente: (cli as any).codigo_cliente 
            } 
          });
        }}
      />

      {/* ⭐ Modal Não Pago */}
      {modalNaoPagoVisible && (
        <View style={S.naoPagoOverlay}>
          <View style={S.naoPagoModal}>
            <View style={S.naoPagoHeader}>
              <Text style={S.naoPagoTitle}>{lang === 'es' ? '✗ Registrar No Pago' : '✗ Registrar Não Pago'}</Text>
              <TouchableOpacity onPress={() => setModalNaoPagoVisible(false)} style={S.naoPagoClose}>
                <Text style={S.naoPagoCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={S.naoPagoBody}>
              <Text style={S.naoPagoCliente}>{naoPagoClienteInfo?.nome}</Text>
              <Text style={S.naoPagoParcela}>
                {lang === 'es' ? 'Cuota' : 'Parcela'} {naoPagoParcelaInfo?.numero_parcela} — $ {naoPagoParcelaInfo?.valor_parcela?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              
              <Text style={S.naoPagoLabel}>{lang === 'es' ? 'Observación (opcional):' : 'Observação (opcional):'}</Text>
              <TextInput
                style={S.naoPagoInput}
                placeholder={lang === 'es' ? 'Motivo por el que no pagó...' : 'Motivo pelo qual não pagou...'}
                placeholderTextColor="#9CA3AF"
                value={naoPagoObservacao}
                onChangeText={setNaoPagoObservacao}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            
            <View style={S.naoPagoFooter}>
              <TouchableOpacity 
                style={S.naoPagoBtnCancelar} 
                onPress={() => setModalNaoPagoVisible(false)}
                disabled={salvandoNaoPago}
              >
                <Text style={S.naoPagoBtnCancelarText}>{lang === 'es' ? 'Cancelar' : 'Cancelar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[S.naoPagoBtnConfirmar, salvandoNaoPago && { opacity: 0.6 }]} 
                onPress={registrarNaoPago}
                disabled={salvandoNaoPago}
              >
                {salvandoNaoPago ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={S.naoPagoBtnConfirmarText}>{lang === 'es' ? 'Confirmar' : 'Confirmar'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#EEF2FF' },
  lW: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  lT: { marginTop: 12, color: '#6B7280', fontSize: 14 },

  // Header
  newHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  newTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Search
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  badgePagas: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 5,
  },
  badgePagasActive: {
    backgroundColor: '#10B981',
  },
  badgePagasText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  badgePagasTextActive: {
    color: '#FFF',
  },
  filterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Banner de visualização
  vizBanner: { backgroundColor: '#FEF3C7', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  vizBannerContent: { flexDirection: 'row', alignItems: 'center' },
  vizBannerIcon: { fontSize: 16, marginRight: 10 },
  vizBannerTexts: { flex: 1 },
  vizBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  vizBannerDesc: { fontSize: 11, color: '#B45309', marginTop: 1 },

  // Banner sem liquidação
  semLiqBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  semLiqIcon: { fontSize: 18, marginRight: 10 },
  semLiqTexts: { flex: 1 },
  semLiqTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  semLiqDesc: { fontSize: 11, color: '#B91C1C', marginTop: 1 },

  // Lista
  ls: { flex: 1, marginTop: 10, zIndex: 1 },
  lsI: { paddingHorizontal: 16 },

  // Empty state
  em: { alignItems: 'center', paddingTop: 60 },
  emI: { fontSize: 48, marginBottom: 12 },
  emT: { fontSize: 14, color: '#9CA3AF' },

  // Alphabet sidebar indicator
  alphaIndicator: { position: 'absolute', left: '50%', top: '45%', marginLeft: -30, marginTop: -30, width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  alphaIndicatorText: { color: '#fff', fontSize: 28, fontWeight: '800' },

  // ⭐ Modal Não Pago
  naoPagoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  naoPagoModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  naoPagoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  naoPagoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  naoPagoClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  naoPagoCloseText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  naoPagoBody: {
    padding: 16,
  },
  naoPagoCliente: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  naoPagoParcela: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  naoPagoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  naoPagoInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 80,
    backgroundColor: '#F9FAFB',
  },
  naoPagoFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 0,
  },
  naoPagoBtnCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  naoPagoBtnCancelarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  naoPagoBtnConfirmar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6B7280',
    alignItems: 'center',
  },
  naoPagoBtnConfirmarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});