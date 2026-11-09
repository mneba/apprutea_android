// Conferência do resumo da ficha do empréstimo.
//
// Mesma lógica de FichaEmprestimoScreen.tsx (e do ModalFichaEmprestimo do
// web), rodando sobre linhas REAIS medidas na base em 08/11/2026.
//
// A pergunta que importa: a cadeia Juros − Pago = Saldo fecha, e a contagem
// de parcelas bate com a lista que aparece logo abaixo na tela?

const t = { pc1: 'parcela', pcN: 'parcelas', pcDe: 'de',
            pcAb1: 'parcela em aberto', pcAbN: 'parcelas em aberto' };

// ── o que a tela calcula ───────────────────────────────────────────────
function resumo(ficha) {
  const totalEmp = Number(ficha.valor_total || 0);
  const saldoEmp = Number(ficha.saldo_atual || 0);
  const creditoEmp = Number(ficha.credito_disponivel || 0);

  const saldoFaltaEmp = Math.max(saldoEmp, 0);          // JÁ líquido de crédito
  const pagoEmp = Math.max(totalEmp - saldoFaltaEmp, 0);

  const pagas = Number(ficha.parcelas_pagas || 0);
  const abertas = Number(ficha.parcelas_abertas || 0);
  const total = Number(ficha.parcelas_total || 0);

  const rotPagas = (rot) => {
    if (!total) return rot;
    const un = pagas === 1 ? t.pc1 : t.pcN;
    return abertas === 0 ? `${rot} (${pagas} ${un})`
                         : `${rot} (${pagas} ${t.pcDe} ${total} ${t.pcN})`;
  };
  const rotAbertas = (rot) =>
    !abertas ? rot
             : `${rot} (${abertas} ${abertas === 1 ? t.pcAb1 : t.pcAbN})`;

  return { pagoEmp, saldoFaltaEmp, creditoEmp, totalEmp,
           rotuloPago: rotPagas('Pago'), rotuloSaldo: rotAbertas('Saldo') };
}

// ── e o que a FÓRMULA ANTIGA calculava, para o contraste ───────────────
function resumoAntigo(ficha) {
  const totalEmp = Number(ficha.valor_total || 0);
  const saldo = Math.max(Number(ficha.saldo_atual || 0) - Number(ficha.credito_disponivel || 0), 0);
  const pago = Math.max(totalEmp - saldo, 0);
  const vp = Number(ficha.valor_parcela || 0);
  const conta = (v) => {
    if (!vp) return '';
    const n = Math.round((v / vp) * 10) / 10;
    const txt = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
    return ` (${txt} ${n === 1 ? t.pc1 : t.pcN})`;
  };
  return { pago, saldo, rotuloPago: `Pago${conta(pago)}`, rotuloSaldo: `Saldo${conta(saldo)}` };
}

// ── os casos, medidos na base ──────────────────────────────────────────
const CASOS = [
  { nome: 'camila rafaela viana gomes', rota: '12.1 Fenix',
    valor_total: 4800, saldo_atual: 35, credito_disponivel: 135, valor_parcela: 200,
    parcelas_pagas: 23, parcelas_abertas: 1, parcelas_total: 24, bruto: 170,
    espera: { pago: 4765, saldo: 35, rotuloPago: 'Pago (23 de 24 parcelas)',
              rotuloSaldo: 'Saldo (1 parcela em aberto)' } },

  { nome: 'luana jessica cardoso', rota: '12.1 Fenix',
    valor_total: 4800, saldo_atual: 800, credito_disponivel: 1100, valor_parcela: 200,
    parcelas_pagas: 5, parcelas_abertas: 19, parcelas_total: 24, bruto: 1900,
    espera: { pago: 4000, saldo: 800, rotuloPago: 'Pago (5 de 24 parcelas)',
              rotuloSaldo: 'Saldo (19 parcelas em aberto)' } },

  // Saldo 0 LEGÍTIMO: o crédito cobre exatamente o que falta. Antes a tela
  // dizia "Saldo 0,00" e nada mais; agora diz que há 2 parcelas em aberto.
  { nome: 'richard marin', rota: '4.1 nayivis vnz',
    valor_total: 960, saldo_atual: 0, credito_disponivel: 86, valor_parcela: 40,
    parcelas_pagas: 22, parcelas_abertas: 2, parcelas_total: 24, bruto: 86,
    espera: { pago: 960, saldo: 0, rotuloPago: 'Pago (22 de 24 parcelas)',
              rotuloSaldo: 'Saldo (2 parcelas em aberto)' } },

  // Empréstimo quitado: sem "de 24" e sem parêntese no saldo.
  { nome: 'quitado, sem crédito', rota: '—',
    valor_total: 1200, saldo_atual: 0, credito_disponivel: 0, valor_parcela: 50,
    parcelas_pagas: 24, parcelas_abertas: 0, parcelas_total: 24, bruto: 0,
    espera: { pago: 1200, saldo: 0, rotuloPago: 'Pago (24 parcelas)',
              rotuloSaldo: 'Saldo' } },

  // Uma parcela só paga, singular dos dois lados.
  { nome: 'uma paga, uma aberta', rota: '—',
    valor_total: 400, saldo_atual: 200, credito_disponivel: 0, valor_parcela: 200,
    parcelas_pagas: 1, parcelas_abertas: 1, parcelas_total: 2, bruto: 200,
    espera: { pago: 200, saldo: 200, rotuloPago: 'Pago (1 de 2 parcelas)',
              rotuloSaldo: 'Saldo (1 parcela em aberto)' } },

  // Empréstimo com parcela CANCELADO: o total vem de parcelas_total (pagas +
  // abertas), não de numero_parcelas, senão sobraria uma no denominador.
  { nome: 'com parcela cancelada', rota: '—',
    valor_total: 1000, saldo_atual: 100, credito_disponivel: 0, valor_parcela: 100,
    parcelas_pagas: 8, parcelas_abertas: 1, parcelas_total: 9, bruto: 100,
    espera: { pago: 900, saldo: 100, rotuloPago: 'Pago (8 de 9 parcelas)',
              rotuloSaldo: 'Saldo (1 parcela em aberto)' } },
];

