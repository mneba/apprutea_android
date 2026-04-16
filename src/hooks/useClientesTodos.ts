import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmprestimoTodos {
  id: string; valor_principal: number; saldo_emprestimo: number;
  valor_parcela: number; numero_parcelas: number; numero_parcela_atual: number;
  status: string; frequencia_pagamento: string; tipo_emprestimo: string;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  data_emprestimo?: string;
}

export interface ClienteTodos {
  id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; status: string; tem_atraso: boolean;
  permite_renegociacao: boolean; cliente_created_at?: string;
  emprestimos: EmprestimoTodos[];
}

// ─── Helper ─────────────────────────────────────────────────────────────────

const buscarCreditoMap = async (empIds: string[]): Promise<Map<string, number>> => {
  if (empIds.length === 0) return new Map();
  const { data } = await supabase
    .from('emprestimo_parcelas')
    .select('emprestimo_id, saldo_excedente')
    .in('emprestimo_id', empIds)
    .gt('saldo_excedente', 0);
  const creditoMap = new Map<string, number>();
  (data || []).forEach((p: any) => {
    const atual = creditoMap.get(p.emprestimo_id) || 0;
    creditoMap.set(p.emprestimo_id, atual + parseFloat(p.saldo_excedente || 0));
  });
  return creditoMap;
};

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseClientesTodosParams {
  rotaId: string | null | undefined;
  tab: 'liquidacao' | 'todos';
  setOrdemRotaMap: (m: Map<string, number>) => void;
  setRefreshing: (v: boolean) => void;
}

