import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

// ════════════════════════════════════════════════════════════════════════
// RASCUNHO DE FORMULÁRIO QUE SOBREVIVE AO APP SER MORTO
// ════════════════════════════════════════════════════════════════════════
//
// O PROBLEMA, relatado pelo Julio em 27/10/2026: o cobrador sai da Rutea
// para responder um WhatsApp ou tirar uma foto, volta, e o que estava
// digitado sumiu. Aconteceu no cadastro de cliente e ao consultar saldo.
//
// A CAUSA NÃO É NOSSA, E NÃO DÁ PARA EVITAR. O Android mata aplicativo em
// segundo plano quando precisa de memória — e abrir a câmera é justamente
// quando ele mais precisa. Em aparelho de 2 GB isso acontece toda hora; em
// um de 8 GB, quase nunca. Como o parque de aparelhos do cliente não é
// escolha nossa, a única saída é o app SOBREVIVER a ser morto, não tentar
// impedir.
//
// Morto o processo, todo `useState` volta ao valor inicial. Este hook põe o
// que o usuário digitou fora da memória do processo.
//
// PARA TESTAR, em qualquer aparelho: Opções do desenvolvedor →
// "Não manter atividades". Ligada, ela mata a activity em TODA troca de
// app, o que transforma um defeito que depende de sorte e de memória livre
// em um teste determinístico.
//
// ─── Como usar ───────────────────────────────────────────────────────────
//
//   const { restaurado, descartar } = useRascunho(
//     chave,                       // null desliga o rascunho
//     { nome, valor },             // o retrato do que deve sobreviver
//     (d) => { if (d.nome != null) setNome(d.nome); ... },
//     { temConteudo: (d) => !!d.nome || !!d.valor },
//   );
//
// A CHAVE TEM DE CARREGAR O CONTEXTO — vendedor, rota, cliente alvo. Um
// rascunho que vaza de um contexto para outro devolve dado plausível no
// lugar errado, que é pior que devolver nada.
//
// ⚠ CHAMAR `descartar()` AO GRAVAR COM SUCESSO. Sem isso, o rascunho de
// uma venda já feita volta na próxima abertura do formulário.

const PREFIXO = 'rascunho:';

/** Depois disto o rascunho é lixo: o dia operacional provavelmente virou. */
const VALIDADE_PADRAO_MS = 12 * 60 * 60 * 1000;

/** Espera parar de digitar antes de gravar. Uma gravação por tecla é desperdício. */
const DEBOUNCE_MS = 800;

/**
 * Teto de segurança do valor gravado.
 *
 * O AsyncStorage do Android é um SQLite com limite por registro (2 MB no
 * padrão) e um teto total do banco. Uma foto em base64 cabe folgado, mas o
 * limite existe para que um campo inesperadamente grande não derrube a
 * gravação inteira — e com ela o resto do formulário.
 */
const LIMITE_BYTES = 900_000;

interface Guardado<T> {
  gravadoEm: number;
  dados: T;
}

export interface OpcoesRascunho<T> {
  /** Idade máxima do rascunho. Padrão: 12 h. */
  validadeMs?: number;
  /**
   * `false` desliga tudo — não restaura e não grava.
   *
   * É o que se usa quando o formulário já nasce com valor que veio de fora e
   * vale mais que o digitado antes. O caso concreto: renovação APROVADA pelo
   * admin. Restaurar um rascunho por cima do valor liberado repetiria o bug
   * de 26/10/2026, em que o formulário sobrescrevia o valor aprovado pelo do
   * empréstimo anterior e a venda saía pelo número errado.
   */
  ativo?: boolean;
  /**
   * Decide se vale a pena guardar. Devolvendo `false`, o rascunho é APAGADO
   * em vez de gravado — então o formulário esvaziado à mão não deixa resto.
   */
  temConteudo?: (dados: T) => boolean;
  /**
   * Campo grande (uma foto, por exemplo). Se o retrato inteiro passar do
   * limite, grava-se uma segunda vez sem ele, em vez de perder tudo.
   */
  campoPesado?: keyof T;
}

