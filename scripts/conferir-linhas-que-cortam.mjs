// =====================================================================
// Acha linha que CORTA texto em vez de deixar quebrar
// =====================================================================
//
// POR QUE ISTO EXISTE
//
// No React Native, filho de flex container nasce com `flexShrink: 0` --
// o INVERSO da web, onde o padrao e `1`. Numa linha
// `flexDirection: 'row'`, a largura e a SOMA dos conteudos, e o que
// passa da borda o Android CORTA em silencio. Nao ha aviso, nao ha erro,
// e em tela larga parece certo.
//
// Isso ja apareceu quatro vezes neste app, sempre igual:
//
//     clienteRow         (LiquidacaoScreen)      corrigido antes
//     financeiroContent  (LiquidacaoScreen)      03/11/2026
//     pRow               (ClienteCardLiquidacao) 03/11/2026
//     pRow               (ClienteCardTodos)      03/11/2026
//
// A regra do Mauricio, em 03/11/2026: "sistema deve ser imune a tudo, pq
// os celulares fontes e telas sao diferentes de um celular para outro".
//
// E NAO DA PARA RESOLVER COM TETO DE FONTE GLOBAL: React 19 removeu
// `defaultProps` de componente de funcao, e o `Text` do RN 0.79 e um
// deles. Entao a imunidade tem de ser ESTRUTURAL -- texto que sempre
// pode quebrar, container de texto sem largura fixa. Com isso, fonte 2x
// faz o cartao ficar mais ALTO, nao cortado.
//
// Este script e a conferencia dessa regra. Rode-o depois de mexer em
// layout:
//
//     node scripts/conferir-linhas-que-cortam.mjs
//
// Sai com codigo 1 se achar algo, para servir de porta num hook futuro.
//
// ---------------------------------------------------------------------
// O QUE ELE ACUSA: a LINHA, nao o filho
// ---------------------------------------------------------------------
// Acusa linha `row` em que ALGUM filho contem `<Text>` e NENHUM filho
// pode ceder largura.
//
// ⚠ Filho rigido NAO e defeito -- e metade do padrao certo. Badge de
// status, contador, divisor e avatar devem ser rigidos; quem cede e o
// NOME ao lado. `statusBadge: { flexShrink: 0 }` em LiquidacaoScreen e
// deliberado e correto.
//
// O defeito e a linha em que NINGUEM cede: ai a largura e a SOMA dos
// conteudos, nao ha de onde tirar espaco, e o excedente e cortado. Foi
// essa a forma dos quatro casos reais.
//
// A segunda versao deste script acusava o FILHO rigido e devolvia 31
// itens, quase todos badge legitimo. Medir a coisa errada com precisao
// nao ajuda: o relatorio tem de apontar a linha que nao fecha.
//
// `width` e `maxWidth` NAO contam como ceder. Largura fixa so quer dizer
// que aquele filho nao estoura sozinho -- ele continua sem poder dar
// espaco ao vizinho, e a soma segue livre.
//
// ⚠ NAO E PROVA DE AUSENCIA. Ele le a fonte com expressao regular, nao
// com parser de JSX, entao estilo montado em variavel, `StyleSheet`
// vindo de outro arquivo e filho dentro de `.map()` profundo escapam.
// Zero achado quer dizer "nenhum do formato conhecido", nao "a tela
// cabe".
// =====================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RAIZ = 'src';

// Arquivos MORTOS, documentados no CLAUDE.md. Acusar defeito em codigo
// que nunca roda gasta o tempo de quem le o relatorio -- e foi por isso
// que `HomeScreen`, com 7 ocorrencias do formato, entrou aqui.
const MORTOS = [
  'screens/HomeScreen.tsx',          // a rota "Home" aponta para LiquidacaoScreen
  'components/ClientesScreen.tsx',   // duplica o nome da tela real em screens/
];

// As UNICAS propriedades que fazem um filho CEDER largura.
//
// `width`, `maxWidth` e `aspectRatio` ficaram FORA de proposito: largura
// fixa diz que aquele filho nao estoura sozinho, nao que ele ceda espaco
// ao vizinho. Numa linha de filhos todos fixos, a soma segue livre.
const DEIXA_CEDER = ['flex', 'flexShrink', 'flexBasis'];

