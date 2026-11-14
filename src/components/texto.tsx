/**
 * A LETRA DO APP É NOSSA — autoridade única de fonte e de teto de escala.
 *
 * ## Por que isto existe
 *
 * Até 13/11/2026 o app não declarava fonte em lugar nenhum: `expo-font`
 * estava no `package.json` sem um único arquivo `.ttf`, e `fontFamily`
 * aparecia em UM arquivo (o extrato, como `monospace` genérico). Então os
 * 1.545 `<Text>` do app desenhavam na letra que o DONO DO APARELHO escolheu
 * — *Estilo da fonte* na Samsung, Temas na Xiaomi.
 *
 * Trocar a letra troca a largura do glifo e a altura da linha. O layout, que
 * é medido em `dp`, não muda — então o texto estoura a linha e o Android
 * CORTA em silêncio. E o mais enganoso: **`fontScale` fica em 1,0**, porque
 * estilo de fonte não é tamanho de fonte. Foi exatamente o que o
 * `AvisoEscalaDaTela` mediu em 30/10/2026 naquele aparelho, e foi por isso
 * que a investigação parou: a régua certa dizia que estava tudo normal.
 *
 * São TRÊS controles diferentes no Android, e só o terceiro é este:
 *
 *   | o usuário muda      | muda no app          | o app pode recusar?     |
 *   |---------------------|----------------------|-------------------------|
 *   | Tamanho da fonte    | `fontScale`          | sim, `maxFontSize...`   |
 *   | Tamanho da tela     | a densidade (`dp`)   | NÃO. só layout fluido   |
 *   | Estilo da fonte     | a LETRA              | sim, e por completo     |
 *
 * ## Como
 *
 * Seis pesos do Roboto empacotados no APK (948 KB) mais dois itálicos. A
 * partir daqui a letra é a mesma em todo aparelho e nenhum ajuste de
 * fabricante a alcança.
 *
 * ⚠ **`expo-font` 13.3.2 NÃO aceita peso por família** — não existe campo
 * `weight` em `FontResource`. Cada arquivo registra uma família PRÓPRIA
 * (`Roboto_700Bold`), e `fontWeight` deixa de selecionar entre elas. Pior:
 * o Android, ao não achar o peso pedido registrado, **cai de volta na fonte
 * do sistema EM SILÊNCIO** — ou seja, usar `fontFamily: 'Roboto'` +
 * `fontWeight: '700'` traria o defeito de volta exatamente no texto em
 * negrito, que é onde está o DINHEIRO.
 *
 * Daí este componente: ele lê o `fontWeight` do estilo, escolhe a FAMÍLIA
 * correspondente e **remove `fontWeight` e `fontStyle`** do estilo final. O
 * peso passa a estar no arquivo, não na propriedade.
 *
 * ## Os seis pesos cobrem os seis que o app usa, sem aproximação
 *
 *   700 → 309x    600 → 229x    500 → 56x
 *   800 →  33x    bold → 15x    300 → 7x    400 → 3x
 *
 * Nenhum peso é arredondado para outro, então a aparência não muda para
 * quem nunca mexeu no estilo de fonte do aparelho — que é a maioria. Quem
 * mexeu volta para o Roboto.
 *
 * ## O teto de escala, de volta — e agora sem `defaultProps`
 *
 * O teto de 1,2x viveu em 29 e 30/10/2026 como remendo no `render` do
 * `Text`, e saiu porque React 19 removeu `defaultProps` de componente de
 * função: `Text.defaultProps = {...}` não funciona mais, e mexer no módulo
 * da RN é preso à versão. O substituto é este: o teto é o DEFAULT de uma
 * prop, num componente nosso. Quem precisar de outro valor passa a prop.
 *
 * `allowFontScaling` continua LIGADO: o usuário que aumenta a fonte por
 * necessidade continua sendo atendido até 1,2x. Desligar resolveria o
 * layout quebrando a acessibilidade, que é troca ruim.
 *
 * ## Herança de `<Text>` dentro de `<Text>`
 *
 * Na RN o filho herda o estilo do pai. Como aqui o peso virou FAMÍLIA, um
 * filho sem `fontWeight` próprio receberia `Roboto_400Regular` e apagaria o
 * negrito do pai. São 32 ocorrências aninhadas em 8 arquivos, então o
 * contexto abaixo repõe a herança.
 *
 * Ele só é pago quando há filho que é ELEMENTO. Na esmagadora maioria o
 * filho é string ou número, e aí não nasce `Provider` nenhum — 1.545
 * providers em lista de 350 clientes seria custo sem motivo.
 *
 * ## Como usar
 *
 * Não se usa `Text` da `react-native` em `src/`. Troque o import:
 *
 *     import { Text, TextInput } from '../components/texto';
 *
 * As tags ficam `<Text>` e `<TextInput>`, inalteradas. A conferência
 * `scripts/conferir-fonte-propria.mjs` reprova quem importar da
 * `react-native`.
 */

