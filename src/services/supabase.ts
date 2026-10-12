import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://fwqnahixkrmmflzjvptg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3cW5haGl4a3JtbWZsemp2cHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTUwOTcsImV4cCI6MjA2NDczMTA5N30.ThRrhfp_7gZPCrdoMpqdMo-NfaMW9LS6ytp4mVzh368';

/**
 * TODO PEDIDO TEM PRAZO.
 *
 * Relatado no campo em 10/10/2026: o vendedor deixou o app aberto na tela de
 * pagamento, o celular dormiu, ele voltou — e aí nada mais funcionava. O
 * botão de pagar não respondia, e a aba "Todos" ficava com o "atualizando"
 * girando para sempre.
 *
 * O MECANISMO. Quando o Android corta a conexão em segundo plano, ele o faz
 * sem fechar o socket direito. O cliente HTTP reaproveita um socket morto, e
 * o `fetch` do React Native **não tem tempo limite nenhum**: a promessa
 * simplesmente nunca resolve. Nem erro, nem resposta.
 *
 * POR QUE ISSO TRAVA TUDO, e não só aquele pedido: o `LiquidacaoContext`
 * guarda `recarregandoClientesRef` para não disparar duas cargas ao mesmo
 * tempo, e só o libera no `finally`. Com a promessa pendurada, o `finally`
 * nunca roda — o guard fica preso em `true`, o `carregandoClientes` fica
 * preso em `true`, e toda recarga seguinte vê "já em andamento" e desiste.
 * Um pedido pendurado congela o app inteiro, para sempre, e só reabrir
 * resolve.
 *
 * O CONSERTO É AQUI, e não em cada chamada. O `supabase-js` aceita um `fetch`
 * próprio, e por ele passam consultas, RPCs e autenticação — os três de uma
 * vez. Pôr prazo em cada `await` espalhado pelo app seria dezenas de lugares
 * para manter, e o primeiro esquecido traria o problema de volta.
 *
 * Vinte e cinco segundos: generoso para rota com sinal ruim, curto o bastante
 * para o vendedor perceber que falhou e tentar de novo em vez de esperar.
 */
const TEMPO_LIMITE_MS = 25_000;

const fetchComPrazo: typeof fetch = async (entrada, init) => {
  const controle = new AbortController();

  // Respeita um cancelamento que a própria chamada tenha pedido — o
  // `supabase-js` usa isso no `.abortSignal()`, e atropelá-lo esconderia um
  // cancelamento legítimo atrás de "tempo esgotado".
  const sinalDaChamada = init?.signal;
  if (sinalDaChamada) {
    if (sinalDaChamada.aborted) controle.abort();
    else sinalDaChamada.addEventListener('abort', () => controle.abort(), { once: true });
  }

  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    return await fetch(entrada, { ...init, signal: controle.signal });
  } catch (e) {
    if (controle.signal.aborted && !sinalDaChamada?.aborted) {
      const erro = new Error('Tempo esgotado ao falar com o servidor') as Error & { code: string };
      erro.code = 'TIMEOUT';
      throw erro;
    }
    throw e;
  } finally {
    clearTimeout(relogio);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchComPrazo },
});
