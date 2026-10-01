import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Language } from '../contexts/LiquidacaoContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmprestimoTodos {
  id: string; valor_principal: number; saldo_emprestimo: number;
  valor_parcela: number; numero_parcelas: number; numero_parcela_atual: number;
  status: string; frequencia_pagamento: string; tipo_emprestimo: string;
  total_parcelas_vencidas: number; valor_total_vencido: number;
  data_emprestimo?: string;
  /**
   * Só em SEMANAL, e só depois que a leitura sob demanda chega — o payload da
   * liquidação não traz este campo. 0 = domingo. Pedido do Julio em
   * 23/09/2026: ver o dia programado sem abrir o empréstimo.
   */
  dia_semana_cobranca?: number | null;
}

export interface ClienteTodos {
  id: string; codigo_cliente: number | null; nome: string;
  telefone_celular: string | null; foto_url: string | null;
  status: string; tem_atraso: boolean;
  permite_renegociacao: boolean; permite_emprestimo_adicional: boolean;
  cliente_created_at?: string;
  emprestimos: EmprestimoTodos[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Nome cheio, não abreviação: aqui há espaço e o rótulo é para ser lido de
// relance. As iniciais ficam para o breadcrumb do filtro, onde o espaço aperta.
const DIA_SEMANA_NOME: Record<Language, string[]> = {
  'pt-BR': ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'],
  'es': ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
};

const FREQ: Record<Language, Record<string, string>> = {
  'pt-BR': { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' },
  'es': { DIARIO: 'Diario', SEMANAL: 'Semanal', QUINZENAL: 'Quincenal', MENSAL: 'Mensual', FLEXIVEL: 'Flexible' },
};

/**
 * A linha "Terça-feira" sob a badge de frequência.
 *
 * Vai ABAIXO e não ao lado porque a linha das badges já carrega parcela,
 * frequência e origem do empréstimo — um quarto elemento ali quebraria em
 * tela estreita.
 */
const linhaDiaSemana = (emp: EmprestimoTodos, lang: Language) => {
  if (emp.frequencia_pagamento !== 'SEMANAL') return null;
  const d = emp.dia_semana_cobranca;
  if (d == null || d < 0 || d > 6) return null;
  return <Text style={S.diaSemLbl}>{DIA_SEMANA_NOME[lang][d]}</Text>;
};

/**
 * Empréstimo encerrado — não recebe mais parcela.
 *
 * RENEGOCIADO e CANCELADO caíam no layout de empréstimo ativo e exibiam
 * "Parcela 5/5" com saldo zero, indistinguível de um quitado. Numa
 * renegociação todas as parcelas pendentes viram CANCELADO e a dívida migra
 * para o empréstimo novo — o número da parcela ali é ficção.
 */
const ENCERRADO = new Set(['QUITADO', 'RENEGOCIADO', 'CANCELADO']);

/** Badge de desfecho do empréstimo. `null` para ATIVO/VENCIDO. */
const desfechoBadge = (status: string, lang: Language) => {
  switch (status) {
    case 'QUITADO':
      return { texto: lang === 'es' ? '✓ Liquidado' : '✓ Quitado',
               fundo: '#D1FAE5', borda: '#6EE7B7', cor: '#059669' };
    case 'RENEGOCIADO':
      return { texto: lang === 'es' ? '↻ Renegociado' : '↻ Renegociado',
               fundo: '#EDE9FE', borda: '#C4B5FD', cor: '#7C3AED' };
    case 'CANCELADO':
      return { texto: lang === 'es' ? '✕ Cancelado' : '✕ Cancelado',
               fundo: '#F3F4F6', borda: '#D1D5DB', cor: '#6B7280' };
    default:
      return null;
  }
};

/**
 * Origem do empréstimo, quando não é uma venda comum.
 *
 * Sem isto, na lista não dá para distinguir um empréstimo novo de um que
 * nasceu renegociando dívida — e a diferença importa para avaliar o cliente.
 */
const ORIGEM: Record<Language, Record<string, string>> = {
  'pt-BR': { RENEGOCIACAO: 'Renegociação', RENOVACAO: 'Renovação', ADICIONAL: 'Adicional' },
  'es': { RENEGOCIACAO: 'Renegociación', RENOVACAO: 'Renovación', ADICIONAL: 'Adicional' },
};
const origemLabel = (tipo: string | undefined, lang: Language): string | null =>
  (tipo && ORIGEM[lang][tipo]) || null;

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

/**
 * Escala de atraso — a MESMA do ClienteCardLiquidacao.
 *
 * O nível médio era laranja (#F97316) aqui. No card da Liquidação ele virou
 * ROXO por pedido do cliente (item #39): laranja e amarelo ficavam quase
 * indistinguíveis na tela do celular. Este card não acompanhou, e as duas
 * listas mostravam cores diferentes para o mesmo cliente.
 */
const corAtraso = (vencidas: number): string => {
  if (vencidas <= 0) return '#10B981';  // verde — em dia
  if (vencidas <= 3) return '#F59E0B';  // amarelo — atraso leve
  if (vencidas <= 7) return '#9333EA';  // roxo — atraso médio
  return '#EF4444';                     // vermelho — atraso crítico
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
    novoEmprestimo: string;
  };
  /** Chave desta linha na lista. Vai de volta no onToggleExpand para o
   *  handler poder ser estável (useCallback sem dependências) — é o que
   *  permite o React.memo funcionar. */
  /** Lista compacta: o card colapsado fica só com a linha do nome e
   *  endereço; o resto abre no toque, já com os botões. Preferência do
   *  usuário, persistida — ver ClientesScreen. */
  compacto?: boolean;
  chaveExpand: string;
  onToggleExpand: (chave: string) => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onChangeEmpIdx: (newIdx: number) => void;
  onAbrirParcelas: (clienteId: string, clienteNome: string, emprestimoId: string, empStatus: string) => void;
  onPagar?: (cliente: ClienteTodos, emprestimo: any) => void;
  onAbrirNotas: (clienteId: string, clienteNome: string) => void;
  onAbrirDetalhes: (cliente: { id: string; nome: string; telefone?: string | null; codigo_cliente?: string | number | null }) => void;
  onNovoEmprestimo: (cliente: ClienteTodos) => void;
  solicitacaoRenovacao?: { solic_id: string; status: string; valor_solicitado: number; valor_limite: number; emprestimo_id: string | null } | null;
  /**
   * `statusSolic` decide se o formulário abre travado: APROVADO significa que
   * o admin definiu valor e taxa; PENDENTE é o vendedor querendo alterar o
   * próprio pedido, e aí os campos precisam ficar livres.
   */
  onAlterarSolicitacaoRenovacao?: (cliente: ClienteTodos, solicId: string, empQuitadoId: string, valorSolic: number, statusSolic: string) => void;
  onCancelarSolicitacaoRenovacao?: (solicId: string) => void;
  todosMode?: boolean;
}

// Botões em avaliação com o cliente (setembro/2026).
//
// O de parcelas sai porque a Ficha do Empréstimo faz o que ele fazia e mais —
// ordena por tempo, agrupa por operação e confere as contas. O link de
// detalhes sai porque a foto do cliente passou a abrir o modal.
//
// Ficam como constante, e não apagados, até o Julio validar a mudança.
const MOSTRAR_BOTAO_PARCELAS = false;
const MOSTRAR_LINK_DETALHES = false;

// ─── Componente ─────────────────────────────────────────────────────────────

// Memoizado de propósito.
//
// A lista de clientes chega a algumas dezenas de cards e cada um é pesado
// (carrossel, badges, barra de progresso, quatro botões). Sem memo, abrir UM
// card re-renderizava TODOS — num Motorola antigo isso é a travada que o
// campo relatou. O memo só funciona porque ClientesScreen estabilizou os
// handlers com useCallback; props novas a cada render anulariam tudo.
function ClienteCardTodos({
  cliente: c,
  emprestimo: emp,
  empIdx: ei,
  expanded: ex,
  modoReordenar,
  lang,
  notasCount,
  t,
  compacto = false,
  chaveExpand,
  onToggleExpand,
  onLongPressStart,
  onLongPressEnd,
  onChangeEmpIdx,
  onAbrirParcelas,
  onPagar,
  onAbrirNotas,
  onAbrirDetalhes,
  onNovoEmprestimo,
  solicitacaoRenovacao,
  onAlterarSolicitacaoRenovacao,
  onCancelarSolicitacaoRenovacao,
  todosMode = false,
}: ClienteCardTodosProps) {
  const nav = useNavigation<any>();
  // Cliente suspenso pelo administrador: não pode iniciar renovação nem
  // empréstimo novo. Antes só era barrado no "Confirmar venda", depois de o
  // cobrador já ter preenchido tudo — e às vezes já ter combinado com o cliente.
  const suspenso = String(c.status || '').toUpperCase() === 'SUSPENSO';
  // Cor da borda — mesma regra do borderOf no ClienteCardLiquidacao.
  //
  // Dois mundos, sem meio-termo: em dia é VERDE, atraso é a escala de cores.
  // Aqui o em-dia era cinza (#D1D5DB), resquício do antigo estado "pendente"
  // que o cliente pediu para eliminar — o mesmo cliente aparecia cinza numa
  // lista e verde na outra.
  //
  // `|| 1` porque `tem_atraso` é do CLIENTE e `total_parcelas_vencidas` é do
  // empréstimo exibido: com o atraso vindo de um segundo empréstimo, o valor
  // chegava zerado e `corAtraso(0)` devolvia verde, contradizendo o próprio
  // `tem_atraso`. Um vencido é atraso leve — mesmo piso do outro card.
  const a = c.tem_atraso;
  const vencidas = emp?.total_parcelas_vencidas || 0;
  const cor = a ? corAtraso(vencidas || 1) : '#10B981';

  return (
    <TouchableOpacity
      key={c.id}
      activeOpacity={0.7}
      onPress={() => { if (!modoReordenar) onToggleExpand(chaveExpand); }}
      onPressIn={onLongPressStart}
      onPressOut={onLongPressEnd}
      style={[S.card, { borderLeftColor: cor }, compacto && S.cardCompacto, todosMode && { backgroundColor: '#FFFBEB' }]}
    >
      {/* Gota: brota da linha fina da esquerda e carrega a inicial da
          frequência — D, S, Q, M ou F. */}
      {compacto && !ex && (
        <View style={S.gotaWrap} pointerEvents="none">
          <View style={S.gotaCaixa}>
            <Svg width={19} height={44} viewBox="0 0 19 44" style={S.gotaSvg}>
              <Path d="M 0 0 C 0 9, 19 11, 19 22 C 19 33, 0 35, 0 44 Z" fill={cor} />
            </Svg>
            <Text style={S.gotaTx}>{((FREQ[lang][emp?.frequencia_pagamento || '']) || '?').charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      )}
      {/* === LINHA 1: Avatar + Nome + Badges === */}
      <View style={S.cardRow}>
        <TouchableOpacity
          style={S.avWrap}
          activeOpacity={0.7}
          onPress={() => onAbrirDetalhes({ id: c.id, nome: c.nome, telefone: c.telefone_celular, codigo_cliente: c.codigo_cliente })}
        >
          {/* Sem foto: as iniciais usam a MESMA cor da borda. Antes era
              vermelho/cinza próprio, e o card dizia duas coisas sobre o
              mesmo cliente — borda âmbar e avatar vermelho. */}
          {c.foto_url ? (
            <Image source={{ uri: c.foto_url }} style={[S.av, { backgroundColor: '#E5E7EB' }]} />
          ) : (
            <View style={[S.av, { backgroundColor: cor }]}>
              <Text style={S.avTx}>{getIni(c.nome)}</Text>
            </View>
          )}
          <View style={S.avBadge}>
            <Ionicons name="information" size={9} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={S.cardInfo}>
          <View style={S.nameRow}>
            <Text style={S.nome} numberOfLines={1}>{c.nome}</Text>
            {vencidas > 0 && <View style={S.bWarnNew}><Text style={S.bWarnNewI}>⚠</Text><Text style={S.bWarnNewT}>{vencidas}</Text></View>}
            {suspenso && (
              <View style={S.bSusp}>
                <Ionicons name="ban-outline" size={11} color="#B91C1C" />
                <Text style={S.bSuspTx}>{lang === 'es' ? 'Suspendido' : 'Suspenso'}</Text>
              </View>
            )}
          </View>
          {c.telefone_celular && <Text style={S.sub} numberOfLines={1}>📞 {fmtTel(c.telefone_celular)}</Text>}
        </View>
      </View>

      {/* === LINHA 2: Info empréstimo ===
          No modo compacto ela só aparece expandida — é o corte que deixa
          o card na altura mínima do nome + telefone. */}
      {emp && (!compacto || ex) && (
        <View style={S.pRow}>
          {ENCERRADO.has(emp.status) ? (
            // Empréstimo encerrado (quitado, renegociado ou cancelado) — resumo
            <>
              <View>
                <View style={S.pLblR}>
                  {(() => {
                    const b = desfechoBadge(emp.status, lang);
                    return b ? (
                      <View style={[S.badgeDesfecho, { backgroundColor: b.fundo, borderColor: b.borda }]}>
                        <Text style={[S.badgeDesfechoTx, { color: b.cor }]}>{b.texto}</Text>
                      </View>
                    ) : null;
                  })()}
                  <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[lang][emp.frequencia_pagamento] || emp.frequencia_pagamento}</Text></View>
                </View>
                {linhaDiaSemana(emp, lang)}
                {origemLabel(emp.tipo_emprestimo, lang) ? (
                  <Text style={S.origemLbl}>{origemLabel(emp.tipo_emprestimo, lang)}</Text>
                ) : null}
                {emp.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(emp.data_emprestimo)}</Text> : null}
              </View>
              <View style={S.sCol}>
                <Text style={[S.pValBig, { color: emp.status === 'QUITADO' ? '#10B981' : '#6B7280', fontSize: 15 }]}>
                  {emp.numero_parcelas}x {fmt(emp.valor_parcela)}
                </Text>
                <Text style={S.sLbl}>{lang === 'es' ? 'Total: ' : 'Total: '}{fmt(emp.valor_parcela * emp.numero_parcelas)}</Text>
                {emp.valor_principal > 0 && (emp.valor_parcela * emp.numero_parcelas) > emp.valor_principal && (
                  <Text style={[S.sLbl, { color: '#F59E0B' }]}>
                    {lang === 'es' ? 'Intereses: ' : 'Juros: '}{fmt((emp.valor_parcela * emp.numero_parcelas) - emp.valor_principal)}
                  </Text>
                )}
              </View>
            </>
          ) : (
            // Empréstimo ativo/vencido — layout original
            <>
              <View>
                <View style={S.pLblR}>
                  <Text style={S.pLbl}>{t.parcela} {emp.numero_parcela_atual}/{emp.numero_parcelas}</Text>
                  <View style={S.fBdg}><Text style={S.fBdgT}>{FREQ[lang][emp.frequencia_pagamento] || emp.frequencia_pagamento}</Text></View>
                  {origemLabel(emp.tipo_emprestimo, lang) ? (
                    <View style={S.origemBdg}>
                      <Text style={S.origemBdgT}>{origemLabel(emp.tipo_emprestimo, lang)}</Text>
                    </View>
                  ) : null}
                </View>
                {linhaDiaSemana(emp, lang)}
                {emp.data_emprestimo ? <Text style={S.dataEmpLbl}>{lang === 'es' ? 'Préstamo:' : 'Empréstimo:'} {fmtData(emp.data_emprestimo)}</Text> : null}
              </View>
              <View style={S.sCol}>
                <Text style={S.pValBig}>{fmt(emp.valor_parcela)}</Text>
                <Text style={S.sLbl}>{t.saldoEmprestimo} {fmt(emp.saldo_emprestimo)}</Text>
                {/* Composição do empréstimo: emprestado + juros + total.
                    valor_total = valor_parcela × numero_parcelas (mesmo cálculo
                    do ramo quitado). Juros = total − principal. */}
                {emp.valor_principal > 0 && (emp.valor_parcela * emp.numero_parcelas) > 0 && (
                  <View style={S.compEmp}>
                    <Text style={S.compEmpLine}>
                      {lang === 'es' ? 'Préstamo' : 'Empréstimo'}: <Text style={S.compEmpStrong}>{fmt(emp.valor_principal)}</Text>
                    </Text>
                    {(emp.valor_parcela * emp.numero_parcelas) > emp.valor_principal && (
                      <Text style={S.compEmpLine}>
                        {lang === 'es' ? 'Intereses' : 'Juros'}: <Text style={S.compEmpStrong}>{fmt((emp.valor_parcela * emp.numero_parcelas) - emp.valor_principal)}</Text>
                      </Text>
                    )}
                    <Text style={S.compEmpLine}>
                      {lang === 'es' ? 'Total' : 'Total'}: <Text style={S.compEmpStrong}>{fmt(emp.valor_parcela * emp.numero_parcelas)}</Text>
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
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

          {/* ⭐ Botão "+ Novo Empréstimo" — mesma regra do ClienteDetalhesModal */}
          {/* Mostra quando cliente em dia E (não tem ativo OU autorizado para adicional) */}
          {/* Sem autorização → não mostra (vendedor abre detalhes para solicitar) */}
          {(() => {
            const temAtivo = c.emprestimos.some(e => e.status === 'ATIVO' || e.status === 'VENCIDO');
            const clienteEmDia = !c.tem_atraso;
            const podeNovoEmprestimo = clienteEmDia && (!temAtivo || c.permite_emprestimo_adicional);

            // Suspenso: mostra o motivo no lugar do botão, em vez de sumir com
            // ele — sumir faria o cobrador achar que é limitação de atraso.
            if (suspenso) {
              return (
                <View style={[S.tAddRowActive, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <Ionicons name="ban-outline" size={16} color="#B91C1C" />
                  <Text style={[S.tAddTextActive, { color: '#B91C1C', marginLeft: 6 }]}>
                    {lang === 'es' ? 'Cliente suspendido' : 'Cliente suspenso'}
                  </Text>
                </View>
              );
            }

            if (!podeNovoEmprestimo) return null;
            
            if (solicitacaoRenovacao) {
              // Há solicitação PENDENTE ou APROVADA — botão especial
              const isPendente = solicitacaoRenovacao.status === 'PENDENTE';
              const handlePress = () => {
                const solicId = solicitacaoRenovacao.solic_id;
                const empId = solicitacaoRenovacao.emprestimo_id || '';
                const valorSolic = solicitacaoRenovacao.valor_solicitado;
                const valorLimite = solicitacaoRenovacao.valor_limite;
                if (!isPendente) {
                  // APROVADO — ir direto para alterar
                  onAlterarSolicitacaoRenovacao?.(c, solicId, empId, valorSolic, solicitacaoRenovacao.status);
                  return;
                }
                const msg = lang === 'es'
                  ? `Solicitud pendiente de renovación por $ ${valorSolic} (límite: $ ${valorLimite}).`
                  : `Solicitação pendente de renovação por $ ${valorSolic} (limite: $ ${valorLimite}).`;
                if (Platform.OS === 'web') {
                  const msgWeb = lang === 'es'
                    ? 'Solicitud pendiente de renovacion. OK = Alterar y cancelar / Cancelar = Ver mas opciones'
                    : 'Solicitacao pendente de renovacao. OK = Alterar e cancelar / Cancelar = Ver mais opcoes';
                  const alterar = window.confirm(msgWeb);
                  if (alterar) {
                    onAlterarSolicitacaoRenovacao?.(c, solicId, empId, valorSolic, solicitacaoRenovacao.status);
                  } else {
                    const msgCancelar = lang === 'es' ? 'Cancelar la solicitud pendiente?' : 'Cancelar a solicitacao pendente?';
                    const cancelar = window.confirm(msgCancelar);
                    if (cancelar) onCancelarSolicitacaoRenovacao?.(solicId);
                  }
                } else {
                  Alert.alert(
                    lang === 'es' ? 'Solicitud pendiente' : 'Solicitação pendente', msg,
                    [
                      { text: lang === 'es' ? 'Cancelar solicitud' : 'Cancelar solicitação', style: 'destructive', onPress: () => onCancelarSolicitacaoRenovacao?.(solicId) },
                      { text: lang === 'es' ? 'Alterar y cancelar' : 'Alterar e cancelar', onPress: () => onAlterarSolicitacaoRenovacao?.(c, solicId, empId, valorSolic, solicitacaoRenovacao.status) },
                      { text: lang === 'es' ? 'Cerrar' : 'Fechar', style: 'cancel' },
                    ]
                  );
                }
              };
              return (
                <TouchableOpacity
                  style={[S.tAddRowActive, { backgroundColor: isPendente ? '#FEF3C7' : '#D1FAE5', borderColor: isPendente ? '#F59E0B' : '#10B981' }]}
                  onPress={handlePress}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isPendente ? 'time-outline' : 'checkmark-circle-outline'} size={16} color={isPendente ? '#92400E' : '#059669'} />
                  <Text style={[S.tAddTextActive, { color: isPendente ? '#92400E' : '#059669', marginLeft: 6 }]}>
                    {isPendente
                      ? (lang === 'es' ? 'Solicitud pendiente' : 'Solicitação pendente')
                      : (lang === 'es' ? 'Renovación aprobada' : 'Renovação aprovada')}
                  </Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity style={S.tAddRowActive} onPress={() => onNovoEmprestimo(c)}>
                <Text style={S.tAddIconActive}>＋</Text>
                <Text style={S.tAddTextActive}>{t.novoEmprestimo}</Text>
              </TouchableOpacity>
            );
          })()}

          {/* ── Ações ──
              Pagar é a única ação de verdade: fica sozinho, na largura toda.
              Notas, Parcelas e Dados são navegação — mesmo peso entre si,
              discretos, abaixo. Antes os três disputavam atenção lado a lado
              e nada indicava qual era o principal. */}
          {onPagar && (emp.status === 'ATIVO' || emp.status === 'VENCIDO') && (
            <TouchableOpacity style={S.btPagarFull} onPress={() => onPagar(c, emp)} activeOpacity={0.85}>
              <Text style={S.btPagarFullTx}>{t.pagar || 'Pagar'}</Text>
            </TouchableOpacity>
          )}

          {MOSTRAR_BOTAO_PARCELAS && (
            <TouchableOpacity style={S.btSecVerde} onPress={() => onAbrirParcelas(c.id, c.nome, emp.id, emp.status)}>
              <View style={S.btSecIconBox}><Text style={S.btSecIconTx}>☰</Text></View>
            </TouchableOpacity>
          )}

          {/* Notas e Dados abrem modal AQUI; Parcelas sai para outra tela.
              Por isso os dois primeiros ficam colados num controle segmentado
              e o terceiro fica apartado, com o chevron que é a convenção de
              "isto te leva embora". */}
          <View style={S.acoesSec}>
            <View style={S.grupoModal}>
              <TouchableOpacity
                style={[S.btGrupo, S.btGrupoEsq]}
                activeOpacity={0.6}
                onPress={() => onAbrirNotas(c.id, c.nome)}
              >
                <Ionicons name="create-outline" size={16} color="#4B5563" />
                <Text style={S.btSecTx}>Notas</Text>
                {notasCount > 0 && <View style={S.btSecCount}><Text style={S.btSecCountTx}>{notasCount}</Text></View>}
              </TouchableOpacity>
              <View style={S.divisor} />
              <TouchableOpacity
                style={[S.btGrupo, S.btGrupoDir]}
                activeOpacity={0.6}
                onPress={() => onAbrirDetalhes({ id: c.id, nome: c.nome, telefone: c.telefone_celular, codigo_cliente: c.codigo_cliente })}
              >
                <Ionicons name="person-outline" size={16} color="#4B5563" />
                <Text style={S.btSecTx}>{lang === 'es' ? 'Datos' : 'Dados'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={S.btPagina}
              activeOpacity={0.7}
              onPress={() => nav.navigate('FichaEmprestimo', { emprestimoId: emp.id })}
            >
              <Ionicons name="list-outline" size={16} color="#4338CA" />
              <Text style={S.btPaginaTx}>{lang === 'es' ? 'Cuotas' : 'Parcelas'}</Text>
              <Ionicons name="chevron-forward" size={13} color="#818CF8" />
            </TouchableOpacity>
          </View>

          {/* Link detalhes */}
          {MOSTRAR_LINK_DETALHES && (
          <TouchableOpacity style={S.linkDetalhes} onPress={() => {
            onAbrirDetalhes({ id: c.id, nome: c.nome, telefone: c.telefone_celular, codigo_cliente: c.codigo_cliente });
          }}>
            <Text style={S.linkDetalhesTx}>{t.toqueDetalhes} ▽</Text>
          </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  btPagarFull: {
    height: 48, borderRadius: 12, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btPagarFullTx: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  acoesSec: { flexDirection: 'row', gap: 10, marginTop: 8 },
  grupoModal: {
    flex: 1, flexDirection: 'row', height: 38, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  btGrupo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  btGrupoEsq: {},
  btGrupoDir: {},
  divisor: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 7 },
  btPagina: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 38, borderRadius: 10,
    backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE',
  },
  btPaginaTx: { fontSize: 12, fontWeight: '700', color: '#4338CA' },
  btSecTx: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  btSecCount: {
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center',
  },
  btSecCountTx: { fontSize: 10, fontWeight: '800', color: '#fff' },
  btFicha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#6366F1', borderRadius: 10,
    height: 46, paddingHorizontal: 16, marginLeft: 6,
  },
  btFichaTx: { color: '#fff', fontSize: 13, fontWeight: '700' },
  avWrap: { position: 'relative' },
  avBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#6366F1', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  btSecFicha: {
    backgroundColor: '#6366F1', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, marginLeft: 6,
  },
  bSusp: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEE2E2', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4,
  },
  bSuspTx: { fontSize: 10, fontWeight: '700', color: '#B91C1C' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  // Compacto: menos respiro dentro e entre os cards. O ganho não está no
  // card individual, e sim em quantos cabem na tela sem rolar.
  // Compacto: menos respiro dentro e entre os cards. O paddingLeft maior
  // é o espaço da gota — a borda fina da esquerda fica como sempre foi.
  cardCompacto: { paddingVertical: 8, marginBottom: 5, paddingLeft: 22 },
  // Gota de frequência — só no modo compacto.
  //
  // A coluna da esquerda continua a mesma linha fina de sempre; o que brota
  // dela é uma folha desenhada em SVG. Precisa ser SVG: `borderRadius` só faz
  // canto arredondado, e o encontro da linha com a bolha vira um degrau.
  //
  // O detalhe que faz a forma escorrer em vez de parecer colada está nos
  // pontos de controle das pontas: `C 0 9, ...` mantém o controle em x=0, ou
  // seja, a curva SAI TANGENTE à linha — desce reta antes de abrir. Com o
  // controle fora do eixo ela partia em ângulo e virava meia-bola grudada.
  //
  // `left: 0` num filho absoluto é a borda INTERNA em RN — ou seja, o ponto
  // onde a linha de 5px termina. O lado reto da folha nasce colado nela.
  gotaWrap: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  gotaCaixa: { width: 19, height: 44, alignItems: 'center', justifyContent: 'center' },
  gotaSvg: { position: 'absolute', left: 0, top: 0 },
  // Desloca a letra para a barriga: o centro da caixa cai à direita da massa
  // da curva.
  gotaTx: { color: '#fff', fontSize: 11, fontWeight: '800', marginRight: 4 },

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
  // Mais forte que a data do empréstimo: é informação de COBRANÇA, do mesmo
  // nível do que a badge de frequência diz.
  diaSemLbl: { fontSize: 11, fontWeight: '700' as const, color: '#4338CA', marginTop: 2 },
  pValBig: { fontSize: 18, fontWeight: '800', color: '#1F2937', textAlign: 'right' },
  sCol: { alignItems: 'flex-end' },
  compEmp: { marginTop: 4, alignItems: 'flex-end', gap: 1 },
  compEmpLine: { fontSize: 11, color: '#6B7280' },
  compEmpStrong: { color: '#374151', fontWeight: '700' },
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
  btPagarTodos: { flex: 1, height: 46, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btPagarTodosTx: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btSecVerde: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  btSecAmarelo: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  btSecIconBox: { alignItems: 'center', justifyContent: 'center' },
  btSecIconTx: { fontSize: 20, color: '#FFF', fontWeight: '700' },
  btSecBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  btSecBadgeT: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  linkDetalhes: { alignItems: 'center', paddingVertical: 4 },
  linkDetalhesTx: { fontSize: 12, color: '#9CA3AF' },
  // ⭐ Botão Novo Empréstimo
  // Cores vêm de desfechoBadge(): verde quitado, roxo renegociado, cinza cancelado.
  badgeDesfecho: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeDesfechoTx: { fontSize: 11, fontWeight: '700' as const },
  // Origem do empréstimo (renegociação/renovação/adicional). Discreta: é
  // contexto, não estado — não deve competir com o badge de desfecho.
  origemBdg: { backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  origemBdgT: { fontSize: 10, fontWeight: '600' as const, color: '#7C3AED' },
  origemLbl: { fontSize: 11, fontWeight: '600' as const, color: '#7C3AED', marginTop: 2 },
  tAddRowActive: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    marginBottom: 10, 
    backgroundColor: '#EFF6FF', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#3B82F6' 
  },
  tAddIconActive: { 
    fontSize: 16, 
    color: '#3B82F6', 
    marginRight: 6, 
    fontWeight: '700' as const,
  },
  tAddTextActive: { 
    fontSize: 13, 
    color: '#3B82F6', 
    fontWeight: '600' as const,
  },
});
export default React.memo(ClienteCardTodos);
