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
import MenuPagamento from '../components/MenuPagamento';
import ConfirmModal from '../components/ConfirmModal';
import PagarMultiplasModal from '../components/PagarMultiplasModal';
import ValorLivreModal from '../components/ValorLivreModal';
import ResumoPagamentoModal from '../components/ResumoPagamentoModal';
import ParcelasModal, { PagamentoDetalhe } from '../components/ParcelasModal';
import ProximosDiasModal from '../components/ProximosDiasModal';
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
  foto_url: string | null;
  latitude: number | null; longitude: number | null;
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number; valor_total?: number;
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
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number; valor_total?: number;
  numero_parcelas: number; status_emprestimo: string; frequencia_pagamento: string;
  parcela_id: string; numero_parcela: number; valor_parcela: number;
  valor_pago_parcela: number; saldo_parcela: number; status_parcela: string;
  data_vencimento: string; ordem_visita_dia: number | null;
  tem_parcelas_vencidas: boolean; total_parcelas_vencidas: number;
  valor_total_vencido: number; status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  is_parcela_atrasada?: boolean;
  pagamento_info?: { valorPago: number; creditoGerado: number; valorParcela: number; dataPagamento?: string | null };
  data_emprestimo?: string;
}

interface ClienteAgrupado {
  cliente_id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  foto_url: string | null;
  latitude: number | null; longitude: number | null; rota_id: string;
  emprestimos: EmprestimoData[]; qtd_emprestimos: number; tem_multiplos_vencimentos: boolean;
}

// Um item da lista da liquidação = UM card.
// Normalmente é o cliente com todos os seus empréstimos (o card vira carrossel
// quando são 2+). Na aba "Pagas" o cliente com 2+ contas é QUEBRADO em um card
// por empréstimo pago: como a ordenação ali é o momento do pagamento, quem
// pagou uma conta às 10h e a outra às 13h aparece duas vezes, cada uma na sua
// posição real — com outros clientes entre elas.
interface ItemLista {
  key: string;
  nome: string;               // exigido pelo AlphabetSidebar
  cliente: ClienteAgrupado;
  emprestimos: EmprestimoData[];
  ms: number;                 // 1º pagamento do item nesta liquidação (ordenação)
}

interface ClienteTodos {
  id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; foto_url: string | null;
  status: string; tem_atraso: boolean;
  permite_renegociacao: boolean; permite_emprestimo_adicional: boolean;
  cliente_created_at?: string;
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
  valor_credito_gerado: number; valor_credito_usado?: number; valor_pago_nesta_liq?: number; valor_credito_usado_nesta_liq?: number; valor_parcela: number; data_pagamento: string;
  created_at?: string; liquidacao_id?: string;
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
    freqTodos: 'Todas', freqDiario: 'Diário', freqSemanal: 'Semanal',
    freqQuinzenal: 'Quinzenal', freqMensal: 'Mensal', freqFlexivel: 'Flexível',
    parcela: 'Parcela', saldoEmprestimo: 'Saldo Empréstimo',
    parcelasVencidas: 'parcela(s) vencida(s)', totalAtraso: 'Total em atraso:',
    emprestimo: 'Empréstimo', principal: 'Principal', juros: 'Juros',
    total: 'Total', jaPago: 'Já Pago', saldo: 'Saldo', parcelas: 'Parcelas',
    progresso: 'Progresso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Parcelas', contato: 'Contato', ir: 'IR', notas: 'Notas',
    semParcelaEmAberto: 'Sem parcela em aberto',
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
    atencaoQuitacao: 'Quitação de Empréstimo',
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
    freqTodos: 'Todas', freqDiario: 'Diario', freqSemanal: 'Semanal',
    freqQuinzenal: 'Quincenal', freqMensal: 'Mensual', freqFlexivel: 'Flexible',
    parcela: 'Cuota', saldoEmprestimo: 'Saldo Préstamo',
    parcelasVencidas: 'cuota(s) vencida(s)', totalAtraso: 'Total en atraso:',
    emprestimo: 'Préstamo', principal: 'Principal', juros: 'Intereses',
    total: 'Total', jaPago: 'Ya Pagó', saldo: 'Saldo', parcelas: 'Cuotas',
    progresso: 'Progreso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Cuotas', contato: 'Contacto', ir: 'IR', notas: 'Notas',
    semParcelaEmAberto: 'Sin cuota abierta',
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
    atencaoQuitacao: 'Liquidación de Préstamo',
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
// ⭐ Normaliza texto para busca: remove acentos + lowercase
const normalizarBusca = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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
  if (vencidas <= 0) return '#10B981'; // verde — em dia
  if (vencidas <= 3) return '#F59E0B'; // amarelo — atraso leve
  if (vencidas <= 7) return '#9333EA'; // roxo — atraso médio (era laranja #F97316, pedido #39)
  return '#EF4444'; // vermelho — atraso crítico
};

