/**
 * Formatação de dinheiro, data e hora SEM depender de ICU.
 *
 * ⚠ POR QUE ESTE ARQUIVO EXISTE
 *
 * Em 04/11/2026, numa build de preview, a tela de clientes mostrou
 * "Saldo Empréstimo $", "Empréstimo: $", "Juros: $", "Total: $" — o
 * símbolo sozinho, sem nenhum número, em todos os cartões.
 *
 * Não era corte de largura. Era `toLocaleString` devolvendo STRING VAZIA
 * no aparelho. A prova estava na própria tela: tudo que passava por
 * `toLocaleString` saía em branco, e tudo que não passava renderizava
 * normal — `Parcela 3/4`, `489 dias`, e a data `03/10/2026`, que o
 * `fmtData` da época montava fatiando `YYYY-MM-DD` na mão.
 * `'$ ' + '' === '$ '`, que é exatamente o que apareceu.
 *
 * O Hermes do Android resolve `Intl` contra os dados do SISTEMA, e esses
 * dados mudam de aparelho para aparelho e de versão de Android para
 * versão de Android. Então o mesmo código mostra o número num celular e
 * engole no outro — o mesmo formato de problema das linhas que cortam
 * (ver "No mobile, linha que não cede largura CORTA o número" no
 * CLAUDE.md), e a mesma regra do Mauricio: o sistema tem de ser imune ao
 * aparelho.
 *
 * ⚠ NÃO VOLTE A USAR `toLocaleString`, `toLocaleDateString`,
 * `toLocaleTimeString` nem `Intl.` neste app. O script
 * `scripts/conferir-formato-sem-icu.mjs` reprova quem voltar.
 *
 * Estas funções dão a MESMA saída que o ICU dava quando ele funcionava —
 * a diferença é que elas também dão quando ele não funciona.
 */

// ──────────────────────────────────────────────────────────────────────
// Dinheiro
// ──────────────────────────────────────────────────────────────────────

/**
 * "1.234,00" — ponto no milhar, vírgula no decimal (pt-BR e es-CO usam a
 * mesma convenção, por isso uma função só atende os dois idiomas).
 *
 * Negativo sai com o sinal colado no número: `-1.234,00`.
 */
export function numeroBr(valor: number | string | null | undefined, casas: number = 2): string {
  const n = Number(valor);
  if (!isFinite(n)) return casas > 0 ? '0,' + '0'.repeat(casas) : '0';

  const negativo = n < 0;
  // toFixed arredonda meio-para-cima no positivo, que é o que o ICU fazia.
  const fixo = Math.abs(n).toFixed(casas);
  const [inteiro, decimal] = fixo.split('.');

  // Milhar de trás para frente, em blocos de 3.
  let comPonto = '';
  for (let i = 0; i < inteiro.length; i++) {
    if (i > 0 && (inteiro.length - i) % 3 === 0) comPonto += '.';
    comPonto += inteiro[i];
  }

  const corpo = decimal ? comPonto + ',' + decimal : comPonto;
  return negativo ? '-' + corpo : corpo;
}

/** "$ 1.234,00" — o formato padrão de dinheiro do app. */
export function moeda(valor: number | string | null | undefined, casas: number = 2): string {
  return '$ ' + numeroBr(valor, casas);
}

/**
 * "$ 1.234,00" — com espaço NÃO separável.
 *
 * Usado onde o valor fica numa linha estreita: o espaço comum deixaria o
 * "$" sozinho numa linha e o número na seguinte.
 */
export function moedaJunta(valor: number | string | null | undefined, casas: number = 2): string {
  return '$ ' + numeroBr(valor, casas);
}

// ──────────────────────────────────────────────────────────────────────
// Data e hora
// ──────────────────────────────────────────────────────────────────────

const MESES: Record<string, string[]> = {
  'pt-BR': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};

const DIAS_SEMANA: Record<string, string[]> = {
  'pt-BR': ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
            'quinta-feira', 'sexta-feira', 'sábado'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
};