function arquivos(dir) {
  const fora = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (nome.endsWith('.tsx')) fora.push(p);
  }
  return fora;
}

/** Os estilos declarados no arquivo: nome -> corpo bruto.
 *
 *  Pega corpo de uma linha e de varias, parando no fecha-chaves do mesmo
 *  nivel -- `padding: { ... }` aninhado nao aparece neste schema, mas
 *  objeto com virgula em varias linhas aparece muito. */
function lerEstilos(src) {
  const mapa = {};
  const re = /^[ \t]*(\w+):[ \t]*\{/gm;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, nivel = 1;
    while (i < src.length && nivel > 0) {
      if (src[i] === '{') nivel++;
      else if (src[i] === '}') nivel--;
      i++;
    }
    mapa[m[1]] = src.slice(re.lastIndex, i - 1);
  }
  return mapa;
}

/** Onde a tag aberta em `abre` termina, e se ela e AUTO-FECHADA.
 *
 *  ⚠ A primeira versao deste script nao distinguia `<View ... />` de
 *  `<View ...>`, entao a auto-fechada -- `<View style={S.divider} />`,
 *  que ha em todo lugar -- somava profundidade e nunca subtraia. O
 *  "corpo" do container vazava ate o fim do arquivo e o relatorio
 *  acusava IRMAO como filho: 57 achados, com coisas impossiveis como
 *  `financeiroContent -> operacoesRow`. Relatorio inflado e pior que
 *  nenhum, porque ninguem confere 57 itens.
 *
 *  Conta so CHAVES, nao aspas: `>` fora de `{}` nao acontece em JSX, e
 *  `=>` de arrow function esta sempre dentro de chave. Rastrear aspas
 *  tambem quebraria em apostrofo de comentario. */
function fimDaTag(src, abre) {
  let chaves = 0;
  for (let i = abre; i < src.length; i++) {
    const c = src[i];
    if (c === '{') chaves++;
    else if (c === '}') chaves--;
    else if (c === '>' && chaves === 0) {
      return { fim: i + 1, auto: src[i - 1] === '/' };
    }
  }
  return { fim: src.length, auto: false };
}

/** O nome da tag aberta em `abre`, ou null se nao for elemento de
 *  componente (`<>` de fragmento, texto solto). */
function nomeDaTag(src, abre) {
  const m = /^<([A-Z][A-Za-z0-9_.]*)/.exec(src.slice(abre, abre + 40));
  return m ? m[1] : null;
}

/** Fecha a tag aberta em `abre` e devolve o conteudo interno.
 *
 *  ⚠ GENERICO POR NOME DE TAG, e isso importa. A versao que contava so
 *  `<View>` nao reconhecia `<TouchableOpacity>` como filho, entao os
 *  `<Text>` de DENTRO dele subiam como se fossem filhos diretos da
 *  linha -- e `operacoesRow` em LiquidacaoScreen aparecia como defeito
 *  quando `operacaoCard` ja tem `flex: 1`. Falso positivo que vem de
 *  nao entender a arvore e o pior tipo: parece achado de verdade.
 *
 *  Para achar o fecha-tag deste elemento basta contar as ocorrencias do
 *  MESMO nome; as outras tags nao interferem. */
function corpoDaTag(src, abre) {
  const t = fimDaTag(src, abre);
  if (t.auto) return { interno: '', fim: t.fim };

  const nome = nomeDaTag(src, abre);
  if (!nome) return { interno: '', fim: t.fim };

  const abrir = new RegExp('<' + nome.replace(/\./g, '\\.') + '(?![A-Za-z0-9_])', 'g');
  const fechar = '</' + nome + '>';

  let i = t.fim, nivel = 1;
  while (i < src.length) {
    const fecha = src.indexOf(fechar, i);
    if (fecha === -1) break;

    abrir.lastIndex = i;
    const m = abrir.exec(src);
    if (m && m.index < fecha) {
      const tt = fimDaTag(src, m.index);
      if (!tt.auto) nivel++;
      i = tt.fim;
      continue;
    }
    nivel--;
    if (nivel === 0) return { interno: src.slice(t.fim, fecha), fim: fecha + fechar.length };
    i = fecha + fechar.length;
  }
  return { interno: src.slice(t.fim), fim: src.length };
}