const borderOf = (e: EmprestimoData, paga: boolean) => {
  // Regra simplificada (decisão do cliente): sem parcela vencida = EM DIA
  // (verde); com parcela vencida = ATRASO. Estado "pendente" (cinza) eliminado.
  if (paga) return '#10B981';
  const vencidas = e.total_parcelas_vencidas || 0;
  if (vencidas > 0) return corAtraso(vencidas);
  if (e.is_parcela_atrasada) return corAtraso(1);
  return '#10B981';
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
  // Config da rota: se trabalha aos domingos (afeta cálculo de dias de atraso)
  const [trabalhaDomingo, setTrabalhaDomingo] = useState(true);
  useEffect(() => {
    if (!rotaId) return;
    supabase.from('rotas').select('trabalha_domingo').eq('id', rotaId).single()
      .then(({ data }) => { if (data) setTrabalhaDomingo(data.trabalha_domingo !== false); })
      .catch(() => {});
  }, [rotaId]);

  // Feriados da rota: dia sem cobrança não é atraso do cliente — a rota não
  // passou. Mesma regra do domingo. Sem esta carga o atraso volta a contar
  // feriado, que foi metade do bug relatado pelo campo.
  const [feriadosRota, setFeriadosRota] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!rotaId) { setFeriadosRota(new Set()); return; }
    supabase.from('feriados_rota').select('data').eq('rota_id', rotaId)
      .then(({ data, error }) => {
        if (error) { console.error('Erro ao carregar feriados da rota:', error); return; }
        setFeriadosRota(new Set((data || []).map((f: any) => String(f.data).substring(0, 10))));
      });
  }, [rotaId]);

  // Objeto estável: recriá-lo a cada render remontaria o memo dos cards.
  const configCobranca = React.useMemo(
    () => ({ trabalhaDomingo, feriados: feriadosRota }),
    [trabalhaDomingo, feriadosRota],
  );
  // data_liquidacao = campo DATE puro sem timezone (adicionado na migration 09)
  // Fallback: data_abertura.substring(0,10) sem conversão UTC
  // Último fallback: data local do dispositivo
  const _liqAtual = liqCtx.liquidacaoAtual as any;

  // ═══════════════════════════════════════════════════════════════════════
  // ORIGEM ÚNICA DO PAR (liqId, dataLiq)
  //
  // `liqId` e `dataLiq` DEVEM sair sempre da MESMA fonte. Antes eram duas
  // cascatas independentes de `||`, e bastava um dos campos do contexto ser
  // limpo sem os outros para produzir um par corrompido — por exemplo
  // `liqId` do dia 17 combinado com `dataLiq` de hoje, fazendo a RPC devolver
  // um conjunto de clientes que não corresponde a dia nenhum.
  //
  // A "seleção de visualização" vive partida em três campos do contexto
  // (modoVisualizacao / liquidacaoIdVisualizacao / dataVisualizacao), escritos
  // por caminhos diferentes. Aqui ela só é aceita se os TRÊS concordarem;
  // qualquer estado pela metade é tratado como "sem seleção".
  // ═══════════════════════════════════════════════════════════════════════
  const vizCoerente = !!(
    liqCtx.modoVisualizacao &&
    liqCtx.liquidacaoIdVisualizacao &&
    liqCtx.dataVisualizacao
  );
  const routeCoerente = !!(route?.params?.liquidacaoId || route?.params?.dataLiquidacao);
  const statusLiq = liqCtx.liquidacaoAtual?.status;
  const abertaCoerente = !!(
    (statusLiq === 'ABERTO' || statusLiq === 'ABERTA' || statusLiq === 'REABERTO') &&
    liqCtx.liquidacaoAtual?.id
  );

  const hojeStr = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

  let liqId: string | null = null;
  let dataLiq: string;
  if (vizCoerente) {
    liqId = liqCtx.liquidacaoIdVisualizacao;
    dataLiq = liqCtx.dataVisualizacao as string;
  } else if (routeCoerente) {
    liqId = route?.params?.liquidacaoId || null;
    dataLiq = route?.params?.dataLiquidacao || hojeStr();
  } else if (abertaCoerente) {
    liqId = liqCtx.liquidacaoAtual?.id || null;
    dataLiq = _liqAtual?.data_liquidacao?.substring(0, 10)
      || (_liqAtual?.data_abertura ? _liqAtual.data_abertura.substring(0, 10) : null)
      || hojeStr();
  } else {
    // Sem seleção coerente: nada de liquidação é carregado (só a aba Todos).
    liqId = null;
    dataLiq = hojeStr();
  }

  // Dia operacional da tela: a liquidação em foco. É contra ela que se decide
  // o que está vencido — não contra o status do banco, que o trigger
  // atualizar_saldo_parcela grava comparando com CURRENT_DATE. Numa liquidação
  // retroativa aquele status marca como vencida parcela que ainda nem venceu.
  const dataOperacionalTela = dataLiq || new Date().toISOString().substring(0, 10);

  const isViz = vizCoerente || route?.params?.isVisualizacao || false;

  // FASE 2.1 — quando a tela está na liquidação ABERTA, o CONTEXTO é a fonte
  // única: o hook não busca sozinho, só espelha o cache (sem busca duplicada).
  // Visualização ou navegação por route-param => modo autônomo (busca direto).
  // Sem liquidação selecionada não existe "liquidação" nem "pagos" para
  // mostrar — só a aba Todos. Nada de liquidação é buscado.
  const temSelecaoLiq = !!liqId;

  const usarCacheCtx = !!(
    !isViz &&
    !route?.params?.liquidacaoId &&
    !route?.params?.dataLiquidacao &&
    liqId && liqId === liqCtx.liquidacaoAtual?.id
  );
  const seedClientes = usarCacheCtx ? {
    raw: liqCtx.clientesRaw,
    pagasSet: liqCtx.pagasSet,
    pagMap: liqCtx.pagMap,
    clientesPagosNaLiq: liqCtx.clientesPagosNaLiq,
    ordemRotaMap: liqCtx.ordemRotaMap,
    updatedAt: liqCtx.clientesUpdatedAt,
  } : undefined;
  const {
    raw, setRaw,
    pagasSet, setPagasSet,
    pagMap, setPagMap,
    clientesPagosNaLiq, setClientesPagosNaLiq,
    ordemRotaMap, setOrdemRotaMap,
    loading, setLoading,
    revalidando,
    refreshing, setRefreshing,
    loadLiq,
    atualizarSaldoLocalLiq,
  } = useClientesLiquidacao({
    rotaId,
    dataLiq,
    liqId,
    enabled: !usarCacheCtx && temSelecaoLiq,
    seed: seedClientes,
    // ⚠️ recarregarTUDO, não só os clientes.
    // `recarregarClientes` relê a lista do dia mas NÃO relê a linha de
    // `liquidacoes_diarias`. Com isso, nenhum caminho de refresh desta tela
    // (puxar para atualizar, voltar o foco, pós-pagamento) enxergava uma
    // mudança de status feita pelo admin no painel — reabertura, fechamento.
    // O objeto ficava velho em memória até a tela ser destruída e remontada,
    // que é o "só funciona saindo e entrando do sistema" relatado pelo campo.
    onReload: liqCtx.recarregarTudo,
  });

  // DEBUG TEMPORÁRIO - REMOVER DEPOIS
  console.log('🔍 DEBUG ClientesScreen:', JSON.stringify({
    build: 'v3-voltar-condicional',
    liqId: liqId || 'NULL',
    dataLiq,
    isViz,
    temSelecaoLiq,
    enabledHook: !usarCacheCtx && temSelecaoLiq,
    usarCacheCtx,
    ctxAtualId: liqCtx.liquidacaoAtual?.id || 'NULL',
    ctxAtualStatus: liqCtx.liquidacaoAtual?.status || 'NULL',
    ctxTemAberta: liqCtx.temLiquidacaoAberta,
    ctxIdViz: liqCtx.liquidacaoIdVisualizacao || 'NULL',
    ctxModoViz: liqCtx.modoVisualizacao,
    ctxDataViz: liqCtx.dataVisualizacao || 'NULL',
    routeLiqId: route?.params?.liquidacaoId || 'NULL',
    routeDataLiq: route?.params?.dataLiquidacao || 'NULL',
    qtdRaw: raw.length,
  }));

  const lang = liqCtx.language || 'pt-BR';
  // Se não há liquidação aberta, força tab "todos"
  const [tab, setTab] = useState<TabAtiva>(!liqId ? 'todos' : 'liquidacao');

  const {
    todosList, setTodosList,
    loadTodos,
    todosCount,
    todosUpdatedAt,
    loadTodosClientes,
    atualizarSaldoLocalTodos,
  } = useClientesTodos({ rotaId, dataOperacional: dataOperacionalTela, setOrdemRotaMap, setRefreshing });
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
  // 'DIA' = só quem tem parcela vencendo na data da liquidação (mesma base de
  // clientes_iniciais). 'CARREGADOS' inclui os atrasados de dias anteriores,
  // que também vão para a rota. Começa em CARREGADOS para não mudar o que o
  // vendedor já enxerga hoje.
  const [filtroVencimento, setFiltroVencimento] = useState<'todos' | 'dia' | 'atrasados'>('todos');
  const [ord, setOrd] = useState<OrdenacaoLiquidacao>('rota');
  const [showOrd, setShowOrd] = useState(false);

  const [expandedTodos, setExpandedTodos] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroFrequencia, setFiltroFrequencia] = useState<string>('todos');
  const [showProximosDias, setShowProximosDias] = useState(false);
  const [showFiltroTipo, setShowFiltroTipo] = useState(false);
  const [showFiltroStatus, setShowFiltroStatus] = useState(false);
  const [ocultarLiquidacao, setOcultarLiquidacao] = useState(false);

  // Sinaliza se há algum filtro do drawer ativo (bolinha vermelha no ícone)
  const temFiltroAtivo = filtro !== 'todos' || filtroTipo !== 'todos' || filtroStatus !== 'todos' || filtroFrequencia !== 'todos' || ocultarLiquidacao;

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
  // ⭐ Menu de pagamento (5 opções) — aparece ao tocar "Pagar"
  const [menuPagamentoVisible, setMenuPagamentoVisible] = useState(false);
  // Modo do modal de pagamento: 'livre' (campo editável) ou 'quitar' (valor = saldo)
  const [modoPagamento, setModoPagamento] = useState<'parcela' | 'livre' | 'quitar'>('parcela');
  // ⭐ Modal de confirmação próprio (Alert nativo não aparece sobre Modal no Android)
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean; titulo: string; mensagem: string; corConfirmar?: string; onConfirmar: () => void;
  }>({ visible: false, titulo: '', mensagem: '', onConfirmar: () => {} });
  // ⭐ Tela nova "Pagar mais de 1 parcela" (com cascata de crédito)
  const [multiplasVisible, setMultiplasVisible] = useState(false);
  const [multiplasParcelas, setMultiplasParcelas] = useState<ParcelaModal[]>([]);
  const [loadingMultiplas, setLoadingMultiplas] = useState(false);
  // ⭐ Popup "Valor livre" (mínimo, 2 passos: campo + cenário)
  const [valorLivreVisible, setValorLivreVisible] = useState(false);
  // ⭐ Resumo de pagamento (saldo/cheia/valor livre → confirma o cenário)
  const [resumoVisible, setResumoVisible] = useState(false);
  const [resumoValor, setResumoValor] = useState(0);
  // Complemento em crédito do pagamento em curso (0 quando é só dinheiro).
  const [resumoCredito, setResumoCredito] = useState(0);
  const [modalEstornoVisible, setModalEstornoVisible] = useState(false);
  const [parcelasModal, setParcelasModal] = useState<ParcelaModal[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [pagamentosDetalhados, setPagamentosDetalhados] = useState<Map<string, PagamentoDetalhe[]>>(new Map());
  const [solicitacoesRenovacaoMap, setSolicitacoesRenovacaoMap] = useState<Map<string, {
    solic_id: string; status: string;
    valor_solicitado: number; valor_limite: number; emprestimo_id: string | null;
  }>>(new Map());
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);
  const [clienteModal, setClienteModal] = useState<{ id: string; nome: string; emprestimo_id: string; emprestimo_status?: string; saldo_emprestimo?: number } | null>(null);
  
  const [parcelaPagamento, setParcelaPagamento] = useState<ParcelaModal | null>(null);
  const [dadosPagamento, setDadosPagamento] = useState<any>(null);
  const [loadingDadosPagamento, setLoadingDadosPagamento] = useState(false);
  // ⭐ Dados extras para o fluxo de 2 passos do PagamentoModal (cenário + faixa de parcial)
  const [emprestimoInfoPag, setEmprestimoInfoPag] = useState<{ valor_total: number; total_pago: number } | null>(null);
  const [pagamentosParciaisPag, setPagamentosParciaisPag] = useState<{ valor: number; dataLiq: string | null }[]>([]);
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
          const raw = data.permitir_exclusao_parcelas;
          // Normaliza para boolean: aceita true, "true", 1, "1".
          // Só é false se explicitamente false/"false"/0. Ausente (null) → true.
          const permite = raw == null
            ? true
            : (raw === true || String(raw).toLowerCase() === 'true' || String(raw) === '1');
          console.log('[CONFIG] permitir_exclusao_parcelas raw =', raw, '→', permite);
          setConfigVendedor({ permitir_exclusao_parcelas: permite });
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
        showAlert('OK', res.mensagem || (lang === 'es' ? 'Cliente registrado como no pagó' : 'Cliente registrado como não pagou'));
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
  
  // ⭐ Aba x seleção de liquidação
  //    Antes esta troca dependia de `temLiquidacaoAberta`, que é sempre false
  //    ao visualizar uma liquidação FECHADA — a aba ficava presa em "Todos"
  //    mesmo com os dados carregados (a lista existe, mas com height: 0).
  //    Agora reage a `liqId`, que cobre aberta e visualização.
  const tabManualRef = useRef(false);
  useEffect(() => {
    if (!liqId) {
      // Sem seleção: só existe "Todos". Volta a permitir troca automática.
      setTab('todos');
      tabManualRef.current = false;
      return;
    }
    if (!tabManualRef.current) setTab('liquidacao');
  }, [liqId]);

  // ⭐ Observar sinal de reset de filtro (disparado após reset de cliente no extrato)
  // Quando o reset é feito, recarrega clientes E desmarca o breadcrumb "pagos"
  useEffect(() => {
    if (liqCtx.resetFiltroSinal > 0) {
      setFiltro('todos');
      loadLiq(true);
    }
  }, [liqCtx.resetFiltroSinal]);

  // ⭐ Limpar TODOS os filtros quando a data operacional muda (virada de dia).
  // Filtros podem ficar ativos durante o mesmo dia, mas não devem persistir no
  // dia seguinte — senão escondem clientes e geram confusão (ex.: "7 na
  // liquidação, 0 na lista"). Vale para qualquer mudança de dia: nova
  // liquidação, troca de dia na visualização, ou o dia real virar.
  const dataOperacionalRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('🔎 DATA_OP_EFFECT', { anterior: dataOperacionalRef.current, atual: dataLiq });
    }
    if (dataOperacionalRef.current === null) {
      // primeira montagem: só registra, não limpa (respeita filtro recém-aplicado)
      dataOperacionalRef.current = dataLiq;
      return;
    }
    if (dataOperacionalRef.current !== dataLiq) {
      // a data mudou → limpa todos os filtros
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('🔎 LIMPANDO FILTROS (dia mudou)');
      setFiltro('todos');
      setBusca('');
      setFiltroTipo('todos');
      setFiltroStatus('todos');
      setFiltroFrequencia('todos');
      dataOperacionalRef.current = dataLiq;
    }
  }, [dataLiq]);

  // ⭐ Recarregar lista ao voltar para a tela (após criar novo empréstimo, renovar, etc)
  const isFirstMount = useRef(true);

  // ═══════════════════════════════════════════════════════════════════════
  // REFS DE LEITURA DO FOCUS EFFECT
  //
  // O useFocusEffect do React Navigation re-executa o callback sempre que a
  // IDENTIDADE dele muda — não só quando a tela ganha foco. Antes, `tab`
  // estava nas dependências do useCallback: cada toque no segmentado recriava
  // o callback, o efeito rodava de novo e disparava refetch + query de
  // solicitações. Como loadTodosClientes(true) faz setLoadTodos(true), a lista
  // era substituída por um spinner de tela cheia — parecia recarga da tela.
  //
  // Agora tudo que o efeito precisa LER vive em refs, e as deps são [].
  // O callback só roda em foco real. Trocar de aba = só trocar visibilidade.
  //
  // ⚠️ Refs (e não closures) são obrigatórias aqui: com deps [], valores
  // capturados no corpo do callback ficariam congelados na montagem.
  // ═══════════════════════════════════════════════════════════════════════
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const clientesUpdatedAtRef = useRef(0);
  useEffect(() => { clientesUpdatedAtRef.current = liqCtx.clientesUpdatedAt || 0; }, [liqCtx.clientesUpdatedAt]);

  const todosUpdatedAtRef = useRef(0);
  useEffect(() => { todosUpdatedAtRef.current = todosUpdatedAt || 0; }, [todosUpdatedAt]);

  // Carimbo de invalidação vinda do contexto (venda/renegociação recém-criada).
  // Em ref pelo mesmo motivo dos dois acima: o useFocusEffect tem lista de
  // dependências vazia e leria uma closure velha.
  const invalidadosEmRef = useRef(0);
  useEffect(() => { invalidadosEmRef.current = liqCtx.clientesInvalidadosEm || 0; }, [liqCtx.clientesInvalidadosEm]);

  const loadLiqRef = useRef(loadLiq);
  useEffect(() => { loadLiqRef.current = loadLiq; }, [loadLiq]);

  const loadTodosClientesRef = useRef(loadTodosClientes);
  useEffect(() => { loadTodosClientesRef.current = loadTodosClientes; }, [loadTodosClientes]);

  // Solicitações RENOVACAO_EXCEDE_ANTERIOR da rota — função única,
  // usada tanto na montagem quanto ao reganhar foco.
  const carregarSolicitacoesRenovacao = useCallback(async () => {
    if (!rotaId) return;
    const { data } = await supabase
      .from('solicitacoes_autorizacao')
      .select('id, cliente_id, status, valor_solicitado, valor_limite, emprestimo_id')
      .eq('rota_id', rotaId)
      .eq('tipo_solicitacao', 'RENOVACAO_EXCEDE_ANTERIOR')
      .in('status', ['PENDENTE', 'APROVADO'])
      .order('created_at', { ascending: false });
    const m = new Map<string, { solic_id: string; status: string; valor_solicitado: number; valor_limite: number; emprestimo_id: string | null }>();
    (data || []).forEach((s: any) => { if (!m.has(s.cliente_id)) m.set(s.cliente_id, { solic_id: s.id, status: s.status, valor_solicitado: s.valor_solicitado || 0, valor_limite: s.valor_limite || 0, emprestimo_id: s.emprestimo_id }); });
    setSolicitacoesRenovacaoMap(m);
  }, [rotaId]);

  const carregarSolicitacoesRef = useRef(carregarSolicitacoesRenovacao);
  useEffect(() => { carregarSolicitacoesRef.current = carregarSolicitacoesRenovacao; }, [carregarSolicitacoesRenovacao]);

  useFocusEffect(
    useCallback(() => {
      // Na primeira montagem, não recarrega (os outros useEffects já fazem isso)
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }

      // Ao voltar para a tela, só recarrega se os dados DA ABA ATIVA estão
      // stale (>30s). Cada aba tem seu próprio timestamp: antes, o de "Todos"
      // era avaliado pelo clientesUpdatedAt da liquidação, sem relação nenhuma.
      const agora = Date.now();
      const tabAtual = tabRef.current;
      const ultimaCarga = tabAtual === 'liquidacao'
        ? clientesUpdatedAtRef.current
        : todosUpdatedAtRef.current;
      const stale = agora - ultimaCarga > 30000;

      // Furo controlado na regra dos 30s: quando o próprio app criou ou alterou
      // um empréstimo (venda, renegociação, renovação), os dados estão obsoletos
      // por definição — não importa há quanto tempo foram carregados. Sem isto,
      // quem voltava da NovaVenda em menos de 30s via o card velho e achava que
      // o sistema tinha demorado a atualizar.
      const invalidado = invalidadosEmRef.current > ultimaCarga;

      if (stale || invalidado) {
        console.log('🔄 useFocusEffect: recarregando aba', tabAtual,
          invalidado ? '(dados invalidados por ação do app)' : '(stale)');
        if (tabAtual === 'liquidacao') loadLiqRef.current();
        else loadTodosClientesRef.current(true);
      } else {
        console.log('✅ useFocusEffect: Dados frescos, sem recarregar');
      }

      // Solicitações podem ter mudado ao voltar de NovaVenda
      carregarSolicitacoesRef.current();
    }, [])
  );

  // Carrega solicitações RENOVACAO_EXCEDE_ANTERIOR da rota ao montar
  useEffect(() => {
    carregarSolicitacoesRenovacao();
  }, [carregarSolicitacoesRenovacao]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Rede de segurança: garante que o spinner SEMPRE desligue, mesmo que
    // loadLiq/loadTodosClientes não resolvam (corrida no contexto, promise
    // pendente, early-return sem desligar). Antes, um desses caminhos deixava
    // o refreshing preso em true — o "carregando infinito" que só saía ao
    // sair e voltar da tela.
    const timeout = setTimeout(() => setRefreshing(false), 8000);
    try {
      if (tab === 'liquidacao') {
        await loadLiq(true);
      } else {
        await loadTodosClientes(true);
      }
    } catch (e) {
      console.error('Erro no refresh:', e);
    } finally {
      clearTimeout(timeout);
      setRefreshing(false);
    }
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
    setPagamentosDetalhados(new Map());
    setCreditoDisponivel(0);
    try {
      const { data: parcelas, error: errP } = await supabase.from('emprestimo_parcelas').select('id, emprestimo_id, numero_parcela, valor_parcela, valor_pago, valor_saldo, valor_multa, data_vencimento, data_pagamento, status, saldo_excedente, liquidacao_id, observacoes, ordem_visita_dia').eq('emprestimo_id', emprestimoId).order('numero_parcela', { ascending: true });
      if (errP) throw errP;
      if (!parcelas || parcelas.length === 0) { setParcelasModal([]); setLoadingParcelas(false); return; }
      const ids = parcelas.map((p: any) => p.id);
      
      // Busca TODOS os pagamentos (incluindo estornados) para pMap + popup de detalhes
      const { data: pagamentos } = await supabase
        .from('pagamentos_parcelas')
        .select('id, parcela_id, valor_pago_atual, valor_credito_usado, valor_credito_gerado, liquidacao_id, forma_pagamento, estornado, created_at, motivo_estorno, estornado_por, data_estorno')
        .in('parcela_id', ids)
        .order('created_at', { ascending: true });
      
      // pMap: manter apenas o pagamento MAIS RECENTE não-estornado por parcela (lógica original)
      const pMap = new Map<string, { valorPago: number; creditoUsado: number; creditoGerado: number; liquidacaoId: string | null }>();
      (pagamentos || []).filter((p: any) => !p.estornado).forEach((p: any) => { 
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
      
      // Resolver nomes de quem estornou (lote). estornado_por = user_id.
      // Mesma fonte que a fn_estornar_pagamento usa: user_profiles.
      const estornadoPorIds = [...new Set(
        (pagamentos || [])
          .filter((p: any) => p.estornado && p.estornado_por)
          .map((p: any) => p.estornado_por)
      )].filter(Boolean);
      const nomeEstornoMap = new Map<string, string>();
      if (estornadoPorIds.length > 0) {
        const { data: perfis } = await supabase
          .from('user_profiles')
          .select('user_id, nome')
          .in('user_id', estornadoPorIds);
        (perfis || []).forEach((u: any) => nomeEstornoMap.set(u.user_id, u.nome));
      }

      // detMap: todos os pagamentos agrupados por parcela_id (para popup de detalhes)
      // Construído APÓS liqDataMap para poder resolver a data_liquidacao de cada pagamento
      const detMap = new Map<string, PagamentoDetalhe[]>();
      (pagamentos || []).forEach((p: any) => {
        const dataLiqPag = p.liquidacao_id ? (liqDataMap.get(p.liquidacao_id) || null) : null;
        const entry: PagamentoDetalhe = {
          id: p.id,   // âncora do comprovante — anexo prende no PAGAMENTO
          valor_pago_total: p.valor_pago_atual || 0,
          valor_credito_usado: p.valor_credito_usado || 0,
          valor_credito_gerado: p.valor_credito_gerado || 0,
          forma_pagamento: p.forma_pagamento || undefined,
          created_at: p.created_at,
          estornado: p.estornado || false,
          data_liquidacao: dataLiqPag,
          // Detalhes do estorno (só relevantes quando estornado = true)
          motivo_estorno: p.motivo_estorno || undefined,
          data_estorno: p.data_estorno || undefined,
          estornado_por_nome: p.estornado_por ? (nomeEstornoMap.get(p.estornado_por) || undefined) : undefined,
        };
        const arr = detMap.get(p.parcela_id) || [];
        arr.push(entry);
        detMap.set(p.parcela_id, arr);
      });
      
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
        
        // DEBUG - verificar dados de cada parcela não-paga
        if (p.status !== 'PAGO' && vPago > 0) {
          console.log(`⚠️ PARCELA ${p.numero_parcela} com pagamento parcial:`, {
            parcela_id: p.id,
            status: p.status,
            valor_parcela: p.valor_parcela,
            valor_pago_db: p.valor_pago,
            valor_pago_usado: vPago,
            valor_saldo_db: p.valor_saldo,
            valor_saldo_usado: vSaldo,
          });
        }
        
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
      setPagamentosDetalhados(detMap);
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
    setEmprestimoInfoPag(null);
    setPagamentosParciaisPag([]);
    setModoPagamento('parcela');
    setMenuPagamentoVisible(true);   // ⭐ abre o MENU (5 opções), não o modal direto
    // GPS já roda em background via watchPosition, mas força refresh rápido
    if (gpsStatus !== 'ok') carregarGPS();
    
    try {
      const { data, error } = await supabase.rpc('fn_consultar_parcela_para_pagamento', { p_parcela_id: parcela.parcela_id });
      if (error) throw error;
      
      const dados = Array.isArray(data) ? data[0] : data;
      if (dados) {
        setDadosPagamento(dados);
        // Fluxo de 2 passos: campo sempre pré-preenchido com o VALOR CHEIO da parcela
        setValorPagamento(parcela.valor_parcela.toFixed(2).replace('.', ','));
      } else {
        setValorPagamento(parcela.valor_parcela.toFixed(2).replace('.', ','));
      }

      // ⭐ Dados extras (cenário do passo 2 + faixa de "parcialmente paga")
      const empId = clienteInfo?.emprestimo_id || (dados && dados.emprestimo_id);
      const [empRes, pagsRes] = await Promise.all([
        empId
          ? supabase.from('emprestimos').select('valor_total, total_pago').eq('id', empId).single()
          : Promise.resolve({ data: null } as any),
        supabase.from('pagamentos_parcelas')
          .select('valor_pago_atual, liquidacao_id, created_at')
          .eq('parcela_id', parcela.parcela_id)
          .eq('estornado', false)
          .order('created_at', { ascending: true }),
      ]);
      if (empRes?.data) {
        setEmprestimoInfoPag({
          valor_total: Number(empRes.data.valor_total || 0),
          total_pago: Number(empRes.data.total_pago || 0),
        });
      }
      const pags = (pagsRes?.data || []).filter((p: any) => Number(p.valor_pago_atual) > 0);
      if (pags.length > 0) {
        // Datas das liquidações dos pagamentos parciais
        const liqIds = [...new Set(pags.map((p: any) => p.liquidacao_id).filter(Boolean))];
        let liqDatas = new Map<string, string>();
        if (liqIds.length > 0) {
          const { data: liqs } = await supabase.from('liquidacoes_diarias').select('id, data_liquidacao').in('id', liqIds);
          (liqs || []).forEach((l: any) => liqDatas.set(l.id, l.data_liquidacao));
        }
        setPagamentosParciaisPag(pags.map((p: any) => ({
          valor: Number(p.valor_pago_atual),
          dataLiq: p.liquidacao_id ? (liqDatas.get(p.liquidacao_id) || null) : (p.created_at ? String(p.created_at).slice(0, 10) : null),
        })));
      } else if (dados && Number(dados.valor_pago) > 0) {
        // Parcela tem valor pago mas sem registros individuais (ex.: parcial da migração)
        setPagamentosParciaisPag([{ valor: Number(dados.valor_pago), dataLiq: null }]);
      }
    } catch (e) {
      console.error('Erro ao consultar parcela:', e);
      setValorPagamento(parcela.valor_parcela.toFixed(2).replace('.', ','));
    } finally {
      setLoadingDadosPagamento(false);
    }
  }, [liqId, isViz, t, carregarGPS]);

  // Pagar cliente da aba "Todos": busca a próxima parcela em aberto e abre o menu
  const pagarClienteTodos = useCallback(async (cliente: any, emprestimo: any) => {
    if (!liqId) { Alert.alert(t.atencao, t.liquidacaoNecessaria); return; }
    try {
      // Primeira parcela em aberto (mais antiga não paga) do empréstimo
      const { data, error } = await supabase
        .from('emprestimo_parcelas')
        .select('id, numero_parcela, valor_parcela, valor_pago, valor_saldo, valor_multa, status, data_vencimento, data_pagamento, saldo_excedente, liquidacao_id')
        .eq('emprestimo_id', emprestimo.id)
        .in('status', ['PENDENTE', 'PARCIAL', 'VENCIDO'])
        .order('numero_parcela', { ascending: true })
        .limit(1);
      if (error) throw error;
      const p = (data || [])[0];
      if (!p) { Alert.alert(t.atencao, t.semParcelaEmAberto || 'Sem parcela em aberto'); return; }
      const parcela: any = {
        parcela_id: p.id,
        numero_parcela: p.numero_parcela,
        valor_parcela: Number(p.valor_parcela || 0),
        valor_pago: Number(p.valor_pago || 0),
        valor_saldo: Number(p.valor_saldo ?? p.valor_parcela),
        valor_multa: Number(p.valor_multa || 0),
        status: p.status,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        saldo_excedente: Number(p.saldo_excedente || 0),
        liquidacao_id: p.liquidacao_id,
      };
      abrirPagamento(parcela, {
        id: cliente.id,
        nome: cliente.nome,
        emprestimo_id: emprestimo.id,
        saldo_emprestimo: Number(emprestimo.valor_saldo ?? emprestimo.saldo_emprestimo ?? 0),
        emprestimo_status: emprestimo.status,
      });
    } catch (e: any) {
      Alert.alert(t.erroGenerico, e.message || 'Erro ao abrir pagamento');
    }
  }, [liqId, t, abrirPagamento]);
  // AÇÕES DO MENU DE PAGAMENTO (5 opções)
  // ═══════════════════════════════════════════════════════════════════

  // Registra pagamento com valores EXPLÍCITOS (usado pelos popups do menu,
  // sem depender do state do input). valorEspecie = dinheiro, valorCredito = crédito.
  const registrarPagamentoDireto = useCallback(async (valorEspecie: number, valorCredito: number) => {
    if (!parcelaPagamento || processando) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_registrar_pagamento', {
        p_parcela_id: parcelaPagamento.parcela_id,
        p_valor_pagamento: valorEspecie,
        p_valor_credito: valorCredito,
        p_forma_pagamento: 'DINHEIRO',
        p_observacoes: null,
        p_latitude: coords?.lat || null,
        p_longitude: coords?.lng || null,
        p_precisao_gps: coords?.acc || null,
        p_liquidacao_id: liqId || null,
        p_user_id: vendedor?.user_id || null,
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        setModalPagamentoVisible(false);
        setMenuPagamentoVisible(false);
        setParcelaPagamento(null);
        setDadosPagamento(null);
        setUsarCredito(false);
        if (clienteModal?.emprestimo_id) { atualizarSaldoLocalLiq(clienteModal.emprestimo_id); atualizarSaldoLocalTodos(clienteModal.emprestimo_id); }
        loadLiq();
      } else {
        Alert.alert(t.erroGenerico, res?.mensagem || 'Erro no pagamento');
        setMenuPagamentoVisible(true);
      }
    } catch (e: any) {
      Alert.alert(t.erroGenerico, e.message || 'Erro no pagamento');
    } finally {
      setProcessando(false);
    }
  }, [parcelaPagamento, processando, coords, liqId, clienteModal, t]);

  // Chama a RPC de crédito em cascata (declarada antes das ações que a usam)
  const usarCreditoCascata = useCallback(async () => {
    if (!parcelaPagamento || processando) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_usar_credito_cascata', {
        p_parcela_id: parcelaPagamento.parcela_id,
        p_liquidacao_id: liqId || null,
        p_user_id: vendedor?.user_id || null,
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        setModalPagamentoVisible(false);
        setMenuPagamentoVisible(false);
        setParcelaPagamento(null);
        setDadosPagamento(null);
        if (clienteModal?.emprestimo_id) { atualizarSaldoLocalLiq(clienteModal.emprestimo_id); atualizarSaldoLocalTodos(clienteModal.emprestimo_id); }
        Alert.alert(t.sucesso || 'Sucesso', res.mensagem || 'Crédito aplicado');
        loadLiq();
      } else {
        Alert.alert(t.erroGenerico, res?.mensagem || 'Erro ao usar crédito');
      }
    } catch (e: any) {
      Alert.alert(t.erroGenerico, e.message || 'Erro ao usar crédito');
    } finally {
      setProcessando(false);
    }
  }, [parcelaPagamento, processando, liqId, clienteModal, t]);

  // 1) Pagar 1 parcela — valor cheio, popup de confirmação
  // O menu manda dinheiro E crédito. O crédito é o complemento quando o
  // dinheiro disponível não cobre a parcela inteira — sem ele a parcela ficava
  // PARCIAL com o crédito intacto (caso Maichel: $29 numa parcela de $36).
  const acaoPagarValor = useCallback((valorEspecie: number, valorCredito: number = 0) => {
    if (!parcelaPagamento) return;
    setMenuPagamentoVisible(false);
    setResumoValor(valorEspecie);
    setResumoCredito(valorCredito);
    setResumoVisible(true);
  }, [parcelaPagamento]);

  // Confirma o pagamento após o resumo
  const handleResumoConfirmar = useCallback(() => {
    setResumoVisible(false);
    registrarPagamentoDireto(resumoValor, resumoCredito);
  }, [resumoValor, resumoCredito, registrarPagamentoDireto]);

  // 2) Valor livre — abre o modal com campo editável
  const acaoValorLivre = useCallback(() => {
    if (!parcelaPagamento) return;
    setMenuPagamentoVisible(false);
    setValorLivreVisible(true);
  }, [parcelaPagamento]);

  // Confirma o valor livre (espécie na parcela atual)
  const handleValorLivreConfirmar = useCallback((valorEspecie: number) => {
    setValorLivreVisible(false);
    registrarPagamentoDireto(valorEspecie, 0);
  }, [registrarPagamentoDireto]);

  // 3) Usar crédito — cascata (fn_usar_credito_cascata), popup de confirmação
  const acaoUsarCredito = useCallback(() => {
    if (!parcelaPagamento) return;
    const credito = Number(dadosPagamento?.credito_disponivel || 0);
    if (credito <= 0) { Alert.alert(t.atencao, t.semCredito || 'Não há crédito disponível'); return; }
    setMenuPagamentoVisible(false);
    setConfirmModal({
      visible: true,
      titulo: t.usarCredito || 'Usar crédito',
      mensagem: `${fmt(credito)} ${t.seraAplicadoCascata || 'será aplicado nas próximas parcelas (quita as que cobrir).'}`,
      corConfirmar: '#4F46E5',
      onConfirmar: () => { setConfirmModal(cc => ({ ...cc, visible: false })); usarCreditoCascata(); },
    });
  }, [parcelaPagamento, dadosPagamento, t, usarCreditoCascata]);

  // 4) Pagar mais de 1 — abre a lista de parcelas (seleção múltipla)
  const acaoPagarMultiplas = useCallback(async () => {
    if (!clienteModal) return;
    setMenuPagamentoVisible(false);
    setLoadingMultiplas(true);
    setMultiplasVisible(true);
    try {
      // Buscar todas as parcelas do empréstimo (para calcular a cascata do crédito)
      const { data, error } = await supabase
        .from('emprestimo_parcelas')
        .select('id, numero_parcela, data_vencimento, valor_parcela, valor_pago, valor_saldo, status')
        .eq('emprestimo_id', clienteModal.emprestimo_id)
        .order('numero_parcela', { ascending: true });
      if (error) throw error;
      setMultiplasParcelas((data || []).map((p: any) => ({
        parcela_id: p.id,
        numero_parcela: p.numero_parcela,
        data_vencimento: p.data_vencimento,
        valor_parcela: Number(p.valor_parcela || 0),
        valor_pago: Number(p.valor_pago || 0),
        valor_saldo: Number(p.valor_saldo ?? p.valor_parcela),
        status: p.status,
        valor_multa: 0,
      })));
    } catch (e: any) {
      Alert.alert(t.erroGenerico, e.message || 'Erro ao carregar parcelas');
      setMultiplasVisible(false);
    } finally {
      setLoadingMultiplas(false);
    }
  }, [clienteModal, t]);

  // Confirma o pagamento de múltiplas parcelas (loop fn_registrar_pagamento nas selecionadas)
  const handleMultiplasConfirmar = useCallback(async (itens: any[], totalEspecie: number) => {
    if (processando || !itens || itens.length === 0) return;
    setProcessando(true);
    try {
      // Ordena por numero_parcela (frente pra trás)
      const ordenadas = [...itens].sort((a, b) => a.parcela.numero_parcela - b.parcela.numero_parcela);
      let erros = 0;
      for (let i = 0; i < ordenadas.length; i++) {
        const it = ordenadas[i];
        const p = it.parcela;
        // valorEspecie = quanto pagar em dinheiro nesta parcela (já descontado crédito).
        // credito = quanto de crédito cobre esta parcela (zona 'credito' ou 'fronteira').
        const valorEspecie = Number(it.valorEspecie || 0);
        const valorCredito = Number(it.credito || 0);
        // Se não há nada a pagar (nem espécie nem crédito), pula
        if (valorEspecie <= 0 && valorCredito <= 0) continue;
        const { data, error } = await supabase.rpc('fn_registrar_pagamento', {
          p_parcela_id: p.parcela_id,
          p_valor_pagamento: valorEspecie,
          p_valor_credito: valorCredito,
          p_forma_pagamento: 'DINHEIRO',
          p_observacoes: `[LOTE ${i + 1}/${ordenadas.length}]`,
          p_latitude: coords?.lat || null,
          p_longitude: coords?.lng || null,
          p_precisao_gps: coords?.acc || null,
          p_liquidacao_id: liqId || null,
          p_user_id: vendedor?.user_id || null,
        });
        const res = Array.isArray(data) ? data?.[0] : data;
        if (error || !res?.sucesso) { erros++; console.error('Erro parcela', p.numero_parcela, error || res?.mensagem); }
      }
      setMultiplasVisible(false);
      setParcelaPagamento(null);
      setDadosPagamento(null);
      if (clienteModal?.emprestimo_id) { atualizarSaldoLocalLiq(clienteModal.emprestimo_id); atualizarSaldoLocalTodos(clienteModal.emprestimo_id); }
      if (erros > 0) Alert.alert(t.atencao, `${ordenadas.length - erros} de ${ordenadas.length} parcelas pagas.`);
      loadLiq();
    } catch (e: any) {
      Alert.alert(t.erroGenerico, e.message || 'Erro no pagamento múltiplo');
    } finally {
      setProcessando(false);
    }
  }, [processando, coords, liqId, clienteModal, vendedor, t]);

  // 5) Quitar empréstimo — valor = saldo total, popup de confirmação
  //
  // clienteModal.saldo_emprestimo (emprestimos.valor_saldo) já vem LÍQUIDO do
  // crédito acumulado — é mantido pelo trigger atualizar_saldo_emprestimo(),
  // que soma o saldo pendente das parcelas e já desconta o saldo_excedente
  // (crédito) existente. Por isso o valor a cobrar em espécie é o próprio
  // saldo, sem subtrair credito_disponivel de novo (isso descontava o
  // crédito duas vezes e deixava exatamente esse valor em aberto após a
  // "quitação" — bug relatado pelo cliente Talles Alan Pineiros, rota
  // Barcelona). O crédito antigo continua no pool e é consumido pela própria
  // fn_registrar_pagamento na cascata de auto-quitação das demais parcelas.
  // Chama fn_quitar_emprestimo, que distribui dinheiro + crédito por TODAS as
  // parcelas abertas. Antes isto mandava o saldo inteiro numa parcela só via
  // fn_registrar_pagamento: a parcela ficava PARCIAL, as demais seguiam
  // abertas e o empréstimo era dado como quitado. É também o caminho que a
  // web já usa — as duas pontas passam a quitar igual.
  const quitarEmprestimoRpc = useCallback(async (dinheiro: number) => {
    if (!clienteModal?.emprestimo_id || processando) return;
    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc('fn_quitar_emprestimo', {
        p_emprestimo_id: clienteModal.emprestimo_id,
        p_valor_pagamento: dinheiro,
        p_forma_pagamento: 'DINHEIRO',
        p_observacoes: null,
        p_latitude: coords?.lat || null,
        p_longitude: coords?.lng || null,
        p_precisao_gps: coords?.acc || null,
        p_liquidacao_id: liqId || null,
        p_user_id: vendedor?.user_id || null,
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (res?.sucesso) {
        setModalPagamentoVisible(false);
        setMenuPagamentoVisible(false);
        setParcelaPagamento(null);
        setDadosPagamento(null);
        atualizarSaldoLocalLiq(clienteModal.emprestimo_id);
        atualizarSaldoLocalTodos(clienteModal.emprestimo_id);
        showAlert(t.sucesso || 'Sucesso', res.mensagem || 'Empréstimo quitado');
        loadLiq();
      } else {
        showAlert(t.erroGenerico, res?.mensagem || 'Erro ao quitar');
      }
    } catch (e: any) {
      showAlert(t.erroGenerico, e.message || 'Erro ao quitar');
    } finally {
      setProcessando(false);
    }
  }, [clienteModal, processando, coords, liqId, t]);

  const acaoQuitarEmprestimo = useCallback(() => {
    if (!parcelaPagamento || !clienteModal) return;
    // saldo_emprestimo já vem líquido de crédito (a trigger desconta), então
    // é exatamente o dinheiro que fn_quitar_emprestimo espera receber.
    const dinheiro = Number(clienteModal.saldo_emprestimo || 0);
    const credito = Number(dadosPagamento?.credito_disponivel || 0);
    if (dinheiro <= 0 && credito <= 0) { Alert.alert(t.atencao, t.semSaldoQuitar || 'Empréstimo já está quitado'); return; }
    setMenuPagamentoVisible(false);
    const msg = credito > 0
      ? `${fmt(dinheiro)} ${t.dinheiro} + ${fmt(credito)} ${t.credito || 'crédito'}`
      : `${t.saldoTotalLbl || 'Saldo total'}: ${fmt(dinheiro)} · ${t.dinheiro}`;
    setConfirmModal({
      visible: true,
      titulo: t.quitarEmprestimo || 'Quitar empréstimo',
      mensagem: msg,
      corConfirmar: '#10B981',
      onConfirmar: () => {
        setConfirmModal(cc => ({ ...cc, visible: false }));
        quitarEmprestimoRpc(dinheiro);
      },
    });
  }, [parcelaPagamento, clienteModal, dadosPagamento, t, quitarEmprestimoRpc]);

  // Chama a RPC de crédito em cascata
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
          // Última parcela: valor calculado (saldos anteriores, créditos, pagamentos parciais)
          // Demais parcelas: sempre o valor fixo da parcela
          const isUltimaParcela = dados.numero_parcela === dados.total_parcelas;
          if (isUltimaParcela) {
            const valorAPagar = dados.valor_saldo_parcela || valorSaldo;
            setValorPagamento(valorAPagar.toFixed(2).replace('.', ','));
          } else {
            setValorPagamento(proxima.valor_parcela.toFixed(2).replace('.', ','));
          }
          console.log('✅ Modal atualizado! Parcela:', dados.numero_parcela, '/', dados.total_parcelas, 'Valor:', isUltimaParcela ? (dados.valor_saldo_parcela || valorSaldo) : proxima.valor_parcela);
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

          // ⭐ Atualização otimista: marcar parcela como paga imediatamente no estado local
          const parcelaId = parcelaPagamento.parcela_id;
          const clienteId = clienteModal?.id || '';
          setPagasSet(prev => { const s = new Set(prev); s.add(parcelaId); return s; });
          setClientesPagosNaLiq(prev => { const s = new Set(prev); s.add(clienteId); return s; });
          setPagMap(prev => {
            const m = new Map(prev);
            m.set(parcelaId, {
              parcela_id: parcelaId,
              cliente_id: clienteId,
              valor_pago_atual: parseFloat(valorPagamento.replace(',', '.')) || 0,
              valor_credito_gerado: 0,
              valor_parcela: dadosPagamento?.valor_parcela || parcelaPagamento.valor_parcela,
              data_pagamento: new Date().toISOString(),
              created_at: new Date().toISOString(),
              liquidacao_id: liqId || '',
            });
            return m;
          });

          setClienteModal(null);
          showAlert(t.sucessoGenerico || 'Sucesso', res.mensagem || t.sucesso);

          // Recarregar dados completos em background (sem bloquear UI)
          setTimeout(() => loadLiq(), 500);
        } else { showAlert(t.erroGenerico, res?.mensagem || t.erro); }
      } catch (e: any) { console.error('Erro pagamento:', e); showAlert(t.erroGenerico, e.message || t.erro); }
      finally { setProcessando(false); }
    };
    
    // Se vai quitar, pedir confirmação
    if (vaiQuitar) {
      const msgQuitar = t.confirmarQuitacao || 
        `Este pagamento irá QUITAR o empréstimo.\n\nSaldo: ${fmt(saldoEmp)}\nPagando: ${fmt(totalPagando)}\n\nTodas as parcelas restantes serão marcadas como pagas.\n\nEsta ação é irreversível.`;
      
      if (Platform.OS === 'web') {
        if (window.confirm(msgQuitar)) executarPagamento();
      } else {
        Alert.alert(
          t.atencaoQuitacao || 'Quitação de Empréstimo',
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

  // ═══════════════════════════════════════════════════════════════════
  // PAGAMENTO MÚLTIPLO DE PARCELAS
  // ═══════════════════════════════════════════════════════════════════
  const handlePagarMultiplo = useCallback(async (
    parcelas: ParcelaModal[], 
    totalValor: number, 
    creditoUsado: number
  ) => {
    if (processando || parcelas.length === 0 || !liqId || !clienteModal) return;

    const msgConfirm = lang === 'es'
      ? `¿Pagar ${parcelas.length} cuotas por $ ${fmt(totalValor)}?${creditoUsado > 0 ? `\nCrédito: $ ${fmt(creditoUsado)}` : ''}`
      : `Pagar ${parcelas.length} parcelas por $ ${fmt(totalValor)}?${creditoUsado > 0 ? `\nCrédito: $ ${fmt(creditoUsado)}` : ''}`;

    const executar = async () => {
      setProcessando(true);
      setModalParcelasVisible(false);
      let sucessos = 0;
      let erroMsg = '';
      const ultimaIdx = parcelas.length - 1;

      for (let i = 0; i < parcelas.length; i++) {
        const p = parcelas[i];
        const isUltima = i === ultimaIdx;
        const valorPago = p.valor_pago || 0;
        const saldoParcela = (valorPago > 0 && p.status !== 'PAGO')
          ? (p.valor_saldo ?? (p.valor_parcela - valorPago))
          : p.valor_parcela;

        // Crédito só na última parcela
        const credito = isUltima ? creditoUsado : 0;
        // Valor em dinheiro = saldo da parcela - crédito aplicado
        const valorDinheiro = Math.max(0, saldoParcela - credito);

        try {
          const { data, error } = await supabase.rpc('fn_registrar_pagamento', {
            p_parcela_id: p.parcela_id,
            p_valor_pagamento: valorDinheiro,
            p_valor_credito: credito,
            p_forma_pagamento: 'DINHEIRO',
            p_observacoes: parcelas.length > 1 ? `[LOTE ${i + 1}/${parcelas.length}]` : null,
            p_latitude: coords?.lat || null,
            p_longitude: coords?.lng || null,
            p_precisao_gps: coords?.acc || null,
            p_liquidacao_id: liqId,
            p_user_id: vendedor?.user_id || null,
          });

          if (error) throw error;
          const res = Array.isArray(data) ? data[0] : data;
          if (res?.sucesso) {
            sucessos++;
            // Atualização otimista por parcela
            setPagasSet(prev => { const s = new Set(prev); s.add(p.parcela_id); return s; });
            setPagMap(prev => {
              const m = new Map(prev);
              m.set(p.parcela_id, {
                parcela_id: p.parcela_id,
                cliente_id: clienteModal.id,
                valor_pago_atual: valorDinheiro + credito,
                valor_credito_gerado: 0,
                valor_parcela: p.valor_parcela,
                data_pagamento: new Date().toISOString(),
                created_at: new Date().toISOString(),
                liquidacao_id: liqId || '',
              });
              return m;
            });
          } else {
            erroMsg = res?.mensagem || `Erro na parcela ${p.numero_parcela}`;
            break;
          }
        } catch (e: any) {
          erroMsg = e.message || `Erro na parcela ${p.numero_parcela}`;
          break;
        }
      }

      // Marcar cliente como pago na liquidação
      if (sucessos > 0) {
        setClientesPagosNaLiq(prev => { const s = new Set(prev); s.add(clienteModal.id); return s; });
        if (clienteModal.emprestimo_id) {
          atualizarSaldoLocalLiq(clienteModal.emprestimo_id);
          atualizarSaldoLocalTodos(clienteModal.emprestimo_id);
        }
      }

      setProcessando(false);

      if (erroMsg) {
        showAlert(t.erroGenerico || 'Erro', 
          `${sucessos}/${parcelas.length} ${lang === 'es' ? 'cuotas pagadas' : 'parcelas pagas'}. ${erroMsg}`);
      } else {
        showAlert(t.sucessoGenerico || 'Sucesso', 
          `${sucessos} ${lang === 'es' ? 'cuotas pagadas con éxito' : 'parcelas pagas com sucesso'}!`);
      }

      setClienteModal(null);
      setTimeout(() => loadLiq(), 500);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msgConfirm)) executar();
    } else {
      Alert.alert(
        lang === 'es' ? 'Confirmar pago múltiple' : 'Confirmar pagamento múltiplo',
        msgConfirm,
        [
          { text: t.cancelar || 'Cancelar', style: 'cancel' },
          { text: t.pagar || 'Pagar', style: 'default', onPress: executar },
        ]
      );
    }
  }, [processando, liqId, clienteModal, coords, vendedor, lang, t, loadLiq, atualizarSaldoLocalLiq, atualizarSaldoLocalTodos]);

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
    
    // Se permitir_exclusao_parcelas = true, abre direto.
    // Comparação robusta: o valor pode vir como boolean true, string "true"
    // ou número 1 dependendo de como o Postgres/PostgREST serializa. Uma
    // comparação estrita (=== true) falharia para "true"/1 e mandaria o
    // vendedor pelo caminho de autorização mesmo com o parâmetro habilitado.
    const permiteEstorno =
      configVendedor?.permitir_exclusao_parcelas === true ||
      String(configVendedor?.permitir_exclusao_parcelas).toLowerCase() === 'true' ||
      String(configVendedor?.permitir_exclusao_parcelas) === '1';
    console.log('[ESTORNO] permitir_exclusao_parcelas =', configVendedor?.permitir_exclusao_parcelas, '→ permite:', permiteEstorno);
    if (permiteEstorno) {
      console.log('[ESTORNO] Permitido, abrindo modal direto');
      setParcelaEstorno(parcela);
      setMotivoEstorno('');
      // Fecha o ParcelasModal antes de abrir o de confirmação. Sem isso, no
      // Android o modal de estorno renderiza ATRÁS do ParcelasModal e o
      // usuário não vê a confirmação ("nada acontece").
      setModalParcelasVisible(false);
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
        setModalParcelasVisible(false);   // fecha ParcelasModal (ver nota acima)
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
        setModalParcelasVisible(false);   // fecha ParcelasModal (ver nota acima)
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
        p_vendedor_id: vendedor?.id,  // Passa o ID do vendedor logado
        // ⭐ GPS do estorno: registra ONDE o vendedor estava ao estornar
        // (auditoria). Mesmo coords usado no pagamento (useGPSTracking).
        p_latitude_estorno: coords?.lat || null,
        p_longitude_estorno: coords?.lng || null,
        p_precisao_gps_estorno: coords?.acc || null
      });
      
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      
      if (res?.sucesso) {
        setModalEstornoVisible(false);
        setParcelaEstorno(null);
        setFiltro('todos'); // ⭐ Voltar para lista de pendentes após estorno (desmarca breadcrumb "pagos")
        Alert.alert(t.sucessoGenerico, res.mensagem || t.estornoSucesso);
        if (clienteModal?.emprestimo_id) { atualizarSaldoLocalLiq(clienteModal.emprestimo_id); atualizarSaldoLocalTodos(clienteModal.emprestimo_id); }
        if (clienteModal) abrirParcelas(clienteModal.id, clienteModal.nome, clienteModal.emprestimo_id);

        // ⭐ Atualização otimista: remover parcela do estado de pagas
        const parcelaId = parcelaEstorno.parcela_id;
        const clienteId = clienteModal?.id || '';
        setPagasSet(prev => { const s = new Set(prev); s.delete(parcelaId); return s; });
        setPagMap(prev => { const m = new Map(prev); m.delete(parcelaId); return m; });
        // Verificar se cliente tem outras parcelas pagas antes de removê-lo de clientesPagosNaLiq
        // (loadLiq em background vai corrigir)

        // ⭐ Recarregar dados ANTES de fechar para garantir lista atualizada
        await loadLiq(true);
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
      if (!g) { g = { cliente_id: r.cliente_id, codigo_cliente: r.codigo_cliente, nome: r.nome, telefone_celular: r.telefone_celular, endereco: r.endereco, foto_url: r.foto_url || null, latitude: r.latitude, longitude: r.longitude, rota_id: r.rota_id, emprestimos: [], qtd_emprestimos: 0, tem_multiplos_vencimentos: false }; m.set(r.cliente_id, g); }
      
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
            data_vencimento: r.data_vencimento, dia_referencia: (r as any).dia_referencia, ordem_visita_dia: r.ordem_visita_dia,
            tem_parcelas_vencidas: r.tem_parcelas_vencidas,
            total_parcelas_vencidas: r.total_parcelas_vencidas,
            valor_total_vencido: r.valor_total_vencido,
            status_dia: r.status_dia, is_parcela_atrasada: r.is_parcela_atrasada,
            saldo_emprestimo: r.saldo_emprestimo,
            pagamento_info: pi ? { valorPago: pi.valor_pago_atual, creditoGerado: pi.valor_credito_gerado, valorParcela: pi.valor_parcela, dataPagamento: pi.data_pagamento || null } : undefined,
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
        g.emprestimos.push({ emprestimo_id: r.emprestimo_id, saldo_emprestimo: r.saldo_emprestimo, valor_principal: r.valor_principal, valor_total: (r as any).valor_total, numero_parcelas: r.numero_parcelas, status_emprestimo: r.status_emprestimo, frequencia_pagamento: r.frequencia_pagamento, parcela_id: r.parcela_id, numero_parcela: r.numero_parcela, valor_parcela: r.valor_parcela, valor_pago_parcela: r.valor_pago_parcela, saldo_parcela: r.saldo_parcela, status_parcela: r.status_parcela, data_vencimento: r.data_vencimento, dia_referencia: (r as any).dia_referencia, ordem_visita_dia: r.ordem_visita_dia, tem_parcelas_vencidas: r.tem_parcelas_vencidas, total_parcelas_vencidas: r.total_parcelas_vencidas, valor_total_vencido: r.valor_total_vencido, status_dia: r.status_dia, is_parcela_atrasada: r.is_parcela_atrasada, pagamento_info: pi ? { valorPago: pi.valor_pago_atual, creditoGerado: pi.valor_credito_gerado, valorParcela: pi.valor_parcela, dataPagamento: pi.data_pagamento || null } : undefined, data_emprestimo: (r as any).data_emprestimo || null });
      }
    });
    m.forEach(g => { g.qtd_emprestimos = g.emprestimos.length; g.tem_multiplos_vencimentos = g.emprestimos.length > 1; });
    return Array.from(m.values());
  }, [raw, pagMap, pagasSet]);

  // Mapa parcela → empréstimo (o pagMap só guarda cliente_id). Usado para
  // somar o recebido POR conta nos clientes com 2+ empréstimos.
  const empDaParcela = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of raw) m.set(r.parcela_id, r.emprestimo_id);
    return m;
  }, [raw]);

  // Cliente é considerado "pago/visitado" se recebeu QUALQUER pagamento na liquidação atual
  // Regra de negócio: vendedor visitou, cobrou (mesmo parcial/atrasada) → sai da lista
  const isCliPago = useCallback((c: ClienteAgrupado) => clientesPagosNaLiq.has(c.cliente_id), [clientesPagosNaLiq]);

  // A mesma regra ("qualquer valor registrado → pago"), só que POR EMPRÉSTIMO.
  // A flag do banco é por CLIENTE; com crédito adicional o cliente tem duas
  // contas e cada uma vai para "Pagas" no seu próprio momento — a que ainda
  // não recebeu nada continua na lista de pendentes.
  const empsPagosNaLiq = useMemo(() => {
    const s = new Set<string>();
    pagMap.forEach((p, parcelaId) => {
      const eid = empDaParcela.get(parcelaId);
      if (!eid) return;
      const n = (p as any).valor_pago_nesta_liq;
      if (Number(n != null ? n : (p.valor_pago_atual || 0)) > 0) s.add(eid);
    });
    return s;
  }, [pagMap, empDaParcela]);

  // Momento do PRIMEIRO pagamento de cada empréstimo nesta liquidação. É o que
  // ordena a aba "Pagas" e o que o cabeçalho de hora do card mostra — os dois
  // precisam sair da mesma fonte, senão a ordem da lista não bate com as horas.
  const msPrimeiroPagEmp = useMemo(() => {
    const m = new Map<string, number>();
    pagMap.forEach((p, parcelaId) => {
      const eid = empDaParcela.get(parcelaId);
      if (!eid || !p.data_pagamento) return;
      const t = new Date(p.data_pagamento).getTime();
      if (isNaN(t)) return;
      const atual = m.get(eid);
      if (atual == null || t < atual) m.set(eid, t);
    });
    return m;
  }, [pagMap, empDaParcela]);

  const msDoItem = useCallback((emps: EmprestimoData[]) => {
    let ms = Infinity;
    for (const e of emps) {
      const t = msPrimeiroPagEmp.get(e.emprestimo_id);
      if (t != null && t < ms) ms = t;
    }
    return ms;
  }, [msPrimeiroPagEmp]);

  // Ids de quem tem ALGUMA parcela vencendo na data da liquidação.
  // Precisa varrer `raw` (uma linha por parcela) e não `grouped`: o
  // agrupamento guarda só UMA parcela por empréstimo, preferindo a pendente
  // de menor número. Um cliente com parcela atrasada e outra vencendo hoje
  // no mesmo empréstimo perdia a de hoje e caía em "Atrasados".
  const idsVencDia = useMemo(() => {
    const ids = new Set<string>();
    if (!dataLiq) return ids;
    for (const r of raw) {
      if (String(r.data_vencimento || '').substring(0, 10) === dataLiq) ids.add(r.cliente_id);
    }
    return ids;
  }, [raw, dataLiq]);

  const ehDoDiaCli = useCallback(
    (c: ClienteAgrupado) => (!dataLiq ? true : idsVencDia.has(c.cliente_id)),
    [idsVencDia, dataLiq]
  );

  // Transforma os clientes (já filtrados por escopo/busca) nos cards da lista.
  // O cliente com 2+ contas é tratado conta a conta: na aba "Pagas" cada conta
  // paga vira um card próprio; nas pendentes fica um card só, com as contas
  // que ainda não receberam nada.
  const montarItens = useCallback((base: ClienteAgrupado[], alvo: FiltroLiquidacao): ItemLista[] => {
    const itens: ItemLista[] = [];
    const temAtraso = (emps: EmprestimoData[]) =>
      emps.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas);

    for (const c of base) {
      const multi = c.emprestimos.length >= 2;

      if (alvo === 'pagas') {
        if (!multi) {
          if (!isCliPago(c)) continue;
          itens.push({ key: c.cliente_id, nome: c.nome, cliente: c, emprestimos: c.emprestimos, ms: msDoItem(c.emprestimos) });
          continue;
        }
        for (const e of c.emprestimos) {
          if (!empsPagosNaLiq.has(e.emprestimo_id)) continue;
          itens.push({ key: `${c.cliente_id}|${e.emprestimo_id}`, nome: c.nome, cliente: c, emprestimos: [e], ms: msDoItem([e]) });
        }
        continue;
      }

      // Pendentes ('todos') e 'atrasados': só as contas que ainda não receberam
      // nada. Com 1 empréstimo vale a flag de cliente do banco, como sempre.
      const pend = multi ? c.emprestimos.filter(e => !empsPagosNaLiq.has(e.emprestimo_id)) : c.emprestimos;
      if (multi ? pend.length === 0 : isCliPago(c)) continue;
      if (alvo === 'atrasados' && !temAtraso(pend)) continue;
      itens.push({ key: c.cliente_id, nome: c.nome, cliente: c, emprestimos: pend, ms: Infinity });
    }
    return itens;
  }, [isCliPago, empsPagosNaLiq, msDoItem]);

  const filtered = useMemo(() => {
    let r = [...grouped];
    // Escopo só faz sentido no braço da liquidação; a aba "Todos" é a carteira
    if (tab === 'liquidacao' && filtroVencimento === 'dia') r = r.filter(ehDoDiaCli);
    else if (tab === 'liquidacao' && filtroVencimento === 'atrasados') r = r.filter(c => !ehDoDiaCli(c));
    if (busca.trim()) { const b = normalizarBusca(busca); r = r.filter(c => normalizarBusca(c.nome).includes(b) || (c.telefone_celular && c.telefone_celular.includes(b)) || (c.endereco && normalizarBusca(c.endereco).includes(b))); }
    // ⭐ O filtro corta os EMPRÉSTIMOS, não só o cliente.
    //
    // Era `.some(...)`: decidia se o cliente entrava, mas entregava a lista de
    // empréstimos intacta ao card. Um cliente com um diário e um semanal
    // passava em "Diários" e o card renderizava OS DOIS — o semanal aparecendo
    // dentro do filtro de diários, relatado pelo campo em 12/08 e 24/08.
    //
    // Cortando o array, o card também deixa de virar carrossel quando sobra um
    // empréstimo só: ele decide isso por `emprestimos.length >= 2`.
    if (filtroFrequencia !== 'todos') {
      r = r
        .map(c => ({ ...c, emprestimos: c.emprestimos.filter(e => e.frequencia_pagamento === filtroFrequencia) }))
        .filter(c => c.emprestimos.length > 0);
    }

    const itens = montarItens(r, filtro);

    if (filtro === 'pagas') {
      // #40: a aba Pagos ordena pela ORDEM EM QUE OS PAGAMENTOS FORAM
      // REGISTRADOS, CRESCENTE — quem pagou primeiro aparece primeiro, para o
      // vendedor conferir a operação na sequência real. Com 2+ contas a
      // posição é a da CONTA, não a do cliente: o mesmo cliente pode aparecer
      // às 10h e de novo às 13h, com outros clientes no meio.
      itens.sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.nome.localeCompare(b.nome)));
    } else {
      itens.sort(ord === 'rota'
        ? (a, b) => {
            const oa = ordemRotaMap.get(a.cliente.cliente_id) ?? 9999;
            const ob = ordemRotaMap.get(b.cliente.cliente_id) ?? 9999;
            if (oa !== ob) return oa - ob;
            return a.nome.localeCompare(b.nome);
          }
        : (a, b) => a.nome.localeCompare(b.nome));
    }
    return itens;
  }, [grouped, busca, filtro, filtroFrequencia, ord, ordemRotaMap, tab, filtroVencimento, ehDoDiaCli, montarItens]);

  // Base dos contadores segue o escopo: com "Do dia" ativo, os números dos
  // segmentos precisam refletir a lista exibida.
  const baseLiq = useMemo(() => {
    if (filtroVencimento === 'dia') return grouped.filter(ehDoDiaCli);
    if (filtroVencimento === 'atrasados') return grouped.filter(c => !ehDoDiaCli(c));
    return grouped;
  }, [grouped, filtroVencimento, ehDoDiaCli]);

  const cntVencDia = useMemo(() => grouped.filter(ehDoDiaCli).length, [grouped, ehDoDiaCli]);
  const cntVencAtrasados = useMemo(() => grouped.filter(c => !ehDoDiaCli(c)).length, [grouped, ehDoDiaCli]);

  // Contam CARDS, não clientes — é o que a lista mostra. Só difere para quem
  // tem 2+ contas: em "Pagas" cada conta paga conta como um card.
  const cntTotal = useMemo(() => montarItens(baseLiq, 'todos').length, [baseLiq, montarItens]);
  const cntAtraso = useMemo(() => montarItens(baseLiq, 'atrasados').length, [baseLiq, montarItens]);
  const cntPagas = useMemo(() => montarItens(baseLiq, 'pagas').length, [baseLiq, montarItens]);
  const cntTotalGeral = grouped.length;
  const clientesLiqIds = useMemo(() => new Set(grouped.map(c => c.cliente_id)), [grouped]);
  const eIdx = (cid: string) => empIdxMap[cid] || 0;
  const eSet = (cid: string, i: number) => setEmpIdxMap(p => ({ ...p, [cid]: i }));

 const renderCard = (it: ItemLista) => {
    const c = it.cliente;
    const emps = it.emprestimos;
    const multi = emps.length >= 2;
    // O card só enxerga as contas DESTE item. Na aba "Pagas" cada conta paga é
    // um card separado; nas pendentes ficam as contas ainda não cobradas.
    const clienteDoCard: ClienteAgrupado = emps.length === c.emprestimos.length
      ? c
      : { ...c, emprestimos: emps, qtd_emprestimos: emps.length, tem_multiplos_vencimentos: emps.length > 1 };
    const e = emps[Math.min(eIdx(c.cliente_id), emps.length - 1)];
    // Com 2+ contas a regra vale por conta; com 1 vale a flag do banco.
    const clienteEstaPago = c.emprestimos.length >= 2
      ? emps.every(x => empsPagosNaLiq.has(x.emprestimo_id))
      : isCliPago(c);

    // Recebido NESTA liquidação, quebrado por empréstimo. Dinheiro real =
    // valor pago − crédito usado. Usa os campos por-liquidação (uma parcela
    // paga em vários dias mostra em cada dia só o que entrou naquele dia),
    // com fallback para o acumulado se a RPC antiga não trouxer o campo.
    type ResumoLinha = { dinheiroReal: number; creditoUsado: number; creditoGerado: number; qtdParcelas: number; somaParcelas: number; valorUnitario?: number | null };
    const porEmp: Record<string, ResumoLinha> = {};
    pagMap.forEach((p, parcelaId) => {
      if (p.cliente_id !== c.cliente_id) return;
      const eid = empDaParcela.get(parcelaId);
      if (!eid) return;
      const pnl = (p as any).valor_pago_nesta_liq;
      const cnl = (p as any).valor_credito_usado_nesta_liq;
      const pagoLiq = pnl != null ? Number(pnl) : (Number(p.valor_pago_atual) || 0);
      const credLiq = cnl != null ? Number(cnl) : (Number((p as any).valor_credito_usado) || 0);
      const credGer = Number((p as any).valor_credito_gerado) || 0;
      const vParc = Number(p.valor_parcela) || 0;
      const a = porEmp[eid] || (porEmp[eid] = { dinheiroReal: 0, creditoUsado: 0, creditoGerado: 0, qtdParcelas: 0, somaParcelas: 0, valorUnitario: null });
      a.dinheiroReal += pagoLiq - credLiq;
      a.creditoUsado += credLiq;
      a.creditoGerado += credGer;
      a.somaParcelas += vParc;
      a.qtdParcelas += 1;
      if (a.qtdParcelas === 1) a.valorUnitario = vParc;
      else if (a.valorUnitario != null && Math.round(a.valorUnitario * 100) !== Math.round(vParc * 100)) a.valorUnitario = null;
    });

    // ⭐ O crédito exibido é só o que veio de FORA do dia.
    //
    // Um pagamento grande numa parcela pequena gera crédito que a auto-quitação
    // consome na mesma operação. Somar esse crédito ao dinheiro recebido faz a
    // tela mentir: o thalles pagou $576 e o card mostrava "$576 recebido +
    // $504 crédito" para 8 parcelas de $72 — soma $1.080 para uma conta de
    // $576. O crédito gerado e consumido no mesmo dia é circulação interna,
    // não dinheiro adicional.
    for (const k of Object.keys(porEmp)) {
      const a = porEmp[k];
      a.creditoUsado = Math.max(0, a.creditoUsado - a.creditoGerado);
    }

    // Carrossel: cada slide mostra o resumo da sua conta.
    const resumoPorEmprestimo = multi ? porEmp : undefined;
    // Card simples na aba Pagos: o resumo é o da única conta do card.
    const resumoPago = (filtro === 'pagas' && !multi) ? porEmp[e.emprestimo_id] : undefined;

    if (typeof __DEV__ !== 'undefined' && __DEV__ && filtro === 'pagas') {
      console.log('🔎 RESUMO_PAGO', c.nome, { conta: e.emprestimo_id, resumo: porEmp[e.emprestimo_id] });
    }
    return (
      <ClienteCardLiquidacao
        key={it.key}
        cliente={clienteDoCard}
        emprestimo={e}
        expanded={expanded === it.key}
        pagasSet={pagasSet}
        naoPagosSet={naoPagosSet}
        liqId={liqId}
        isViz={isViz}
        isClientePago={clienteEstaPago}
        resumoPago={resumoPago}
        resumoPorEmprestimo={resumoPorEmprestimo}
        dataReferencia={dataLiq}
        configCobranca={configCobranca}
        lang={lang}
        notasCount={notasCountMap.get(c.cliente_id) || 0}
        t={t}
        onToggleExpand={() => setExpanded(p => p === it.key ? null : it.key)}
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
    if (busca.trim()) { const b = normalizarBusca(busca); r = r.filter(c => normalizarBusca(c.nome).includes(b) || (c.telefone_celular && c.telefone_celular.includes(b))); }
    // ⭐ Tipo e frequência cortam os EMPRÉSTIMOS, não só o cliente.
    //
    // Mesmo defeito da aba Liquidação (ver `filtered`): o `.some(...)` decidia
    // se o cliente entrava e deixava a lista de empréstimos inteira. Esta aba
    // renderiza um card POR EMPRÉSTIMO, então os de outra modalidade apareciam
    // lado a lado com os filtrados.
    if (filtroTipo !== 'todos') {
      r = r
        .map(c => ({ ...c, emprestimos: c.emprestimos.filter(e => e.tipo_emprestimo === filtroTipo) }))
        .filter(c => c.emprestimos.length > 0);
    }
    if (filtroFrequencia !== 'todos') {
      r = r
        .map(c => ({ ...c, emprestimos: c.emprestimos.filter(e => e.frequencia_pagamento === filtroFrequencia) }))
        .filter(c => c.emprestimos.length > 0);
    }
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
  }, [todosList, busca, filtroTipo, filtroStatus, filtroFrequencia, ocultarLiquidacao, clientesLiqIds, ordemRotaMap]);

  const renderTodos = (c: ClienteTodos) => {
    // Default: ativo/vencido primeiro; sem ativo, usa o último (mais recente)
    const defaultIdx = (() => {
      if (!c.emprestimos.length) return 0;
      const iAtivo = c.emprestimos.findIndex(e => e.status === 'ATIVO' || e.status === 'VENCIDO');
      if (iAtivo >= 0) return iAtivo;
      return c.emprestimos.length - 1;
    })();
    const ei = empIdxTodos[c.id] ?? defaultIdx;
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
        todosMode={true}
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
        onPagar={pagarClienteTodos}
        onAbrirNotas={(id, nome) => { setNotasClienteId(id); setNotasClienteNome(nome); setModalNotasClienteVisible(true); }}
        onAbrirDetalhes={(cli) => { setDetalhesCliente(cli); setModalDetalhesVisible(true); }}
        solicitacaoRenovacao={solicitacoesRenovacaoMap.get(c.id) || null}
        onNovoEmprestimo={(cli) => {
          const nav = navigation.getParent() || navigation;
          nav.navigate('NovoCliente', { dataLiq, 
            clienteExistente: { 
              id: cli.id, 
              nome: cli.nome, 
              telefone_celular: cli.telefone_celular, 
              documento: cli.codigo_cliente?.toString() || '' 
            } 
          });
        }}
        onAlterarSolicitacaoRenovacao={async (cli, solicId, empQuitadoId, valorSolic, statusSolic) => {
          // Busca os termos exatamente como o vendedor pediu (persistidos em
          // renovacoes_pendentes no momento do bloqueio), não os do empréstimo
          // antigo quitado — é isso que preserva a data que ele escolheu.
          const { data: sa } = await supabase
            .from('solicitacoes_autorizacao')
            .select('renovacao_pendente_id')
            .eq('id', solicId)
            .single();

          let termos: any = null;
          if (sa?.renovacao_pendente_id) {
            const { data: rp } = await supabase.rpc('fn_buscar_detalhes_renovacao_pendente', {
              p_renovacao_pendente_id: sa.renovacao_pendente_id,
            });
            termos = Array.isArray(rp) ? rp[0] : rp;
          }

          const nav = navigation.getParent() || navigation;
          nav.navigate('NovoCliente', { dataLiq,
            clienteExistente: { id: cli.id, nome: cli.nome, telefone_celular: cli.telefone_celular, documento: cli.codigo_cliente?.toString() || '' },
            solicitacaoRenovacao: {
              solic_id: solicId,
              // APROVADO trava valor e taxa no formulário; PENDENTE deixa livre
              status: statusSolic,
              valor_principal: termos?.valor_aprovado ?? termos?.valor_principal ?? valorSolic,
              numero_parcelas: termos?.numero_parcelas || 10,
              taxa_juros: termos?.taxa_juros || 20,
              frequencia: termos?.frequencia || 'DIARIO',
              dia_semana_cobranca: termos?.dia_semana_cobranca ?? null,
              dia_mes_cobranca: termos?.dia_mes_cobranca ?? null,
              dias_mes_cobranca: termos?.dias_mes_cobranca ?? null,
              iniciar_proximo_mes: termos?.iniciar_proximo_mes ?? false,
              data_primeiro_vencimento: termos?.data_primeiro_vencimento ?? null,
              observacoes_emprestimo: termos?.observacoes_emprestimo ?? null,
              microseguro_valor: termos?.microseguro_valor ?? null,
            },
          });
        }}
        onCancelarSolicitacaoRenovacao={async (solicId) => {
          await supabase
            .from('solicitacoes_autorizacao')
            .update({ status: 'CANCELADO', motivo_resolucao: 'Cancelado pelo vendedor', data_resolucao: new Date().toISOString() })
            .eq('id', solicId);
          setSolicitacoesRenovacaoMap(prev => { const m = new Map(prev); m.forEach((v, k) => { if (v.solic_id === solicId) m.delete(k); }); return m; });
        }}
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

  // Spinner de tela cheia SÓ na primeira carga, quando não há nada a mostrar.
  // Com lista em tela, a recarga é reconciliação em segundo plano (ver o
  // comentário em useClientesLiquidacao) e a tela continua utilizável.
  if (loading && raw.length === 0) return (<View style={S.lW}><ActivityIndicator size="large" color="#3B82F6" /><Text style={S.lT}>{t.carregando}</Text></View>);

return (
    <View style={S.c}>
      <LegendaCoresModal
        visible={modalLegendaVisible}
        onClose={() => setModalLegendaVisible(false)}
        t={t}
      />

      {isViz && (<View style={S.vizBanner}><View style={S.vizBannerContent}><Ionicons name="alert-circle" size={20} color="#D97706" /><View style={S.vizBannerTexts}><Text style={S.vizBannerTitle}>{t.modoVisualizacao}</Text><Text style={S.vizBannerDesc}>{t.modoVisualizacaoDesc} {fmtData(dataLiq)}</Text></View></View></View>)}
      
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
      
      {/* Linha 1: Título */}
      <View style={S.newHeader}>
        <Text style={S.newTitle}>{t.titulo || 'Clientes'}</Text>
        <View style={S.filterRight}>
          {/* Sincronizar — pedido direto do campo. Mudanças feitas pelo admin
              (reabertura, fechamento, autorização) chegam com um toque, sem
              precisar sair e entrar do app. Azul para não se perder entre os
              ícones cinzas: é ação, não configuração. */}
          <TouchableOpacity
            style={S.syncBtn}
            onPress={onRefresh}
            disabled={refreshing || revalidando}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={lang === 'es' ? 'Sincronizar' : 'Sincronizar'}
          >
            {refreshing || revalidando ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Ionicons name="sync-outline" size={20} color="#2563EB" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={S.filterBtn} onPress={openDrawer} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={20} color="#374151" />
            {temFiltroAtivo && <View style={S.filterDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={S.helpBtn} onPress={() => setModalLegendaVisible(true)} activeOpacity={0.7}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
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

      {/* Linha 3: Controle Segmentado */}
      <View style={S.segmentRow}>
        <View style={S.segmentGroup}>
          {/* Liquidação */}
          <TouchableOpacity
            style={[S.segmentBtn, tab === 'liquidacao' && filtro !== 'pagas' && S.segmentBtnActive]}
            onPress={() => { if (liqId) { tabManualRef.current = true; setTab('liquidacao'); setFiltro('todos'); } }}
            activeOpacity={0.7}
            disabled={!liqId}
          >
            <Ionicons name="receipt-outline" size={14} color={tab === 'liquidacao' && filtro !== 'pagas' ? '#fff' : (liqId ? '#374151' : '#9CA3AF')} />
            <Text style={[S.segmentBtnText, tab === 'liquidacao' && filtro !== 'pagas' && S.segmentBtnTextActive, !liqId && { color: '#9CA3AF' }]}>
              {lang === 'es' ? 'Liquidación' : 'Liquidação'} {liqId ? cntTotal : ''}
            </Text>
          </TouchableOpacity>

          {/* Pagos */}
          <TouchableOpacity
            style={[S.segmentBtn, tab === 'liquidacao' && filtro === 'pagas' && S.segmentBtnActivePagos]}
            onPress={() => { if (liqId && cntPagas > 0) { tabManualRef.current = true; setTab('liquidacao'); setFiltro('pagas'); } }}
            activeOpacity={0.7}
            disabled={!liqId || cntPagas === 0}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color={tab === 'liquidacao' && filtro === 'pagas' ? '#fff' : (cntPagas > 0 ? '#10B981' : '#9CA3AF')} />
            <Text style={[S.segmentBtnText, tab === 'liquidacao' && filtro === 'pagas' && S.segmentBtnTextActive, cntPagas === 0 && { color: '#9CA3AF' }]}>
              {lang === 'es' ? 'Pagados' : 'Pagos'} {cntPagas > 0 ? cntPagas : ''}
            </Text>
          </TouchableOpacity>

          {/* Todos */}
          <TouchableOpacity
            style={[S.segmentBtn, tab === 'todos' && S.segmentBtnActiveTodos]}
            onPress={() => { tabManualRef.current = true; setTab('todos'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={14} color={tab === 'todos' ? '#fff' : '#374151'} />
            <Text style={[S.segmentBtnText, tab === 'todos' && S.segmentBtnTextActive]}>
              {lang === 'es' ? 'Todos' : 'Todos'} {todosList.length > 0 ? todosList.length : ''}
            </Text>
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
        onLimpar={() => {
          setFiltro('todos');
          setFiltroVencimento('todos');
          setFiltroTipo('todos');
          setFiltroStatus('todos');
          setFiltroFrequencia('todos');
          setOcultarLiquidacao(false);
        }}
        filtroVencimento={filtroVencimento}
        setFiltroVencimento={setFiltroVencimento}
        cntVencDia={cntVencDia}
        cntVencAtrasados={cntVencAtrasados}
        temFiltroAtivo={temFiltroAtivo}
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
        filtroFrequencia={filtroFrequencia}
        setFiltroFrequencia={setFiltroFrequencia}
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
      {/* Recarga em segundo plano: a lista continua na tela e utilizável; esta
          faixa fina é o único sinal de que os dados estão sendo conferidos. */}
      {(tab === 'liquidacao' ? revalidando : (loadTodos && todosList.length > 0)) && (
        <View style={S.faixaAtualizando}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={S.faixaAtualizandoTx}>{lang === 'es' ? 'Actualizando…' : 'Atualizando…'}</Text>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          LISTAS — ambas sempre montadas, visibilidade via display
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* Lista Liquidação (colapsada quando inativa, mas sempre montada) */}
      <View style={tab === 'liquidacao' ? { flex: 1 } : { height: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <View style={[S.em, { justifyContent: 'center' }]}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={S.emT}>{t.semClientes}</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#BFDBFE' }}
              onPress={() => setShowProximosDias(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color="#2563EB" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB' }}>
                {lang === 'es' ? 'Próximos días' : 'Próximos dias'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListLiqRef}
              data={filtered}
              keyExtractor={(item) => item.key}
              renderItem={({ item }: { item: ItemLista }) => {
                if (filtro === 'pagas') {
                  // Hora do PRIMEIRO pagamento das contas DESTE card — a mesma
                  // que ordena a lista, senão a sequência exibida não bate com
                  // as horas. Varre o pagMap pelas parcelas dos empréstimos do
                  // item (não pela parcela_id do card: quando o empréstimo tem
                  // parcela paga + pendente, o card guarda a PENDENTE e o
                  // pagMap, chaveado por parcela, não acharia a data).
                  const empsDoItem = new Set(item.emprestimos.map(x => x.emprestimo_id));
                  let dtSrc: string | null = null;
                  let dtSrcMs = Infinity;
                  pagMap.forEach((p, parcelaId) => {
                    const eid = empDaParcela.get(parcelaId);
                    if (!eid || !empsDoItem.has(eid) || !p.data_pagamento) return;
                    const ms = new Date(p.data_pagamento).getTime();
                    if (!isNaN(ms) && ms < dtSrcMs) { dtSrcMs = ms; dtSrc = p.data_pagamento; }
                  });
                  const fmtDtPag = dtSrc ? (() => {
                    if (dtSrc.includes('T') || dtSrc.includes('+') || dtSrc.length > 10) {
                      const d = new Date(dtSrc);
                      return `${d.toLocaleDateString(lang === 'es' ? 'es' : 'pt-BR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString(lang === 'es' ? 'es' : 'pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                    }
                    const [y, m, day] = dtSrc.split('-');
                    return `${day}/${m}`;
                  })() : null;
                  return (
                    <View>
                      {fmtDtPag && (
                        <View style={S.pagDateHeader}>
                          <Ionicons name="time-outline" size={12} color="#374151" />
                          <Text style={S.pagDateText}>{lang === 'es' ? 'Pagado' : 'Pago'}: {fmtDtPag}</Text>
                        </View>
                      )}
                      {renderCard(item)}
                    </View>
                  );
                }
                return renderCard(item);
              }}
              style={S.ls}
              contentContainerStyle={S.lsI}
              refreshControl={!isViz ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => { setShowFiltroTipo(false); setShowFiltroStatus(false); }}
              ListFooterComponent={
                <View style={{ paddingBottom: 90 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingVertical: 14, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                    onPress={() => setShowProximosDias(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#2563EB' }}>
                      {lang === 'es' ? 'Próximos días' : 'Próximos dias'}
                    </Text>
                  </TouchableOpacity>
                </View>
              }
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
        )}
      </View>

      {/* Lista Todos (colapsada quando inativa, mas sempre montada) */}
      <View style={tab === 'todos' ? { flex: 1 } : { height: 0, overflow: 'hidden' }}>
        {loadTodos && todosList.length === 0 ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
        ) : todosFilt.length === 0 ? (
          <View style={S.em}><Ionicons name="document-text-outline" size={48} color="#9CA3AF" /><Text style={S.emT}>{t.semClientes}</Text></View>
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
              ListHeaderComponent={
                <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="people" size={16} color="#92400E" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E', flex: 1 }}>
                    {lang === 'es' ? `Mostrando todos · ${todosFilt.length} clientes` : `Mostrando todos · ${todosFilt.length} clientes`}
                  </Text>
                  {/* Só faz sentido oferecer "Voltar" se existir uma liquidação
                      selecionada para onde voltar. Sem seleção, a aba Liquidação
                      está desabilitada e o toque não levava a lugar nenhum. */}
                  {temSelecaoLiq && (
                    <TouchableOpacity
                      onPress={() => { tabManualRef.current = true; setTab('liquidacao'); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#D97706' }}>
                        {lang === 'es' ? 'Volver' : 'Voltar'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
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
        )}
      </View>

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
        onPagarMultiplo={handlePagarMultiplo}
        onEstornar={abrirEstorno}
        pagamentosDetalhados={pagamentosDetalhados}
        lang={lang}
        trabalhaDomingo={trabalhaDomingo}
        feriados={feriadosRota}
        dataOperacional={dataOperacionalTela}
        t={t}
      />

      {/* MODAL PAGAMENTO - COM CRÉDITO E VALIDAÇÕES */}
      <MenuPagamento
        visible={menuPagamentoVisible}
        onClose={() => setMenuPagamentoVisible(false)}
        parcela={parcelaPagamento}
        clienteNome={dadosPagamento?.cliente_nome || clienteModal?.nome || ''}
        totalParcelas={dadosPagamento?.total_parcelas || parcelasModal.length || 0}
        saldoEmprestimo={Number(clienteModal?.saldo_emprestimo || 0)}
        creditoDisponivel={Number(dadosPagamento?.credito_disponivel || 0)}
        pagamentosParciais={pagamentosParciaisPag}
        onPagarValor={acaoPagarValor}
        onUsarCredito={acaoUsarCredito}
        onPagarMultiplas={acaoPagarMultiplas}
        onQuitarEmprestimo={acaoQuitarEmprestimo}
        t={t}
      />

      <ResumoPagamentoModal
        visible={resumoVisible}
        onClose={() => setResumoVisible(false)}
        parcelaNumero={parcelaPagamento?.numero_parcela || 0}
        clienteNome={clienteModal?.nome || ''}
        valorPagamento={resumoValor}
        saldoEmprestimo={Number(clienteModal?.saldo_emprestimo || 0)}
        totalPagoEmprestimo={Number(emprestimoInfoPag?.total_pago || 0)}
        valorTotalEmprestimo={Number(emprestimoInfoPag?.valor_total || 0)}
        processando={processando}
        onConfirmar={handleResumoConfirmar}
        t={t}
      />

      <ConfirmModal
        visible={confirmModal.visible}
        titulo={confirmModal.titulo}
        mensagem={confirmModal.mensagem}
        textoCancelar={t.cancelar || 'Cancelar'}
        textoConfirmar={t.confirmar || 'Confirmar'}
        corConfirmar={confirmModal.corConfirmar}
        onCancelar={() => { setConfirmModal(c => ({ ...c, visible: false })); setMenuPagamentoVisible(true); }}
        onConfirmar={confirmModal.onConfirmar}
      />

      <PagarMultiplasModal
        visible={multiplasVisible}
        onClose={() => setMultiplasVisible(false)}
        clienteNome={clienteModal?.nome || ''}
        totalParcelas={dadosPagamento?.total_parcelas || multiplasParcelas.length || 0}
        parcelas={multiplasParcelas}
        parcelaAtualId={parcelaPagamento?.parcela_id || ''}
        creditoDisponivel={Number(dadosPagamento?.credito_disponivel || 0)}
        saldoEmprestimo={Number(clienteModal?.saldo_emprestimo || 0)}
        totalPagoEmprestimo={Number(emprestimoInfoPag?.total_pago || 0)}
        valorTotalEmprestimo={Number(emprestimoInfoPag?.valor_total || 0)}
        onConfirmar={handleMultiplasConfirmar}
        t={t}
      />

      <ValorLivreModal
        visible={valorLivreVisible}
        onClose={() => setValorLivreVisible(false)}
        parcelaNumero={parcelaPagamento?.numero_parcela || 0}
        clienteNome={clienteModal?.nome || ''}
        saldoEmprestimo={Number(clienteModal?.saldo_emprestimo || 0)}
        totalPagoEmprestimo={Number(emprestimoInfoPag?.total_pago || 0)}
        valorTotalEmprestimo={Number(emprestimoInfoPag?.valor_total || 0)}
        processando={processando}
        onConfirmar={handleValorLivreConfirmar}
        t={t}
      />

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
        emprestimoInfo={emprestimoInfoPag}
        pagamentosParciais={pagamentosParciaisPag}
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
        permitirCriar={!!(liqId && ['ABERTO', 'ABERTA', 'REABERTO', 'REABERTA'].includes(liqCtx.liquidacaoAtual?.status || ''))}
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
            nav.navigate('NovoCliente', { dataLiq, 
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
        onAlterarSolicitacaoRenovacao={async (cli, solicId, empQuitadoId, valorSolic, statusSolic) => {
          // Busca os termos exatamente como o vendedor pediu (persistidos em
          // renovacoes_pendentes no momento do bloqueio), não os do empréstimo
          // antigo quitado — é isso que preserva a data que ele escolheu.
          const { data: sa } = await supabase
            .from('solicitacoes_autorizacao')
            .select('renovacao_pendente_id')
            .eq('id', solicId)
            .single();

          let termos: any = null;
          if (sa?.renovacao_pendente_id) {
            const { data: rp } = await supabase.rpc('fn_buscar_detalhes_renovacao_pendente', {
              p_renovacao_pendente_id: sa.renovacao_pendente_id,
            });
            termos = Array.isArray(rp) ? rp[0] : rp;
          }

          const nav = navigation.getParent() || navigation;
          nav.navigate('NovoCliente', { dataLiq,
            clienteExistente: { id: cli.id, nome: cli.nome, telefone_celular: (cli as any).telefone_celular, documento: (cli as any).codigo_cliente?.toString() || '' },
            solicitacaoRenovacao: {
              solic_id: solicId,
              // APROVADO trava valor e taxa no formulário; PENDENTE deixa livre
              status: statusSolic,
              valor_principal: termos?.valor_aprovado ?? termos?.valor_principal ?? valorSolic,
              numero_parcelas: termos?.numero_parcelas || 10,
              taxa_juros: termos?.taxa_juros || 20,
              frequencia: termos?.frequencia || 'DIARIO',
              dia_semana_cobranca: termos?.dia_semana_cobranca ?? null,
              dia_mes_cobranca: termos?.dia_mes_cobranca ?? null,
              dias_mes_cobranca: termos?.dias_mes_cobranca ?? null,
              iniciar_proximo_mes: termos?.iniciar_proximo_mes ?? false,
              data_primeiro_vencimento: termos?.data_primeiro_vencimento ?? null,
              observacoes_emprestimo: termos?.observacoes_emprestimo ?? null,
              microseguro_valor: termos?.microseguro_valor ?? null,
            },
          });
        }}
        onCancelarSolicitacaoRenovacao={async (solicId) => {
          await supabase
            .from('solicitacoes_autorizacao')
            .update({ status: 'CANCELADO', motivo_resolucao: 'Cancelado pelo vendedor', data_resolucao: new Date().toISOString() })
            .eq('id', solicId);
          setSolicitacoesRenovacaoMap(prev => { const m = new Map(prev); m.forEach((v, k) => { if (v.solic_id === solicId) m.delete(k); }); return m; });
          setModalDetalhesVisible(false);
          setTimeout(() => setModalDetalhesVisible(true), 100);
        }}
        onRenegociar={(cli, emp) => {
          // Mesmo fluxo do onRenegociar do ClienteCardTodos
          const nav = navigation.getParent() || navigation;
          nav.navigate('NovoCliente', { dataLiq, 
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

      {/* Modal Próximos Dias */}
      <ProximosDiasModal
        visible={showProximosDias}
        onClose={() => setShowProximosDias(false)}
        rotaId={rotaId}
        dataLiq={dataLiq}
        lang={lang}
      />
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
    paddingBottom: 8,
  },
  newTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Controle segmentado
  segmentRow: { paddingHorizontal: 16, paddingBottom: 10 },
  segmentGroup: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 10, padding: 3 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 4 },
  segmentBtnActive: { backgroundColor: '#3B82F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  segmentBtnActivePagos: { backgroundColor: '#10B981', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  segmentBtnActiveTodos: { backgroundColor: '#D97706', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  segmentBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  segmentBtnTextActive: { color: '#fff' },


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

  // Filter buttons
  filterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFF',
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
  faixaAtualizando: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingVertical: 6 },
  faixaAtualizandoTx: { fontSize: 12, fontWeight: '600', color: '#2563EB' },

  // Empty state
  em: { alignItems: 'center', paddingTop: 60 },
  emI: { fontSize: 48, marginBottom: 12 },
  emT: { fontSize: 14, color: '#9CA3AF' },

  // Alphabet sidebar indicator
  alphaIndicator: { position: 'absolute', left: '50%', top: '45%', marginLeft: -30, marginTop: -30, width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 200, pointerEvents: 'none' },
  alphaIndicatorText: { color: '#fff', fontSize: 28, fontWeight: '800' },

  // Data/hora pagamento (visão Pagos)
  pagDateHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  pagDateText: { fontSize: 11, fontWeight: '600', color: '#374151' },

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