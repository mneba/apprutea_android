// ============================================================
// creditoEmTela — a régua do crédito para quem NÃO o vê
//
// `rotas.trabalha_credito = false` (ver hooks/useTrabalhaCredito) esconde a
// palavra crédito. O crédito continua existindo igual: o pago a mais fica em
// `saldo_excedente` e é consumido no FIM do empréstimo — a última parcela sai
// cobrando menos, como o "Pagar várias" e a quitação sempre fizeram.
//
// Então o que a tela mostra no lugar dele é uma CONTAGEM: quantas parcelas o
// dinheiro já entregue equivale. Pagou 150 em parcelas de 100: "1,5 pagas".
//
// Pura de propósito (sem react-native): dá para compilar e chamar.
// ============================================================

/**
 * Parcelas pagas em EQUIVALENTE: (total − saldo) ÷ valor da parcela.
 *
 * `saldo` é `emprestimos.valor_saldo`, que JÁ é líquido de crédito — por isso
 * o pago a mais entra aqui sem conta nenhuma a mais. Não subtraia o crédito
 * de novo (CLAUDE.md, "`valor_saldo` vem líquido de crédito").
 *
 * Arredonda para BAIXO na primeira casa: a tela nunca diz que foi pago mais
 * do que foi. Com saldo em aberto, nunca chega ao total.
 *
 * Devolve null sem valor de parcela ou de total (não há o que dividir).
 */
export function parcelasPagasEquivalentes(
  valorTotal: number,
  saldo: number,
  valorParcela: number,
  parcelasTotal?: number,
): number | null {
  if (!(valorParcela > 0) || !(valorTotal > 0)) return null;
  const pago = Math.max(valorTotal - Math.max(saldo || 0, 0), 0);
  let n = Math.floor((pago / valorParcela) * 10 + 1e-6) / 10;
  if (parcelasTotal != null && parcelasTotal > 0) {
    if (n > parcelasTotal) n = parcelasTotal;
    // Saldo em aberto não pode virar "24 de 24".
    if ((saldo || 0) > 0.009 && n >= parcelasTotal) n = Math.round((parcelasTotal - 0.1) * 10) / 10;
  }
  return n;
}

/** Quantas faltam, na mesma régua: total − pagas, uma casa. */
export function parcelasRestantesEquivalentes(parcelasTotal: number, pagas: number): number {
  return Math.max(Math.round((parcelasTotal - pagas) * 10) / 10, 0);
}

/** 1.5 → "1,5"; 2 → "2". Sem Intl (ver formato.ts). */
export function fracaoBr(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

/**
 * Quanto de cada parcela o dinheiro já entregue cobre, EM ORDEM: 1 = cheia,
 * 0,5 = metade, 0 = nada. É o desenho do "1,5 de 24": pagou 150 em parcelas
 * de 100 → [1, 0.5, 0, 0, ...].
 *
 * `pago` é `valor_total − valor_saldo` (o saldo já é líquido de crédito). Com
 * saldo zerado, passe `Infinity`: `valor_total` difere da soma das parcelas
 * por centavos em alguns empréstimos, e a última não pode sair "quase cheia".
 *
 * É visual de propósito: a parcela 2 aparece meio paga mesmo que, no banco, o
 * excedente esteja guardado na 1 — e é isso que se quer mostrar.
 */
export function preenchimentoParcelas(valores: number[], pago: number): number[] {
  let resto = Math.max(pago || 0, 0);
  return valores.map(v => {
    if (!(v > 0)) return 0;
    const f = Math.min(Math.max(resto / v, 0), 1);
    resto -= v;
    return f > 0.995 ? 1 : f;
  });
}
