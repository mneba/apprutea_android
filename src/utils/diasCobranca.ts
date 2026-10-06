// =====================================================
// DIAS DE COBRANÇA — autoridade única de "dias de atraso"
// Arquivo: src/utils/diasCobranca.ts
// =====================================================
//
// POR QUE ESTE ARQUIVO EXISTE
//
// O app tinha três cálculos independentes de atraso e só um estava certo:
//
//   • ClienteCardLiquidacao ... diferença de calendário pura (contava domingo)
//   • ParcelasModal .......... excluía domingo, mas não feriado
//   • ClienteDetalhesModal ... coluna `emprestimo_parcelas.dias_atraso`, que o
//                              banco persiste como (hoje − vencimento)
//
// O campo relatou o mesmo bug quatro vezes entre 17/07 e 24/08 de 2026 porque
// as correções anteriores foram aplicadas no lugar que já estava correto. Daqui
// em diante, quem mostra atraso importa DESTE arquivo — não recalcula.
//
// A REGRA
//
// Atraso é medido em DIAS DE COBRANÇA, não em dias de calendário: só contam os
// dias em que a rota efetivamente passa. Um domingo numa rota que não trabalha
// domingo, ou um feriado lançado em `feriados_rota`, não é atraso do cliente —
// a cobrança não aconteceu porque ninguém foi cobrar.
//
// Exemplo real (Andreza Vera Rodrigues, rota Madrid, empréstimo de 30/07/2026):
//   parcela 2 — venc 01/08 (sáb), paga 04/08 (ter)
//       3 dias corridos − domingo 02/08 = 2 dias de atraso
//   parcela 5 — venc 05/08 (qua), paga 10/08 (seg)
//       5 dias corridos − domingo 09/08 = 4 dias de atraso
//
// O sistema mostrava 3 e 5 — um a mais em cada, o domingo.

/** Configuração de cobrança da rota. */
export interface ConfigCobranca {
  /** `rotas.trabalha_domingo`. Atenção ao default: no banco NULL equivale a
   *  FALSE (é como fn_validar_abertura_liquidacao lê, com COALESCE). Leia
   *  sempre com `valor !== false` invertido — ou seja, `!!valor`. */
  trabalhaDomingo: boolean;
  /** Datas 'YYYY-MM-DD' de `feriados_rota` da rota. Opcional. */
  feriados?: Set<string> | null;
}

const MS_DIA = 86400000;

/** 'YYYY-MM-DD' (ou ISO completo) → Date em UTC. Null se não parsear.
 *  UTC de propósito: com data local, um fuso a oeste de Greenwich desloca o
 *  dia e o `getDay()` passa a apontar para o dia errado. */
const parseData = (valor?: string | null): Date | null => {
  if (!valor) return null;
  const p = valor.substring(0, 10).split('-').map(Number);
  if (p.length !== 3 || p.some(n => !Number.isFinite(n))) return null;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
};

const chaveDia = (d: Date): string => d.toISOString().substring(0, 10);

/** A rota passa neste dia? */
export const ehDiaDeCobranca = (data: Date, config: ConfigCobranca): boolean => {
  if (!config.trabalhaDomingo && data.getUTCDay() === 0) return false;
  if (config.feriados?.has(chaveDia(data))) return false;
  return true;
};

/**
 * Dias de cobrança entre o vencimento e a data de referência.
 *
 * Conta os dias APÓS o vencimento, até a referência inclusive — o próprio dia
 * do vencimento nunca é atraso.
 *
 *   > 0  atraso, em dias de cobrança
 *   = 0  em dia (pagou no vencimento, ou só houve dias sem cobrança no meio)
 *   < 0  adiantado, em dias de cobrança
 *
 * Datas ausentes ou inválidas devolvem 0 — nunca lançam.
 */
export function diasCobrancaEntre(
  dataVencimento?: string | null,
  dataReferencia?: string | null,
  config: ConfigCobranca = { trabalhaDomingo: true },
): number {
  const venc = parseData(dataVencimento);
  const ref = parseData(dataReferencia);
  if (!venc || !ref) return 0;

  const corridos = Math.round((ref.getTime() - venc.getTime()) / MS_DIA);
  if (corridos === 0) return 0;

  // Caminha dia a dia porque domingos e feriados não têm periodicidade comum —
  // uma fórmula fechada erraria sempre que os dois coincidissem.
  const sinal = corridos > 0 ? 1 : -1;
  const passos = Math.abs(corridos);
  let dias = 0;
  const cursor = new Date(venc);
  for (let i = 0; i < passos; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + sinal);
    if (ehDiaDeCobranca(cursor, config)) dias++;
  }
  return dias * sinal;
}