const dois = (n: number) => (n < 10 ? '0' + n : String(n));

/**
 * Transforma o que vier numa `Date` local, ou devolve null.
 *
 * ⚠ `YYYY-MM-DD` puro é lido ao MEIO-DIA local, não à meia-noite: é o
 * mesmo cuidado de `dateFormat.ts` no web. Meia-noite UTC vira o dia
 * anterior em qualquer fuso a oeste de Greenwich — a Colômbia é UTC−5 —
 * e a parcela passaria a vencer um dia antes na tela.
 */
export function paraData(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === '') return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  if (typeof d === 'number') {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [a, m, dia] = s.split('-').map(Number);
    return new Date(a, m - 1, dia, 12, 0, 0);
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * "2026-11-03" — a chave YYYY-MM-DD do dia, pelos campos LOCAIS da Date.
 *
 * ⚠ NUNCA use `toISOString().split('T')[0]` para isto. O ISO converte para
 * UTC, e em qualquer fuso a oeste de Greenwich isso devolve o dia SEGUINTE a
 * partir de certa hora da noite — na Colômbia (UTC−5), das 19h em diante.
 *
 * Foi exatamente assim que duas solicitações de abertura nasceram datadas de
 * 04/11 enquanto a vendedora ainda operava o dia 03/11 (Julio, 04/11/2026).
 * Medido: das 424 solicitações de abertura da base, 26 têm data posterior ao
 * dia real da rota e ZERO têm data posterior ao dia em UTC — a data gravada
 * era a data UTC, sem uma exceção. Ver "A liquidação é a régua do tempo" no
 * CLAUDE.md.
 *
 * Sem argumento, devolve a chave de agora pelo relógio do aparelho.
 */
export function chaveData(d?: Date | string | number | null): string {
  const dt = paraData(d) ?? new Date();
  return `${dt.getFullYear()}-${dois(dt.getMonth() + 1)}-${dois(dt.getDate())}`;
}

/** "03/10/2026" */
export function data(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${dois(dt.getDate())}/${dois(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

/** "03/10/26" */
export function dataAno2(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${dois(dt.getDate())}/${dois(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
}

/** "03/10" */
export function diaMes(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${dois(dt.getDate())}/${dois(dt.getMonth() + 1)}`;
}

/** "14:35" */
export function hora(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${dois(dt.getHours())}:${dois(dt.getMinutes())}`;
}

/** "03/10/2026 14:35" */
export function dataHora(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${data(dt)} ${hora(dt)}`;
}

/** "03/10/26 14:35" */
export function dataAno2Hora(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${dataAno2(dt)} ${hora(dt)}`;
}

/** "03/10 · 14:35" */
export function diaMesHora(d: Date | string | number | null | undefined, vazio: string = ''): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  return `${diaMes(dt)} · ${hora(dt)}`;
}

/**
 * "segunda-feira, 3 de novembro de 2026" / "lunes, 3 de noviembre de 2026"
 *
 * `lang` aceita 'pt-BR' ou 'es'; qualquer outra coisa cai em pt-BR.
 */
export function dataExtenso(
  d: Date | string | number | null | undefined,
  lang: string = 'pt-BR',
  vazio: string = '',
): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  const idioma = lang === 'es' ? 'es' : 'pt-BR';
  const semana = DIAS_SEMANA[idioma][dt.getDay()];
  const mes = MESES[idioma][dt.getMonth()];
  return `${semana}, ${dois(dt.getDate())} de ${mes} de ${dt.getFullYear()}`;
}

/** "3 de novembro de 2026" / "3 de noviembre de 2026" — sem o dia da semana. */
export function mesExtenso(
  d: Date | string | number | null | undefined,
  lang: string = 'pt-BR',
  vazio: string = '',
): string {
  const dt = paraData(d);
  if (!dt) return vazio;
  const idioma = lang === 'es' ? 'es' : 'pt-BR';
  return `${dois(dt.getDate())} de ${MESES[idioma][dt.getMonth()]} de ${dt.getFullYear()}`;
}