const falhas = [];
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FALHA'}  ${m}`); if (!c) falhas.push(m); };
const q = (v) => v.toFixed(2);

for (const c of CASOS) {
  const r = resumo(c);
  console.log(`\n── ${c.nome}  (${c.rota})`);
  ok(Math.abs(r.pagoEmp - c.espera.pago) < 0.005, `pago ${q(r.pagoEmp)} (esperado ${q(c.espera.pago)})`);
  ok(Math.abs(r.saldoFaltaEmp - c.espera.saldo) < 0.005, `saldo ${q(r.saldoFaltaEmp)} (esperado ${q(c.espera.saldo)})`);
  ok(r.rotuloPago === c.espera.rotuloPago, `"${r.rotuloPago}"`);
  ok(r.rotuloSaldo === c.espera.rotuloSaldo, `"${r.rotuloSaldo}"`);

  // A cadeia da tela: Juros − Pago = Saldo, por construção.
  ok(Math.abs(r.pagoEmp + r.saldoFaltaEmp - r.totalEmp) < 0.005,
     `cadeia: ${q(r.pagoEmp)} + ${q(r.saldoFaltaEmp)} = ${q(r.totalEmp)}`);

  // E o saldo tem de ser o que as PARCELAS dizem, menos o crédito.
  ok(Math.abs(r.saldoFaltaEmp - Math.max(c.bruto - c.credito_disponivel, 0)) < 0.005,
     `saldo = parcelas abertas ${q(c.bruto)} − crédito ${q(c.credito_disponivel)}`);

  // Contagem contra a lista de parcelas da mesma tela.
  ok(c.parcelas_pagas + c.parcelas_abertas === c.parcelas_total,
     `contagem fecha: ${c.parcelas_pagas} + ${c.parcelas_abertas} = ${c.parcelas_total}`);

  // A contradição que o Julio relatou: contagem cheia com parcela em aberto.
  const n = Number((r.rotuloPago.match(/\((\d+)/) || [])[1] || 0);
  ok(!(c.parcelas_abertas > 0 && n >= c.parcelas_total),
     `sem contradição: não diz "${c.parcelas_total} pagas" com ${c.parcelas_abertas} em aberto`);

  const a = resumoAntigo(c);
  if (Math.abs(a.pago - r.pagoEmp) > 0.005 || a.rotuloPago !== r.rotuloPago
      || Math.abs(a.saldo - r.saldoFaltaEmp) > 0.005) {
    console.log(`      antes:  ${a.rotuloPago} ${q(a.pago)} · ${a.rotuloSaldo} ${q(a.saldo)}`);
    console.log(`      agora:  ${r.rotuloPago} ${q(r.pagoEmp)} · ${r.rotuloSaldo} ${q(r.saldoFaltaEmp)}`);
  }
}

console.log('');
if (falhas.length) { console.log(`${falhas.length} FALHA(S)`); process.exit(1); }
console.log(`todas as conferências passaram (${CASOS.length} casos).`);
