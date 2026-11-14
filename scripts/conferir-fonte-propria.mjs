#!/usr/bin/env node
/**
 * Reprova texto que desenha na fonte DO APARELHO.
 *
 *   cd apprutea_android && node scripts/conferir-fonte-propria.mjs
 *
 * ── POR QUE ─────────────────────────────────────────────────────────────
 *
 * Ate 13/11/2026 o app nao declarava fonte em lugar nenhum: `expo-font`
 * estava no `package.json` sem um unico `.ttf`, e `fontFamily` aparecia em
 * UM arquivo. Os 1.545 `<Text>` desenhavam na letra que o DONO DO APARELHO
 * escolheu -- *Estilo da fonte* na Samsung, Temas na Xiaomi.
 *
 * Letra diferente tem largura de glifo e altura de linha diferentes. O
 * layout, medido em `dp`, nao muda -- o texto estoura a linha e o Android
 * CORTA calado. E o mais enganoso: `fontScale` fica em 1,0, porque estilo
 * de fonte nao e tamanho de fonte. Foi o que o `AvisoEscalaDaTela` mediu em
 * 30/10/2026 no aparelho do relato, e foi por isso que a investigacao
 * parou: a regua certa dizia que estava tudo normal.
 *
 * O conserto foi `src/components/texto.tsx` -- seis pesos do Roboto
 * empacotados, mais dois italicos, e um componente que traduz `fontWeight`
 * em FAMILIA. Este script existe para a fonte do sistema nao voltar pela
 * porta dos fundos na proxima tela.
 *
 * ── O QUE ELE REPROVA ───────────────────────────────────────────────────
 *
 *   1. `Text` ou `TextInput` importado da `react-native` em `src/`.
 *      E o unico jeito de um texto escapar do nosso componente. Importar
 *      TIPO (`TextProps`, `TextStyle`, `TextInputProps`) segue liberado.
 *
 *   2. `fontFamily` escrito a mao com algo que nao e `Roboto_*`.
 *      Excecao NOMEADA: o `MONO` do extrato -- ver a lista abaixo.
 *
 * ── O QUE ELE AVISA, SEM REPROVAR ───────────────────────────────────────
 *
 *   3. `fontWeight` fora dos seis pesos empacotados. Nao e defeito: o
 *      componente aproxima para o peso mais proximo, e aproximar nao joga
 *      ninguem de volta na fonte do sistema. Mas a aparencia muda, e quem
 *      escreveu `fontWeight: '900'` esperando Black vai receber ExtraBold.
 *      O conserto e acrescentar o arquivo no `App.tsx` e em `texto.tsx`.
 *
 * ── O QUE ELE NAO FAZ ───────────────────────────────────────────────────
 *
 * Le o texto com expressao regular, nao executa nada. Garante que ninguem
 * IMPORTOU o `Text` da plataforma; nao garante que `texto.tsx` escolhe a
 * familia certa -- isso se prova rodando, e os seis pesos foram conferidos
 * contra os seis que o app usa em 13/11/2026.
 *
 * E ele NAO cobre o `fontFamily` que chega por variavel montada em tempo
 * de execucao, nem estilo vindo de outro arquivo. Zero achado quer dizer
 * "nenhum do formato conhecido", nao "todo texto esta no Roboto".
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(AQUI, '..', 'src');

/** O proprio modulo da fonte: ele PRECISA importar da react-native. */
const LIBERADOS = new Set(['components/texto.tsx']);

/**
 * Familias liberadas fora do Roboto, com o motivo escrito.
 *
 * `monospace` / `Courier` -- o extrato (`LiquidacaoDetalhes.tsx`) alinha
 * colunas de dinheiro em largura fixa, e para isso precisa de monoespacada.
 * O Roboto Mono nao esta empacotado, entao ali a letra ainda e do sistema.
 * ⚠ E DIVIDA CONHECIDA, nao decisao: a familia monoespacada e separada da
 * sans que o "Estilo da fonte" troca, logo a exposicao e menor -- mas nao e
 * zero. Empacotar o Roboto Mono fecha.
 */
const FAMILIAS_LIBERADAS = new Set(['monospace', 'Courier']);

