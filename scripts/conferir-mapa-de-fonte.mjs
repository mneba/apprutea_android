#!/usr/bin/env node
/**
 * Conferência do mapa PESO -> FAMÍLIA, RODANDO.
 *
 *   cd apprutea_android && node scripts/conferir-mapa-de-fonte.mjs
 *
 * ── POR QUE RODAR, E NÃO LER ────────────────────────────────────────────
 *
 * Esta é a peça em que um erro não aparece como erro. `familiaDe` devolve
 * um NOME de família; se o nome não estiver registrado no `App.tsx`, o
 * Android cai na fonte do sistema **em silêncio** — e cai justamente no
 * peso que faltou, que no app é `'700'`, que é o dinheiro.
 *
 * É a lição de 18/10/2026: a conferência perguntou se o retorno da função
 * *continha* a coluna nova e disse `true` com a função quebrada, porque
 * incompatibilidade só existe na execução. Então aqui o arquivo é
 * compilado e as funções são CHAMADAS.
 *
 * ── AS TRÊS PARTES ──────────────────────────────────────────────────────
 *
 *   A. casos de peso, contra valores escritos À MÃO.
 *      Não contra uma segunda implementação: duas contas concordando não
 *      provam nada quando leem a mesma entrada (a conferência da quitação
 *      pagou essa lição, e foi o terceiro valor, escrito à mão, que pegou
 *      um erro na fixture).
 *
 *   B. toda família que o mapa PODE devolver está registrada no `App.tsx`.
 *      Esta é a parte que fecha o defeito silencioso. Acrescentar um peso
 *      em `utils/fonte.ts` sem acrescentar o `.ttf` no `App.tsx` reprova
 *      aqui, e não no celular do vendedor.
 *
 *   C. todo `fontWeight` que existe em `src/` cai numa família registrada.
 *      Fecha o caminho inverso: estilo novo com peso que o mapa aproxima
 *      para uma família que ninguém carregou.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = join(AQUI, '..');
const SRC = join(RAIZ, 'src');

let falhas = 0;
const erro = (msg) => {
  falhas += 1;
  console.log(`  FALHOU  ${msg}`);
};

// ── compila e importa o módulo de verdade ──────────────────────────────

const saida = mkdtempSync(join(tmpdir(), 'conf-fonte-'));
try {
  // Chama o compilador pelo node, direto. `npx` no Windows é um `.cmd` e
  // `spawnSync` o recusa com EINVAL sem `shell: true` — e abrir shell para
  // isto seria convidar aspas a interpretar caminho com espaço.
  execFileSync(
    process.execPath,
    [
      join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc'),
      join('src', 'utils', 'fonte.ts'),
      '--outDir',
      saida,
      '--target',
      'es2020',
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--skipLibCheck',
    ],
    { cwd: RAIZ, stdio: 'pipe' }
  );
} catch (e) {
  console.log('\nREPROVADO -- src/utils/fonte.ts nao compila.\n');
  console.log(String(e.stdout || e.message));
  process.exit(1);
}

// Sem isto o node trata o .js como CommonJS e o `export` estoura.
renameSync(join(saida, 'fonte.js'), join(saida, 'fonte.mjs'));
const fonte = await import(pathToFileURL(join(saida, 'fonte.mjs')).href);

// ── A. casos de peso, com o esperado escrito à mão ─────────────────────

console.log('\nA. peso -> familia');

const CASOS = [
  // os seis que o app usa de verdade, cada um com arquivo proprio
  ['300', false, 'Roboto_300Light'],
  ['400', false, 'Roboto_400Regular'],
  ['500', false, 'Roboto_500Medium'],
  ['600', false, 'Roboto_600SemiBold'],
  ['700', false, 'Roboto_700Bold'],
  ['800', false, 'Roboto_800ExtraBold'],

  // nomes que a RN aceita
  ['bold', false, 'Roboto_700Bold'],
  ['normal', false, 'Roboto_400Regular'],
  ['semibold', false, 'Roboto_600SemiBold'],

  // sem peso declarado: o padrao do texto
  [undefined, false, 'Roboto_400Regular'],
  [null, false, 'Roboto_400Regular'],

  // numero, nao string
  [700, false, 'Roboto_700Bold'],
  [600, false, 'Roboto_600SemiBold'],

  // fora dos empacotados: aproxima, e NUNCA cai no sistema
  ['100', false, 'Roboto_300Light'],
  ['200', false, 'Roboto_300Light'],
  ['900', false, 'Roboto_800ExtraBold'],
  ['thin', false, 'Roboto_300Light'],
  ['black', false, 'Roboto_800ExtraBold'],

  // empate 450: vai para o MAIS PESADO, de proposito
  [450, false, 'Roboto_500Medium'],
  [550, false, 'Roboto_600SemiBold'],

  // italico: so dois arquivos, entao aproxima mais grosso
  ['400', true, 'Roboto_400Regular_Italic'],
  ['700', true, 'Roboto_700Bold_Italic'],
  ['300', true, 'Roboto_400Regular_Italic'],
  ['600', true, 'Roboto_700Bold_Italic'],
  ['800', true, 'Roboto_700Bold_Italic'],
  [undefined, true, 'Roboto_400Regular_Italic'],

  // lixo: nao estoura, cai no regular
  ['', false, 'Roboto_400Regular'],
  ['  ', false, 'Roboto_400Regular'],
  ['qualquercoisa', false, 'Roboto_400Regular'],
  [0, false, 'Roboto_400Regular'],
  [-5, false, 'Roboto_400Regular'],
  // com espaco nas pontas ainda e o nome
  [' bold ', false, 'Roboto_700Bold'],
];

for (const [peso, italico, esperado] of CASOS) {
  const obtido = fonte.familiaDe(fonte.pesoEmNumero(peso), italico);
  const rotulo = `${JSON.stringify(peso)}${italico ? ' italico' : ''}`;
  if (obtido !== esperado) {
    erro(`${rotulo}  ->  ${obtido}   (esperado ${esperado})`);
  } else {
    console.log(`  ok      ${rotulo.padEnd(22)} ->  ${obtido}`);
  }
}

/**
 * A armadilha que esta conferência pegou em 13/11/2026, nomeada aqui para
 * ninguém "simplificar" a guarda de volta: `Number('')` é **0**, e 0 é
 * finito, então `if (Number.isFinite(n)) return n` fazia `fontWeight: ''`
 * virar peso 0 e aproximar para o Light. Texto normal saindo FINO, calado.
 */