export function useRascunho<T extends object>(
  chave: string | null,
  dados: T,
  restaurar: (dados: Partial<T>) => void,
  opcoes?: OpcoesRascunho<T>,
) {
  const ativo = opcoes?.ativo !== false && !!chave;
  const validadeMs = opcoes?.validadeMs ?? VALIDADE_PADRAO_MS;
  const chaveCompleta = chave ? PREFIXO + chave : null;

  const [restaurado, setRestaurado] = useState(false);

  // Em ref porque os dois são recriados a cada render e não devem reiniciar
  // nem a restauração nem o temporizador de gravação.
  const restaurarRef = useRef(restaurar);
  restaurarRef.current = restaurar;
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  // ⚠ A GRAVAÇÃO SÓ COMEÇA DEPOIS DA TENTATIVA DE RESTAURAR.
  // Sem esta trava, o primeiro render — com o formulário ainda vazio — grava
  // por cima do rascunho guardado e o apaga justamente na hora de usá-lo.
  const prontoRef = useRef(false);
  const descartadoRef = useRef(false);

  // ─── Restauração ──────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    prontoRef.current = false;
    descartadoRef.current = false;
    setRestaurado(false);

    if (!chaveCompleta || !ativo) {
      prontoRef.current = true;
      return;
    }

    (async () => {
      try {
        const cru = await AsyncStorage.getItem(chaveCompleta);
        if (!vivo) return;
        if (cru) {
          const guardado = JSON.parse(cru) as Guardado<T>;
          const idade = Date.now() - (guardado?.gravadoEm ?? 0);
          if (guardado?.dados && idade <= validadeMs) {
            restaurarRef.current(guardado.dados);
            setRestaurado(true);
            console.log('📝 Rascunho restaurado:', chaveCompleta);
          } else {
            await AsyncStorage.removeItem(chaveCompleta);
          }
        }
      } catch (err) {
        console.warn('Não deu para ler o rascunho:', err);
      } finally {
        if (vivo) prontoRef.current = true;
      }
    })();

    return () => { vivo = false; };
  }, [chaveCompleta, ativo, validadeMs]);

  // ─── Gravação ─────────────────────────────────────────────────────────
  //
  // `dados` é objeto novo a cada render, então este efeito roda sempre e
  // reinicia o temporizador. É o desenho: grava quando o usuário PARA.
  useEffect(() => {
    if (!chaveCompleta || !ativo || descartadoRef.current) return;

    const id = setTimeout(() => {
      if (!prontoRef.current || descartadoRef.current) return;
      void (async () => {
        try {
          const atual = dadosRef.current;
          const op = opcoesRef.current;

          if (op?.temConteudo && !op.temConteudo(atual)) {
            await AsyncStorage.removeItem(chaveCompleta);
            return;
          }

          let texto = JSON.stringify({ gravadoEm: Date.now(), dados: atual });
          if (texto.length > LIMITE_BYTES && op?.campoPesado) {
            const semPesado = { ...atual, [op.campoPesado]: null };
            texto = JSON.stringify({ gravadoEm: Date.now(), dados: semPesado });
            console.warn('Rascunho grande demais; gravando sem', String(op.campoPesado));
          }
          if (texto.length > LIMITE_BYTES) return;

          await AsyncStorage.setItem(chaveCompleta, texto);
        } catch (err) {
          console.warn('Não deu para gravar o rascunho:', err);
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [dados, chaveCompleta, ativo]);

  /**
   * Apaga o rascunho. Chamar ao enviar com sucesso.
   *
   * ⚠ A MUDEZ É TEMPORÁRIA, e tem de ser. Ela existe só para o retrato que
   * já estava no forno não ser gravado depois do apagamento — o debounce
   * pode ter 800 ms de dados em voo. Mudez permanente pareceria mais segura
   * e deixaria a SEGUNDA venda da mesma sessão sem rascunho nenhum: a tela
   * não é desmontada entre uma e outra, então o hook não recomeça.
   */
  const descartar = useCallback(() => {
    descartadoRef.current = true;
    setRestaurado(false);
    if (chaveCompleta) AsyncStorage.removeItem(chaveCompleta).catch(() => {});
    setTimeout(() => { descartadoRef.current = false; }, DEBOUNCE_MS * 2);
  }, [chaveCompleta]);

  return { restaurado, descartar };
}

/**
 * Varre os rascunhos vencidos. Chamado uma vez por abertura do app — barato,
 * e evita que rascunho de venda abandonada fique ocupando o banco para
 * sempre, já que a limpeza normal só acontece quando o MESMO formulário é
 * aberto de novo.
 */
export async function limparRascunhosVencidos(validadeMs = VALIDADE_PADRAO_MS) {
  try {
    const chaves = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(PREFIXO));
    if (chaves.length === 0) return;
    const pares = await AsyncStorage.multiGet(chaves);
    const vencidas = pares
      .filter(([, valor]) => {
        if (!valor) return true;
        try {
          const g = JSON.parse(valor) as Guardado<unknown>;
          return Date.now() - (g?.gravadoEm ?? 0) > validadeMs;
        } catch {
          return true;
        }
      })
      .map(([k]) => k);
    if (vencidas.length > 0) await AsyncStorage.multiRemove(vencidas);
  } catch {
    // silêncio de propósito: limpeza de fundo não pode atrapalhar a abertura
  }
}
