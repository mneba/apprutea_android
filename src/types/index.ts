// Tipos base do sistema

export interface DashboardMetrics {
  totalLoaned: string;
  totalDue: string;
  pending: string;
  activeClients: number;
  activeLoans: number;
  overdueLoans: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'partner' | 'secretary' | 'seller' | 'inspector';
  companyId?: string;
}

export interface Vendedor {
  id: string;
  nome: string;
  codigo_vendedor: string | null;
  telefone: string | null;
  documento: string | null;
  endereco: string | null;
  email: string | null;
  status: string;
  data_admissao: string | null;
  created_at: string;
  updated_at: string;
  empresa_id: string | null;
  apellidos: string | null;
  data_vencimento: string | null;
  valor_venda_maxima: number | null;
  saldo_inicial: number | null;
  codigo_acesso: string;
  estado_acesso: string | null;
  hierarquia_id: string | null;
  user_id: string | null;
  foto_url: string | null;
}

export interface LiquidacaoDiaria {
  id: string;
  vendedor_id: string;
  rota_id: string;
  empresa_id: string;
  data_abertura: string;
  data_fechamento: string | null;
  status: string;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  caixa_inicial: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  caixa_final: number | null;
  carteira_inicial: number | null;
  carteira_final: number | null;
  valor_esperado_dia: number | null;
  valor_recebido_dia: number | null;
  percentual_recebimento: number | null;
  clientes_iniciais: number | null;
  clientes_sincronizados: number | null;
  clientes_novos: number | null;
  clientes_renovados: number | null;
  clientes_renegociados: number | null;
  clientes_cancelados: number | null;
  pagamentos_pagos: number | null;
  pagamentos_nao_pagos: number | null;
  valor_dinheiro: number | null;
  valor_transferencia: number | null;
  total_microseguro_dia: number | null;
  qtd_microseguros_dia: number | null;
  total_emprestado_dia: number | null;
  qtd_emprestimos_dia: number | null;
  total_despesas_dia: number | null;
  qtd_despesas_dia: number | null;
}

export interface Conta {
  id: string;
  nome: string;
  tipo: string;
  saldo_atual: number;
  rota_id: string | null;
  empresa_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Rota {
  id: string;
  nome: string;
  empresa_id: string;
  vendedor_id: string | null;
}

// Tipo para a view vw_clientes_rota_dia
export interface ClienteRotaDia {
  // Dados do Cliente
  cliente_id: string;
  consecutivo: number | null;
  nome: string;
  telefone_celular: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  
  // Dados do Empréstimo
  emprestimo_id: string;
  saldo_emprestimo: number;
  valor_principal: number;
  numero_parcelas: number;
  status_emprestimo: string;
  rota_id: string;
  frequencia_pagamento?: string | null;
  
  // Dados da Parcela do Dia
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago_parcela: number;
  saldo_parcela: number;
  status_parcela: string;
  data_vencimento: string;
  ordem_visita_dia: number | null;
  liquidacao_id: string | null;
  
  // Indicadores para filtros
  tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number;
  valor_total_vencido: number;
  
  // Status visual para o frontend
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  
  // Empréstimo adicional
  permite_emprestimo_adicional: boolean;
  
  // Flag para indicar parcela atrasada
  is_parcela_atrasada?: boolean;
}

// Tipo para dados de um empréstimo individual
export interface EmprestimoData {
  emprestimo_id: string;
  saldo_emprestimo: number;
  valor_principal: number;
  numero_parcelas: number;
  status_emprestimo: string;
  frequencia_pagamento?: string | null;
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago_parcela: number;
  pagamento_info?: {
    valorPago: number;
    creditoGerado: number;
    valorParcela: number;
  };
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

// Tipo para cliente agrupado com múltiplos empréstimos
export interface ClienteAgrupado {
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

export interface Parcela {
  id?: string;
  parcela_id?: string;
  emprestimo_id: string;
  numero_parcela: number;
  valor_parcela?: number;
  valor_pago?: number;
  valor_saldo?: number;
  valor_multa?: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
}

// Tipos de ordenação e filtros
export type OrdenacaoTipo = 'rota' | 'a-z' | 'z-a' | 'endereco' | 'proximos';
export type FiltroTipo = 'todos' | 'inadimplentes' | 'proximos';
export type AbaAtiva = 'liquidacao' | 'todos';
export type FiltroTipoEmprestimo = 'todos' | 'NOVO' | 'RENOVACAO' | 'RENEGOCIACAO';
export type FiltroStatusEmprestimo = 'todos' | 'ATIVO' | 'QUITADO' | 'CANCELADO' | 'VENCIDO' | 'RENEGOCIADO';

// Idiomas suportados
export type Language = 'pt-BR' | 'es';