if (fonte.pesoEmNumero('') !== 400) {
  erro("pesoEmNumero('') devia ser 400 -- a guarda do `> 0` caiu");
}
if (fonte.pesoEmNumero(0) !== 400) {
  erro('pesoEmNumero(0) devia ser 400 -- peso zero nao existe');
}

// ── B. toda família possível está registrada no App.tsx ────────────────

console.log('\nB. familias registradas no App.tsx');

const appTsx = readFileSync(join(RAIZ, 'App.tsx'), 'utf8');
const possiveis = fonte.todasAsFamilias();

for (const fam of possiveis) {
  // Precisa estar DENTRO do objeto FONTES, nao so mencionada no comentario.
  const dentroDeFontes = new RegExp(
    `const FONTES = \\{[^}]*\\b${fam}\\b[^}]*\\}`,
    's'
  ).test(appTsx);
  if (!dentroDeFontes) {
    erro(`${fam} pode ser devolvida pelo mapa e NAO esta em FONTES do App.tsx`);
  } else {
    console.log(`  ok      ${fam}`);
  }
}

// ── C. todo fontWeight de src/ cai numa família registrada ─────────────

console.log('\nC. pesos usados em src/');

const arquivos = [];
(function varrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho);
    else if (/\.(tsx|ts)$/.test(nome)) arquivos.push(caminho);
  }
})(SRC);

const usados = new Map(); // peso -> [arquivo:linha]
for (const caminho of arquivos) {
  const rel = relative(SRC, caminho).split(sep).join('/');
  readFileSync(caminho, 'utf8')
    .split(/\r?\n/)
    .forEach((bruta, i) => {
      const linha = bruta.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      for (const m of linha.matchAll(/fontWeight:\s*'([^']*)'/g)) {
        if (!usados.has(m[1])) usados.set(m[1], []);
        usados.get(m[1]).push(`${rel}:${i + 1}`);
      }
    });
}

const registradas = new Set(possiveis);
for (const [peso, onde] of [...usados.entries()].sort()) {
  const fam = fonte.familiaDe(fonte.pesoEmNumero(peso), false);
  if (!registradas.has(fam)) {
    erro(`fontWeight '${peso}' -> ${fam}, que nao esta registrada  (${onde[0]})`);
  } else {
    console.log(`  ok      '${peso}'`.padEnd(22) + `->  ${fam}   (${onde.length}x)`);
  }
}

// ── veredicto ───────────────────────────────────────────────────────────

if (falhas === 0) {
  console.log(`\nok  ${CASOS.length} caso(s) de peso, ${possiveis.length} familia(s) e`);
  console.log(`    ${usados.size} peso(s) em uso -- todos caem em familia registrada.`);
  console.log('    Nenhum caminho devolve familia que o App.tsx nao carrega, entao');
  console.log('    nenhum texto volta para a fonte do aparelho em silencio.');
  process.exit(0);
}

console.log(`\nREPROVADO -- ${falhas} falha(s) no mapa de fonte.\n`);
console.log('Familia devolvida que o App.tsx nao carrega = Android cai na fonte');
console.log('do SISTEMA sem avisar, no peso que faltou. Acrescente o .ttf em');
console.log('FONTES (App.tsx) e o peso em src/utils/fonte.ts, juntos.\n');
process.exit(1);
