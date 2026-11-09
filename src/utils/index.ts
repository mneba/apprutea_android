/**
 * Funções utilitárias do app Bella Kids
 */
import { numeroBr, data as dataBr, dataHora } from './formato';

/**
 * Formata valor em dinheiro.
 *
 * ⚠ O simbolo e SEMPRE `$`, com 2 casas. O sistema opera na America
 * Latina e a tela NAO sabe em que pais esta -- a empresa e que carrega o
 * fuso e a moeda, e nao ha campo de moeda no schema (ver "Ja existem
 * DUAS moedas na base" no prompt do modulo de licencas). Entao `R$` aqui
 * era simplesmente errado, e cortar os centavos por supor peso
 * colombiano seria o mesmo erro pelo outro lado: decisao do Mauricio em
 * 04/11/2026, "como nao sabemos a localizacao devemos manter casas
 * decimais".
 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '$ 0,00';
  return '$ ' + numeroBr(valor);
}

/** @deprecated Mesma coisa que `formatarMoeda`. Use aquela. */
export function formatarMoedaCOP(valor: number | null | undefined): string {
  return formatarMoeda(valor);
}

/**
 * Formata data para exibição
 */
export function formatarData(data: string | Date | null): string {
  if (!data) return '-';
  return dataBr(data);
}

/**
 * Formata data e hora para exibição
 */
export function formatarDataHora(data: string | Date | null): string {
  if (!data) return '-';
  const d = new Date(data);
  return dataHora(d);
}

/**
 * Retorna a cor baseada no status
 */
export function getStatusColor(status: string): string {
  const cores: Record<string, string> = {
    'PAGO': '#10B981',
    'PARCIAL': '#F59E0B', 
    'EM_ATRASO': '#EF4444',
    'PENDENTE': '#6B7280',
    'ABERTA': '#10B981',
    'FECHADA': '#6B7280',
    'ATIVO': '#10B981',
    'INATIVO': '#EF4444',
    'QUITADO': '#3B82F6',
    'CANCELADO': '#9CA3AF',
  };
  return cores[status] || '#6B7280';
}

/**
 * Retorna emoji + texto baseado no status
 */
export function getStatusText(status: string): string {
  const textos: Record<string, string> = {
    'PAGO': '✅ Pago',
    'PARCIAL': '⚡ Parcial',
    'EM_ATRASO': '⚠️ Atraso',
    'PENDENTE': '⏳ Pendente',
    'ABERTA': '🟢 Aberto',
    'FECHADA': '🔴 Fechado',
    'ATIVO': '✅ Ativo',
    'INATIVO': '❌ Inativo',
  };
  return textos[status] || status;
}

/**
 * Calcula dias de atraso
 */
export function calcularDiasAtraso(dataVencimento: string): number {
  const hoje = new Date();
  const vencimento = new Date(dataVencimento);
  const diffTime = hoje.getTime() - vencimento.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Formata telefone para exibição
 */
export function formatarTelefone(telefone: string | null): string {
  if (!telefone) return '-';
  const numeros = telefone.replace(/\D/g, '');
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  return telefone;
}

/**
 * Limpa telefone para uso em links
 */
export function limparTelefone(telefone: string | null): string {
  if (!telefone) return '';
  return telefone.replace(/\D/g, '');
}

/**
 * Trunca texto com ellipsis
 */
/**
 * Normaliza texto para BUSCA: sem acento, minusculo, sem espaco nas pontas.
 *
 * Vive aqui porque duas telas buscam cliente pelo nome — a lista de clientes
 * e o "Resetar cliente" do extrato — e busca que ignora acento num lugar e
 * nao no outro e o formato de erro que este projeto ja pagou varias vezes.
 * Quem digita "nubia" tem de achar "núbia" nos dois.
 */
export const normalizarBusca = (texto: string): string =>
  (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function truncarTexto(texto: string, tamanho: number): string {
  if (texto.length <= tamanho) return texto;
  return texto.slice(0, tamanho - 3) + '...';
}

/**
 * Gera iniciais do nome
 */
export function getIniciais(nome: string): string {
  const partes = nome.trim().split(' ');
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

/**
 * Valida se é um email válido
 */
export function validarEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida se é um CPF válido (formato)
 */
export function validarCPF(cpf: string): boolean {
  const numeros = cpf.replace(/\D/g, '');
  return numeros.length === 11;
}

/**
 * Formata CPF para exibição
 */
export function formatarCPF(cpf: string | null): string {
  if (!cpf) return '-';
  const numeros = cpf.replace(/\D/g, '');
  if (numeros.length !== 11) return cpf;
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
}
