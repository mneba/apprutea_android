// Conferência da conta da QUITAÇÃO.
//
// A mesma lógica que ClientesScreen monta em `quitacaoInfo` e que
// MenuPagamento exibe, rodando sobre parcelas REAIS medidas na base em
// 08/11/2026 — mais os casos de borda.
//
// A pergunta que importa: o número que a tela manda em `p_valor_pagamento` é
// o que `fn_quitar_emprestimo` exige? Ela recusa fora de ±0,01, nas duas
// direções, então não há margem.

const ABERTAS = ['PENDENTE', 'PARCIAL', 'VENCIDO'];

/** A conta da tela (ClientesScreen, dentro de `abrirPagamento`). */
function contaDaTela(parcelas) {
  const bruto = parcelas
    .filter((p) => ABERTAS.includes(p.status))
    .reduce((acc, p) => acc + Number(p.valor_saldo || 0), 0);
  const credito = parcelas
    .filter((p) => Number(p.saldo_excedente || 0) > 0)
    .reduce((acc, p) => acc + Number(p.saldo_excedente || 0), 0);
  const aUsar = Math.min(credito, bruto);
  return { bruto, credito, dinheiro: bruto - aUsar };
}

/** A conta da FUNÇÃO, transcrita do corpo dela. */
function contaDaFuncao(parcelas) {
  const vSaldoBruto = parcelas
    .filter((p) => ABERTAS.includes(p.status))
    .reduce((acc, p) => acc + Number(p.valor_saldo || 0), 0);
  const vCredito = parcelas
    .filter((p) => Number(p.saldo_excedente || 0) > 0)
    .reduce((acc, p) => acc + Number(p.saldo_excedente || 0), 0);
  const vCreditoAUsar = Math.min(vCredito, vSaldoBruto);
  return {
    dinheiroNecessario: vSaldoBruto - vCreditoAUsar,
    recusaPorSobra: vCredito > vSaldoBruto + 0.01,
    recusaPorVazio: vSaldoBruto <= 0,
  };
}

/** A derivação ANTIGA, que a tela usava e que é o fallback de hoje. */
function contaAntiga(valorSaldoColuna) {
  return valorSaldoColuna;
}

const rep = (n, p) => Array.from({ length: n }, () => ({ ...p }));

const CASOS = [
  {
    nome: 'Jose Inacio Sousa Santos (Madrid)',
    // 12 pagas, duas delas carregando crédito (19 e 4), 8 pendentes de 36
    parcelas: [
      ...rep(9, { status: 'PAGO', valor_saldo: 0, saldo_excedente: 0 }),
      { status: 'PAGO', valor_saldo: 0, saldo_excedente: 19 },
      { status: 'PAGO', valor_saldo: 0, saldo_excedente: 0 },
      { status: 'PAGO', valor_saldo: 0, saldo_excedente: 4 },
      ...rep(8, { status: 'PENDENTE', valor_saldo: 36, saldo_excedente: 0 }),
    ],
    valorSaldoColuna: 265,
    espera: { bruto: 288, credito: 23, dinheiro: 265 },
  },
  {
    // O PIOR dos 24 em que `emprestimos.valor_saldo` diverge da soma das
    // parcelas. Crédito zero, e a coluna está 0,39 acima do devido — o
    // bastante para a função recusar, porque a tolerância dela é 0,01.
    nome: 'denise peluquería (7.1 BendCredit)',
    parcelas: [
      ...rep(4, { status: 'PAGO', valor_saldo: 0, saldo_excedente: 0 }),
      { status: 'VENCIDO', valor_saldo: 36.95, saldo_excedente: 0 },
      // 94, nao 95: 36,95 + 94 x 69,39 = 6559,61. Contei errado na primeira
      // versao e a assercao de `espera` pegou -- a comparacao tela x funcao
      // NAO pegaria, porque as duas leem a mesma entrada. Conferencia precisa
      // de um valor esperado vindo de fora, nao so de duas contas concordando.
      ...rep(94, { status: 'VENCIDO', valor_saldo: 69.39, saldo_excedente: 0 }),
    ],
    valorSaldoColuna: 6560,
    espera: { bruto: 6559.61, credito: 0, dinheiro: 6559.61 },
  },
  {
    nome: 'sem crédito, coluna em dia',
    parcelas: [
      ...rep(2, { status: 'PAGO', valor_saldo: 0, saldo_excedente: 0 }),
      ...rep(3, { status: 'PENDENTE', valor_saldo: 50, saldo_excedente: 0 }),
    ],
    valorSaldoColuna: 150,
    espera: { bruto: 150, credito: 0, dinheiro: 150 },
  },
  {
    // Crédito MAIOR que a dívida: a função recusa, e a tela tem de avisar
    // ANTES do clique. Era o aviso que nunca disparava.
    nome: 'crédito maior que a dívida',
    parcelas: [
      { status: 'PAGO', valor_saldo: 0, saldo_excedente: 500 },
      { status: 'PENDENTE', valor_saldo: 100, saldo_excedente: 0 },
    ],
    valorSaldoColuna: 0,
    espera: { bruto: 100, credito: 500, dinheiro: 0 },
    esperaAviso: true,
  },
  {
    nome: 'crédito cobre exatamente o que falta',
    parcelas: [
      { status: 'PAGO', valor_saldo: 0, saldo_excedente: 86 },
      ...rep(2, { status: 'VENCIDO', valor_saldo: 43, saldo_excedente: 0 }),
    ],
    valorSaldoColuna: 0,
    espera: { bruto: 86, credito: 86, dinheiro: 0 },
  },
];