const PESOS_EMPACOTADOS = new Set(['300', '400', '500', '600', '700', '800']);
/** Nomes que a RN aceita e que caem dentro dos pesos empacotados. */
const PESOS_NOMEADOS_OK = new Set(['normal', 'regular', 'bold', 'light', 'medium', 'semibold']);

const arquivos = [];
(function varrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      varrer(caminho);
    } else if (/\.(tsx|ts)$/.test(nome)) {
      arquivos.push(caminho);
    }
  }
})(SRC);

const reprovados = [];
const avisos = [];

/** Remove comentarios de linha, para nao acusar o texto que EXPLICA o defeito. */
function semComentario(linha) {
  return linha.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
}

for (const caminho of arquivos) {
  const rel = relative(SRC, caminho).split(sep).join('/');
  if (LIBERADOS.has(rel)) continue;

  const linhas = readFileSync(caminho, 'utf8').split(/\r?\n/);

  linhas.forEach((bruta, i) => {
    const linha = semComentario(bruta);
    const n = i + 1;

    // 1. Text / TextInput vindos da plataforma.
    const imp = linha.match(/import\s*\{([^}]*)\}\s*from\s*'react-native'/);
    if (imp) {
      for (const bruto of imp[1].split(',')) {
        const nome = bruto.trim();
        if (nome === 'Text' || nome === 'TextInput') {
          reprovados.push({
            rel,
            n,
            o_que: `${nome} importado da react-native`,
            troca: `importe de '${rel.includes('/') ? '../' : './'}texto'`,
            trecho: bruta.trim().slice(0, 110),
          });
        }
      }
    }

    // 2. fontFamily escrito a mao.
    for (const m of linha.matchAll(/fontFamily:\s*'([^']+)'/g)) {
      const fam = m[1];
      if (fam.startsWith('Roboto_') || FAMILIAS_LIBERADAS.has(fam)) continue;
      reprovados.push({
        rel,
        n,
        o_que: `fontFamily: '${fam}'`,
        troca: 'deixe o componente escolher, ou empacote a familia',
        trecho: bruta.trim().slice(0, 110),
      });
    }

    // 3. fontWeight fora dos pesos empacotados -- aviso.
    for (const m of linha.matchAll(/fontWeight:\s*'([^']+)'/g)) {
      const p = m[1];
      if (PESOS_EMPACOTADOS.has(p) || PESOS_NOMEADOS_OK.has(p)) continue;
      avisos.push({ rel, n, peso: p, trecho: bruta.trim().slice(0, 110) });
    }
  });
}

function listar(itens, imprimir) {
  let atual = '';
  for (const a of itens) {
    if (a.rel !== atual) {
      atual = a.rel;
      console.log(`  ${atual}`);
    }
    imprimir(a);
  }
}

if (avisos.length > 0) {
  console.log(`\naviso -- ${avisos.length} peso(s) fora dos seis empacotados.\n`);
  console.log('Nao e defeito: o componente aproxima para o peso mais proximo, e');
  console.log('ninguem volta para a fonte do sistema. Mas a aparencia muda.\n');
  listar(avisos, (a) => {
    console.log(`    linha ${String(a.n).padStart(5)}  fontWeight: '${a.peso}'`);
    console.log(`               ${a.trecho}`);
  });
  console.log('');
}

if (reprovados.length === 0) {
  console.log(`ok  ${arquivos.length} arquivo(s) conferido(s).`);
  console.log('    Nenhum texto desenha na fonte do aparelho: Text e TextInput saem');
  console.log('    de src/components/texto.tsx, com os seis pesos do Roboto no APK.');
  process.exit(0);
}

console.log(`\nREPROVADO -- ${reprovados.length} ponto(s) desenhando na fonte do aparelho.\n`);
console.log('Trocar o Estilo da fonte no celular muda a largura do glifo, o texto');
console.log('estoura a linha e o Android corta calado -- com fontScale em 1,0.\n');
listar(reprovados, (a) => {
  console.log(`    linha ${String(a.n).padStart(5)}  ${a.o_que}  ->  ${a.troca}`);
  console.log(`               ${a.trecho}`);
});
console.log('');
process.exit(1);
