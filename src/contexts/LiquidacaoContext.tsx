import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LiquidacaoContextType {
  /** true quando o vendedor está visualizando um dia passado (read-only) */
  modoVisualizacao: boolean;
  setModoVisualizacao: (v: boolean) => void;
  /** data sendo visualizada no formato YYYY-MM-DD, ou null se é o dia corrente */
  dataVisualizacao: string | null;
  setDataVisualizacao: (d: string | null) => void;
  /** id da liquidação sendo visualizada (se existir), ou null */
  liquidacaoIdVisualizacao: string | null;
  setLiquidacaoIdVisualizacao: (id: string | null) => void;
}

const LiquidacaoContext = createContext<LiquidacaoContextType>({
  modoVisualizacao: false,
  setModoVisualizacao: () => {},
  dataVisualizacao: null,
  setDataVisualizacao: () => {},
  liquidacaoIdVisualizacao: null,
  setLiquidacaoIdVisualizacao: () => {},
});

export function LiquidacaoProvider({ children }: { children: ReactNode }) {
  const [modoVisualizacao, setModoVisualizacao] = useState(false);
  const [dataVisualizacao, setDataVisualizacao] = useState<string | null>(null);
  const [liquidacaoIdVisualizacao, setLiquidacaoIdVisualizacao] = useState<string | null>(null);

  return (
    <LiquidacaoContext.Provider value={{
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
