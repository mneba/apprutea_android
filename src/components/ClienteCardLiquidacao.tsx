import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Language } from '../contexts/LiquidacaoContext';

// ─── Types (re-exportados para uso externo) ────────────────────────────────

export interface EmprestimoData {
  emprestimo_id: string; saldo_emprestimo: number; valor_principal: number;
  valor_total?: number;
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
  foto_url: string | null;
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
  // Níveis de atraso (pedido #39 do cliente): substituído o laranja (#F97316)
  // por ROXO (#9333EA) no nível médio, porque laranja e amarelo eram quase
  // indistinguíveis. Escala: verde (em dia) → amarelo (leve) → roxo (médio)
  // → vermelho (crítico).
  if (vencidas <= 0) return '#10B981';  // verde — em dia
  if (vencidas <= 3) return '#F59E0B';  // amarelo — atraso leve
  if (vencidas <= 7) return '#9333EA';  // roxo — atraso médio
  return '#EF4444';                     // vermelho — atraso crítico
};

const borderOf = (e: EmprestimoData, paga: boolean) => {
  // Regra simplificada (decisão do cliente): só existem dois mundos —
  //   sem parcela vencida não paga  → EM DIA (verde)
  //   com parcela vencida não paga  → ATRASO (amarelo/roxo/vermelho)
  // O antigo estado "pendente" (cinza) foi eliminado: um cliente cuja próxima
  // parcela ainda não venceu está EM DIA, não "pendente".
  if (paga) return '#10B981';
  const vencidas = e.total_parcelas_vencidas || 0;
  if (vencidas > 0) return corAtraso(vencidas);
  // is_parcela_atrasada cobre o caso em que a parcela venceu (data < hoje, não
  // paga) mas o status ainda não virou 'VENCIDO' — também é atraso. Como só há
  // 1 parcela nessa condição, cor de atraso leve.
  if (e.is_parcela_atrasada) return corAtraso(1);
  // Sem nenhuma parcela vencida → em dia (verde), inclusive cliente novo.
  return '#10B981';
};

const bgOf = (_e: EmprestimoData, paga: boolean) => paga ? 'rgba(16,185,129,0.05)' : '#fff';
const isPagaFn = (pid: string, sd: string, set: Set<string>) => set.has(pid) || sd === 'PAGO';

/**
 * Quanto cobrar nesta parcela.
 *
 * O teto é o SALDO DO EMPRÉSTIMO. Um cliente que pagou adiantado pode ter
 * saldo menor que uma parcela (ex.: parcela $36, saldo $29): exibir a parcela
 * cheia manda o cobrador pedir mais do que o cliente deve, e o valor nem seria
 * aceito no registro. É a mesma regra que MenuPagamento já aplica em
 * `valorCheioLimitado` — o card estava sem ela, e os dois discordavam na tela.
 */
const valorACobrar = (e: EmprestimoData, paga: boolean): number => {
  const base = e.numero_parcela === e.numero_parcelas
    ? (e.valor_pago_parcela > 0 && !paga ? e.saldo_parcela : e.valor_parcela)
    : e.valor_parcela;
  const saldo = Number(e.saldo_emprestimo || 0);
  return saldo > 0 && base > saldo ? saldo : base;
};

// Diferença em dias entre duas datas YYYY-MM-DD (sem timezone).
const diasEntre = (ref?: string | null, venc?: string | null): number => {
  if (!ref || !venc) return 0;
  const r = ref.substring(0, 10).split('-').map(Number);
  const v = venc.substring(0, 10).split('-').map(Number);
  if (r.length !== 3 || v.length !== 3) return 0;
  return Math.round((Date.UTC(r[0], r[1] - 1, r[2]) - Date.UTC(v[0], v[1] - 1, v[2])) / 86400000);
};

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ResumoPago {
  dinheiroReal: number; creditoUsado: number; qtdParcelas: number;
  somaParcelas: number; valorUnitario?: number | null;
}

