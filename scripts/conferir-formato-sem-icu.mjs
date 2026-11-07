#!/usr/bin/env node
/**
 * Reprova o uso de ICU (`Intl`) no app do vendedor.
 *
 *   cd apprutea_android && node scripts/conferir-formato-sem-icu.mjs
 *
 * ── POR QUE ─────────────────────────────────────────────────────────────
 *
 * Em 04/11/2026, numa build de preview, a tela de clientes mostrou
 * "Saldo Emprestimo $", "Emprestimo: $", "Juros: $", "Total: $" -- o
 * simbolo sozinho, sem numero nenhum, em todos os cartoes.
 *
 * Nao era corte de largura. `toLocaleString` devolveu STRING VAZIA no
 * aparelho, e `'$ ' + '' === '$ '`. A prova estava na propria tela: tudo
 * que passava por `toLocaleString` saiu em branco, e tudo que nao passava
 * renderizou -- `Parcela 3/4`, `489 dias` e a data `03/10/2026`, que era
 * montada fatiando `YYYY-MM-DD` na mao.
 *
 * O Hermes do Android resolve `Intl` contra os dados de locale do
 * SISTEMA. Eles mudam de aparelho para aparelho e de versao de Android
 * para versao de Android, entao o mesmo codigo mostra o numero num
 * celular e engole no outro. E a mesma familia do defeito das linhas que
 * cortam: o sistema tem de ser imune ao aparelho.
 *
 * O conserto foi `src/utils/formato.ts`, escrito a mao. Este script
 * existe para o ICU nao voltar pela porta dos fundos na proxima tela --
 * imunidade aqui e uma CONFERENCIA QUE SE RODA, nao uma lembranca.
 *
 * ── O QUE ELE NAO FAZ ───────────────────────────────────────────────────
 *
 * Le o texto com expressao regular, nao executa nada. Ele garante que
 * ninguem CHAMOU o ICU; nao garante que `formato.ts` formata certo --
 * isso se prova rodando as funcoes, o que foi feito em 04/11/2026
 * comparando 17 valores contra a saida do ICU do Node, todos iguais.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FONTE = join(RAIZ, 'src');

// O proprio formatador cita os nomes proibidos nos comentarios, e e ele
// que existe para substitui-los.
const LIBERADOS = [join('src', 'utils', 'formato.ts')];

const PROIBIDOS = [
  { re: /\.toLocaleString\s*\(/, nome: 'toLocaleString', troca: 'numeroBr / moeda / dataHora' },
  { re: /\.toLocaleDateString\s*\(/, nome: 'toLocaleDateString', troca: 'data / dataAno2 / diaMes' },
  { re: /\.toLocaleTimeString\s*\(/, nome: 'toLocaleTimeString', troca: 'hora' },
  { re: /\bIntl\s*\./, nome: 'Intl', troca: 'as funcoes de utils/formato' },
];

function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === 'node_modules' || nome.startsWith('.')) continue;
      saida.push(...arquivos(caminho));
    } else if (/\.(ts|tsx)$/.test(nome) && !nome.endsWith('.d.ts')) {
      saida.push(caminho);
    }
  }
  return saida;
}

/** Tira comentario de linha e de bloco, para citacao em comentario nao reprovar. */
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

const achados = [];
for (const caminho of arquivos(FONTE)) {
  const rel = relative(RAIZ, caminho);
  if (LIBERADOS.includes(rel) || LIBERADOS.includes(rel.split('/').join(sep))) continue;

  const linhas = semComentarios(readFileSync(caminho, 'utf8')).split('\n');
  linhas.forEach((linha, i) => {
    for (const p of PROIBIDOS) {
      if (p.re.test(linha)) {
        achados.push({ arquivo: rel, linha: i + 1, nome: p.nome, troca: p.troca, trecho: linha.trim().slice(0, 100) });
      }
    }
  });
}

if (achados.length === 0) {
  console.log('ok  nenhuma chamada de ICU no app do vendedor.');
  console.log('    Dinheiro, data e hora saem de src/utils/formato.ts, que nao depende do aparelho.');
  process.exit(0);
}

console.log(`\nREPROVADO -- ${achados.length} chamada(s) de ICU no app do vendedor.\n`);
console.log('Elas devolvem STRING VAZIA em parte dos aparelhos Android, e o');
console.log('numero some da tela sem erro nenhum. Troque por src/utils/formato.ts.\n');

let atual = '';
for (const a of achados) {
  if (a.arquivo !== atual) {
    atual = a.arquivo;
    console.log(`  ${atual}`);
  }
  console.log(`    linha ${String(a.linha).padStart(5)}  ${a.nome}  ->  use ${a.troca}`);
  console.log(`               ${a.trecho}`);
}
console.log('');
process.exit(1);