export default function useClientesTodos({ rotaId, tab, setOrdemRotaMap, setRefreshing }: UseClientesTodosParams) {
  const [todosList, setTodosList] = useState<ClienteTodos[]>([]);
  const [loadTodos, setLoadTodos] = useState(false);
  const [todosCount, setTodosCount] = useState<number | null>(null);

  const loadTodosClientes = useCallback(async (forceReload = false) => {
    if (!rotaId || (!forceReload && todosList.length > 0)) { setRefreshing(false); return; }
    setLoadTodos(true);
    try {
      // Query 1: Todos os empréstimos da rota com dados do cliente
      const { data: emps } = await supabase
        .from('emprestimos')
        .select(`id, valor_principal, valor_saldo, valor_parcela, numero_parcelas, status, frequencia_pagamento, tipo_emprestimo, data_emprestimo, clientes!inner(id, nome, telefone_celular, status, codigo_cliente, permite_renegociacao, created_at)`)
        .eq('rota_id', rotaId)
        .in('status', ['ATIVO', 'VENCIDO', 'QUITADO', 'RENEGOCIADO']);

      if (!emps || emps.length === 0) { setTodosList([]); return; }

      // Query 2: Todas as parcelas dos empréstimos de uma vez
      const empIds = (emps as any[]).map(e => e.id);
      const { data: allParcs } = await supabase
        .from('emprestimo_parcelas')
        .select('emprestimo_id, numero_parcela, valor_parcela, status')
        .in('emprestimo_id', empIds);

      // Agrupa parcelas por empréstimo
      const parcMap = new Map<string, { maxParcela: number; vencidas: number; totalVencido: number }>();
      (allParcs || []).forEach((p: any) => {
        let info = parcMap.get(p.emprestimo_id);
        if (!info) { info = { maxParcela: 0, vencidas: 0, totalVencido: 0 }; parcMap.set(p.emprestimo_id, info); }
        if (p.numero_parcela > info.maxParcela) info.maxParcela = p.numero_parcela;
        if (p.status === 'VENCIDO' || p.status === 'VENCIDA') {
          info.vencidas++;
          info.totalVencido += (p.valor_parcela || 0);
        }
      });

      // Monta clientes
      const cliMap = new Map<string, ClienteTodos>();
      for (const e of emps as any[]) {
        const c = e.clientes;
        if (!c) continue;
        let cli = cliMap.get(c.id);
        if (!cli) {
          cli = {
            id: c.id,
            codigo_cliente: c.codigo_cliente,
            nome: c.nome,
            telefone_celular: c.telefone_celular,
            status: c.status,
            tem_atraso: false,
            permite_renegociacao: c.permite_renegociacao || false,
            cliente_created_at: c.created_at || null,
            emprestimos: [],
          };
          cliMap.set(c.id, cli);
        }
        const info = parcMap.get(e.id) || { maxParcela: 1, vencidas: 0, totalVencido: 0 };
        if (info.vencidas > 0) cli.tem_atraso = true;
        cli.emprestimos.push({
          id: e.id,
          valor_principal: e.valor_principal,
          saldo_emprestimo: e.valor_saldo,
          valor_parcela: e.valor_parcela,
          numero_parcelas: e.numero_parcelas,
          numero_parcela_atual: info.maxParcela,
          status: e.status,
          frequencia_pagamento: e.frequencia_pagamento,
          tipo_emprestimo: (e as any).tipo_emprestimo || 'NOVO',
          total_parcelas_vencidas: info.vencidas,
          valor_total_vencido: info.totalVencido,
          data_emprestimo: (e as any).data_emprestimo || null,
        });
      }

      // Descontar crédito acumulado do saldo de cada empréstimo
      const empIdsTodos = (emps as any[]).map(e => e.id);
      const creditoMapTodos = await buscarCreditoMap(empIdsTodos);
      if (creditoMapTodos.size > 0) {
        Array.from(cliMap.values()).forEach(cli => {
          cli.emprestimos.forEach(emp => {
            const credito = creditoMapTodos.get(emp.id) || 0;
            if (credito > 0) emp.saldo_emprestimo = Math.max(0, emp.saldo_emprestimo - credito);
          });
        });
      }
      setTodosList(Array.from(cliMap.values()));

      // Carregar ordem da rota
      if (rotaId) {
        const clienteIds = Array.from(cliMap.keys());
        const { data: ordens } = await supabase
          .from('ordem_rota_cliente')
          .select('cliente_id, ordem')
          .eq('rota_id', rotaId)
          .in('cliente_id', clienteIds);
        if (ordens && ordens.length > 0) {
          const m = new Map<string, number>();
          (ordens as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
          setOrdemRotaMap(m);
        }
      }
    } catch (e) {
      console.error('Erro loadTodos:', e);
    } finally {
      setLoadTodos(false);
      setRefreshing(false);
    }
  }, [rotaId, todosList.length, setOrdemRotaMap, setRefreshing]);

  // Carga quando muda para aba todos
  useEffect(() => {
    if (tab === 'todos') loadTodosClientes();
  }, [tab, loadTodosClientes]);

  // Contagem rápida para exibir no tab "Todos" antes de carregar
  useEffect(() => {
    if (!rotaId || todosCount !== null) return;
    (async () => {
      try {
        const { count } = await supabase
          .from('emprestimos')
          .select('cliente_id', { count: 'exact', head: true })
          .eq('rota_id', rotaId)
          .in('status', ['ATIVO', 'VENCIDO', 'QUITADO']);
        setTodosCount(count || 0);
      } catch { }
    })();
  }, [rotaId, todosCount]);

  // Atualiza saldo do empréstimo localmente após pagamento
  const atualizarSaldoLocalTodos = useCallback(async (emprestimoId: string) => {
    if (!emprestimoId) return;
    const { data } = await supabase
      .from('emprestimos')
      .select('id, valor_saldo, status')
      .eq('id', emprestimoId)
      .single();
    if (!data) return;
    const novoSaldo = data.valor_saldo ?? 0;
    const novoStatus = data.status;
    setTodosList(prev => prev.map(c => ({
      ...c,
      emprestimos: c.emprestimos.map(e =>
        e.id === emprestimoId
          ? { ...e, saldo_emprestimo: novoSaldo, status: novoStatus }
          : e
      ),
    })));
  }, []);

  return {
    todosList,
    setTodosList,
    loadTodos,
    todosCount,
    loadTodosClientes,
    atualizarSaldoLocalTodos,
  };
}