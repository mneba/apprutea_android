// =====================================================================
// FICHA DO EMPRÉSTIMO — acesso
// Arquivo: src/services/fichaEmprestimo.ts
// =====================================================================
//
// Uma chamada, um JSON. Toda a montagem vive em fn_ficha_emprestimo (ver
// sql/2026-09-15_fn_ficha_emprestimo.sql) porque o webapp consome exatamente
// a mesma coisa — duas montagens divergiriam, como já divergiram as regras de
// data entre julho e setembro de 2026.
//
// Os campos `emprestimo`, `cliente` e `parcelas` vêm de `to_jsonb` da linha
// inteira: ganham colunas sozinhos quando a tabela ganha. Por isso são `any`
// aqui — tipar seria congelar o que o banco não congelou.

import { supabase } from './supabase';

export type TipoEvento =
  | 'CONCESSAO'
  | 'PAGAMENTO'
  | 'QUITACAO'
  | 'CREDITO_CASCATA'
  | 'IMPORTACAO';

export interface EventoFicha {
  tipo: TipoEvento;
  operacao_id?: string;
  /** Instante real da operação (timestamptz). Na concessão é só a data. */
  quando: string;
  /** Data da liquidação em que a operação foi registrada. */
  data_operacional: string;
  liquidacao_data?: string | null;
  parcelas?: number[];
  pagamento_ids?: string[];
  registros?: number;
  /** Valor abatido do empréstimo (dinheiro + crédito). */
  aplicado?: number;
  /** Só o que entrou no caixa. */
  dinheiro?: number;
  credito_usado?: number;
  credito_gerado?: number;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  estornado: boolean;
  data_estorno?: string | null;
  motivo_estorno?: string | null;
  estornado_por?: string | null;
  autor?: string | null;
  /** Saldos APÓS o evento, já descontando o que foi estornado. */
  saldo_devedor: number;
  saldo_credito: number;
  /** Só na CONCESSAO. */
  valor_emprestado?: number;
}

export interface EloCadeia {
  id: string;
  atual: boolean;
  tipo_emprestimo: string | null;
  status: string;
  data_emprestimo: string | null;
  valor_principal: number | null;
  valor_total: number | null;
  valor_saldo: number | null;
  origem_id: string | null;
}

export interface TotaisFicha {
  valor_total: number;
  saldo_atual: number;
  dinheiro_recebido: number;
  credito_disponivel: number;
  parcelas_total: number;
  parcelas_pagas: number;
  parcelas_abertas: number;
}

/**
 * As duas invariantes, calculadas pelo banco a cada abertura.
 *
 * `caixa_confere` compara o que as parcelas dizem ter recebido (menos o
 * crédito consumido) com o dinheiro que realmente entrou. `credito_confere`
 * compara o crédito gerado menos usado com o que ainda está parado em
 * `saldo_excedente`. Foram estas duas contas, feitas à mão, que resolveram o
 * caso Paloma Unhas — agora a ficha as mostra sozinha.
 */
export interface ConferenciaFicha {
  dinheiro_recebido: number;
  pago_nas_parcelas: number;
  credito_usado: number;
  caixa_confere: boolean;
  credito_gerado: number;
  credito_saldo_registros: number;
  credito_saldo_parcelas: number;
  credito_confere: boolean;
}

export interface Ficha {
  sucesso: boolean;
  mensagem?: string;
  emprestimo: any;
  cliente: any;
  rota_nome: string | null;
  totais: TotaisFicha;
  eventos: EventoFicha[];
  parcelas: any[];
  cadeia: EloCadeia[];
  conferencia: ConferenciaFicha;
}

export async function buscarFicha(emprestimoId: string): Promise<Ficha> {
  const { data, error } = await supabase.rpc('fn_ficha_emprestimo', {
    p_emprestimo_id: emprestimoId,
  });

  if (error) throw error;
  if (!data) throw new Error('Ficha vazia');
  if (data.sucesso === false) throw new Error(data.mensagem || 'Empréstimo não encontrado');

  return data as Ficha;
}
