// =====================================================================
// DIA DA SEMANA DOS EMPRÉSTIMOS SEMANAIS
// Arquivo: src/services/diasSemanaEmprestimos.ts
// =====================================================================
//
// O Julio pediu (23/09/2026) que o cliente semanal mostre, abaixo de
// "Semanal", o dia programado — "Terça-feira" — principalmente na aba Todos.
//
// `dia_semana_cobranca` não vem em `fn_liquidacao_dia_completa`, e acrescentar
// coluna lá obrigaria a DERRUBAR E RECRIAR a função espinha dorsal da operação
// diária (é `RETURNS TABLE`, não aceita CREATE OR REPLACE com assinatura
// nova). Risco desproporcional para exibir um rótulo.
//
// Então é uma leitura à parte, SOB DEMANDA: só quando a aba Todos é aberta ou
// o filtro Semanal é ligado. A "uma onda" do carregamento diário
// (ver clientesLiquidacaoRepo.ts e CLAUDE.md) continua intacta — esta chamada
// não existe no caminho quente.
//
// É leitura de duas colunas, sem regra de negócio no meio: `.from()` direto,
// como o app já faz em NotasComponent, useBuscaDocumento e LiquidacaoDetalhes.

import { supabase } from './supabase';

/** 0 = domingo … 6 = sábado, igual a `DIAS_SEMANA` da Nova Venda e a getDay(). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** `emprestimo_id` → dia da semana. Só empréstimos SEMANAL aparecem. */
export type MapaDiasSemana = Record<string, DiaSemana>;

// O `.in()` do PostgREST viaja na query string. Uma rota grande tem centenas
// de empréstimos e 37 caracteres por uuid estouram a URL — daí o lote.
const LOTE = 120;

export async function buscarDiasSemana(emprestimoIds: string[]): Promise<MapaDiasSemana> {
  const ids = Array.from(new Set(emprestimoIds.filter(Boolean)));
  if (!ids.length) return {};

  const mapa: MapaDiasSemana = {};

  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const { data, error } = await supabase
      .from('emprestimos')
      .select('id, dia_semana_cobranca')
      .in('id', lote)
      .eq('frequencia_pagamento', 'SEMANAL');

    if (error) {
      console.error('❌ Dias da semana:', error);
      // Devolve o que já juntou: o rótulo é um extra, não pode derrubar a
      // lista de clientes por causa de uma leitura secundária.
      return mapa;
    }

    for (const r of (data || [])) {
      const d = (r as any).dia_semana_cobranca;
      if (d != null && d >= 0 && d <= 6) mapa[(r as any).id] = Number(d) as DiaSemana;
    }
  }

  return mapa;
}
