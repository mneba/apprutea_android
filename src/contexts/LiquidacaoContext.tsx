import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { LiquidacaoDiaria } from '../types';
import { useAuth } from './AuthContext';

interface LiquidacaoContextType {
  // Liquidação atual (ABERTA/REABERTA)
  liquidacaoAtual: LiquidacaoDiaria | null;
  setLiquidacaoAtual: (l: LiquidacaoDiaria | null) => void;
  temLiquidacaoAberta: boolean;
  recarregarLiquidacao: () => Promise<void>;
  loadingLiquidacao: boolean;

  // Modo visualização (existente)
  modoVisualizacao: boolean;
  setModoVisualizacao: (v: boolean) => void;
  dataVisualizacao: string | null;
  setDataVisualizacao: (d: string | null) => void;
  liquidacaoIdVisualizacao: string | null;
  setLiquidacaoIdVisualizacao: (id: string | null) => void;
}

const LiquidacaoContext = createContext<LiquidacaoContextType>({
  liquidacaoAtual: null,
  setLiquidacaoAtual: () => {},
  temLiquidacaoAberta: false,
  recarregarLiquidacao: async () => {},
  loadingLiquidacao: false,

  modoVisualizacao: false,
  setModoVisualizacao: () => {},
  dataVisualizacao: null,
  setDataVisualizacao: () => {},
  liquidacaoIdVisualizacao: null,
  setLiquidacaoIdVisualizacao: () => {},
});

export function LiquidacaoProvider({ children }: { children: ReactNode }) {
  const { vendedor } = useAuth();

  // Liquidação atual
  const [liquidacaoAtual, setLiquidacaoAtual] = useState<LiquidacaoDiaria | null>(null);
  const [loadingLiquidacao, setLoadingLiquidacao] = useState(false);

  // Modo visualização (existente)
  const [modoVisualizacao, setModoVisualizacao] = useState(false);
  const [dataVisualizacao, setDataVisualizacao] = useState<string | null>(null);
  const [liquidacaoIdVisualizacao, setLiquidacaoIdVisualizacao] = useState<string | null>(null);

  // Computed
  const temLiquidacaoAberta = !!(
    liquidacaoAtual?.id && 
    (liquidacaoAtual.status === 'ABERTO' || liquidacaoAtual.status === 'ABERTA' || liquidacaoAtual.status === 'REABERTO')
  );

  // Buscar liquidação aberta ao montar o contexto
  const recarregarLiquidacao = useCallback(async () => {
    if (!vendedor?.rota_id) return;

    setLoadingLiquidacao(true);
    try {
      const { data, error } = await supabase
        .from('liquidacoes_diarias')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .in('status', ['ABERTO', 'ABERTA', 'REABERTO'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) {
        setLiquidacaoAtual(data || null);
      }
    } catch (err) {
      console.error('Erro ao carregar liquidação:', err);
    } finally {
      setLoadingLiquidacao(false);
    }
  }, [vendedor?.rota_id]);

  // Carregar ao montar e quando vendedor mudar
  useEffect(() => {
    if (vendedor?.rota_id) {
      recarregarLiquidacao();
    }
  }, [vendedor?.rota_id, recarregarLiquidacao]);

  return (
    <LiquidacaoContext.Provider value={{
      liquidacaoAtual,
      setLiquidacaoAtual,
      temLiquidacaoAberta,
      recarregarLiquidacao,
      loadingLiquidacao,

      modoVisualizacao,
      setModoVisualizacao,
      dataVisualizacao,
      setDataVisualizacao,
      liquidacaoIdVisualizacao,
      setLiquidacaoIdVisualizacao,
    }}>
      {children}
    </LiquidacaoContext.Provider>
  );
}

export function useLiquidacaoContext() {
  return useContext(LiquidacaoContext);
}