import React, { useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Language } from '../contexts/LiquidacaoContext';

// ─── Types (re-exportados para uso externo) ────────────────────────────────

export interface EmprestimoData {
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  numero_parcelas: number; status_emprestimo: string; frequencia_pagamento: string;
  parcela_id: string; numero_parcela: number; valor_parcela: number;
  valor_pago_parcela: number; saldo_parcela: number; status_parcela: string;
  data_vencimento: string; ordem_visita_dia: number | null;
  tem_parcelas_vencidas: boolean; total_parcelas_vencidas: number;
  valor_total_vencido: number; status_dia: 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';
  is_parcela_atrasada?: boolean;
  pagamento_info?: { valorPago: number; creditoGerado: number; valorParcela: number };
  data_emprestimo?: string;
}

export interface ClienteAgrupado {
  cliente_id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null; rota_id: string;
  emprestimos: EmprestimoData[]; qtd_emprestimos: number; tem_multiplos_vencimentos: boolean;
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

const borderOf = (e: EmprestimoData, paga: boolean) => {
  if (paga) return '#10B981';
  const vencidas = e.total_parcelas_vencidas || 0;
  if (vencidas > 0) return corAtraso(vencidas);
  if (e.is_parcela_atrasada) return '#F59E0B';
  return ({ PAGO: '#10B981', EM_ATRASO: '#F59E0B', PARCIAL: '#F59E0B', PENDENTE: '#D1D5DB' } as any)[e.status_dia] || '#D1D5DB';
};

const bgOf = (_e: EmprestimoData, paga: boolean) => paga ? 'rgba(16,185,129,0.05)' : '#fff';
const isPagaFn = (pid: string, sd: string, set: Set<string>) => set.has(pid) || sd === 'PAGO';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ClienteCardLiquidacaoProps {
  cliente: ClienteAgrupado;
  emprestimo: EmprestimoData;
  expanded: boolean;
  pagasSet: Set<string>;
  naoPagosSet?: Set<string>;
  liqId: string | null;
  isViz: boolean;
  lang: Language;
  notasCount: number;
  t: {
    parcela: string;
    saldoEmprestimo: string;
    pagar: string;
    toqueDetalhes: string;
    naoPago?: string;
  };
  onToggleExpand: () => void;
  onPagar: (parcela: any, clienteInfo: any) => void;
  onAbrirParcelas: (clienteId: string, clienteNome: string, emprestimoId: string) => void;
  onAbrirNotas: (clienteId: string, clienteNome: string) => void;
  onAbrirDetalhes: (cliente: { id: string; nome: string; telefone?: string | null; endereco?: string | null; codigo_cliente?: string | number | null }) => void;
  onNaoPago?: (parcelaInfo: {
    parcela_id: string;
    numero_parcela: number;
    valor_parcela: number;
    valor_saldo: number;
    emprestimo_id: string;
  }, clienteInfo: { id: string; nome: string }) => void;
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function ClienteCardLiquidacao({
  cliente: c,
  emprestimo: e,
  expanded: ex,
  pagasSet,
  naoPagosSet,
  liqId,
  isViz,
  lang,
  notasCount,
  t,
  onToggleExpand,
  onPagar,
  onAbrirParcelas,
  onAbrirNotas,
  onAbrirDetalhes,
  onNaoPago,
}: ClienteCardLiquidacaoProps) {
  const swipeableRef = useRef<Swipeable>(null);
  
  const pg = isPagaFn(e.parcela_id, e.status_dia, pagasSet);
  const np = naoPagosSet?.has(e.parcela_id) || false;
  const bc = borderOf(e, pg);
  const bg = bgOf(e, pg);
  const pi = e.pagamento_info;
  const valorAPagar = e.valor_pago_parcela > 0 && !pg ? e.saldo_parcela : e.valor_parcela;

  // Swipe só funciona no mobile
  const isWeb = Platform.OS === 'web';
  const podeSwipe = !isWeb && !pg && !np && !!liqId && !isViz && !!onNaoPago;

  // Renderiza ação de swipe à direita (botão Não Pago)
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={S.swipeAction}>
        <TouchableOpacity
          style={S.naoPagoBtn}
          onPress={() => {
            swipeableRef.current?.close();
            if (onNaoPago) {
              onNaoPago(
                {
                  parcela_id: e.parcela_id,
                  numero_parcela: e.numero_parcela,
                  valor_parcela: e.valor_parcela,
                  valor_saldo: e.saldo_parcela || e.valor_parcela,
                  emprestimo_id: e.emprestimo_id,
                },
                { id: c.cliente_id, nome: c.nome }
              );
            }
          }}
        >
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <Text style={S.naoPagoIcon}>✗</Text>
            <Text style={S.naoPagoText}>{t.naoPago || (lang === 'es' ? 'No Pagó' : 'Não Pagou')}</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  const cardContent = (
    <TouchableOpacity
      key={c.cliente_id}
      activeOpacity={0.7}
      onPress={onToggleExpand}
      style={[
        S.card, 
        { borderLeftColor: np ? '#6B7280' : bc, backgroundColor: np ? '#F9FAFB' : bg },
      ]}
    >
      {/* Badge NÃO PAGO */}
      {np && (
        <View style={S.naoPagoBadge}>
          <Text style={S.naoPagoBadgeText}>{lang === 'es' ? '✗ NO PAGÓ' : '✗ NÃO PAGOU'}</Text>
        </View>
      )}

      {/* === LINHA 1: Avatar + Nome + Badges === */}
      <View style={S.cardRow}>
        <View style={[S.av, { backgroundColor: pg ? '#10B981' : np ? '#6B7280' : e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 ? '#EF4444' : '#3B82F6' }]}>
          <Text style={S.avTx}>{getIni(c.nome)}</Text>
        </View>
        <View style={S.cardInfo}>
          <View style={S.nameRow}>
            <Text style={[S.nome, np && { color: '#6B7280' }]} numberOfLines={1}>{c.nome}</Text>
            {e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 && (
              <View style={S.bWarnNew}><Text style={S.bWarnNewI}>⚠</Text><Text style={S.bWarnNewT}>{e.total_parcelas_vencidas}</Text></View>
            )}
          </View>
          <Text style={S.sub} numberOfLines={1}>
            {c.telefone_celular ? `📞 ${fmtTel(c.telefone_celular)}` : ''}{c.telefone_celular && c.endereco ? '  ◦  ' : ''}{c.endereco ? `📍 ${c.endereco}` : ''}
          </Text>
        </View>
      </View>

      {/* === LINHA 2: Parcela + Frequência + Valor === */}
      <View style={S.pRow}>
        <View>
          <View style={S.pLblR}>
            <Text style={S.pLbl}>{t.parcela} {e.numero_parcela}/{e.numero_parcelas}</Text>
            <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[lang][e.frequencia_pagamento] || e.frequencia_pagamento}</Text></View>
          </View>
          {e.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(e.data_emprestimo)}</Text> : null}
        </View>
        <View style={S.sCol}>
          {pg && pi ? (
            <Text style={[S.pValBig, { color: '#10B981' }]}>{fmt(pi.valorPago)}</Text>
          ) : np ? (
            <Text style={[S.pValBig, { color: '#6B7280', textDecorationLine: 'line-through' }]}>{fmt(valorAPagar)}</Text>
          ) : (
            <Text style={S.pValBig}>{fmt(valorAPagar)}</Text>
          )}
          <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(e.saldo_emprestimo)}</Text>
        </View>
      </View>

