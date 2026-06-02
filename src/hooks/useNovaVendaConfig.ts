import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { Segmento, SegmentoGrupo } from '../constants/novaVendaConstants';

// ============================================================
// HOOK: Configurações da rota/vendedor
// Segmentos, taxas de juros, dias úteis, restrição de valor
// ============================================================

interface UseNovaVendaConfigParams {
  vendedorId?: string | null;
  rotaId?: string | null;
}

export function useNovaVendaConfig({ vendedorId, rotaId }: UseNovaVendaConfigParams) {
  // --- Segmentos ---
  const [segmentos, setSegmentos] = useState<SegmentoGrupo[]>([]);
  const [segmentosLoading, setSegmentosLoading] = useState(false);

  // --- Taxas de juros ---
  const [taxasPermitidas, setTaxasPermitidas] = useState<number[]>([5, 10, 15, 20, 25]);
  const [taxasLivre, setTaxasLivre] = useState(false);

  // --- Dias úteis da rota ---
  const [trabalhaDomingo, setTrabalhaDomingo] = useState<boolean>(true);
  const [feriadosSet, setFeriadosSet] = useState<Set<string>>(new Set());

  // --- Restrição de valor máximo de vendas ---
  const [validarMaxVendas, setValidarMaxVendas] = useState<boolean>(false);
  const [valorMaxVendas, setValorMaxVendas] = useState<number>(0);

  // -----------------------------------------------------------
  // CARREGAR SEGMENTOS
  // -----------------------------------------------------------
  const loadSegmentos = async () => {
    setSegmentosLoading(true);
    try {
      const { data, error } = await supabase
        .from('segmentos')
        .select('id, grupo_pt, nome_pt, ordem_grupo, ordem')
        .eq('ativo', true)
        .order('ordem_grupo')
        .order('ordem');

      if (error) throw error;

      const grupos: Record<string, Segmento[]> = {};
      (data || []).forEach((seg: Segmento) => {
        const grupo = seg.grupo_pt || 'Outros';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(seg);
      });

      const agrupados: SegmentoGrupo[] = Object.entries(grupos).map(([grupo, itens]) => ({
        grupo,
        itens,
      }));

      setSegmentos(agrupados);
    } catch (err) {
      console.error('Erro ao carregar segmentos:', err);
    } finally {
      setSegmentosLoading(false);
    }
  };

  // -----------------------------------------------------------
  // CARREGAR TAXAS PERMITIDAS
  // -----------------------------------------------------------
  const loadTaxasPermitidas = async () => {
    if (!vendedorId) return;
    try {
      const { data, error } = await supabase
        .rpc('fn_listar_taxas_juros', { p_vendedor_id: vendedorId });

      if (!error && data) {
        const livre = data.length === 0 || data.some((r: any) => r.is_livre === true);
        if (livre) {
          setTaxasLivre(true);
          setTaxasPermitidas([5, 10, 15, 20, 25]);
        } else {
          setTaxasLivre(false);
          const taxas = data.map((r: any) => Number(r.taxa)).filter((t: number) => t > 0);
          if (taxas.length > 0) setTaxasPermitidas(taxas);
        }
      } else {
        setTaxasLivre(true);
      }
    } catch (err) {
      console.error('Erro ao carregar taxas:', err);
      setTaxasLivre(true);
    }
  };

  // -----------------------------------------------------------
  // EFEITOS
  // -----------------------------------------------------------

  // Carregar segmentos e taxas na montagem
  useEffect(() => {
    loadSegmentos();
    loadTaxasPermitidas();
  }, []);

  // Carregar config de dias úteis da rota
  useEffect(() => {
    if (!rotaId) return;

    (async () => {
      try {
        const { data: rotaData } = await supabase
          .from('rotas')
          .select('trabalha_domingo')
          .eq('id', rotaId)
          .single();

        setTrabalhaDomingo(rotaData?.trabalha_domingo !== false);

        const { data: feriadosData } = await supabase
          .from('feriados')
          .select('data')
          .eq('rota_id', rotaId);

        const set = new Set<string>();
        (feriadosData || []).forEach((f: any) => {
          if (f.data) set.add(f.data);
        });
        setFeriadosSet(set);
      } catch (e) {
        console.error('Erro ao carregar config de dias úteis:', e);
      }
    })();
  }, [rotaId]);

  // Carregar restrição de valor máximo de vendas
  useEffect(() => {
    if (!vendedorId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('restricoes_vendedor')
          .select('validar_valor_max_vendas, valor_max_vendas')
          .eq('vendedor_id', vendedorId)
          .maybeSingle();
        if (data) {
          setValidarMaxVendas(data.validar_valor_max_vendas === true);
          setValorMaxVendas(parseFloat(String(data.valor_max_vendas)) || 0);
        }
      } catch (e) {
        console.error('Erro ao carregar restrição de vendas:', e);
      }
    })();
  }, [vendedorId]);

  return {
    // Segmentos
    segmentos,
    segmentosLoading,
    // Taxas
    taxasPermitidas,
    taxasLivre,
    // Dias úteis
    trabalhaDomingo,
    feriadosSet,
    // Restrição vendas
    validarMaxVendas,
    valorMaxVendas,
  };
}
