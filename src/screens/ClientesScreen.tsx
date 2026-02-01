import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Linking, Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

type Language = 'pt-BR' | 'es';
type TabAtiva = 'liquidacao' | 'todos';
type FiltroLiquidacao = 'todos' | 'atrasados';
type OrdenacaoLiquidacao = 'rota' | 'nome';

interface ClienteRotaDia {
  cliente_id: string; consecutivo: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null;
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  numero_parcelas: number; status_emprestimo: string; rota_id: string;
  frequencia_pagamento: string; parcela_id: string; numero_parcela: number;
  valor_parcela: number; valor_pago_parcela: number; saldo_parcela: number;
  status_parcela: string; data_vencimento: string; ordem_visita_dia: number | null;
  liquidacao_id: string | null; tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  permite_emprestimo_adicional: boolean; is_parcela_atrasada?: boolean;
}

interface EmprestimoData {
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  numero_parcelas: number; status_emprestimo: string; frequencia_pagamento: string;
  parcela_id: string; numero_parcela: number; valor_parcela: number;
  valor_pago_parcela: number; saldo_parcela: number; status_parcela: string;
  data_vencimento: string; ordem_visita_dia: number | null;
  tem_parcelas_vencidas: boolean; total_parcelas_vencidas: number;
  valor_total_vencido: number; status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  is_parcela_atrasada?: boolean;
  pagamento_info?: { valorPago: number; creditoGerado: number; valorParcela: number };
}

interface ClienteAgrupado {
  cliente_id: string; consecutivo: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null; rota_id: string;
  emprestimos: EmprestimoData[]; qtd_emprestimos: number; tem_multiplos_vencimentos: boolean;
}

interface ClienteTodos {
  id: string; consecutivo: number | null; nome: string;
  telefone_celular: string | null; status: string; tem_atraso?: boolean;
}

interface PagamentoParcela {
  parcela_id: string; cliente_id: string; valor_pago_atual: number;
  valor_credito_gerado: number; valor_parcela: number; data_pagamento: string;
}

// ── i18n ──
const textos = {
  'pt-BR': {
    titulo: 'Meus Clientes', hoje: 'Hoje', clientes: 'clientes',
    liquidacao: 'Liquidação', todosList: 'Todos', buscar: 'Buscar...',
    ordemRota: 'Ordem rota', ordemNome: 'Nome A-Z',
    filtroTodos: 'Todos', filtroAtrasados: 'Atrasados', filtroPagas: 'Pagas',
    parcela: 'Parcela', saldoEmprestimo: 'Saldo Empréstimo',
    parcelasVencidas: 'parcela(s) vencida(s)', totalAtraso: 'Total em atraso:',
    emprestimo: 'Empréstimo', principal: 'Principal', juros: 'Juros',
    total: 'Total', jaPago: 'Já Pago', saldo: 'Saldo', parcelas: 'Parcelas',
    progresso: 'Progresso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Parcelas', contato: 'Contato', ir: 'IR',
    semClientes: 'Nenhum cliente encontrado', carregando: 'Carregando clientes...',
    statusAtraso: 'Atraso', statusInativo: 'Inativo',
    tipoFiltro: 'Tipo:...', statusFiltro: 'Status:...',
    pago: 'Pago:', original: 'Original:', credito: 'Crédito:',
  },
  'es': {
    titulo: 'Mis Clientes', hoje: 'Hoy', clientes: 'clientes',
    liquidacao: 'Liquidación', todosList: 'Todos', buscar: 'Buscar...',
    ordemRota: 'Orden ruta', ordemNome: 'Nombre A-Z',
    filtroTodos: 'Todos', filtroAtrasados: 'Atrasados', filtroPagas: 'Pagados',
    parcela: 'Cuota', saldoEmprestimo: 'Saldo Préstamo',
    parcelasVencidas: 'cuota(s) vencida(s)', totalAtraso: 'Total en atraso:',
    emprestimo: 'Préstamo', principal: 'Principal', juros: 'Intereses',
    total: 'Total', jaPago: 'Ya Pagó', saldo: 'Saldo', parcelas: 'Cuotas',
    progresso: 'Progreso', restantes: 'restante(s)',
    pagar: 'Pagar', verParcelas: 'Cuotas', contato: 'Contacto', ir: 'IR',
    semClientes: 'Ningún cliente encontrado', carregando: 'Cargando clientes...',
    statusAtraso: 'Atraso', statusInativo: 'Inactivo',
    tipoFiltro: 'Tipo:...', statusFiltro: 'Estado:...',
    pago: 'Pagado:', original: 'Original:', credito: 'Crédito:',
  }
};