      {/* === EXPANDIDO (1 clique) === */}
      {ex && (
        <View style={S.exp}>
          {/* Pagar (flex) + Parcelas + Notas na mesma linha */}
          <View style={S.expActRow}>
            <TouchableOpacity
              style={[S.btPagarGrande, (pg || np || !liqId || isViz) && S.btPagarDisabled]}
              onPress={() => {
                if (liqId && !isViz && !pg && !np) onPagar(
                  { parcela_id: e.parcela_id, numero_parcela: e.numero_parcela, data_vencimento: e.data_vencimento, valor_parcela: e.valor_parcela, status: e.status_parcela, data_pagamento: null, valor_multa: 0, valor_pago: e.valor_pago_parcela || 0, valor_saldo: e.saldo_parcela || e.valor_parcela },
                  { id: c.cliente_id, nome: c.nome, emprestimo_id: e.emprestimo_id, saldo_emprestimo: e.saldo_emprestimo, emprestimo_status: e.status_emprestimo }
                );
              }}
              disabled={pg || np || !liqId || isViz}
            >
              <Text style={S.btPagarIcon}>$</Text>
              <Text style={S.btPagarText}>{t.pagar}</Text>
              {!pg && !np && <View style={S.btPagarValor}><Text style={S.btPagarValorText}>${Math.round(valorAPagar)}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={S.btSecVerde} onPress={() => onAbrirParcelas(c.cliente_id, c.nome, e.emprestimo_id)}>
              <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>☰</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={S.btSecAmarelo} onPress={() => onAbrirNotas(c.cliente_id, c.nome)}>
              <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>✎</Text></View>
              {notasCount > 0 && <View style={S.btSecBadge}><Text style={S.btSecBadgeT}>{notasCount}</Text></View>}
            </TouchableOpacity>
          </View>

          {/* Link para detalhes */}
          <TouchableOpacity style={S.linkDetalhes} onPress={() => {
            onAbrirDetalhes({ id: c.cliente_id, nome: c.nome, telefone: c.telefone_celular, endereco: c.endereco, codigo_cliente: c.codigo_cliente });
          }}>
            <Text style={S.linkDetalhesTx}>{t.toqueDetalhes} ▽</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  // Wrap com Swipeable apenas no mobile e se pode marcar como não pago
  if (podeSwipe) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
      >
        {cardContent}
      </Swipeable>
    );
  }

  return cardContent;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 5, elevation: 2 },
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
  expActRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'center' },
  btPagarGrande: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, gap: 8 },
  btPagarDisabled: { backgroundColor: '#D1D5DB' },
  btPagarIcon: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  btPagarText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btPagarValor: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8 },
  btPagarValorText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  btSecVerde: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btSecAmarelo: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  btSecIconBox: { alignItems: 'center', justifyContent: 'center' },
  btSecIconTx: { fontSize: 20, color: '#FFF', fontWeight: '700' },
  btSecBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  btSecBadgeT: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  linkDetalhes: { alignItems: 'center', paddingVertical: 4 },
  linkDetalhesTx: { fontSize: 12, color: '#9CA3AF' },
  // Swipe action
  swipeAction: { 
    justifyContent: 'center', 
    alignItems: 'flex-end',
    paddingRight: 4,
    marginBottom: 8,
  },
  naoPagoBtn: {
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  naoPagoIcon: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  naoPagoText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  naoPagoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#6B7280',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
  },
  naoPagoBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
});