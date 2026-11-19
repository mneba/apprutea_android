// ============================================================
// useTrabalhaCredito — o parâmetro de TELA da rota
//
// `rotas.trabalha_credito` NÃO muda regra nenhuma: o crédito existe e funciona
// igual em toda rota (fica em `saldo_excedente` da parcela, e
// `emprestimos.valor_saldo` já vem líquido dele). O parâmetro só decide se o
// vendedor VÊ a palavra crédito, ou se o pago a mais aparece como fração de
// parcela. Ver sql/2026-11-18_rota_trabalha_credito.sql.
//
// Lido por rota_id a cada montagem (com cache curto), e não no login: a sessão
// do vendedor fica guardada no aparelho e ele não refaz login, então um valor
// gravado no login nunca veria a troca feita no web.
//
// ⚠ Falha de leitura (inclusive a coluna ainda não existir) devolve `true` —
// mostrar o crédito como hoje. Esconder por engano faria o vendedor cobrar sem
// saber que o cliente tem dinheiro adiantado.
// ============================================================

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

const TTL_MS = 60_000;
const cache = new Map<string, { valor: boolean; em: number }>();

export function useTrabalhaCredito(): boolean {
  const { vendedor } = useAuth();
  const rotaId = vendedor?.rota_id ?? null;
  const emCache = rotaId ? cache.get(rotaId) : undefined;
  const [valor, setValor] = useState<boolean>(emCache?.valor ?? true);

  useEffect(() => {
    if (!rotaId) return;
    const c = cache.get(rotaId);
    if (c && Date.now() - c.em < TTL_MS) {
      setValor(c.valor);
      return;
    }
    let vivo = true;
    supabase
      .from('rotas')
      .select('trabalha_credito')
      .eq('id', rotaId)
      .single()
      .then(
        ({ data, error }) => {
          // Sem a coluna, `data.trabalha_credito` vem undefined: fica true.
          const v = error ? true : (data as any)?.trabalha_credito !== false;
          cache.set(rotaId, { valor: v, em: Date.now() });
          if (vivo) setValor(v);
        },
        () => { if (vivo) setValor(true); },
      );
    return () => { vivo = false; };
  }, [rotaId]);

  return valor;
}