/** Os filhos IMEDIATOS deste conteudo -- `<View>` E `<Text>`.
 *
 *  ⚠ Contar so `<View>` dava falso positivo em toda linha nome + badge:
 *  em `nameRow` quem cede e o `<Text style={S.nome}>`, que tem
 *  `flex: 1`, e o detector nao o via -- acusava a linha de "ninguem
 *  cede" quando o nome cedia. `<Text>` e filho de primeira classe aqui.
 *
 *  Os `<View>` saem pelo casamento de tags; os `<Text>` saem por
 *  exclusao: posicao que NAO esta dentro de nenhum `<View>` filho e
 *  filho imediato. */
function filhosImediatos(interno) {
  const filhos = [];
  const re = /<[A-Z][A-Za-z0-9_.]*/g;
  let m;
  while ((m = re.exec(interno))) {
    const { fim } = corpoDaTag(interno, m.index);
    filhos.push({
      pos: m.index,
      tag: nomeDaTag(interno, m.index),
      trecho: interno.slice(m.index, Math.max(fim, m.index + 1)),
    });
    re.lastIndex = Math.max(fim, m.index + 1);   // salta a subarvore inteira
  }
  return filhos;
}

const nomesDeEstilo = (trechoDaTag) =>
  [...trechoDaTag.matchAll(/(?:S|styles|E)\.(\w+)/g)].map((m) => m[1]);

let achados = 0;
let ocorrencias = 0;
let comDinheiro = 0;
let linhasVistas = 0;