interface ClienteCardLiquidacaoProps {
  cliente: ClienteAgrupado;
  emprestimo: EmprestimoData;
  expanded: boolean;
  pagasSet: Set<string>;
  naoPagosSet?: Set<string>;
  liqId: string | null;
  isViz: boolean;
  isClientePago?: boolean; // ⭐ Cliente está no filtro "Pagas" - desabilita pagamento
  resumoPago?: ResumoPago;
  // Cliente com 2+ empréstimos: resumo do recebido POR empréstimo (chave =
  // emprestimo_id). Cada slide do carrossel mostra o seu.
  resumoPorEmprestimo?: Record<string, ResumoPago>;
  dataReferencia?: string | null; // dia da liquidação sendo vista (YYYY-MM-DD) — base dos dias de atraso
  lang: Language;
  notasCount: number;
  t: {
    parcela: string;
    saldoEmprestimo: string;
    pagar: string;
    parcialmentePaga?: string;
    deLbl?: string;
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

export default function ClienteCardLiquidacao(props: ClienteCardLiquidacaoProps) {
  const {
    cliente: c,
    emprestimo: e,
    expanded: ex,
    pagasSet,
    naoPagosSet,
    liqId,
    isViz,
    isClientePago = false,
    resumoPago,
    dataReferencia,
    lang,
    notasCount,
    t,
    onToggleExpand,
    onPagar,
    onAbrirParcelas,
    onAbrirNotas,
    onAbrirDetalhes,
    onNaoPago,
  } = props;
  const swipeableRef = useRef<Swipeable>(null);

  // Cliente com 2+ empréstimos ativos (ex.: crédito adicional autorizado):
  // o card vira um carrossel horizontal, uma conta por slide. Com um único
  // empréstimo o caminho abaixo continua idêntico ao de sempre.
  if ((c.emprestimos?.length || 0) >= 2) return <CardMultiplo {...props} />;

  // ⭐ Se isClientePago é true, forçar pg = true para desabilitar pagamento
  const pg = isClientePago || isPagaFn(e.parcela_id, e.status_dia, pagasSet);
  const np = naoPagosSet?.has(e.parcela_id) || false;
  const bc = borderOf(e, pg);
  const bg = bgOf(e, pg);
  const pi = e.pagamento_info;
  const valorAPagar = valorACobrar(e, pg);

  // Swipe desabilitado temporariamente
  const podeSwipe = false;

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

      {/* === LINHA 1: Avatar + Nome === */}
      <View style={S.cardRow}>
        {c.foto_url ? (
          <Image source={{ uri: c.foto_url }} style={[S.av, { backgroundColor: '#E5E7EB' }]} />
        ) : (
          <View style={[S.av, { backgroundColor: pg ? '#10B981' : np ? '#6B7280' : e.tem_parcelas_vencidas && e.total_parcelas_vencidas > 0 ? '#EF4444' : '#3B82F6' }]}>
            <Text style={S.avTx}>{getIni(c.nome)}</Text>
          </View>
        )}
        <View style={S.cardInfo}>
          <View style={S.nameRow}>
            <Text style={[S.nome, np && { color: '#6B7280' }]} numberOfLines={1}>{c.nome}</Text>
          </View>
          <Text style={S.sub} numberOfLines={1}>
            {c.telefone_celular ? `📞 ${fmtTel(c.telefone_celular)}` : ''}{c.telefone_celular && c.endereco ? '  ◦  ' : ''}{c.endereco ? `📍 ${c.endereco}` : ''}
          </Text>
        </View>
      </View>

      {/* === LINHA 2: [breadcrumb tipo·status] + Parcela + Valores === */}
      <View style={S.pRow}>
        <View>
          {/* ⭐ Breadcrumb: tipo do empréstimo · dias de atraso. "ok" quando em
              dia; "N dias" a partir do 1º dia de atraso (para TODOS os clientes
              com parcela vencida, sem depender do status VENCIDO formal).
              Dias = dia da liquidação vista (dataReferencia) − vencimento da
              parcela exibida. Datas parseadas como string (sem timezone). */}
          {(() => {
            // Diferença em dias entre duas datas YYYY-MM-DD (sem timezone).
            const diasEntre = (ref?: string | null, venc?: string | null): number => {
              if (!ref || !venc) return 0;
              const r = ref.substring(0, 10).split('-').map(Number);
              const v = venc.substring(0, 10).split('-').map(Number);
              if (r.length !== 3 || v.length !== 3) return 0;
              const dR = Date.UTC(r[0], r[1] - 1, r[2]);
              const dV = Date.UTC(v[0], v[1] - 1, v[2]);
              return Math.round((dR - dV) / 86400000);
            };
            const refAtraso = (e as any).dia_referencia || dataReferencia;
            const diasAtraso = Math.max(0, diasEntre(refAtraso, e.data_vencimento));
            const emDia = diasAtraso <= 0;
            const cor = emDia ? '#10B981' : corAtraso(e.total_parcelas_vencidas || 1);
            const tipo = FREQ[lang][e.frequencia_pagamento] || e.frequencia_pagamento;
            const txtDias = diasAtraso === 1
              ? (lang === 'es' ? '1 día' : '1 dia')
              : `${diasAtraso} ${lang === 'es' ? 'días' : 'dias'}`;
            return (
              <Text style={[S.breadTipo, { color: cor }]} numberOfLines={1}>
                {tipo} · {emDia ? 'ok' : txtDias}
              </Text>
            );
          })()}
          <View style={S.pLblR}>
            <Text style={S.pLbl}>{t.parcela} {e.numero_parcela}/{e.numero_parcelas}</Text>
          </View>
          {e.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(e.data_emprestimo)}</Text> : null}
        </View>
        <View style={S.sCol}>
          {pg && resumoPago ? (
            // Aba Pagos: DINHEIRO EFETIVO recebido em destaque; crédito à parte;
            // valor/qtd de parcela discreto. Soma todas as parcelas do cliente.
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[S.pValBig, { color: '#059669' }]}>{fmt(resumoPago.dinheiroReal)}</Text>
              <Text style={S.pRecebidoLbl}>{lang === 'es' ? 'recibido' : 'recebido'}</Text>
              {/* "pagos com crédito", não "+ crédito": este número COMPÕE o valor
                  da parcela, não é saldo a favor do cliente. Com o rótulo antigo
                  o cobrador lia como se o cliente ainda tivesse esse crédito
                  guardado — e o saldo disponível dele podia ser zero. */}
              {resumoPago.creditoUsado > 0 ? (
                <Text style={S.pCreditoLbl}>
                  {fmt(resumoPago.creditoUsado)} {lang === 'es' ? 'pagados con crédito' : 'pagos com crédito'}
                </Text>
              ) : null}
              <Text style={S.pParcelaDiscreta}>
                {resumoPago.qtdParcelas > 1
                  ? (resumoPago.valorUnitario != null
                      ? `${resumoPago.qtdParcelas} ${lang === 'es' ? 'cuotas de' : 'parcelas de'} ${fmt(resumoPago.valorUnitario)}`
                      : `${resumoPago.qtdParcelas} ${lang === 'es' ? 'cuotas' : 'parcelas'} · ${lang === 'es' ? 'total' : 'total'} ${fmt(resumoPago.somaParcelas)}`)
                  : `${t.parcela} ${e.numero_parcela}/${e.numero_parcelas} · ${fmt(resumoPago.somaParcelas)}`}
              </Text>
            </View>
          ) : pg && pi ? (
            <Text style={[S.pValBig, { color: '#10B981' }]}>{fmt(pi.valorPago)}</Text>
          ) : np ? (
            <Text style={[S.pValBig, { color: '#6B7280', textDecorationLine: 'line-through' }]}>{fmt(valorAPagar)}</Text>
          ) : (
            <Text style={S.pValBig}>{fmt(valorAPagar)}</Text>
          )}
          <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(e.saldo_emprestimo)}</Text>
          {/* ⭐ Composição do empréstimo: emprestado + juros + total.
              Antes só o total era exibido; agora o usuário vê quanto foi
              de fato emprestado sem calcular. Juros = total − principal. */}
          {typeof e.valor_total === 'number' && e.valor_total > 0 && (
            <View style={S.compEmp}>
              <Text style={S.compEmpLine}>
                {lang === 'es' ? 'Préstamo' : 'Empréstimo'}: <Text style={S.compEmpStrong}>{fmt(e.valor_principal)}</Text>
              </Text>
              <Text style={S.compEmpLine}>
                {lang === 'es' ? 'Intereses' : 'Juros'}: <Text style={S.compEmpStrong}>{fmt(e.valor_total - e.valor_principal)}</Text>
              </Text>
              <Text style={S.compEmpLine}>
                {lang === 'es' ? 'Total' : 'Total'}: <Text style={S.compEmpStrong}>{fmt(e.valor_total)}</Text>
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* === EXPANDIDO (1 clique) === */}
      {ex && (
        <View style={S.exp}>
          {/* Faixa: parcela parcialmente paga (tem valor pago, não quitada) */}
          {!pg && Number(e.valor_pago_parcela || 0) > 0 && (
            <View style={S.faixaParcial}>
              <Text style={S.faixaParcialTx}>
                ⓘ {t.parcialmentePaga || 'Parcialmente paga'} · {fmt(Number(e.valor_pago_parcela || 0))} {t.deLbl || 'de'} {fmt(Number(e.valor_parcela || 0))}
              </Text>
            </View>
          )}
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

// ─── Carrossel: cliente com 2+ empréstimos ──────────────────────────────────
// Motivo (pedido do cliente): quando um crédito adicional é autorizado o
// cliente passa a ter DUAS contas ativas, mas a liquidação só mostrava uma —
// o cobrador não percebia que precisava cobrar as duas separadamente.
// Cabeçalho do cliente fica fixo; cada conta é um slide com seus próprios
// valores e botões, apontando para o respectivo empréstimo/parcela.

function CardMultiplo({
  cliente: c,
  pagasSet,
  naoPagosSet,
  liqId,
  isViz,
  isClientePago = false,
  resumoPorEmprestimo,
  dataReferencia,
  lang,
  notasCount,
  t,
  onPagar,
  onAbrirParcelas,
  onAbrirNotas,
  onAbrirDetalhes,
}: ClienteCardLiquidacaoProps) {
  const { width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);

  const emps = c.emprestimos;
  const n = emps.length;

  // Largura útil dentro do card = tela − padding da lista (16×2) − padding do
  // card (12×2) − borda esquerda (5). O slide ocupa 78% e o restante é o
  // "espião" do próximo, sinalizando que dá para deslizar.
  const UTIL = Math.max(220, width - 61);
  const SLIDE = Math.round(UTIL * 0.78);
  const GAP = 10;
  const INTERVAL = SLIDE + GAP;

  const pagoDe = (e: EmprestimoData) => isPagaFn(e.parcela_id, e.status_dia, pagasSet);
  const qtdPagas = emps.filter(pagoDe).length;

  // Borda do card = pior situação entre as contas, para a lista continuar
  // legível pela cor sem precisar deslizar.
  const pior = emps.reduce((acc, e) => {
    const grau = pagoDe(e) ? -1 : (e.total_parcelas_vencidas || (e.is_parcela_atrasada ? 1 : 0));
    return grau > acc.grau ? { grau, e } : acc;
  }, { grau: -2, e: emps[0] });

  const renderSlide = (e: EmprestimoData, i: number) => {
    const pago = pagoDe(e);
    const np = naoPagosSet?.has(e.parcela_id) || false;
    const rp = resumoPorEmprestimo?.[e.emprestimo_id];
    const bloqueado = pago || np || !liqId || isViz || isClientePago;
    const valorAPagar = valorACobrar(e, pago);
    const diasAtraso = Math.max(0, diasEntre((e as any).dia_referencia || dataReferencia, e.data_vencimento));
    const emDia = diasAtraso <= 0;
    const corDias = emDia ? '#10B981' : corAtraso(e.total_parcelas_vencidas || 1);
    const tipo = FREQ[lang][e.frequencia_pagamento] || e.frequencia_pagamento;
    const txtDias = diasAtraso === 1
      ? (lang === 'es' ? '1 día' : '1 dia')
      : `${diasAtraso} ${lang === 'es' ? 'días' : 'dias'}`;

    return (
      <View
        key={e.emprestimo_id}
        style={[S.slide, {
          width: SLIDE,
          marginRight: i === n - 1 ? 0 : GAP,
          borderLeftColor: np ? '#6B7280' : borderOf(e, pago),
          backgroundColor: np ? '#F9FAFB' : (pago ? 'rgba(16,185,129,0.06)' : '#fff'),
        }]}
      >
        <View style={S.slideTop}>
          <View style={S.slideTopL}>
            <View style={[S.contaBdg, pago && S.contaBdgPago]}>
              <Text style={[S.contaBdgTx, pago && S.contaBdgTxPago]}>
                {lang === 'es' ? 'Cuenta' : 'Conta'} {i + 1} {lang === 'es' ? 'de' : 'de'} {n}
                {pago ? (lang === 'es' ? ' · pagada' : ' · paga') : ''}
              </Text>
            </View>
            <Text style={[S.breadTipo, { color: corDias, marginTop: 5 }]} numberOfLines={1}>
              {tipo} · {emDia ? 'ok' : txtDias}
            </Text>
            <Text style={S.pLbl}>{t.parcela} {e.numero_parcela}/{e.numero_parcelas}</Text>
          </View>
          <View style={S.sCol}>
            {pago && rp ? (
              <>
                <Text style={[S.pValBig, { color: '#059669' }]}>{fmt(rp.dinheiroReal)}</Text>
                <Text style={S.pRecebidoLbl}>{lang === 'es' ? 'recibido' : 'recebido'}</Text>
                {rp.creditoUsado > 0 ? (
                  <Text style={S.pCreditoLbl}>
                    {fmt(rp.creditoUsado)} {lang === 'es' ? 'pagados con crédito' : 'pagos com crédito'}
                  </Text>
                ) : null}
              </>
            ) : pago && e.pagamento_info ? (
              <Text style={[S.pValBig, { color: '#10B981' }]}>{fmt(e.pagamento_info.valorPago)}</Text>
            ) : np ? (
              <Text style={[S.pValBig, { color: '#6B7280', textDecorationLine: 'line-through' }]}>{fmt(valorAPagar)}</Text>
            ) : (
              <Text style={S.pValBig}>{fmt(valorAPagar)}</Text>
            )}
            <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(e.saldo_emprestimo)}</Text>
          </View>
        </View>

        <View style={S.slideComp}>
          {typeof e.valor_total === 'number' && e.valor_total > 0 ? (
            <Text style={S.slideCompTx} numberOfLines={1}>
              {lang === 'es' ? 'Préstamo' : 'Empréstimo'}: <Text style={S.compEmpStrong}>{fmt(e.valor_principal)}</Text>
              {'  ·  '}{lang === 'es' ? 'Intereses' : 'Juros'}: <Text style={S.compEmpStrong}>{fmt(e.valor_total - e.valor_principal)}</Text>
            </Text>
          ) : null}
          <Text style={S.slideCompTx} numberOfLines={1}>
            {typeof e.valor_total === 'number' && e.valor_total > 0
              ? <>Total: <Text style={S.compEmpStrong}>{fmt(e.valor_total)}</Text>{'  ·  '}</>
              : null}
            {lang === 'es' ? 'Vence' : 'Venc.'} {fmtData(e.data_vencimento)}
          </Text>
        </View>

        {!pago && Number(e.valor_pago_parcela || 0) > 0 && (
          <View style={S.faixaParcial}>
            <Text style={S.faixaParcialTx} numberOfLines={2}>
              ⓘ {t.parcialmentePaga || 'Parcialmente paga'} · {fmt(Number(e.valor_pago_parcela || 0))} {t.deLbl || 'de'} {fmt(Number(e.valor_parcela || 0))}
            </Text>
          </View>
        )}

        <View style={S.expActRow}>
          <TouchableOpacity
            style={[S.btPagarGrande, bloqueado && S.btPagarDisabled]}
            disabled={bloqueado}
            onPress={() => {
              if (bloqueado) return;
              onPagar(
                { parcela_id: e.parcela_id, numero_parcela: e.numero_parcela, data_vencimento: e.data_vencimento, valor_parcela: e.valor_parcela, status: e.status_parcela, data_pagamento: null, valor_multa: 0, valor_pago: e.valor_pago_parcela || 0, valor_saldo: e.saldo_parcela || e.valor_parcela },
                { id: c.cliente_id, nome: c.nome, emprestimo_id: e.emprestimo_id, saldo_emprestimo: e.saldo_emprestimo, emprestimo_status: e.status_emprestimo }
              );
            }}
          >
            <Text style={S.btPagarIcon}>$</Text>
            <Text style={S.btPagarText}>{t.pagar}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btSecSm, { backgroundColor: '#10B981' }]} onPress={() => onAbrirParcelas(c.cliente_id, c.nome, e.emprestimo_id)}>
            <Text style={S.btSecIconTx}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btSecSm, { backgroundColor: '#F59E0B' }]} onPress={() => onAbrirNotas(c.cliente_id, c.nome)}>
            <Text style={S.btSecIconTx}>✎</Text>
            {notasCount > 0 && <View style={S.btSecBadge}><Text style={S.btSecBadgeT}>{notasCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[S.card, { borderLeftColor: borderOf(pior.e, pagoDe(pior.e)) }]}>
      {/* === Cabeçalho do cliente (fixo, fora do carrossel) === */}
      <View style={S.cardRow}>
        {c.foto_url ? (
          <Image source={{ uri: c.foto_url }} style={[S.av, { backgroundColor: '#E5E7EB' }]} />
        ) : (
          <View style={[S.av, { backgroundColor: qtdPagas === n ? '#10B981' : '#6366F1' }]}>
            <Text style={S.avTx}>{getIni(c.nome)}</Text>
          </View>
        )}
        <View style={S.cardInfo}>
          <Text style={S.nome} numberOfLines={1}>{c.nome}</Text>
          <Text style={S.sub} numberOfLines={1}>
            {c.telefone_celular ? `📞 ${fmtTel(c.telefone_celular)}` : ''}{c.telefone_celular && c.endereco ? '  ◦  ' : ''}{c.endereco ? `📍 ${c.endereco}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={S.contasBdg}>
            <Text style={S.contasBdgTx}>{n} {lang === 'es' ? 'cuentas' : 'contas'} ‹ ›</Text>
          </View>
          {qtdPagas > 0 && (
            <Text style={S.contasProg}>
              {qtdPagas}/{n} {lang === 'es' ? 'pagadas' : 'pagas'}
            </Text>
          )}
        </View>
      </View>

      {/* === Carrossel horizontal: uma conta por slide === */}
      <View style={S.carrossel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={INTERVAL}
          snapToAlignment="start"
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingRight: Math.max(0, UTIL - SLIDE) }}
          onScroll={(ev) => {
            const i = Math.round(ev.nativeEvent.contentOffset.x / INTERVAL);
            const clamp = Math.min(n - 1, Math.max(0, i));
            if (clamp !== idx) setIdx(clamp);
          }}
        >
          {emps.map(renderSlide)}
        </ScrollView>

        <View style={S.dotsRow}>
          {emps.map((e, i) => (
            <View key={e.emprestimo_id} style={[S.dot, i === idx && S.dotOn]} />
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={S.linkDetalhes}
        onPress={() => onAbrirDetalhes({ id: c.cliente_id, nome: c.nome, telefone: c.telefone_celular, endereco: c.endereco, codigo_cliente: c.codigo_cliente })}
      >
        <Text style={S.linkDetalhesTx}>{t.toqueDetalhes} ▽</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 5, elevation: 2 },
  cardRow: { flexDirection: 'row' },
  av: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avTx: { color: '#fff', fontSize: 13, fontWeight: '700' },
  breadTipo: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
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
  pRecebidoLbl: { fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: -2 },
  pCreditoLbl: { fontSize: 11, color: '#7C3AED', textAlign: 'right', marginTop: 2, fontWeight: '600' },
  pParcelaDiscreta: { fontSize: 11, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  sCol: { alignItems: 'flex-end' },
  sLbl: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  exp: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  expActRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'center' },
  faixaParcial: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  faixaParcialTx: { fontSize: 12, color: '#B45309', lineHeight: 17 },
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
  // ── Carrossel (cliente com 2+ empréstimos) ──
  contasBdg: { backgroundColor: '#EEF2FF', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  contasBdgTx: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
  contasProg: { fontSize: 10, color: '#6B7280', marginTop: 3 },
  carrossel: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  slide: { borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 4, borderRadius: 12, padding: 11 },
  slideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  slideTopL: { flex: 1, paddingRight: 6 },
  contaBdg: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  contaBdgTx: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  contaBdgPago: { backgroundColor: '#D1FAE5' },
  contaBdgTxPago: { color: '#065F46' },
  slideComp: { marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginBottom: 9, gap: 1 },
  slideCompTx: { fontSize: 10, color: '#9CA3AF' },
  btSecSm: { width: 42, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotOn: { width: 20, backgroundColor: '#6366F1' },
  compEmp: { marginTop: 4, alignItems: 'flex-end', gap: 1 },
  compEmpLine: { fontSize: 11, color: '#6B7280' },
  compEmpStrong: { color: '#374151', fontWeight: '700' },
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