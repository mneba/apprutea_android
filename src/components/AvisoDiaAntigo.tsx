/**
 * Faixa "você está operando um dia passado" (pedido do Julio, 12/10/2026).
 *
 * Operar dia passado é o fluxo NORMAL de recuperar dias atrasados, e tudo o
 * que se registra fica com a data do dia aberto — é a regra "a liquidação é a
 * régua do tempo" (CLAUDE.md). O que faltava era DIZER isso: na Prueba Julio 1
 * um empréstimo feito em 12/10 entrou em 29/09 sem nenhum aviso na tela.
 *
 * Compara o dia aberto (`data_liquidacao`) com o hoje da ROTA
 * (`fn_data_hoje_rota`, fuso da empresa), nunca com o relógio do aparelho.
 * Some quando o dia aberto é hoje, quando não há dia aberto, e quando
 * qualquer das duas leituras falha — aviso errado é pior que aviso nenhum.
 *
 * Dentro das abas, passe `dia` (vem do LiquidacaoContext). Fora delas
 * (Nova Venda, Nova Movimentação são irmãs de MainTabs, fora do provider),
 * omita: o componente lê o dia aberto sozinho.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Text } from './texto';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.substring(0, 10).split('-').map(Number);
  const [a2, m2, d2] = ate.substring(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

function dataBr(iso: string): string {
  const [a, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

interface Props {
  /** `data_liquidacao` do dia aberto, quando quem chama já sabe. */
  dia?: string | null;
  /** Muda para forçar releitura (ex.: id da liquidação aberta). */
  chave?: string | number | null;
  /** 'faixa' no topo da tela; 'linha' junto do botão de confirmar. */
  variante?: 'faixa' | 'linha';
}

export function AvisoDiaAntigo({ dia, chave, variante = 'faixa' }: Props) {
  const { vendedor, idioma } = useAuth();
  const rotaId = (vendedor as any)?.rota_id as string | undefined;
  const es = idioma === 'es';

  const [hoje, setHoje] = useState<string | null>(null);
  const [diaLido, setDiaLido] = useState<string | null>(null);
  const usaProp = dia !== undefined;

  const ler = useCallback(async () => {
    if (!rotaId) return;
    const [h, l] = await Promise.all([
      supabase.rpc('fn_data_hoje_rota', { p_rota_id: rotaId }).then((r) => r, () => null),
      usaProp
        ? Promise.resolve(null)
        : supabase
            .from('liquidacoes_diarias')
            .select('data_liquidacao')
            .eq('rota_id', rotaId)
            .in('status', ['ABERTO', 'REABERTO'])
            .order('data_liquidacao', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then((r) => r, () => null),
    ]);
    setHoje(h && !h.error && h.data ? String(h.data) : null);
    if (!usaProp) setDiaLido(l && !l.error && l.data ? String(l.data.data_liquidacao) : null);
  }, [rotaId, usaProp]);

  useEffect(() => { ler(); }, [ler, chave]);

  // Virada do dia com o app aberto: relê ao voltar para o primeiro plano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') ler(); });
    return () => sub.remove();
  }, [ler]);

  const diaAberto = usaProp ? dia : diaLido;
  if (!diaAberto || !hoje) return null;
  const atras = diasEntre(diaAberto, hoje);
  if (atras <= 0) return null;

  const quando = atras === 1
    ? (es ? 'ayer' : 'ontem')
    : (es ? `hace ${atras} días` : `${atras} dias atrás`);
  const titulo = es
    ? `Operando el día ${dataBr(diaAberto)} (${quando})`
    : `Você está operando o dia ${dataBr(diaAberto)} (${quando})`;
  const corpo = es
    ? 'Todo lo que registre queda con esa fecha.'
    : 'Tudo o que registrar fica com essa data.';

  if (variante === 'linha') {
    return (
      <View style={s.linha}>
        <Ionicons name="calendar-outline" size={16} color="#92400E" />
        <Text style={s.linhaTexto}>{titulo}. {corpo}</Text>
      </View>
    );
  }

  return (
    <View style={s.faixa}>
      <Ionicons name="calendar-outline" size={18} color="#92400E" />
      <View style={s.textos}>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.corpo}>{corpo}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  faixa: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    marginHorizontal: 16, marginTop: 8,
  },
  textos: { flex: 1, flexShrink: 1 },
  titulo: { color: '#92400E', fontSize: 13, fontWeight: '700' },
  corpo: { color: '#92400E', fontSize: 12, marginTop: 1 },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8,
  },
  linhaTexto: { flex: 1, flexShrink: 1, color: '#92400E', fontSize: 12, fontWeight: '600' },
});
