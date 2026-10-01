// =====================================================================
// FICHA DO EMPRÉSTIMO
// Arquivo: src/screens/FichaEmprestimoScreen.tsx
// =====================================================================
//
// Responde a pergunta que nenhuma tela respondia: "o que aconteceu com este
// cliente?". O ParcelasModal organizava por PARCELA, então uma quitação de 8
// parcelas virava 8 linhas soltas na mesma data, sem dizer que foram uma só
// operação. Aqui a ordem é o TEMPO, e a unidade é a OPERAÇÃO.
//
// Motivada pelo caso Paloma Unhas (12/09/2026): reconstruir o que houve com
// ela exigiu três rodadas de consulta direta ao banco. A ficha entrega o
// mesmo em uma tela.
//
// Mostra tudo, inclusive o que deu errado — estornos, tentativas abortadas,
// resets. Foram justamente eles que explicaram aquele caso.
//
// Nenhum cálculo mora aqui: fn_ficha_emprestimo já entrega saldos correntes e
// conferência prontos. Esta tela renderiza.

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnexosLista from '../components/AnexosLista';
import Carregando from '../components/Carregando';
import { useAuth } from '../contexts/AuthContext';
import { buscarFicha, EventoFicha, Ficha } from '../services/fichaEmprestimo';

type Lang = 'pt-BR' | 'es';

