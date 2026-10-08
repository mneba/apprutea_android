import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmprestimoTodos {
  id: string; valor_principal: number; valor_total?: number; saldo_emprestimo: number;
  valor_parcela: number; numero_parcelas: number; numero_parcela_atual: number;
  status: string; frequencia_pagamento: string; tipo_emprestimo: string;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  /** Vencimento da parcela em aberto mais antiga — base dos dias de atraso. */
  data_vencimento_mais_antiga?: string | null;
  data_emprestimo?: string;
}

export interface ClienteTodos {
  id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; foto_url: string | null;
  status: string; tem_atraso: boolean;
  permite_renegociacao: boolean; permite_emprestimo_adicional: boolean;
  cliente_created_at?: string;
  emprestimos: EmprestimoTodos[];
}

// ─── Helper ─────────────────────────────────────────────────────────────────

// O `buscarCreditoMap` que existia aqui foi absorvido pela consulta das
// parcelas: ele varria a MESMA tabela com o MESMO filtro `.in(empIds)`, só
// trocando a coluna lida. Numa rota com 300 empréstimos de 20 parcelas eram
// duas varreduras de seis mil linhas onde bastava uma — e a segunda ainda
// esperava a primeira terminar.
//
// Agora `saldo_excedente` vem junto e o mapa de crédito é montado na mesma
// passagem. A cópia em ClientesScreen.tsx continua existindo e serve a outro
// caminho.

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseClientesTodosParams {
  rotaId: string | null | undefined;
  /** @deprecated Não é lido. A carga é feita na montagem, não pela aba ativa. */
  tab?: 'liquidacao' | 'todos';
  /**
   * Data operacional (YYYY-MM-DD): a liquidação em foco, ou o hoje da rota.
   * Base para decidir o que está vencido — ver a nota na montagem do parcMap.
   */
  dataOperacional: string;
  setOrdemRotaMap: (m: Map<string, number>) => void;
  setRefreshing: (v: boolean) => void;
}

