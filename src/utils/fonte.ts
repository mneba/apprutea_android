/**
 * O mapa PESO -> FAMÍLIA, puro e sem dependência de plataforma.
 *
 * Vive separado de [components/texto.tsx](../components/texto.tsx) por um
 * motivo só: para poder ser EXECUTADO fora do app. A escolha da família é a
 * peça em que um erro não aparece como erro — ela devolve um nome de família
 * que não existe, o Android cai na fonte do sistema **em silêncio**, e o
 * defeito volta exatamente no texto em negrito, que é onde está o dinheiro.
 *
 * É a lição de 18/10/2026: conferência que lê o catálogo não prova que a
 * função roda. `scripts/conferir-mapa-de-fonte.mjs` compila este arquivo e
 * chama estas funções, caso por caso, contra valores escritos à mão — e
 * confere que toda família que elas podem devolver está REGISTRADA no
 * `App.tsx`.
 *
 * ⚠ Acrescentar peso aqui sem acrescentar o arquivo no `App.tsx` é
 * justamente o defeito. A conferência reprova esse par desencontrado.
 */

/** Os pesos retos que existem como arquivo `.ttf` no APK. */
export const PESOS_RETOS = [300, 400, 500, 600, 700, 800] as const;

/** Itálico só nos dois pesos em que o app o usa (10 ocorrências). */
export const PESOS_ITALICOS = [400, 700] as const;

export const FAMILIA: Record<number, string> = {
  300: 'Roboto_300Light',
  400: 'Roboto_400Regular',
  500: 'Roboto_500Medium',
  600: 'Roboto_600SemiBold',
  700: 'Roboto_700Bold',
  800: 'Roboto_800ExtraBold',
};

export const FAMILIA_ITALICA: Record<number, string> = {
  400: 'Roboto_400Regular_Italic',
  700: 'Roboto_700Bold_Italic',
};

/**
 * Os nomes que a React Native aceita em `fontWeight` além dos números.
 *
 * `condensed` e `condensedBold` são de LARGURA, não de peso. Caem no peso
 * que carregam porque não há Roboto Condensed empacotado — a alternativa
 * seria devolver uma família inexistente, que é o defeito.
 */
const NOME_PARA_NUMERO: Record<string, number> = {
  thin: 100,
  ultralight: 200,
  light: 300,
  normal: 400,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  condensed: 400,
  condensedBold: 700,
  heavy: 800,
  black: 900,
};

/** O que a RN admite em `fontWeight`, sem depender do tipo dela. */
export type PesoBruto = string | number | null | undefined;

/**
 * ⚠ **`Number('')` é 0, e 0 é finito.** A primeira versão desta função fazia
 * `if (Number.isFinite(n)) return n`, e com isso `fontWeight: ''` virava peso
 * **0**, que aproximava para o peso empacotado mais próximo — o Light. Texto
 * que devia sair normal sairia FINO, sem erro nenhum.
 *
 * Não está no código hoje (os sete pesos em uso são todos explícitos), mas é
 * a forma de um `fontWeight: destaque ? '700' : ''`. Pego em 13/11/2026 pela
 * conferência que roda, contra valor escrito à mão — não por leitura.
 *
 * Daí a guarda `> 0`: peso zero ou negativo não existe, e qualquer um dos
 * dois é entrada ruim, não um pedido de letra fina.
 */
export function pesoEmNumero(peso: PesoBruto): number {
  if (peso === undefined || peso === null) return 400;
  if (typeof peso === 'number') return peso > 0 ? peso : 400;

  const texto = peso.trim();
  if (texto === '') return 400;

  const n = Number(texto);
  if (Number.isFinite(n) && n > 0) return n;

  return NOME_PARA_NUMERO[texto] ?? 400;
}

/**
 * O peso empacotado mais próximo. Empate vai para o mais PESADO — o app usa
 * negrito para dinheiro, e errar para o lado leve apaga o destaque.
 */
export function aproximar(alvo: number, disponiveis: readonly number[]): number {
  let melhor = disponiveis[0];
  for (const p of disponiveis) {
    const d = Math.abs(p - alvo);
    const dMelhor = Math.abs(melhor - alvo);
    if (d < dMelhor || (d === dMelhor && p > melhor)) melhor = p;
  }
  return melhor;
}

export function familiaDe(peso: number, italico: boolean): string {
  if (italico) return FAMILIA_ITALICA[aproximar(peso, PESOS_ITALICOS)];
  return FAMILIA[aproximar(peso, PESOS_RETOS)];
}

/** Todas as famílias que `familiaDe` pode devolver. A conferência usa isto. */
export function todasAsFamilias(): string[] {
  return [...Object.values(FAMILIA), ...Object.values(FAMILIA_ITALICA)];
}