import React, { createContext, useContext } from 'react';
import {
  StyleSheet,
  Text as TextRN,
  TextInput as TextInputRN,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { familiaDe, pesoEmNumero } from '../utils/fonte';

/**
 * O máximo que a fonte do sistema pode esticar o nosso texto.
 *
 * 1,2 é o mesmo valor do teto removido em 30/10/2026. Não é número redondo
 * por acaso: acima disso as linhas de dinheiro começam a estourar, e o
 * trabalho de `flexShrink` que as torna fluidas ainda tem 54 estilos
 * latentes (ver `scripts/conferir-linhas-que-cortam.mjs`). Quando aquela
 * conta chegar a zero, este teto pode subir.
 */
export const TETO_FONTE = 1.2;

/**
 * Os nomes também valem como TIPO, porque `useRef<TextInput>(null)` aparece
 * em 4 lugares e um `const` sozinho não serve de tipo. Como o nosso
 * `forwardRef` declara a instância da RN como alvo da ref, o tipo aqui é o
 * da RN — a ref continua apontando para o campo nativo, com `.focus()` e o
 * resto.
 */
export type Text = TextRN;
export type TextInput = TextInputRN;

/**
 * O mapa peso -> família vive em [utils/fonte.ts](../utils/fonte.ts), puro e
 * sem plataforma, para que `scripts/conferir-mapa-de-fonte.mjs` possa
 * EXECUTÁ-LO. Errar ali não dá erro: devolve família inexistente e o Android
 * cai na fonte do sistema em silêncio.
 */

/** O que o pai passa ao filho aninhado, repondo a herança da RN. */
type Herdado = { peso: number; italico: boolean };
const EstiloHerdado = createContext<Herdado | undefined>(undefined);

/**
 * `true` quando algum filho é elemento React — único caso em que o
 * `Provider` da herança é necessário. String e número não herdam nada.
 */
function temFilhoElemento(filhos: React.ReactNode): boolean {
  let achou = false;
  React.Children.forEach(filhos, (f) => {
    if (!achou && f !== null && f !== undefined && typeof f === 'object') achou = true;
  });
  return achou;
}

export const Text = React.forwardRef<TextRN, TextProps>(function Text(
  { style, maxFontSizeMultiplier = TETO_FONTE, children, ...resto },
  ref
) {
  const herdado = useContext(EstiloHerdado);

  /**
   * Achatar é necessário para ler o `fontWeight` efetivo de um array de
   * estilos, e também para REMOVER as duas propriedades com segurança:
   * `style={[original, { fontWeight: undefined }]}` depende de como a RN
   * trata `undefined` na mesclagem, que é detalhe interno. Construir o
   * objeto final à mão não depende de nada.
   */
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  const temPesoProprio = plano.fontWeight !== undefined && plano.fontWeight !== null;
  const temEstiloProprio = plano.fontStyle !== undefined && plano.fontStyle !== null;

  const peso = temPesoProprio ? pesoEmNumero(plano.fontWeight) : (herdado?.peso ?? 400);
  const italico = temEstiloProprio ? plano.fontStyle === 'italic' : (herdado?.italico ?? false);

  const estilo: TextStyle = { ...plano, fontFamily: familiaDe(peso, italico) };
  delete estilo.fontWeight;
  delete estilo.fontStyle;

  const elemento = (
    <TextRN ref={ref} {...resto} maxFontSizeMultiplier={maxFontSizeMultiplier} style={estilo}>
      {children}
    </TextRN>
  );

  if (!temFilhoElemento(children)) return elemento;

  return (
    <EstiloHerdado.Provider value={{ peso, italico }}>{elemento}</EstiloHerdado.Provider>
  );
});

/**
 * O campo de digitar tem o MESMO problema: o texto que o vendedor digita, e
 * o `placeholder`, saem na letra do aparelho. São 49 campos em 21 arquivos.
 *
 * ⚠ Campo não herda estilo de `<Text>` pai na RN, então aqui não há
 * contexto — o peso sai do próprio estilo, e na falta dele é 400.
 */
export const TextInput = React.forwardRef<TextInputRN, TextInputProps>(function TextInput(
  { style, maxFontSizeMultiplier = TETO_FONTE, ...resto },
  ref
) {
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  const peso = pesoEmNumero(plano.fontWeight);
  const italico = plano.fontStyle === 'italic';

  const estilo: TextStyle = { ...plano, fontFamily: familiaDe(peso, italico) };
  delete estilo.fontWeight;
  delete estilo.fontStyle;

  return (
    <TextInputRN
      ref={ref}
      {...resto}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={estilo}
    />
  );
});
