import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Language } from '../contexts/LiquidacaoContext';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const FREQ: Record<Language, Record<string, string>> = {
  'pt-BR': { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' },
  'es': { DIARIO: 'Diario', SEMANAL: 'Semanal', QUINZENAL: 'Quincenal', MENSAL: 'Mensual', FLEXIVEL: 'Flexible' },
};

const getIni = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
const fmt = (v: number) => '$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTel = (t: string) => t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
const fmtData = (d: string | null | undefined) => {
  if (!d) return '';
  if (d.length === 10 && d.includes('-')) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('pt-BR');
};

const corAtraso = (vencidas: number): string => {
  if (vencidas <= 0) return '#10B981';
  if (vencidas <= 3) return '#F59E0B';
  if (vencidas <= 7) return '#F97316';
  return '#EF4444';
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface ClienteCardTodosProps {
  cliente: ClienteTodos;
  emprestimo: EmprestimoTodos;
  empIdx: number;
  expanded: boolean;
  modoReordenar: boolean;
  lang: Language;
  notasCount: number;
  t: {
    parcela: string;
    saldoEmprestimo: string;
    parcelasVencidas: string;
    totalAtraso: string;
    emprestimo: string;
    toqueDetalhes: string;
  };
  onToggleExpand: () => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onChangeEmpIdx: (newIdx: number) => void;
  onAbrirParcelas: (clienteId: string, clienteNome: string, emprestimoId: string, empStatus: string) => void;
  onAbrirNotas: (clienteId: string, clienteNome: string) => void;
  onAbrirDetalhes: (cliente: { id: string; nome: string; telefone?: string | null; codigo_cliente?: string | number | null }) => void;
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function ClienteCardTodos({
  cliente: c,
  emprestimo: emp,
  empIdx: ei,
  expanded: ex,
  modoReordenar,
  lang,
  notasCount,
  t,
  onToggleExpand,
  onLongPressStart,
  onLongPressEnd,
  onChangeEmpIdx,
  onAbrirParcelas,
  onAbrirNotas,
  onAbrirDetalhes,
}: ClienteCardTodosProps) {
  const a = c.tem_atraso;
  const vencidas = emp?.total_parcelas_vencidas || 0;
  const cor = a ? corAtraso(vencidas) : '#D1D5DB';

  return (
    <TouchableOpacity
      key={c.id}
      activeOpacity={0.7}
      onPress={() => { if (!modoReordenar) onToggleExpand(); }}
      onPressIn={onLongPressStart}
      onPressOut={onLongPressEnd}
      style={[S.card, { borderLeftColor: cor }]}
    >
      {/* === LINHA 1: Avatar + Nome + Badges === */}
      <View style={S.cardRow}>
        <View style={[S.av, { backgroundColor: a ? '#EF4444' : '#64748B' }]}>
          <Text style={S.avTx}>{getIni(c.nome)}</Text>
        </View>
        <View style={S.cardInfo}>
          <View style={S.nameRow}>
            <Text style={S.nome} numberOfLines={1}>{c.nome}</Text>
            {vencidas > 0 && <View style={S.bWarnNew}><Text style={S.bWarnNewI}>⚠</Text><Text style={S.bWarnNewT}>{vencidas}</Text></View>}
          </View>
          {c.telefone_celular && <Text style={S.sub} numberOfLines={1}>📞 {fmtTel(c.telefone_celular)}</Text>}
        </View>
      </View>

      {/* === LINHA 2: Info empréstimo === */}
      {emp && (
        <View style={S.pRow}>
          <View>
            <View style={S.pLblR}>
              <Text style={S.pLbl}>{t.parcela} {emp.numero_parcela_atual}/{emp.numero_parcelas}</Text>
              <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[lang][emp.frequencia_pagamento] || emp.frequencia_pagamento}</Text></View>
            </View>
            {emp.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(emp.data_emprestimo)}</Text> : null}
          </View>
          <View style={S.sCol}>
            <Text style={S.pValBig}>{fmt(emp.valor_parcela)}</Text>
            <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(emp.saldo_emprestimo)}</Text>
          </View>
        </View>
      )}

      {/* === EXPANDIDO (1 clique) === */}
      {ex && emp && (
        <View style={S.exp}>
          {/* Alerta vencidas */}
          {emp.total_parcelas_vencidas > 0 && (
            <View style={S.aR}>
              <Text style={S.aRT}>⚠ {emp.total_parcelas_vencidas} {t.parcelasVencidas}</Text>
              <Text style={S.aRS}>{t.totalAtraso} {fmt(emp.valor_total_vencido)}</Text>
            </View>
          )}

          {/* Navegação múltiplos empréstimos */}
          {c.emprestimos.length > 1 && (
            <View style={S.eNav}>
              <TouchableOpacity
                onPress={() => onChangeEmpIdx(Math.max(0, ei - 1))}
                disabled={ei === 0}
                style={[S.eNBtn, ei === 0 && S.eNOff]}
              >
                <Text style={S.eNBTx}>◀</Text>
              </TouchableOpacity>
              {c.emprestimos.map((_, i) => <View key={i} style={[S.eDot, i === ei && S.eDotOn]} />)}
              <TouchableOpacity
                onPress={() => onChangeEmpIdx(Math.min(c.emprestimos.length - 1, ei + 1))}
                disabled={ei >= c.emprestimos.length - 1}
                style={[S.eNBtn, ei >= c.emprestimos.length - 1 && S.eNOff]}
              >
                <Text style={S.eNBTx}>▶</Text>
              </TouchableOpacity>
              <Text style={S.eNLbl}> {t.emprestimo} {ei + 1}/{c.emprestimos.length}</Text>
            </View>
          )}

          {/* Parcelas + Notas na mesma linha */}
          <View style={S.expActRow}>
            <TouchableOpacity style={S.btSecVerde} onPress={() => onAbrirParcelas(c.id, c.nome, emp.id, emp.status)}>
              <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>☰</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={S.btSecAmarelo} onPress={() => onAbrirNotas(c.id, c.nome)}>
              <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>✎</Text></View>
              {notasCount > 0 && <View style={S.btSecBadge}><Text style={S.btSecBadgeT}>{notasCount}</Text></View>}
            </TouchableOpacity>
          </View>

          {/* Link detalhes */}
          <TouchableOpacity style={S.linkDetalhes} onPress={() => {
            onAbrirDetalhes({ id: c.id, nome: c.nome, telefone: c.telefone_celular, codigo_cliente: c.codigo_cliente });
          }}>
            <Text style={S.linkDetalhesTx}>{t.toqueDetalhes} ▽</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avTx: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nome: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  bWarnNew: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 6, gap: 2 },
  bWarnNewI: { fontSize: 10, color: '#EF4444' },
  bWarnNewT: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  sub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pLblR: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  pLbl: { fontSize: 11, color: '#6B7280' },
  fBdg: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  fBdgT: { fontSize: 9, fontWeight: '600', color: '#7C3AED' },
  dataEmpLbl: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  pValBig: { fontSize: 18, fontWeight: '800', color: '#1F2937', textAlign: 'right' },
  sCol: { alignItems: 'flex-end' },
  sLbl: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  exp: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  aR: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 10, marginBottom: 10 },
  aRT: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  aRS: { fontSize: 11, color: '#B91C1C', marginTop: 2 },
  eNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 6 },
  eNBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  eNOff: { opacity: 0.3 },
  eNBTx: { fontSize: 11, color: '#6B7280' },
  eDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' },
  eDotOn: { backgroundColor: '#3B82F6' },
  eNLbl: { fontSize: 10, color: '#6B7280' },
  expActRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'center' },
  btSecVerde: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btSecAmarelo: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  btSecIconBox: { alignItems: 'center', justifyContent: 'center' },
  btSecIconTx: { fontSize: 20, color: '#FFF', fontWeight: '700' },
  btSecBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  btSecBadgeT: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  linkDetalhes: { alignItems: 'center', paddingVertical: 4 },
  linkDetalhesTx: { fontSize: 12, color: '#9CA3AF' },
});