// ── Helpers ──
const fmt = (v: number | null | undefined) => {
  if (v == null) return '$ 0,00';
  return `$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getIni = (nome: string) => {
  if (!nome) return '??';
  const p = nome.trim().split(/\s+/);
  return p.length === 1 ? p[0].substring(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const fmtTel = (tel: string | null) => {
  if (!tel) return '';
  const n = tel.replace(/\D/g, '');
  if (n.length === 13 && n.startsWith('55')) return `(${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return tel;
};

const FREQ: Record<string, string> = { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' };

const borderOf = (e: EmprestimoData, paga: boolean) => {
  if (paga) return '#10B981';
  if (e.is_parcela_atrasada) return '#EF4444';
  return ({ PAGO: '#10B981', EM_ATRASO: '#EF4444', PARCIAL: '#F59E0B', PENDENTE: '#D1D5DB' } as any)[e.status_dia] || '#D1D5DB';
};

const bgOf = (_e: EmprestimoData, paga: boolean) => paga ? 'rgba(16,185,129,0.07)' : '#fff';

const isPaga = (pid: string, sd: string, set: Set<string>) => set.has(pid) || sd === 'PAGO';

// ── Component ──
export default function ClientesScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();
  const rotaId = route?.params?.rotaId || vendedor?.rota_id;
  const dataLiq = route?.params?.dataLiquidacao || new Date().toISOString().split('T')[0];
  const liqId = route?.params?.liquidacaoId;
  const isViz = route?.params?.isVisualizacao || false;

  const [lang] = useState<Language>('pt-BR');
  const [tab, setTab] = useState<TabAtiva>('liquidacao');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  const [raw, setRaw] = useState<ClienteRotaDia[]>([]);
  const [pagasSet, setPagasSet] = useState<Set<string>>(new Set());
  const [pagMap, setPagMap] = useState<Map<string, PagamentoParcela>>(new Map());
  const [mostrarPagas, setMostrarPagas] = useState(false);
  const [filtro, setFiltro] = useState<FiltroLiquidacao>('todos');
  const [ord, setOrd] = useState<OrdenacaoLiquidacao>('rota');
  const [showOrd, setShowOrd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [empIdxMap, setEmpIdxMap] = useState<Record<string, number>>({});

  const [todosList, setTodosList] = useState<ClienteTodos[]>([]);
  const [loadTodos, setLoadTodos] = useState(false);

  const t = textos[lang];

  // ── Load ──
  const loadLiq = useCallback(async () => {
    if (!rotaId || !dataLiq) return;
    try {
      const [{ data: d1, error: e1 }, { data: d2, error: e2 }] = await Promise.all([
        supabase.from('vw_clientes_rota_dia').select('*').eq('rota_id', rotaId).eq('data_vencimento', dataLiq).order('ordem_visita_dia', { ascending: true, nullsFirst: false }),
        supabase.from('pagamentos_parcelas').select('parcela_id, cliente_id, valor_pago_atual, valor_credito_gerado, valor_parcela, data_pagamento').eq('rota_id', rotaId).eq('estornado', false).gte('data_pagamento', dataLiq),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const ps = new Set<string>();
      const pm = new Map<string, PagamentoParcela>();
      (d2 || []).forEach((p: PagamentoParcela) => { ps.add(p.parcela_id); pm.set(p.parcela_id, p); });
      setRaw(d1 || []);
      setPagasSet(ps);
      setPagMap(pm);
    } catch (err) { console.error('Erro load liq:', err); }
  }, [rotaId, dataLiq]);

  const loadTodosF = useCallback(async () => {
    if (!rotaId) return;
    setLoadTodos(true);
    try {
      // 1. Buscar IDs dos clientes da rota
      const { data: rcData, error: rcErr } = await supabase
        .from('rota_clientes')
        .select('cliente_id')
        .eq('rota_id', rotaId)
        .eq('status', 'ATIVO');
      if (rcErr) throw rcErr;
      const ids = (rcData || []).map((r: any) => r.cliente_id);
      if (ids.length === 0) { setTodosList([]); return; }

      // 2. Buscar dados dos clientes
      const { data: cliData, error: cliErr } = await supabase
        .from('clientes')
        .select('id, consecutivo, nome, telefone_celular, status')
        .in('id', ids);
      if (cliErr) throw cliErr;

      // 3. Verificar quais têm empréstimo VENCIDO
      let vencSet = new Set<string>();
      const { data: ve } = await supabase
        .from('emprestimos')
        .select('cliente_id')
        .eq('rota_id', rotaId)
        .eq('status', 'VENCIDO')
        .in('cliente_id', ids);
      (ve || []).forEach((e: any) => vencSet.add(e.cliente_id));

      setTodosList(
        (cliData || []).map((c: any) => ({
          id: c.id, consecutivo: c.consecutivo, nome: c.nome,
          telefone_celular: c.telefone_celular, status: c.status,
          tem_atraso: vencSet.has(c.id),
        })).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
      );
    } catch (err) { console.error('Erro load todos:', err); }
    finally { setLoadTodos(false); }
  }, [rotaId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadLiq(), loadTodosF()]);
    setLoading(false);
  }, [loadLiq, loadTodosF]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  }, [loadAll]);

  // ── Agrupamento ──
  const grouped = useMemo((): ClienteAgrupado[] => {
    const m = new Map<string, ClienteAgrupado>();
    raw.forEach(r => {
      let g = m.get(r.cliente_id);
      if (!g) {
        g = {
          cliente_id: r.cliente_id, consecutivo: r.consecutivo, nome: r.nome,
          telefone_celular: r.telefone_celular, endereco: r.endereco,
          latitude: r.latitude, longitude: r.longitude, rota_id: r.rota_id,
          emprestimos: [], qtd_emprestimos: 0, tem_multiplos_vencimentos: false,
        };
        m.set(r.cliente_id, g);
      }
      if (!g.emprestimos.some(e => e.parcela_id === r.parcela_id)) {
        const pi = pagMap.get(r.parcela_id);
        g.emprestimos.push({
          emprestimo_id: r.emprestimo_id, saldo_emprestimo: r.saldo_emprestimo,
          valor_principal: r.valor_principal, numero_parcelas: r.numero_parcelas,
          status_emprestimo: r.status_emprestimo, frequencia_pagamento: r.frequencia_pagamento,
          parcela_id: r.parcela_id, numero_parcela: r.numero_parcela,
          valor_parcela: r.valor_parcela, valor_pago_parcela: r.valor_pago_parcela,
          saldo_parcela: r.saldo_parcela, status_parcela: r.status_parcela,
          data_vencimento: r.data_vencimento, ordem_visita_dia: r.ordem_visita_dia,
          tem_parcelas_vencidas: r.tem_parcelas_vencidas,
          total_parcelas_vencidas: r.total_parcelas_vencidas,
          valor_total_vencido: r.valor_total_vencido,
          status_dia: r.status_dia, is_parcela_atrasada: r.is_parcela_atrasada,
          pagamento_info: pi ? { valorPago: pi.valor_pago_atual, creditoGerado: pi.valor_credito_gerado, valorParcela: pi.valor_parcela } : undefined,
        });
      }
    });
    m.forEach(g => { g.qtd_emprestimos = g.emprestimos.length; g.tem_multiplos_vencimentos = g.emprestimos.length > 1; });
    return Array.from(m.values());
  }, [raw, pagMap]);

  const isCliPago = useCallback((c: ClienteAgrupado) =>
    c.emprestimos.every(e => isPaga(e.parcela_id, e.status_dia, pagasSet)), [pagasSet]);

  const filtered = useMemo(() => {
    let r = [...grouped];
    // Toggle pagas: por padrão oculta pagos
    if (!mostrarPagas) r = r.filter(c => !isCliPago(c));
    // Busca
    if (busca.trim()) {
      const b = busca.toLowerCase().trim();
      r = r.filter(c => c.nome.toLowerCase().includes(b) || (c.telefone_celular && c.telefone_celular.includes(b)) || (c.endereco && c.endereco.toLowerCase().includes(b)));
    }
    // Filtro chip
    if (filtro === 'atrasados') r = r.filter(c => c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas));
    // Ordenação
    r.sort(ord === 'rota'
      ? (a, b) => (a.emprestimos[0]?.ordem_visita_dia ?? 9999) - (b.emprestimos[0]?.ordem_visita_dia ?? 9999)
      : (a, b) => a.nome.localeCompare(b.nome));
    return r;
  }, [grouped, busca, filtro, ord, mostrarPagas, isCliPago]);

  const cntTotal = grouped.length;
  const cntAtraso = grouped.filter(c => c.emprestimos.some(e => e.status_dia === 'EM_ATRASO' || e.is_parcela_atrasada || e.tem_parcelas_vencidas)).length;
  const cntPagas = grouped.filter(c => isCliPago(c)).length;

  const eIdx = (cid: string) => empIdxMap[cid] || 0;
  const eSet = (cid: string, i: number) => setEmpIdxMap(p => ({ ...p, [cid]: i }));
  const eAtual = (c: ClienteAgrupado) => c.emprestimos[Math.min(eIdx(c.cliente_id), c.emprestimos.length - 1)];

  // ── Card Liquidação ──
  const renderCard = (c: ClienteAgrupado) => {
    const e = eAtual(c);
    const ex = expanded === c.cliente_id;
    const ei = eIdx(c.cliente_id);
    const pg = isPaga(e.parcela_id, e.status_dia, pagasSet);
    const bc = borderOf(e, pg);
    const bg = bgOf(e, pg);
    const pi = e.pagamento_info;
    const juros = e.valor_parcela * e.numero_parcelas - e.valor_principal;
    const totalE = e.valor_principal + juros;
    const pp = e.numero_parcela - 1 + (pg ? 1 : 0);
    const pr = e.numero_parcelas - pp;
    const pct = e.numero_parcelas > 0 ? Math.min(100, Math.round((pp / e.numero_parcelas) * 100)) : 0;

    return (
      <TouchableOpacity
        key={c.cliente_id} activeOpacity={0.7}
        onPress={() => setExpanded(p => p === c.cliente_id ? null : c.cliente_id)}
        style={[S.card, { borderLeftColor: bc, backgroundColor: bg }]}
      >
        {/* Header */}
        <View style={S.cardRow}>
          <View style={[S.av, { backgroundColor: bc === '#D1D5DB' ? '#3B82F6' : bc }]}>
            <Text style={S.avTx}>{getIni(c.nome)}</Text>
          </View>
          <View style={S.cardInfo}>
            <View style={S.nameRow}>
              <Text style={S.nome} numberOfLines={1}>{c.nome.toLowerCase()}</Text>
              {e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 && (
                <View style={S.bWarn}>
                  <Text style={S.bWarnI}>⚠</Text>
                  <Text style={S.bWarnT}>{e.total_parcelas_vencidas}</Text>
                </View>
              )}
              {c.tem_multiplos_vencimentos && (
                <View style={S.bMul}><Text style={S.bMulT}>{c.qtd_emprestimos}</Text></View>
              )}
              <Text style={S.dots}>⋮</Text>
            </View>
            {c.telefone_celular ? <Text style={S.sub}>📞 {fmtTel(c.telefone_celular)}</Text> : null}
            {c.endereco ? <Text style={S.sub} numberOfLines={1}>📍 {c.endereco}</Text> : null}
          </View>
        </View>

        {/* Parcela + Saldo */}
        <View style={S.pRow}>
          <View>
            <View style={S.pLblR}>
              <Text style={S.pLbl}>{t.parcela} {e.numero_parcela}/{e.numero_parcelas}</Text>
              <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[e.frequencia_pagamento] || e.frequencia_pagamento}</Text></View>
            </View>
            {pg && pi ? (
              <>
                <Text style={S.pgVal}>{t.pago} {fmt(pi.valorPago)}</Text>
                <Text style={S.pgOrig}>{t.original} {fmt(pi.valorParcela)}</Text>
                {pi.creditoGerado > 0 && <Text style={S.pgCred}>{t.credito} {fmt(pi.creditoGerado)}</Text>}
              </>
            ) : (
              <Text style={S.pVal}>{fmt(e.valor_parcela)}</Text>
            )}
          </View>
          <View style={S.sCol}>
            <Text style={S.sLbl}>{t.saldoEmprestimo}</Text>
            <Text style={S.sVal}>{fmt(e.saldo_emprestimo)}</Text>
          </View>
        </View>

        {/* Expanded */}
        {ex && (
          <View style={S.exp}>
            {e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 && (
              <View style={S.aR}>
                <Text style={S.aRT}>⚠ {e.total_parcelas_vencidas} {t.parcelasVencidas}</Text>
                <Text style={S.aRS}>{t.totalAtraso} {fmt(e.valor_total_vencido)}</Text>
              </View>
            )}
            {e.status_parcela === 'PARCIAL' && !pg && (
              <View style={S.aY}>
                <Text style={S.aYT}>Parcial: {fmt(e.valor_pago_parcela)} / {fmt(e.valor_parcela)}</Text>
                <Text style={S.aYS}>Restante: {fmt(e.saldo_parcela)}</Text>
              </View>
            )}
            {c.tem_multiplos_vencimentos && (
              <View style={S.eNav}>
                <TouchableOpacity onPress={() => eSet(c.cliente_id, Math.max(0, ei - 1))} disabled={ei === 0} style={[S.eNBtn, ei === 0 && S.eNOff]}><Text style={S.eNBTx}>◀</Text></TouchableOpacity>
                {c.emprestimos.map((_, i) => <View key={i} style={[S.eDot, i === ei && S.eDotOn]} />)}
                <TouchableOpacity onPress={() => eSet(c.cliente_id, Math.min(c.emprestimos.length - 1, ei + 1))} disabled={ei >= c.emprestimos.length - 1} style={[S.eNBtn, ei >= c.emprestimos.length - 1 && S.eNOff]}><Text style={S.eNBTx}>▶</Text></TouchableOpacity>
                <Text style={S.eNLbl}> {t.emprestimo} {ei + 1}/{c.qtd_emprestimos}</Text>
              </View>
            )}
            <View style={S.res}>
              <View style={S.resH}>
                <Text style={S.resT}>{t.emprestimo} {ei + 1}/{c.qtd_emprestimos}</Text>
                <View style={[S.stB, { backgroundColor: e.status_dia === 'EM_ATRASO' ? '#FEE2E2' : pg ? '#D1FAE5' : '#F3F4F6' }]}>
                  <Text style={[S.stBT, { color: e.status_dia === 'EM_ATRASO' ? '#DC2626' : pg ? '#059669' : '#6B7280' }]}>{pg ? 'PAGO' : e.status_dia}</Text>
                </View>
              </View>
              <View style={S.g3}>
                <View style={S.gi}><Text style={S.gl}>{t.principal}</Text><Text style={S.gv}>{fmt(e.valor_principal)}</Text></View>
                <View style={S.gi}><Text style={S.gl}>{t.juros}</Text><Text style={[S.gv, { color: '#F59E0B' }]}>{fmt(juros)}</Text></View>
                <View style={S.gi}><Text style={S.gl}>{t.total}</Text><Text style={S.gv}>{fmt(totalE)}</Text></View>
              </View>
              <View style={S.g3}>
                <View style={S.gi}><Text style={S.gl}>{t.jaPago}</Text><Text style={[S.gv, { color: '#10B981' }]}>{fmt(totalE - e.saldo_emprestimo)}</Text></View>
                <View style={S.gi}><Text style={S.gl}>{t.saldo}</Text><Text style={[S.gv, { color: '#EF4444' }]}>{fmt(e.saldo_emprestimo)}</Text></View>
                <View style={S.gi}><Text style={S.gl}>{t.parcelas}</Text><Text style={S.gv}>{pp}/{e.numero_parcelas}</Text></View>
              </View>
              <Text style={S.prL}>{t.progresso}</Text>
              <View style={S.prB}><View style={[S.prF, { width: `${pct}%` }]} /></View>
              <Text style={S.prR}>{pr} {t.restantes}</Text>
            </View>
            <View style={S.btR}>
              <TouchableOpacity style={[S.bt, S.btG, (isViz || pg) && S.btOff]} onPress={() => { if (!isViz) navigation.navigate('Pagamento', { clienteId: c.cliente_id, clienteNome: c.nome, parcelaId: e.parcela_id, emprestimoId: e.emprestimo_id, valorParcela: e.valor_parcela, saldoParcela: e.saldo_parcela, numeroParcela: e.numero_parcela, totalParcelas: e.numero_parcelas, liquidacaoId: liqId, rotaId }); }} disabled={isViz || pg}>
                <Text style={S.btI}>💰</Text><Text style={S.btW}>{t.pagar}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.bt, S.btBl]} onPress={() => navigation.navigate('Parcelas', { emprestimoId: e.emprestimo_id })}>
                <Text style={S.btI}>👁</Text><Text style={S.btW}>{t.verParcelas}</Text>
              </TouchableOpacity>
            </View>
            <View style={S.btR}>
              <TouchableOpacity style={[S.bt, S.btOG]} onPress={() => c.telefone_celular && Linking.openURL(`tel:${c.telefone_celular.replace(/\D/g, '')}`)} disabled={!c.telefone_celular}>
                <Text style={S.btI}>📱</Text><Text style={S.btTG}>{t.contato}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.bt, S.btOB]} onPress={() => { if (c.latitude && c.longitude) Linking.openURL(Platform.OS === 'ios' ? `maps:?daddr=${c.latitude},${c.longitude}` : `google.navigation:q=${c.latitude},${c.longitude}`); }} disabled={!c.latitude}>
                <Text style={S.btI}>🧭</Text><Text style={S.btTB}>{t.ir}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Todos ──
  const todosFilt = useMemo(() => {
    if (!busca.trim()) return todosList;
    const b = busca.toLowerCase().trim();
    return todosList.filter(c => c.nome.toLowerCase().includes(b) || (c.telefone_celular && c.telefone_celular.includes(b)));
  }, [todosList, busca]);

  const renderTodos = (c: ClienteTodos) => {
    const a = c.tem_atraso;
    const inativo = c.status !== 'ATIVO';
    const cor = a ? '#EF4444' : inativo ? '#9CA3AF' : '#3B82F6';
    return (
      <TouchableOpacity key={c.id} activeOpacity={0.7} style={[S.tC, { borderLeftColor: cor }]}>
        <View style={[S.tAv, { backgroundColor: cor }]}>
          <Text style={S.tAvT}>{getIni(c.nome)}</Text>
        </View>
        <Text style={S.tNm} numberOfLines={1}>{c.nome.toLowerCase()}</Text>
        {(a || inativo) && <Text style={[S.tSt, { color: cor }]}>{a ? t.statusAtraso : t.statusInativo}</Text>}
      </TouchableOpacity>
    );
  };

  // ── Main render ──
  if (loading) return (
    <View style={S.lW}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={S.lT}>{t.carregando}</Text>
    </View>
  );

  return (
    <View style={S.c}>
      {/* Header */}
      <View style={S.hd}>
        <View>
          <Text style={S.hdT}>{t.titulo}</Text>
          <Text style={S.hdS}>{t.hoje} - {tab === 'liquidacao' ? filtered.length : todosList.length} {t.clientes}</Text>
        </View>
        <View style={S.hdR}>
          <View style={S.hdDot} />
          <Text style={S.hdI}>🔔</Text>
          <Text style={S.hdI}>⚙️</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        <TouchableOpacity style={[S.tb, tab === 'liquidacao' && S.tbOn]} onPress={() => setTab('liquidacao')}>
          <Text style={S.tbI}>📅</Text>
          <Text style={[S.tbTx, tab === 'liquidacao' && S.tbTxOn]}>{t.liquidacao} ({cntTotal})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tb, tab === 'todos' && S.tbOn]} onPress={() => setTab('todos')}>
          <Text style={S.tbI}>👥</Text>
          <Text style={[S.tbTx, tab === 'todos' && S.tbTxOn]}>{t.todosList} ({todosList.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Search + Sort */}
      <View style={S.srR}>
        <View style={S.srB}>
          <Text style={S.srI}>🔍</Text>
          <TextInput style={S.srIn} placeholder={t.buscar} placeholderTextColor="#9CA3AF" value={busca} onChangeText={setBusca} />
        </View>
        {tab === 'liquidacao' && (
          <TouchableOpacity style={S.orB} onPress={() => setShowOrd(!showOrd)}>
            <Text style={S.orI}>↕️</Text>
            <Text style={S.orTx}>{ord === 'rota' ? t.ordemRota : t.ordemNome}</Text>
            <Text style={S.orCh}>▼</Text>
          </TouchableOpacity>
        )}
      </View>

      {showOrd && tab === 'liquidacao' && (
        <View style={S.orDr}>
          {(['rota', 'nome'] as OrdenacaoLiquidacao[]).map(o => (
            <TouchableOpacity key={o} style={[S.orOp, ord === o && S.orOpOn]} onPress={() => { setOrd(o); setShowOrd(false); }}>
              <Text style={[S.orOpTx, ord === o && S.orOpTxOn]}>{o === 'rota' ? t.ordemRota : t.ordemNome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Chips — Liquidação */}
      {tab === 'liquidacao' && (
        <View style={S.chs}>
          <TouchableOpacity style={[S.ch, filtro === 'todos' && S.chOn]} onPress={() => setFiltro('todos')}>
            <Text style={[S.chTx, filtro === 'todos' && S.chTxOn]}>{t.filtroTodos} {filtered.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.ch, filtro === 'atrasados' && S.chOn]} onPress={() => setFiltro('atrasados')}>
            <Text style={[S.chTx, filtro === 'atrasados' && S.chTxOn]}>{t.filtroAtrasados} {cntAtraso}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.ch, mostrarPagas ? S.chPOn : S.chPOff]} onPress={() => setMostrarPagas(!mostrarPagas)}>
            <Text style={[S.chTx, mostrarPagas ? S.chPTxOn : S.chPTxOff]}>{t.filtroPagas} {cntPagas}</Text>
          </TouchableOpacity>
          <Text style={S.chCh}>▼</Text>
        </View>
      )}

      {/* Filtros Todos */}
      {tab === 'todos' && (
        <View style={S.tF}>
          <TouchableOpacity style={S.tFB}><Text style={S.tFBT}>{t.tipoFiltro}</Text><Text style={S.tFC}>▼</Text></TouchableOpacity>
          <TouchableOpacity style={S.tFB}><Text style={S.tFBT}>{t.statusFiltro}</Text><Text style={S.tFC}>▼</Text></TouchableOpacity>
          <Text style={S.tCnt}>{todosFilt.length} {t.clientes}</Text>
          <Text style={S.tChv}>▼</Text>
        </View>
      )}

      {/* List */}
      <ScrollView style={S.ls} contentContainerStyle={S.lsI} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        {tab === 'liquidacao' ? (
          filtered.length === 0
            ? <View style={S.em}><Text style={S.emI}>📋</Text><Text style={S.emT}>{t.semClientes}</Text></View>
            : filtered.map(renderCard)
        ) : (
          loadTodos
            ? <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            : todosFilt.length === 0
              ? <View style={S.em}><Text style={S.emI}>📋</Text><Text style={S.emT}>{t.semClientes}</Text></View>
              : todosFilt.map(renderTodos)
        )}
        <View style={{ height: 90 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──
const S = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#EEF2FF' },
  lW: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  lT: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  hd: { backgroundColor: '#3B82F6', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hdT: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hdS: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  hdR: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hdDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  hdI: { fontSize: 18 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: '#E8EBF7', borderRadius: 12, padding: 3 },
  tb: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, gap: 5 },
  tbOn: { backgroundColor: '#3B82F6' },
  tbI: { fontSize: 13 },
  tbTx: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tbTxOn: { color: '#fff' },
  srR: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, gap: 8 },
  srB: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: '#E5E7EB' },
  srI: { fontSize: 13, marginRight: 6, opacity: 0.5 },
  srIn: { flex: 1, fontSize: 13, color: '#1F2937', padding: 0 },
  orB: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  orI: { fontSize: 11 },
  orTx: { fontSize: 12, color: '#6B7280' },
  orCh: { fontSize: 8, color: '#9CA3AF' },
  orDr: { position: 'absolute', top: 175, right: 16, zIndex: 100, backgroundColor: '#fff', borderRadius: 10, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  orOp: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  orOpOn: { backgroundColor: '#EFF6FF' },
  orOpTx: { fontSize: 13, color: '#6B7280' },
  orOpTxOn: { color: '#3B82F6', fontWeight: '600' },
  chs: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8 },
  ch: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chOn: { backgroundColor: '#1F2937', borderColor: '#1F2937' },
  chTx: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  chTxOn: { color: '#fff' },
  chPOn: { backgroundColor: '#059669', borderColor: '#059669' },
  chPOff: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  chPTxOn: { color: '#fff' },
  chPTxOff: { color: '#6B7280' },
  chCh: { fontSize: 10, color: '#9CA3AF' },
  tF: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, gap: 8 },
  tFB: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', gap: 4 },
  tFBT: { fontSize: 12, color: '#6B7280' },
  tFC: { fontSize: 8, color: '#9CA3AF' },
  tCnt: { flex: 1, textAlign: 'right', fontSize: 12, color: '#6B7280' },
  tChv: { fontSize: 10, color: '#9CA3AF' },
  ls: { flex: 1, marginTop: 10 },
  lsI: { paddingHorizontal: 16 },
  em: { alignItems: 'center', paddingTop: 60 },
  emI: { fontSize: 48, marginBottom: 12 },
  emT: { fontSize: 14, color: '#9CA3AF' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avTx: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nome: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  bWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, marginLeft: 4, borderWidth: 1, borderColor: '#FECACA' },
  bWarnI: { fontSize: 10, color: '#F59E0B', marginRight: 2 },
  bWarnT: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  bMul: { backgroundColor: '#FED7AA', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, marginLeft: 3 },
  bMulT: { fontSize: 10, fontWeight: '700', color: '#C2410C' },
  dots: { fontSize: 18, color: '#9CA3AF', marginLeft: 4, fontWeight: '700' },
  sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pLblR: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  pLbl: { fontSize: 11, color: '#6B7280' },
  fBdg: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  fBdgT: { fontSize: 9, fontWeight: '600', color: '#7C3AED' },
  pVal: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  sCol: { alignItems: 'flex-end' },
  sLbl: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  sVal: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  pgVal: { fontSize: 14, fontWeight: '700', color: '#059669' },
  pgOrig: { fontSize: 10, color: '#9CA3AF' },
  pgCred: { fontSize: 10, color: '#2563EB' },
  exp: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  aR: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 10, marginBottom: 10 },
  aRT: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  aRS: { fontSize: 11, color: '#B91C1C', marginTop: 2 },
  aY: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginBottom: 10 },
  aYT: { fontSize: 12, fontWeight: '600', color: '#D97706' },
  aYS: { fontSize: 11, color: '#B45309', marginTop: 2 },
  eNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 6 },
  eNBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  eNOff: { opacity: 0.3 },
  eNBTx: { fontSize: 11, color: '#6B7280' },
  eDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' },
  eDotOn: { backgroundColor: '#3B82F6' },
  eNLbl: { fontSize: 10, color: '#6B7280' },
  res: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  resH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resT: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  stB: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stBT: { fontSize: 9, fontWeight: '700' },
  g3: { flexDirection: 'row', marginBottom: 6 },
  gi: { flex: 1 },
  gl: { fontSize: 9, color: '#9CA3AF', marginBottom: 1 },
  gv: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  prL: { fontSize: 9, color: '#9CA3AF', marginTop: 4, marginBottom: 3 },
  prB: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  prF: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  prR: { fontSize: 9, color: '#9CA3AF', marginTop: 2, textAlign: 'right' },
  btR: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 10, gap: 5 },
  btG: { backgroundColor: '#10B981' },
  btBl: { backgroundColor: '#3B82F6' },
  btOG: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  btOB: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  btOff: { opacity: 0.4 },
  btI: { fontSize: 13 },
  btW: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btTG: { color: '#059669', fontSize: 12, fontWeight: '600' },
  btTB: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  tC: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  tAv: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  tAvT: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tNm: { flex: 1, fontSize: 13, fontWeight: '500', color: '#1F2937' },
  tSt: { fontSize: 11, fontWeight: '500', marginLeft: 8 },
});