const falhas = [];
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FALHA'}  ${m}`); if (!c) falhas.push(m); };
const q = (v) => v.toFixed(2);

for (const c of CASOS) {
  const tela = contaDaTela(c.parcelas);
  const fn = contaDaFuncao(c.parcelas);
  console.log(`\n── ${c.nome}`);

  ok(Math.abs(tela.bruto - c.espera.bruto) < 0.005, `bruto ${q(tela.bruto)} (esperado ${q(c.espera.bruto)})`);
  ok(Math.abs(tela.credito - c.espera.credito) < 0.005, `crédito ${q(tela.credito)} (esperado ${q(c.espera.credito)})`);
  ok(Math.abs(tela.dinheiro - c.espera.dinheiro) < 0.005, `dinheiro ${q(tela.dinheiro)} (esperado ${q(c.espera.dinheiro)})`);

  // A ASSERÇÃO QUE IMPORTA: a função aceita o que a tela manda?
  ok(Math.abs(tela.dinheiro - fn.dinheiroNecessario) < 0.01,
     `a função aceita: tela manda ${q(tela.dinheiro)}, ela exige ${q(fn.dinheiroNecessario)}`);

  // A decomposição que a tela MOSTRA tem de fechar de cima para baixo.
  ok(Math.abs(tela.bruto - Math.min(tela.credito, tela.bruto) - tela.dinheiro) < 0.005,
     `a decomposição fecha: ${q(tela.bruto)} − ${q(Math.min(tela.credito, tela.bruto))} = ${q(tela.dinheiro)}`);

  // O aviso de sobra, que até 08/11 nunca disparava.
  const avisoTela = tela.credito - tela.bruto > 0.01;
  ok(avisoTela === !!c.esperaAviso,
     `aviso de crédito maior que a dívida: ${avisoTela ? 'mostra' : 'não mostra'}`);
  ok(avisoTela === fn.recusaPorSobra, 'o aviso da tela concorda com a recusa da função');

  // E o contraste com a conta antiga.
  const antigo = contaAntiga(c.valorSaldoColuna);
  if (Math.abs(antigo - fn.dinheiroNecessario) > 0.01) {
    console.log(`      ANTES a tela mandava ${q(antigo)} e a função recusava `
      + `(exige ${q(fn.dinheiroNecessario)}, diferença ${q(Math.abs(antigo - fn.dinheiroNecessario))})`);
  }
}

console.log('');
if (falhas.length) { console.log(`${falhas.length} FALHA(S)`); process.exit(1); }
console.log(`todas as conferências passaram (${CASOS.length} casos).`);