const TX = {
  'pt-BR': {
    titulo: 'Ficha do empréstimo',
    erro: 'Não foi possível carregar a ficha',
    tentar: 'Tentar de novo',
    carregando: 'Abrindo a ficha…',
    linhaTempo: 'Linha do tempo',
    parcelas: 'Parcelas',
    emprestado: 'Emprestado',
    saldo: 'Saldo devedor',
    recebido: 'Dinheiro recebido',
    credito: 'Crédito disponível',
    confereOk: 'Contas conferem',
    confereErro: 'Divergência encontrada',
    caixaErro: 'O dinheiro recebido não bate com o registrado nas parcelas',
    creditoErro: 'O crédito registrado não bate com o saldo das parcelas',
    cadeia: 'Empréstimos deste cliente',
    atual: 'atual',
    concessao: 'Empréstimo concedido',
    pagamento: 'Pagamento',
    quitacao: 'Quitação',
    creditoCascata: 'Crédito aplicado',
    importacao: 'Importação',
    estornado: 'ESTORNADO',
    estornadoEm: 'Estornado em',
    por: 'por',
    motivo: 'Motivo',
    dinheiro: 'Dinheiro',
    creditoUsado: 'Crédito usado',
    creditoGerado: 'Gerou crédito',
    parcela: 'Parcela',
    parcelasLbl: 'Parcelas',
    liquidacao: 'Liquidação',
    apos: 'Depois deste evento',
    devedor: 'devedor',
    venc: 'Venc.',
    pago: 'Pago',
    pendente: 'Pendente',
    parcial: 'Parcial',
    cancelado: 'Cancelado',
    jurosLbl: 'Juros',
    creditoCurto: 'Crédito',
    saldoCurto: 'Saldo',
    pc1: 'parcela',
    pcN: 'parcelas',
    semEventos: 'Nenhuma movimentação registrada',
    comprovantes: 'Comprovantes',
    documentos: 'Documentos do cliente',
    observacoes: 'Observações',
    abertas: 'Em aberto',
    todas: 'Todas',
  },
  'es': {
    titulo: 'Ficha del préstamo',
    erro: 'No se pudo cargar la ficha',
    tentar: 'Intentar de nuevo',
    carregando: 'Abriendo la ficha…',
    linhaTempo: 'Línea de tiempo',
    parcelas: 'Cuotas',
    emprestado: 'Prestado',
    saldo: 'Saldo deudor',
    recebido: 'Efectivo recibido',
    credito: 'Crédito disponible',
    confereOk: 'Las cuentas cuadran',
    confereErro: 'Divergencia encontrada',
    caixaErro: 'El efectivo recibido no coincide con lo registrado en las cuotas',
    creditoErro: 'El crédito registrado no coincide con el saldo de las cuotas',
    cadeia: 'Préstamos de este cliente',
    atual: 'actual',
    concessao: 'Préstamo otorgado',
    pagamento: 'Pago',
    quitacao: 'Liquidación total',
    creditoCascata: 'Crédito aplicado',
    importacao: 'Importación',
    estornado: 'ANULADO',
    estornadoEm: 'Anulado el',
    por: 'por',
    motivo: 'Motivo',
    dinheiro: 'Efectivo',
    creditoUsado: 'Crédito usado',
    creditoGerado: 'Generó crédito',
    parcela: 'Cuota',
    parcelasLbl: 'Cuotas',
    liquidacao: 'Liquidación',
    apos: 'Después de este evento',
    devedor: 'deudor',
    venc: 'Vence',
    pago: 'Pagada',
    pendente: 'Pendiente',
    parcial: 'Parcial',
    cancelado: 'Cancelada',
    jurosLbl: 'Intereses',
    creditoCurto: 'Crédito',
    saldoCurto: 'Saldo',
    pc1: 'cuota',
    pcN: 'cuotas',
    semEventos: 'Ninguna movimentación registrada',
    comprovantes: 'Comprobantes',
    documentos: 'Documentos del cliente',
    observacoes: 'Observaciones',
    abertas: 'Pendientes',
    todas: 'Todas',
  },
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ANIM = {
  duration: 180,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
} as const;

/** Uma linha do painel: rótulo à esquerda, valor à direita. */
const Linha = ({ rot, val, cor, forte, derivada }: {
  rot: string; val: string; cor?: string; forte?: boolean;
  /** Desdobra a linha de cima: recuo, cotovelo e peso menor. */
  derivada?: boolean;
}) => (
  <View style={[S.linha, derivada && S.linhaDeriv]}>
    <View style={S.linhaEsq}>
      {derivada && (
        <Ionicons name="return-down-forward-outline" size={13} color="rgba(255,255,255,0.45)" />
      )}
      <Text
        style={[S.linhaRot, forte && S.linhaRotForte, derivada && S.linhaRotDeriv]}
        numberOfLines={1}
      >{rot}</Text>
    </View>
    <Text style={[
      S.linhaVal,
      forte && S.linhaValForte,
      derivada && S.linhaValDeriv,
      !!cor && { color: cor },
    ]}>{val}</Text>
  </View>
);

const fmt = (v: number | null | undefined) =>
  '$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `YYYY-MM-DD` ou timestamp → `DD/MM/AA`. */
const fmtData = (d?: string | null) => {
  if (!d) return '';
  const iso = String(d).substring(0, 10);
  const [y, m, dia] = iso.split('-');
  if (!y || !m || !dia) return '';
  return `${dia}/${m}/${y.substring(2)}`;
};

/** Hora do instante real da operação. Vazio quando só há data (concessão). */
const fmtHora = (ts?: string | null) => {
  if (!ts || String(ts).length <= 10) return '';
  const d = new Date(String(ts).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const CORES: Record<string, string> = {
  CONCESSAO: '#6366F1',
  PAGAMENTO: '#10B981',
  QUITACAO: '#059669',
  CREDITO_CASCATA: '#4F46E5',
  IMPORTACAO: '#6B7280',
};

const ICONES: Record<string, any> = {
  CONCESSAO: 'cash-outline',
  PAGAMENTO: 'arrow-down-circle-outline',
  QUITACAO: 'checkmark-done-circle-outline',
  CREDITO_CASCATA: 'card-outline',
  IMPORTACAO: 'cloud-download-outline',
};

export default function FichaEmprestimoScreen({ route, navigation }: any) {
  const emprestimoId: string = route?.params?.emprestimoId;
  const { idioma, vendedor } = useAuth();
  const insets = useSafeAreaInsets();
  const lang: Lang = (idioma as Lang) || 'pt-BR';
  const t = TX[lang];

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<'parcelas' | 'tempo'>('parcelas');
  const [resumoAberto, setResumoAberto] = useState(true);
  const [soAbertas, setSoAbertas] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!emprestimoId) {
      setErro('Empréstimo não informado');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setFicha(await buscarFicha(emprestimoId));
    } catch (e: any) {
      console.error('❌ Ficha:', e);
      setErro(e?.message || t.erro);
    } finally {
      setCarregando(false);
    }
  }, [emprestimoId, t.erro]);

  useEffect(() => { carregar(); }, [carregar]);

  const nomeCliente = ficha?.cliente?.nome || '';
  const conf = ficha?.conferencia;
  const tudoConfere = !!conf && conf.caixa_confere && conf.credito_confere;

  // Os números do painel. Nenhum é lido de coluna que alguém mantenha à mão:
  // todos saem do que o banco já calculou ou de uma subtração entre eles.
  const principalEmp = Number(ficha?.emprestimo?.valor_principal || 0);
  const totalEmp = Number(ficha?.totais?.valor_total || 0);
  const saldoEmp = Number(ficha?.totais?.saldo_atual || 0);
  const creditoEmp = Number(ficha?.totais?.credito_disponivel || 0);
  const valorParcelaEmp = Number(ficha?.emprestimo?.valor_parcela || 0);

  // SALDO é o que o cliente ainda tem de TRAZER, e por isso desconta o
  // crédito: esse dinheiro ele já entregou e pode usá-lo a qualquer momento
  // para pagar uma parcela. `saldo_atual` é a dívida contábil das parcelas,
  // que não enxerga crédito ainda não aplicado — e é maior exatamente por ele.
  const saldoFaltaEmp = Math.max(saldoEmp - creditoEmp, 0);

  // PAGO é tudo o que o cliente entregou, crédito incluído: quem paga 150 numa
  // parcela de 100 pagou 150. O CRÉDITO não é uma parcela irmã desta — é um
  // PEDAÇO dela, a parte que ainda não baixou parcela. Daí a linha do crédito
  // aparecer derivada, recuada sob o pago, e não como mais um item da lista.
  //
  // Derivado do saldo, e não de `dinheiro_recebido + crédito`, para fechar
  // também quando o crédito vem de outro empréstimo da cadeia — nesse caso ele
  // já entrou no abatimento, e somá-lo contaria o mesmo dinheiro duas vezes.
  //
  // A cadeia fecha por construção: Juros − Pago = Saldo.
  const pagoEmp = Math.max(totalEmp - saldoFaltaEmp, 0);

  const taxaEmp = ficha?.emprestimo?.taxa_juros;
  // Sem zeros à direita: 20.00 vira "20%", 20.50 vira "20,5%". Taxa nula não
  // vira "null%" — fica um travessão.
  const taxaTx = taxaEmp == null || isNaN(Number(taxaEmp))
    ? '—'
    : Number(taxaEmp).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + '%';

  // "Pago (1,5 parcelas)". O número sai do dinheiro dividido pelo valor da
  // parcela e pode ser quebrado — pagamento parcial é a regra, não a exceção.
  // Sem valor de parcela o rótulo fica sozinho, em vez de exibir uma divisão
  // por zero.
  const rotComParcelas = (rot: string, valor: number) => {
    if (!valorParcelaEmp) return rot;
    const n = Math.round((valor / valorParcelaEmp) * 10) / 10;
    const txt = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
    return `${rot} (${txt} ${n === 1 ? t.pc1 : t.pcN})`;
  };

  const rotuloEvento = (ev: EventoFicha) => ({
    CONCESSAO: t.concessao,
    PAGAMENTO: t.pagamento,
    QUITACAO: t.quitacao,
    CREDITO_CASCATA: t.creditoCascata,
    IMPORTACAO: t.importacao,
  }[ev.tipo] || ev.tipo);

  return (
    <View style={S.container}>
      <View style={[S.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={S.btVoltar} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitulo}>{t.titulo}</Text>
          {!!nomeCliente && <Text style={S.headerSub} numberOfLines={1}>{nomeCliente}</Text>}
        </View>
        <View style={S.btVoltar} />
      </View>

      {carregando ? (
        <Carregando texto={t.carregando} />
      ) : erro ? (
        <View style={S.erroBox}>
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={S.erroTx}>{erro}</Text>
          <TouchableOpacity style={S.btTentar} onPress={carregar}>
            <Text style={S.btTentarTx}>{t.tentar}</Text>
          </TouchableOpacity>
        </View>
      ) : !ficha ? null : (
        <>

        {/* Recolhido, o painel é o MESMO card — mesma cor, mesmo raio, mesmas
            margens —, só que de uma linha. Não vira uma faixa de ponta a
            ponta: minimizar é encolher dentro dos próprios limites, não trocar
            de forma.

            Continua fora do ScrollView de propósito: é o único jeito de rolar
            a lista de parcelas sem perder o saldo de vista. */}
        {!resumoAberto && (
          <TouchableOpacity
            style={[S.resumo, S.resumoMin]}
            onPress={() => { LayoutAnimation.configureNext(ANIM); setResumoAberto(true); }}
            activeOpacity={0.85}
          >
            <Text style={S.linhaRotForte} numberOfLines={1}>
              {rotComParcelas(t.saldoCurto, saldoFaltaEmp)}
            </Text>
            <View style={S.minDir}>
              <Text style={[S.linhaVal, S.linhaValForte, { color: saldoFaltaEmp > 0 ? '#FCD34D' : '#6EE7B7' }]}>
                {fmt(saldoFaltaEmp)}
              </Text>
              <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.6)" />
            </View>
          </TouchableOpacity>
        )}

        <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Resumo ──
              Linha a linha, rótulo à esquerda e valor à direita: a conta do
              empréstimo se lê de cima para baixo como um extrato, em vez de
              exigir que o vendedor junte células espalhadas em colunas.

              A cadeia fecha em `Juros − Pago = Saldo`, por construção.
              `Pago` é tudo o que o cliente entregou e `Saldo` é o que falta
              trazer; o `Crédito` é um pedaço do pago, não um item à parte, e
              por isso aparece recuado sob ele.

              Recolhido, o painel vira uma barra de uma linha só com o saldo,
              fixa abaixo do cabeçalho: sai de dentro do scroll justamente
              para que rolar a lista de parcelas não esconda o número. */}
          {/* O card inteiro é o botão de recolher — o chevron lá embaixo é só
              o indicador de que ele responde ao toque. */}
          {resumoAberto && (
          <TouchableOpacity
            style={S.resumo}
            onPress={() => { LayoutAnimation.configureNext(ANIM); setResumoAberto(false); }}
            activeOpacity={0.9}
          >

            <Linha rot={t.emprestado} val={fmt(principalEmp)} />
            <Linha rot={`${t.jurosLbl} (${taxaTx})`} val={fmt(totalEmp)} />

            <View style={S.resumoDiv} />

            <Linha rot={rotComParcelas(t.pago, pagoEmp)} val={fmt(pagoEmp)} />
            <Linha
              rot={t.creditoCurto}
              val={fmt(creditoEmp)}
              cor={creditoEmp > 0 ? '#C7D2FE' : undefined}
              derivada
            />

            <View style={S.resumoDiv} />

            {/* Âmbar quando ainda deve, verde quando zerou: no fundo escuro o
                vermelho some, e o que importa é a distinção. */}
            <Linha
              rot={rotComParcelas(t.saldoCurto, saldoFaltaEmp)}
              val={fmt(saldoFaltaEmp)}
              cor={saldoFaltaEmp > 0 ? '#FCD34D' : '#6EE7B7'}
              forte
            />
            <Linha rot={t.parcela} val={fmt(valorParcelaEmp)} />

            <View style={S.pega} pointerEvents="none">
              <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.65)" />
            </View>

          </TouchableOpacity>
          )}

          {/* ── Conferência ──
              Aparece sempre, verde ou vermelha. Um empréstimo que não fecha
              precisa gritar, não ficar escondido atrás de um toque. */}
          <View style={[S.selo, tudoConfere ? S.seloOk : S.seloErro]}>
            <Ionicons
              name={tudoConfere ? 'shield-checkmark' : 'warning'}
              size={18}
              color={tudoConfere ? '#059669' : '#DC2626'}
            />
            <View style={{ flex: 1 }}>
              <Text style={[S.seloTx, { color: tudoConfere ? '#065F46' : '#991B1B' }]}>
                {tudoConfere ? t.confereOk : t.confereErro}
              </Text>
              {!conf?.caixa_confere && <Text style={S.seloDetalhe}>{t.caixaErro}</Text>}
              {!conf?.credito_confere && <Text style={S.seloDetalhe}>{t.creditoErro}</Text>}
            </View>
          </View>

          {/* ── Cadeia de empréstimos ──
              Dropdown, e não lista aberta: um cliente com cinco renovações
              empurrava as parcelas para fora da tela logo na abertura. Fechado
              ele é uma linha que diz onde você está; aberto, a escolha. */}
          {ficha.cadeia?.length > 1 && (
            <TouchableOpacity
              style={S.seletor}
              activeOpacity={0.7}
              onPress={() => setSeletorAberto(true)}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color="#4338CA" />
              <View style={{ flex: 1 }}>
                <Text style={S.seletorRot}>{t.cadeia}</Text>
                <Text style={S.seletorTx} numberOfLines={1}>
                  {(() => {
                    const atual = ficha.cadeia.find(e => e.atual);
                    const pos = ficha.cadeia.findIndex(e => e.atual) + 1;
                    return atual
                      ? `${pos}/${ficha.cadeia.length} · ${atual.tipo_emprestimo || '—'} · ${fmtData(atual.data_emprestimo)}`
                      : `${ficha.cadeia.length}`;
                  })()}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}

          {/* ── Abas ── */}
          <View style={S.abas}>
            <TouchableOpacity
              style={[S.aba, aba === 'parcelas' && S.abaAtiva]}
              onPress={() => setAba('parcelas')}
            >
              <Text style={[S.abaTx, aba === 'parcelas' && S.abaTxAtiva]}>{t.parcelas}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.aba, aba === 'tempo' && S.abaAtiva]}
              onPress={() => setAba('tempo')}
            >
              <Text style={[S.abaTx, aba === 'tempo' && S.abaTxAtiva]}>{t.linhaTempo}</Text>
            </TouchableOpacity>
          </View>

          {aba === 'parcelas' ? (
            <>
              <View style={S.filtro}>
                <TouchableOpacity
                  style={[S.filtroBt, soAbertas && S.filtroBtOn]}
                  onPress={() => setSoAbertas(true)}
                >
                  <Text style={[S.filtroTx, soAbertas && S.filtroTxOn]}>
                    {t.abertas} ({ficha.totais.parcelas_abertas})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.filtroBt, !soAbertas && S.filtroBtOn]}
                  onPress={() => setSoAbertas(false)}
                >
                  <Text style={[S.filtroTx, !soAbertas && S.filtroTxOn]}>
                    {t.todas} ({ficha.totais.parcelas_total})
                  </Text>
                </TouchableOpacity>
              </View>
            <View style={S.card}>
              {ficha.parcelas.filter((p: any) => !soAbertas || p.status !== 'PAGO').map((p: any) => {
                const pago = p.status === 'PAGO';
                const parcial = p.status === 'PARCIAL';
                const rot = pago ? t.pago : parcial ? t.parcial
                  : p.status === 'CANCELADO' ? t.cancelado : t.pendente;
                const cor = pago ? '#059669' : parcial ? '#D97706' : '#6B7280';
                // Anexos são gravados por PAGAMENTO. Parcela ainda não paga
                // não tem onde pendurar arquivo — o botão some em vez de
                // abrir uma gaveta que não aceita nada.
                const pags: string[] = p.pagamento_ids || [];
                const abertoAnexos = anexoAberto === p.id;
                return (
                  <View key={p.id} style={S.parcelaBloco}>
                    <View style={S.parcelaLinha}>
                      <Text style={S.parcelaNum}>{String(p.numero_parcela).padStart(2, '0')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={S.parcelaTx}>
                          {t.venc} {fmtData(p.data_vencimento)}
                          {p.data_pagamento ? ` · ${t.pago} ${fmtData(p.data_pagamento)}` : ''}
                        </Text>
                        <Text style={[S.parcelaStatus, { color: cor }]}>{rot}</Text>
                        {!!p.observacoes && (
                          <Text style={S.parcelaObs} numberOfLines={4}>{p.observacoes}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={S.parcelaValor}>{fmt(p.valor_parcela)}</Text>
                        {Number(p.valor_pago || 0) > 0 && (
                          <Text style={S.parcelaPago}>{fmt(p.valor_pago)}</Text>
                        )}
                        {Number(p.saldo_excedente || 0) > 0 && (
                          <Text style={S.parcelaCredito}>+{fmt(p.saldo_excedente)}</Text>
                        )}
                      </View>
                      {pags.length > 0 && (
                        <TouchableOpacity
                          style={[S.clipeBt, abertoAnexos && S.clipeBtOn]}
                          onPress={() => setAnexoAberto(abertoAnexos ? null : p.id)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="attach-outline"
                            size={17}
                            color={abertoAnexos ? '#fff' : '#6B7280'}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    {abertoAnexos && (
                      <View style={S.anexosBox}>
                        {pags.map(pid => (
                          <AnexosLista
                            key={pid}
                            clienteId={ficha.cliente?.id}
                            pagamentoId={pid}
                            lang={lang}
                            enviadoPor={vendedor?.user_id || null}
                            enviadoPorNome={vendedor?.nome || null}
                            podeEditar
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            </>
          ) : (
            ficha.eventos.length === 0 ? (
              <Text style={S.vazio}>{t.semEventos}</Text>
            ) : (
              ficha.eventos.map((ev, i) => {
                const cor = ev.estornado ? '#9CA3AF' : (CORES[ev.tipo] || '#6B7280');
                const chave = ev.operacao_id || `${ev.tipo}-${i}`;
                const aberto = expandido === chave;
                const temDetalhe = !!(ev.pagamento_ids?.length || ev.observacoes);
                return (
                  <View key={chave} style={[S.evento, ev.estornado && S.eventoEstornado]}>
                    <View style={S.eventoTopo}>
                      <View style={[S.eventoIcone, { backgroundColor: cor + '22' }]}>
                        <Ionicons name={ICONES[ev.tipo] || 'ellipse-outline'} size={18} color={cor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[S.eventoTitulo, ev.estornado && S.riscado]}>
                          {rotuloEvento(ev)}
                        </Text>
                        <Text style={S.eventoData}>
                          {fmtData(ev.data_operacional)}
                          {fmtHora(ev.quando) ? ` · ${fmtHora(ev.quando)}` : ''}
                          {ev.autor ? ` · ${ev.autor}` : ''}
                        </Text>
                      </View>
                      {ev.tipo === 'CONCESSAO' ? (
                        <Text style={[S.eventoValor, { color: cor }]}>{fmt(ev.valor_emprestado)}</Text>
                      ) : (
                        <Text style={[S.eventoValor, { color: cor }, ev.estornado && S.riscado]}>
                          {fmt(ev.aplicado)}
                        </Text>
                      )}
                    </View>

                    {/* Composição: dinheiro e crédito separados. É exatamente o
                        que faltava no extrato — a quitação da Paloma mostrava
                        $360 sem dizer que outros $120 vieram de crédito. */}
                    {ev.tipo !== 'CONCESSAO' && (
                      <View style={S.eventoCorpo}>
                        {!!ev.parcelas?.length && (
                          <Text style={S.eventoInfo}>
                            {ev.parcelas.length === 1
                              ? `${t.parcela} ${ev.parcelas[0]}`
                              : `${t.parcelasLbl} ${ev.parcelas[0]}–${ev.parcelas[ev.parcelas.length - 1]} (${ev.parcelas.length})`}
                          </Text>
                        )}
                        <View style={S.chips}>
                          {(ev.dinheiro || 0) > 0 && (
                            <Text style={[S.chip, S.chipVerde]}>
                              {t.dinheiro}: {fmt(ev.dinheiro)}
                            </Text>
                          )}
                          {(ev.credito_usado || 0) > 0 && (
                            <Text style={[S.chip, S.chipRoxo]}>
                              {t.creditoUsado}: {fmt(ev.credito_usado)}
                            </Text>
                          )}
                          {(ev.credito_gerado || 0) > 0 && (
                            <Text style={[S.chip, S.chipAzul]}>
                              {t.creditoGerado}: {fmt(ev.credito_gerado)}
                            </Text>
                          )}
                          {!!ev.forma_pagamento && (
                            <Text style={[S.chip, S.chipCinza]}>{ev.forma_pagamento}</Text>
                          )}
                        </View>

                        {!!ev.liquidacao_data && (
                          <Text style={S.eventoLiq}>
                            {t.liquidacao} {fmtData(ev.liquidacao_data)}
                          </Text>
                        )}

                        {ev.estornado && (
                          <View style={S.estornoBox}>
                            <Text style={S.estornoTag}>{t.estornado}</Text>
                            <Text style={S.estornoTx}>
                              {t.estornadoEm} {fmtData(ev.data_estorno)}
                              {ev.estornado_por ? ` ${t.por} ${ev.estornado_por}` : ''}
                            </Text>
                            {!!ev.motivo_estorno && (
                              <Text style={S.estornoTx}>{t.motivo}: {ev.motivo_estorno}</Text>
                            )}
                          </View>
                        )}

                        {!ev.estornado && (
                          <Text style={S.eventoSaldo}>
                            {t.apos}: {fmt(ev.saldo_devedor)} {t.devedor}
                            {(ev.saldo_credito || 0) > 0 ? ` · ${fmt(ev.saldo_credito)} ${t.credito.toLowerCase()}` : ''}
                          </Text>
                        )}

                        {temDetalhe && (
                          <TouchableOpacity
                            style={S.btDetalhe}
                            onPress={() => setExpandido(aberto ? null : chave)}
                          >
                            <Text style={S.btDetalheTx}>
                              {aberto ? '▲' : '▼'} {t.comprovantes} ({ev.anexos ?? 0})
                            </Text>
                          </TouchableOpacity>
                        )}

                        {aberto && (
                          <View style={S.detalhe}>
                            {!!ev.observacoes && (
                              <Text style={S.obsTx}>{ev.observacoes}</Text>
                            )}
                            {ev.pagamento_ids?.map(pid => (
                              <AnexosLista
                                key={pid}
                                clienteId={ficha.cliente?.id}
                                pagamentoId={pid}
                                lang={lang}
                                podeEditar={false}
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )
          )}

          {/* ── Documentos do cliente ── */}
          {!!ficha.cliente?.id && (
            <View style={S.card}>
              <Text style={S.cardTitulo}>{t.documentos}</Text>
              <View style={S.divider} />
              <AnexosLista clienteId={ficha.cliente.id} lang={lang} podeEditar={false} />
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
        </>
      )}

      {/* Escolha do empréstimo. Modal e não menu ancorado: no Android antigo
          menu flutuante posicionado à mão erra em tela pequena. */}
      <Modal
        visible={seletorAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setSeletorAberto(false)}
      >
        <TouchableOpacity
          style={S.selOverlay}
          activeOpacity={1}
          onPress={() => setSeletorAberto(false)}
        >
          <View style={S.selCaixa}>
            <Text style={S.selTitulo}>{t.cadeia}</Text>
            {ficha?.cadeia?.map(elo => {
              const cor = elo.status === 'QUITADO' ? '#10B981'
                : elo.status === 'RENEGOCIADO' ? '#9333EA'
                : elo.status === 'CANCELADO' ? '#9CA3AF' : '#3B82F6';
              return (
                <TouchableOpacity
                  key={elo.id}
                  style={[S.selLinha, elo.atual && S.selLinhaAtual]}
                  activeOpacity={elo.atual ? 1 : 0.7}
                  onPress={() => {
                    setSeletorAberto(false);
                    // Não recarrega o mesmo: push da própria ficha empilharia
                    // a mesma tela e quebraria o voltar.
                    if (elo.atual) return;
                    navigation.replace('FichaEmprestimo', { emprestimoId: elo.id });
                  }}
                >
                  <View style={[S.eloPonto, { backgroundColor: cor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[S.eloTx, elo.atual && { color: '#4338CA' }]}>
                      {elo.tipo_emprestimo || '—'} · {fmtData(elo.data_emprestimo)}
                    </Text>
                    <Text style={S.eloSub}>
                      {fmt(elo.valor_total)} · {elo.status}
                      {(elo.valor_saldo || 0) > 0 ? ` · ${t.saldo.toLowerCase()} ${fmt(elo.valor_saldo)}` : ''}
                    </Text>
                  </View>
                  {elo.atual
                    ? <Ionicons name="checkmark-circle" size={18} color="#4338CA" />
                    : <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  header: {
    backgroundColor: '#3B82F6',
    paddingBottom: 18,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btVoltar: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitulo: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', marginTop: 1 },

  scroll: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },

  erroBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  erroTx: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginTop: 10 },
  btTentar: {
    marginTop: 16, backgroundColor: '#3B82F6',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  btTentarTx: { color: '#fff', fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitulo: { fontSize: 13, fontWeight: '700', color: '#374151' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },

  resumo: {
    // Azul da familia do cabecalho (#3B82F6), bem mais fundo. O #2563EB que
    // tentei antes estourava: saturado demais para uma area grande e chapada,
    // ainda por cima encostada num azul claro. Superficie grande pede tom
    // baixo; o brilho fica para o saldo em ambar.
    backgroundColor: '#1E40AF', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#172554', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  resumoDiv: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 6 },

  // Minimizado: o mesmo card, uma linha. Herda `resumo` e só troca o arranjo
  // interno e as margens que o ScrollView daria.
  resumoMin: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, marginHorizontal: 14, marginTop: 14, marginBottom: 4,
    paddingVertical: 12,
  },
  minDir: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  pega: { alignItems: 'center', paddingTop: 4, paddingBottom: 2, marginTop: 2 },

  linha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, gap: 12,
  },
  linhaEsq: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  linhaRot: { fontSize: 13, color: 'rgba(255,255,255,0.78)', flexShrink: 1 },

  // Derivada: recuo, cotovelo e peso menor. O crédito é um pedaço do pago
  // logo acima, não um irmão dele na lista.
  linhaDeriv: { paddingLeft: 14, paddingVertical: 4, marginTop: -2 },
  linhaRotDeriv: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  linhaValDeriv: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  linhaRotForte: { fontSize: 14, color: '#fff', fontWeight: '700' },
  linhaVal: { fontSize: 15, fontWeight: '700', color: '#fff' },
  linhaValForte: { fontSize: 20, fontWeight: '800' },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  resumoItem: { flex: 1 },
  resumoRot: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  resumoVal: { fontSize: 19, fontWeight: '800', color: '#fff', marginTop: 3 },
  resumoValPeq: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 3 },

  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1,
  },
  seloOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  seloErro: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  seloTx: { fontSize: 13, fontWeight: '700' },
  seloDetalhe: { fontSize: 11, color: '#991B1B', marginTop: 2 },

  seletor: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  seletorRot: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  seletorTx: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 2 },

  selOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  selCaixa: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  selTitulo: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  selLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, marginTop: 6,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6',
  },
  selLinhaAtual: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },

  eloPonto: { width: 8, height: 8, borderRadius: 4 },
  eloTx: { fontSize: 13, fontWeight: '700', color: '#111827' },
  eloSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  filtro: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filtroBt: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  filtroBtOn: { backgroundColor: '#4338CA', borderColor: '#4338CA' },
  filtroTx: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filtroTxOn: { color: '#fff' },
  abas: { flexDirection: 'row', backgroundColor: '#E0E7FF', borderRadius: 10, padding: 3, marginBottom: 12 },
  aba: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  abaAtiva: { backgroundColor: '#fff' },
  abaTx: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  abaTxAtiva: { color: '#1D4ED8' },

  vazio: { textAlign: 'center', color: '#9CA3AF', marginTop: 24, fontSize: 13 },

  evento: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  eventoEstornado: { backgroundColor: '#FAFAFA' },
  eventoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventoIcone: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  eventoTitulo: { fontSize: 14, fontWeight: '700', color: '#111827' },
  eventoData: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  eventoValor: { fontSize: 15, fontWeight: '700' },
  riscado: { textDecorationLine: 'line-through', color: '#9CA3AF' },

  eventoCorpo: { marginTop: 8, paddingLeft: 44 },
  eventoInfo: { fontSize: 12, color: '#374151', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  chipVerde: { backgroundColor: '#ECFDF5', color: '#047857' },
  chipRoxo: { backgroundColor: '#EEF2FF', color: '#4338CA' },
  chipAzul: { backgroundColor: '#EFF6FF', color: '#1D4ED8' },
  chipCinza: { backgroundColor: '#F3F4F6', color: '#4B5563' },
  eventoLiq: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  eventoSaldo: { fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' },

  estornoBox: {
    marginTop: 8, padding: 8, borderRadius: 8,
    backgroundColor: '#FEF2F2', borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  estornoTag: { fontSize: 10, fontWeight: '800', color: '#991B1B', letterSpacing: 0.5 },
  estornoTx: { fontSize: 11, color: '#7F1D1D', marginTop: 2 },

  btDetalhe: { marginTop: 8, alignSelf: 'flex-start' },
  btDetalheTx: { fontSize: 11, color: '#3B82F6', fontWeight: '600' },
  detalhe: { marginTop: 8 },
  obsTx: { fontSize: 11, color: '#6B7280', marginBottom: 6 },

  parcelaBloco: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  clipeBt: {
    width: 32, height: 32, borderRadius: 8, marginLeft: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  clipeBtOn: { backgroundColor: '#4338CA' },
  anexosBox: { paddingBottom: 10, paddingLeft: 32 },
  parcelaLinha: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 9,
  },
  parcelaNum: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', width: 22, marginTop: 1 },
  parcelaTx: { fontSize: 12, color: '#374151' },
  parcelaStatus: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  parcelaObs: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  parcelaValor: { fontSize: 13, fontWeight: '700', color: '#111827' },
  parcelaPago: { fontSize: 11, color: '#059669', marginTop: 1 },
  parcelaCredito: { fontSize: 11, color: '#4F46E5', marginTop: 1 },
});
