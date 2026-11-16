// O PORTAO ANTES DA BUILD -- `npm run conferir`
//
// Roda o typecheck e TODAS as conferencias de scripts/conferir-*.mjs, e so
// termina com exit 0 se todas passarem. Nasceu em 16/11/2026, depois de o
// Mauricio pedir processo de teste: as conferencias existiam e eram boas, mas
// cada uma dependia de alguem lembrar de roda-la. Portao que depende de
// memoria nao e portao.
//
// Roda TODAS mesmo quando uma falha -- parar na primeira esconderia as outras
// e obrigaria a rodar de novo so para descobrir o proximo problema.
//
// ⚠ O typecheck e um dos portoes, e so serve se ficar em ZERO. Com erros
//   permanentes, um erro novo entra sem ninguem ver (CLAUDE.md: "conferencia
//   que nunca passa e conferencia que se desliga"). Em 16/11/2026 o mobile
//   tinha 34 e foi zerado no mesmo dia.
//
// Nao descobre scripts por glob: a lista e explicita para que acrescentar uma
// conferencia nova seja uma decisao, nao um efeito colateral de criar arquivo.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ETAPAS = [
  // [nome, comando, args]
  ['typecheck (tsc --noEmit)',  process.execPath, [path.join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit']],
  ['linhas que cortam',          process.execPath, [path.join(raiz, 'scripts', 'conferir-linhas-que-cortam.mjs')]],
  ['formato sem ICU',            process.execPath, [path.join(raiz, 'scripts', 'conferir-formato-sem-icu.mjs')]],
  ['fonte propria',              process.execPath, [path.join(raiz, 'scripts', 'conferir-fonte-propria.mjs')]],
  ['mapa de fonte (roda)',       process.execPath, [path.join(raiz, 'scripts', 'conferir-mapa-de-fonte.mjs')]],
  ['quitacao (roda)',            process.execPath, [path.join(raiz, 'scripts', 'conferir-quitacao.mjs')]],
  ['ficha',                      process.execPath, [path.join(raiz, 'scripts', 'conferir-ficha.mjs')]],
];

const resultados = [];
for (const [nome, cmd, args] of ETAPAS) {
  const t0 = Date.now();
  // process.execPath em vez de `npx`: no Windows `npx` e um .cmd e spawnSync o
  // recusa com EINVAL sem shell -- ja custou uma vez (ver conferir-mapa-de-fonte).
  const r = spawnSync(cmd, args, { cwd: raiz, encoding: 'utf8' });
  const ok = r.status === 0;
  resultados.push({ nome, ok, ms: Date.now() - t0, saida: (r.stdout || '') + (r.stderr || '') });
}

console.log('');
console.log('CONFERENCIAS ANTES DA BUILD');
console.log('='.repeat(60));
for (const r of resultados) {
  console.log(`${r.ok ? 'ok    ' : 'FALHOU'}  ${r.nome.padEnd(32)} ${String(r.ms).padStart(6)} ms`);
}
console.log('='.repeat(60));

const falhas = resultados.filter(r => !r.ok);
if (falhas.length === 0) {
  console.log(`${resultados.length} de ${resultados.length} passaram. Pode buildar.`);
  process.exit(0);
}

for (const f of falhas) {
  console.log('');
  console.log(`--- ${f.nome} ---`);
  // So o fim da saida: o inicio costuma ser cabecalho, o fim e o veredito.
  const linhas = f.saida.trim().split('\n');
  console.log(linhas.slice(-25).join('\n'));
}
console.log('');
console.log(`${falhas.length} de ${resultados.length} FALHARAM. Nao builde.`);
process.exit(1);