/** Atraso para exibição: nunca negativo. Adiantado vira 0. */
export const diasAtraso = (
  dataVencimento?: string | null,
  dataReferencia?: string | null,
  config: ConfigCobranca = { trabalhaDomingo: true },
): number => Math.max(0, diasCobrancaEntre(dataVencimento, dataReferencia, config));

// =====================================================
// A COR DO ATRASO
// =====================================================
//
// A escala vivia copiada em quatro arquivos e era alimentada pelo NÚMERO DE
// PARCELAS VENCIDAS, enquanto o texto ao lado dela mostrava DIAS. No mesmo
// card, a cor e o número diziam coisas diferentes — e a cor significava coisas
// incomparáveis conforme a frequência:
//
//   3 parcelas vencidas = 3 dias no diário · 3 semanas no semanal
//                       = 45 dias no quinzenal · 3 meses no mensal
//
// Tudo isso aparecia como o mesmo amarelo de "atraso leve". Um cliente mensal
// com 90 dias sem pagar ficava igual a um diário com três dias.
//
// Agora a cor sai dos MESMOS dias de cobrança que o card escreve ao lado. Os
// limites são os de antes (1-3 / 4-7 / 8+), então a rota diária não mudou em
// nada — ali parcela e dia sempre foram a mesma coisa. Mudou só o que estava
// mentindo.
//
// O roxo no nível médio é pedido #39 do cliente: laranja e amarelo ficavam
// quase indistinguíveis na tela do celular.

export const COR_EM_DIA = '#10B981';  // verde
export const COR_LEVE   = '#F59E0B';  // amarelo
export const COR_MEDIO  = '#9333EA';  // roxo
export const COR_GRAVE  = '#EF4444';  // vermelho

// DOIS EIXOS, E A COR É O PIOR DOS DOIS
//
// Nenhuma das duas medidas serve sozinha, e a carteira prova: 60% dela é
// diária, mas 25% é semanal e 8% é mensal ou quinzenal (medido em 05/10/2026).
//
//   Só por COBRANÇAS PERDIDAS, o mensal com 3 parcelas vencidas — noventa dias
//   sem pagar — fica amarelo, igual ao diário de três dias.
//
//   Só por TEMPO, o mensal que atrasou 8 dias fica vermelho, tendo perdido
//   uma única cobrança.
//
// As duas erram, em casos opostos. Então medimos os dois e ficamos com o pior:
// a cor responde "quantas cobranças falharam OU há quanto tempo não entra
// dinheiro, o que for mais grave".
//
// Na rota diária o resultado é idêntico ao de antes, porque ali um dia é uma
// cobrança e os dois eixos andam juntos. Muda só o que estava mal classificado.
//
// Os limites de TEMPO (15 e 30 dias) são regra de negócio, não técnica —
// calibrados para o mensal não gritar cedo demais. Trocar os dois números
// recalibra o sistema inteiro, e é o único lugar onde eles existem.

export const LIMITE_COBRANCAS_LEVE  = 3;
export const LIMITE_COBRANCAS_MEDIO = 7;
export const LIMITE_DIAS_LEVE       = 15;
export const LIMITE_DIAS_MEDIO      = 30;

/** 0 em dia · 1 leve · 2 moderado · 3 crítico. */
export type NivelAtraso = 0 | 1 | 2 | 3;

/** As cores na ordem dos níveis. A legenda lê daqui para não divergir. */
export const CORES_NIVEL: readonly string[] = [COR_EM_DIA, COR_LEVE, COR_MEDIO, COR_GRAVE];

export const nivelAtraso = (dias: number, cobrancasPerdidas: number): NivelAtraso => {
  const d = Number.isFinite(dias) ? dias : 0;
  const c = Number.isFinite(cobrancasPerdidas) ? cobrancasPerdidas : 0;

  const porCobrancas: NivelAtraso =
    c <= 0 ? 0 : c <= LIMITE_COBRANCAS_LEVE ? 1 : c <= LIMITE_COBRANCAS_MEDIO ? 2 : 3;
  const porTempo: NivelAtraso =
    d <= 0 ? 0 : d <= LIMITE_DIAS_LEVE ? 1 : d <= LIMITE_DIAS_MEDIO ? 2 : 3;

  return Math.max(porCobrancas, porTempo) as NivelAtraso;
};

/**
 * A cor do atraso.
 *
 * @param dias              dias de COBRANÇA de atraso (ver `diasAtraso`)
 * @param cobrancasPerdidas parcelas vencidas em aberto
 */
export const corAtraso = (dias: number, cobrancasPerdidas = 0): string =>
  CORES_NIVEL[nivelAtraso(dias, cobrancasPerdidas)];