export default function useClientesTodos({ rotaId, dataOperacional, setOrdemRotaMap, setRefreshing }: UseClientesTodosParams) {
  const [todosList, setTodosList] = useState<ClienteTodos[]>([]);
  const [loadTodos, setLoadTodos] = useState(false);
  const [todosCount, setTodosCount] = useState<number | null>(null);
  // Timestamp da última carga bem-sucedida. A ClientesScreen usa isto para
  // decidir staleness DESTA aba — antes ela usava o clientesUpdatedAt da
  // liquidação, que não tem nada a ver com o ciclo de vida de "Todos".
  const [todosUpdatedAt, setTodosUpdatedAt] = useState(0);

  // ⭐ Ref espelhando o tamanho da lista — lemos sem criar dependência no useCallback
  const todosListLenRef = useRef(0);
  useEffect(() => { todosListLenRef.current = todosList.length; }, [todosList.length]);

  const loadTodosClientes = useCallback(async (forceReload = false) => {
    if (!rotaId || (!forceReload && todosListLenRef.current > 0)) { 
      setRefreshing(false); 
      return; 
    }
    setLoadTodos(true);
    try {
      // A ordem da rota não depende de nada do que vem abaixo — basta o
      // `rotaId`. Antes ela era a última da fila, esperando as três consultas
      // anteriores sem motivo. Agora sai junto com a primeira e só é colhida
      // no fim.
      //
      // O filtro `.in(clienteIds)` que existia nela foi removido: a tabela já
      // é filtrada por rota, e era esse filtro que obrigava a esperar a lista
      // de clientes ficar pronta.
      const promessaOrdem = supabase
        .from('ordem_rota_cliente')
        .select('cliente_id, ordem')
        .eq('rota_id', rotaId);

      // Query 1: Todos os empréstimos da rota com dados do cliente
      const { data: emps } = await supabase
        .from('emprestimos')
        .select(`id, valor_principal, valor_total, valor_saldo, valor_parcela, numero_parcelas, status, frequencia_pagamento, tipo_emprestimo, data_emprestimo, clientes!inner(id, nome, foto_url, telefone_celular, status, codigo_cliente, permite_renegociacao, permite_emprestimo_adicional, created_at)`)
        .eq('rota_id', rotaId)
        .in('status', ['ATIVO', 'VENCIDO', 'QUITADO', 'RENEGOCIADO']);

      if (!emps || emps.length === 0) { setTodosList([]); setTodosUpdatedAt(Date.now()); return; }

      // Query 2: as parcelas — mas SÓ dos empréstimos em aberto.
      //
      // Medido em 07/10/2026: de 63% a 78% das parcelas que esta tela baixava
      // eram de empréstimo `QUITADO` ou `RENEGOCIADO`. Na Madrid, 2.186 de
      // 2.850 linhas. A consulta levava 1 segundo em média e era a mais lenta
      // do sistema.
      //
      // E não perdemos nada: de empréstimo encerrado não há parcela vencida
      // nem vencimento em aberto, e a parcela atual é a última. Os três saíam
      // dos dados que o próprio empréstimo já traz — ver o `info` sintetizado
      // mais abaixo.
      const empIdsAbertos = (emps as any[])
        .filter(e => e.status === 'ATIVO' || e.status === 'VENCIDO')
        .map(e => e.id);

      const { data: allParcs } = empIdsAbertos.length > 0
        ? await supabase
            .from('emprestimo_parcelas')
            .select('emprestimo_id, numero_parcela, valor_parcela, status, data_vencimento, saldo_excedente')
            .in('emprestimo_id', empIdsAbertos)
        : { data: [] as any[] };

      // Agrupa parcelas por empréstimo
      //
      // ⭐ VENCIDA é decidido pela DATA OPERACIONAL, não pelo `status`.
      //
      // O status é gravado pelo trigger atualizar_saldo_parcela comparando com
      // CURRENT_DATE — o relógio real. Operando uma liquidação retroativa isso
      // mente: cliente cadastrada em 22/08, parcelas de 24 a 29/08, aparecia
      // com 5 vencidas enquanto se trabalhava o dia 25/08, sendo que quatro
      // delas nem tinham chegado ao vencimento.
      //
      // `<` e não `<=`: parcela que vence no próprio dia ainda está no prazo.
      //
      // `vencimentoMaisAntigo` é a parcela em aberto mais velha. É dela que sai o
      // atraso em DIAS, que agora manda na cor do card — antes a cor vinha da
      // CONTAGEM de vencidas, e por isso três parcelas pintavam igual sendo três
      // dias no diário e três meses no mensal. O cálculo em si fica em
      // src/utils/diasCobranca.ts, onde domingo e feriado são descontados; aqui
      // só escolhemos a data.
      const parcMap = new Map<string, {
        maxParcela: number; vencidas: number; totalVencido: number;
        vencimentoMaisAntigo: string | null;
      }>();
      // Montado na mesma passagem das parcelas — ver o comentário no topo.
      const creditoMapTodos = new Map<string, number>();
      (allParcs || []).forEach((p: any) => {
        const excedente = parseFloat(p.saldo_excedente || 0);
        if (excedente > 0) {
          creditoMapTodos.set(p.emprestimo_id,
            (creditoMapTodos.get(p.emprestimo_id) || 0) + excedente);
        }
        let info = parcMap.get(p.emprestimo_id);
        if (!info) {
          info = { maxParcela: 0, vencidas: 0, totalVencido: 0, vencimentoMaisAntigo: null };
          parcMap.set(p.emprestimo_id, info);
        }
        if (p.numero_parcela > info.maxParcela) info.maxParcela = p.numero_parcela;
        const emAberto = p.status !== 'PAGO' && p.status !== 'CANCELADO';
        const venc = p.data_vencimento ? String(p.data_vencimento).substring(0, 10) : null;
        const venceu = !!venc && venc < dataOperacional;
        if (emAberto && venc && (!info.vencimentoMaisAntigo || venc < info.vencimentoMaisAntigo)) {
          info.vencimentoMaisAntigo = venc;
        }
        if (emAberto && venceu) {
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
            foto_url: c.foto_url ?? null,
            status: c.status,
            tem_atraso: false,
            permite_renegociacao: c.permite_renegociacao || false,
            permite_emprestimo_adicional: c.permite_emprestimo_adicional || false,
            cliente_created_at: c.created_at || null,
            emprestimos: [],
          };
          cliMap.set(c.id, cli);
        }
        // Empréstimo encerrado não teve as parcelas baixadas (ver a Query 2), e
        // os números dele são conhecidos sem elas: tudo pago, nada vencido, e
        // a parcela atual é a última. Não é aproximação — é o que as parcelas
        // diriam.
        const encerrado = e.status === 'QUITADO' || e.status === 'RENEGOCIADO';
        const info = parcMap.get(e.id) || {
          maxParcela: encerrado ? (e.numero_parcelas || 1) : 1,
          vencidas: 0,
          totalVencido: 0,
          vencimentoMaisAntigo: null,
        };
        if (info.vencidas > 0) cli.tem_atraso = true;
        cli.emprestimos.push({
          id: e.id,
          valor_principal: e.valor_principal,
          valor_total: e.valor_total,
          saldo_emprestimo: e.valor_saldo,
          valor_parcela: e.valor_parcela,
          numero_parcelas: e.numero_parcelas,
          numero_parcela_atual: info.maxParcela,
          status: e.status,
          frequencia_pagamento: e.frequencia_pagamento,
          tipo_emprestimo: (e as any).tipo_emprestimo || 'NOVO',
          total_parcelas_vencidas: info.vencidas,
          valor_total_vencido: info.totalVencido,
          data_vencimento_mais_antiga: info.vencimentoMaisAntigo,
          data_emprestimo: (e as any).data_emprestimo || null,
        });
      }

      // Descontar crédito acumulado do saldo de cada empréstimo. O mapa já veio
      // da passagem acima; antes custava uma consulta inteira a mais.
      if (creditoMapTodos.size > 0) {
        Array.from(cliMap.values()).forEach(cli => {
          cli.emprestimos.forEach(emp => {
            const credito = creditoMapTodos.get(emp.id) || 0;
            if (credito > 0) emp.saldo_emprestimo = Math.max(0, emp.saldo_emprestimo - credito);
          });
        });
      }
      setTodosList(Array.from(cliMap.values()));
      setTodosUpdatedAt(Date.now());

      // A ordem da rota, disparada lá em cima.
      const { data: ordens } = await promessaOrdem;
      if (ordens && ordens.length > 0) {
        const m = new Map<string, number>();
        (ordens as any[]).forEach(o => m.set(o.cliente_id, Number(o.ordem)));
        setOrdemRotaMap(m);
      }
    } catch (e) {
      console.error('Erro loadTodos:', e);
    } finally {
      setLoadTodos(false);
      setRefreshing(false);
    }
    // `dataOperacional` entra nas dependências: mudar de liquidação muda o
    // que conta como vencido, e sem isto o callback ficaria com a data antiga.
  }, [rotaId, dataOperacional, setOrdemRotaMap, setRefreshing]);

  // Pré-carga: carregar assim que rotaId estiver disponível (não espera tab)
  useEffect(() => {
    loadTodosClientes();
  }, [loadTodosClientes]);

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
    todosUpdatedAt,
    loadTodosClientes,
    atualizarSaldoLocalTodos,
  };
}