for (const caminho of arquivos(RAIZ)) {
  const rel = relative('.', caminho).split(sep).join('/');
  if (MORTOS.some((m) => rel.endsWith(m)) || rel.includes('.old')) continue;

  const src = readFileSync(caminho, 'utf8');
  const estilos = lerEstilos(src);

  // Linhas de verdade: `row` sem `wrap` (com wrap o filho desce de linha
  // em vez de ser cortado).
  const ehLinha = (nome) => {
    const c = estilos[nome];
    return c && c.includes("flexDirection: 'row'") && !c.includes("flexWrap: 'wrap'");
  };

  const problemas = [];
  const re = /<View\b[^>]*style=\{/g;
  let m;
  while ((m = re.exec(src))) {
    const tag = src.slice(m.index, fimDaTag(src, m.index).fim);
    if (!nomesDeEstilo(tag).some(ehLinha)) continue;
    linhasVistas++;

    const { interno } = corpoDaTag(src, m.index);
    const filhos = filhosImediatos(interno);
    if (filhos.length < 2) continue;   // um filho so nao disputa largura

    let algumCede = false, algumTemTexto = false;
    const descricao = [];

    for (const filho of filhos) {
      const tagFilho = filho.trecho.slice(0, fimDaTag(filho.trecho, 0).fim);
      const nomes = nomesDeEstilo(tagFilho);
      // Estilo embutido no proprio JSX (`style={{ flex: 1 }}`) tambem vale.
      const texto = nomes.map((n) => estilos[n] || '').join(' ') + ' ' + tagFilho;
      const cede = DEIXA_CEDER.some((p) => new RegExp('\\b' + p + '\\b').test(texto));
      const temTexto = /<Text\b/.test(filho.trecho);

      if (cede) algumCede = true;
      if (temTexto) algumTemTexto = true;
      descricao.push(`${filho.tag}(${nomes.join('/') || 'sem style'})${cede ? ' [cede]' : ''}`);
    }

    // Linha com texto e sem ninguem que ceda: a largura e a soma dos
    // conteudos, e o excedente e cortado.
    if (algumTemTexto && !algumCede) {
      // CONTEUDO ILIMITADO: dinheiro, data e telefone formatados crescem
      // com o DADO. Rotulo de botao e preso ao texto traduzido, que o
      // desenvolvedor ve. E a diferenca entre "vai cortar" e "pode cortar
      // um dia" -- e e por ela que a triagem comeca.
      const bruto = filhos.map((f) => f.trecho).join(' ');
      const ilimitado = /\bfmt\(|formatarMoeda|fmtData|fmtTel|toLocaleString/.test(bruto);
      problemas.push({
        linha: src.slice(0, m.index).split('\n').length,
        pai: nomesDeEstilo(tag).filter(ehLinha).join('/'),
        filhos: descricao.join(' + '),
        ilimitado,
      });
    }
  }

  if (problemas.length) {
    // AGRUPA POR ESTILO DA LINHA, porque o conserto e no StyleSheet e nao
    // no JSX: `resumoLinha` aparece 6 vezes e e UM estilo -- um `flex: 1`
    // no rotulo conserta as 6. Contar ocorrencia infla o trabalho por um
    // fator de tres e assusta sem motivo.
    const porEstilo = new Map();
    for (const p of problemas) {
      const g = porEstilo.get(p.pai) || { n: 0, linhas: [], filhos: p.filhos, ilimitado: false };
      g.n++;
      g.linhas.push(p.linha);
      g.ilimitado = g.ilimitado || p.ilimitado;
      porEstilo.set(p.pai, g);
    }
    console.log('\n' + rel);
    const ordem = [...porEstilo].sort((a, b) => Number(b[1].ilimitado) - Number(a[1].ilimitado));
    for (const [estilo, g] of ordem) {
      const onde = g.n === 1
        ? `:${g.linhas[0]}`
        : `${g.n}x (:${g.linhas.slice(0, 3).join(' :')}${g.n > 3 ? ' ...' : ''})`;
      console.log(`  ${g.ilimitado ? '>>' : '  '} ${estilo.padEnd(18)} ${onde}`);
      console.log(`       ${g.filhos}`);
      if (g.ilimitado) comDinheiro++;
    }
    achados += porEstilo.size;
    ocorrencias += problemas.length;
  }
}

console.log('');
console.log(`${linhasVistas} linha(s) 'row' examinada(s).`);
console.log(`${achados} estilo(s) de linha em que nenhum filho cede largura, em ${ocorrencias} ocorrencia(s).`);
console.log('');

// ---------------------------------------------------------------------
// A PORTA e so o dinheiro, de proposito
// ---------------------------------------------------------------------
// Reprovar as duas categorias juntas tornaria este script inutil no dia
// em que foi escrito: havia 81 estilos, e uma conferencia que nunca passa
// e uma conferencia que se desliga.
//
// O que ELE REPROVA e a linha com DINHEIRO, DATA ou TELEFONE sem
// protecao -- conteudo que cresce com o dado, onde o corte mostra numero
// errado ao vendedor. Em 03/11/2026 os 25 que existiam foram corrigidos,
// e a partir daqui a conta tem de ficar em ZERO: linha nova de dinheiro
// sem protecao reprova.
//
// As outras (rotulo de botao, aba, legenda) saem como LATENTES e nao
// reprovam: o conteudo e preso ao texto traduzido, que o desenvolvedor
// ve, e o pior caso e uma palavra de botao cortada -- nao um valor
// errado. Conserte-as ao mexer na tela, nao numa varredura cega: entre
// os alvos ha icone e estilo modificador, que pedem olho.
if (comDinheiro > 0) {
  console.log(`>> REPROVADO: ${comDinheiro} estilo(s) com DINHEIRO, DATA ou TELEFONE`);
  console.log('   sem ninguem que ceda largura. Isso corta VALOR na tela do vendedor.');
  console.log('');
  console.log('   Conserto: `flexShrink: 1` no estilo do ROTULO (o lado que cede).');
  console.log('   O valor fica rigido, para dinheiro nunca quebrar no meio do numero.');
  console.log('   NUNCA `adjustsFontSizeToFit` -- ver o cabecalho deste arquivo.');
  process.exit(1);
}

console.log('Nenhuma linha de DINHEIRO/DATA sem protecao.');
if (achados > 0) {
  console.log(`${achados} latente(s) acima, de rotulo e botao: conteudo preso ao texto`);
  console.log('traduzido. Conserte ao mexer na tela; nao vale varredura cega.');
}
console.log('(Nao e prova de ausencia -- ver o cabecalho deste arquivo.)');
