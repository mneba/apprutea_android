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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnexosLista from '../components/AnexosLista';
import Carregando from '../components/Carregando';
import { useAuth } from '../contexts/AuthContext';
import { useTrabalhaCredito } from '../hooks/useTrabalhaCredito';
import { parcelasPagasEquivalentes, fracaoBr } from '../utils/creditoEmTela';
import { buscarFicha, EventoFicha, Ficha } from '../services/fichaEmprestimo';
import { mensagemErro } from '../utils/mensagemErro';
import { moeda, hora, numeroBr } from '../utils/formato';

type Lang = 'pt-BR' | 'es';

const TX = {
  'pt-BR': {
    titulo: 'Ficha do empréstimo',
    erro: 'Não foi possível carregar a ficha',
    tentar: 'Tentar de novo',
    carregando: 'Abrindo a ficha…',
    linhaTempo: 'Linha do tempo',
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
    adiantamento: 'Adiantamento aplicado',
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
    pago: 'Pago',
    jurosLbl: 'Juros',
    creditoCurto: 'Crédito',
    saldoCurto: 'Saldo',
    pc1: 'parcela',
    pcN: 'parcelas',
    pcDe: 'de',
    pcAb1: 'parcela em aberto',
    pcAbN: 'parcelas em aberto',
    semEventos: 'Nenhuma movimentação registrada',
    comprovantes: 'Comprovantes',
    documentos: 'Documentos do cliente',
    semDocumentos: 'nenhum',
    observacoes: 'Observações',
    emprestimoLbl: 'Empréstimo',
    recebidoLbl: 'Recebido',
    restanteLbl: 'Restante',
    totalLbl: 'Total',
    jurosTopo: 'Juros',
    pagas: (a: number | string, b: number) => `${a} de ${b} pagas`,
    tipos: { NOVO: 'Novo', RENOVACAO: 'Renovação', RENEGOCIACAO: 'Renegociação', ADICIONAL: 'Adicional' } as Record<string, string>,
  },
  'es': {
    titulo: 'Ficha del préstamo',
    erro: 'No se pudo cargar la ficha',
    tentar: 'Intentar de nuevo',
    carregando: 'Abriendo la ficha…',
    linhaTempo: 'Línea de tiempo',
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
    adiantamento: 'Anticipo aplicado',
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
    pago: 'Pagada',
    jurosLbl: 'Intereses',
    creditoCurto: 'Crédito',
    saldoCurto: 'Saldo',
    pc1: 'cuota',
    pcN: 'cuotas',
    pcDe: 'de',
    pcAb1: 'cuota pendiente',
    pcAbN: 'cuotas pendientes',
    semEventos: 'Ninguna movimentación registrada',
    comprovantes: 'Comprobantes',
    documentos: 'Documentos del cliente',
    semDocumentos: 'ninguno',
    observacoes: 'Observaciones',
    emprestimoLbl: 'Préstamo',
    recebidoLbl: 'Recibido',
    restanteLbl: 'Restante',
    totalLbl: 'Total',
    jurosTopo: 'Intereses',
    pagas: (a: number | string, b: number) => `${a} de ${b} pagadas`,
    tipos: { NOVO: 'Nuevo', RENOVACAO: 'Renovación', RENEGOCIACAO: 'Renegociación', ADICIONAL: 'Adicional' } as Record<string, string>,
  },
};

const fmt = (v: number | null | undefined) =>
  moeda(Number(v || 0));

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
  return hora(d);
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
  const { idioma } = useAuth();
  const mostrarCredito = useTrabalhaCredito();
  const insets = useSafeAreaInsets();
  const lang: Lang = (idioma as Lang) || 'pt-BR';
  const t = TX[lang];

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  // null = ainda carregando. Com 0, o cartão some (fica montado, para
  // a lista poder carregar e avisar).
  const [docsQtd, setDocsQtd] = useState<number | null>(null);

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
      setErro(mensagemErro(e, t.erro));
    } finally {
      setCarregando(false);
    }
  }, [emprestimoId, t.erro]);

  useEffect(() => { carregar(); }, [carregar]);

  // ⭐ Recarregar ao ganhar foco.
  //
  // Nasceu para o "+", que saiu em 12/11/2026, e FICA: esta tela é empilhada
  // sobre as abas e sobre o ParcelasModal, então o dinheiro pode ter mudado
  // enquanto ela estava atrás. Ficha de dinheiro mostrando estado velho é o
  // formato de erro que este projeto já pagou.
  //
  // A primeira vez é pulada porque o efeito acima já carregou.
  const primeiroFoco = useRef(true);
  useEffect(() => {
    const off = navigation.addListener('focus', () => {
      if (primeiroFoco.current) { primeiroFoco.current = false; return; }
      carregar();
    });
    return off;
  }, [navigation, carregar]);

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

  // SALDO é o que o cliente ainda tem de TRAZER, e `saldo_atual` JÁ É isso:
  // `emprestimos.valor_saldo` vem LÍQUIDO DE CRÉDITO, porque o gatilho
  // `atualizar_saldo_emprestimo` faz `GREATEST(0, Σ parcelas abertas − crédito)`.
  //
  // ⚠ Esta linha subtraía o crédito DE NOVO, e era desconto duplo. Na Camila
  // Rafaela (relato do Julio, 06/11/2026): parcelas abertas 170, crédito 135,
  // `valor_saldo` 35 — e a tela mostrava `max(35 − 135, 0)` = 0,00 EM VERDE,
  // com uma parcela de 200 em aberto. Medido na base: 389 empréstimos em
  // aberto têm crédito e em 23 o saldo aparecia zerado, em 15 rotas.
  //
  // O mesmo erro já tinha sido consertado DENTRO do banco, em
  // `fn_quitar_emprestimo` ("a versão anterior subtraía o crédito de novo,
  // então quitava cobrando a menos"), e o aviso está no CLAUDE.md desde
  // 06/10/2026. Os 35 aqui são o MESMO número que aquela função cobra em
  // dinheiro: 170 das parcelas menos os 135 de crédito que ela consome.
  const saldoFaltaEmp = Math.max(saldoEmp, 0);

  // PAGO é tudo o que o cliente entregou, crédito incluído: quem paga 150 numa
  // parcela de 100 pagou 150. O CRÉDITO não é uma parcela irmã desta — é um
  // PEDAÇO dela, a parte que ainda não baixou parcela. Daí a linha do crédito
  // aparecer derivada, recuada sob o pago, e não como mais um item da lista.
  //
  // Derivado do saldo, e não de `dinheiro_recebido + crédito`, para fechar
  // também quando o crédito vem de outro empréstimo da cadeia — nesse caso ele
  // já entrou no abatimento, e somá-lo contaria o mesmo dinheiro duas vezes.
  //
  // A cadeia fecha por construção: Juros − Pago = Saldo. Na Camila,
  // 4.800 − 35 = 4.765, que é o dinheiro que ela entregou de verdade — e não
  // os 4.800 das 24 parcelas inteiras, que foi o relato do Julio.
  const pagoEmp = Math.max(totalEmp - saldoFaltaEmp, 0);

  const taxaEmp = ficha?.emprestimo?.taxa_juros;
  // Sem zeros à direita: 20.00 vira "20%", 20.50 vira "20,5%". Taxa nula não
  // vira "null%" — fica um travessão.
  const taxaTx = taxaEmp == null || isNaN(Number(taxaEmp))
    ? '—'
    : Number(taxaEmp).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + '%';

  // PARCELA SE CONTA EM PARCELA, NÃO EM DINHEIRO.
  //
  // ⚠ Isto saía de `dinheiro ÷ valor_parcela`, e era a outra metade do relato
  // do Julio: a Camila aparecia com "Pago (24 parcelas)" e, na lista logo
  // abaixo, uma parcela em aberto. 4.800 / 200 = 24 — o resumo contradizia a
  // lista na mesma tela, e nenhuma das duas estava contando parcelas.
  //
  // Quem conta é o banco, em `totais`. Conferido antes de confiar:
  // `status = 'PAGO'` ⟺ `valor_saldo = 0` em 32.099 de 32.099 parcelas, zero
  // divergências nas duas direções — ao contrário de PENDENTE × VENCIDO, que
  // o gatilho grava contra CURRENT_DATE e por isso mente (ver CLAUDE.md).
  //
  // O denominador é `parcelas_total` dos totais, não `numero_parcelas`: as 58
  // parcelas CANCELADO da base não são devidas nem pagas, e ficam fora das
  // duas contagens — somá-las ao total deixaria "23 de 24" com uma a mais.
  const parcelasPagas = Number(ficha?.totais?.parcelas_pagas || 0);
  const parcelasTotal = Number(ficha?.totais?.parcelas_total || 0);

  // ⚠ O "+" DO CABEÇALHO SAIU em 12/11/2026, no mesmo dia em que entrou.
  //
  // A porta das operações — renegociar, empréstimo novo, adicional — é a
  // aba Empréstimos do `ClienteDetalhesModal`. Esta tela é de UM
  // empréstimo, e as três são decisões do CLIENTE: o adicional depende da
  // carteira inteira, não desta conta. Decisão do Mauricio: "não faz
  // sentido" aqui.
  //
  // Com isso, as quatro chaves que `fn_ficha_emprestimo` passou a devolver
  // em sql/2026-11-12_ficha_dia_operacional.sql — `dia_operacional`,
  // `liquidacao_aberta_id`, `tem_atraso`, `cliente_tem_atraso` — ficam SEM
  // USO. Continuam na função e na interface; o modal deriva as suas
  // sozinho, porque está DENTRO do `LiquidacaoProvider` e conhece a data
  // operacional, que é exatamente o que esta tela não tem.

  // Cabeçalho: o nome do cliente é o título, e o subtítulo diz QUAL empréstimo
  // da cadeia está na tela. O título fixo "Ficha do empréstimo" saiu em
  // 18/11/2026 — a tela já diz o que é pelo conteúdo.
  const eloAtual = ficha?.cadeia?.find(e => e.atual);
  const tipoAtual: string = eloAtual?.tipo_emprestimo || ficha?.emprestimo?.tipo_emprestimo || '';
  const dataAtual: string = eloAtual?.data_emprestimo || ficha?.emprestimo?.data_emprestimo || '';
  const subCabecalho = [t.tipos[tipoAtual] || tipoAtual, fmtData(dataAtual)].filter(Boolean).join(' · ');
  // Juros em DINHEIRO: total a pagar menos o que saiu do caixa.
  const jurosEmp = Math.max(totalEmp - principalEmp, 0);
  // Sem crédito à vista: "1,5 de 24 pagas". Ver utils/creditoEmTela.
  const pagasEquiv = parcelasPagasEquivalentes(totalEmp, saldoFaltaEmp, valorParcelaEmp, parcelasTotal);
  const progresso = totalEmp > 0
    ? Math.min(1, pagoEmp / totalEmp)
    : (parcelasTotal > 0 ? parcelasPagas / parcelasTotal : 0);

  const rotuloEvento = (ev: EventoFicha) => ({
    CONCESSAO: t.concessao,
    PAGAMENTO: t.pagamento,
    QUITACAO: t.quitacao,
    CREDITO_CASCATA: mostrarCredito ? t.creditoCascata : t.adiantamento,
    IMPORTACAO: t.importacao,
  }[ev.tipo] || ev.tipo);

  return (
    <View style={S.container}>
      <View style={[S.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={S.btVoltar} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitulo} numberOfLines={1}>{nomeCliente || t.titulo}</Text>
          {!!subCabecalho && <Text style={S.headerSub} numberOfLines={1}>{subCabecalho}</Text>}
        </View>
        {/* Espaçador que equilibra o botão de voltar, para o título ficar
            centrado. Já era isto antes do "+" e voltou a ser. */}
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

        <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Resumo ──
              O MESMO bloco da tela de Parcelas (ParcelasModal, `R.topo`), para
              o vendedor ler as duas do mesmo jeito. Escolhido pelo Mauricio em
              18/11/2026 (mockup, variante B).

              O painel que recolhia saiu: ele existia para rolar a lista de
              parcelas sem perder o saldo de vista, e a lista saiu da ficha.

              Recebido = total − saldo e Restante = saldo, que JÁ vem líquido
              de crédito — ver o comentário de `saldoFaltaEmp`. O crédito
              aparece numa linha própria, informativa, e NÃO se subtrai de
              nada: é o que o vendedor diz ao cliente que ele tem. */}
          <View style={S.topo}>
            <View style={S.topoLinha}>
              <View style={S.topoEsq}>
                <Text style={S.topoRot}>{t.emprestimoLbl}</Text>
                <Text style={S.topoGrande}>{numeroBr(principalEmp)}</Text>
                <Text style={S.topoRot}>
                  {t.jurosTopo} {numeroBr(jurosEmp)} · {taxaTx}
                </Text>
                {parcelasTotal > 0 && (
                  <Text style={S.topoRot}>
                    {parcelasTotal} × {numeroBr(valorParcelaEmp)}
                  </Text>
                )}
              </View>
              <View style={S.topoDir}>
                <View style={S.kv}>
                  <Text style={S.topoRot}>{t.recebidoLbl}</Text>
                  <Text style={S.topoValor}>{numeroBr(pagoEmp)}</Text>
                </View>
                <View style={S.kv}>
                  <Text style={S.topoRot}>{t.restanteLbl}</Text>
                  <Text style={S.topoValor}>{numeroBr(saldoFaltaEmp)}</Text>
                </View>
              </View>
            </View>
            <View style={S.barra}>
              <View style={[S.barraFill, { width: `${Math.round(progresso * 100)}%` }]} />
            </View>
            <View style={S.topoRodape}>
              {parcelasTotal > 0 && (
                <Text style={S.topoRodapeTx}>{t.pagas(!mostrarCredito && pagasEquiv != null ? fracaoBr(pagasEquiv) : parcelasPagas, parcelasTotal)}</Text>
              )}
              <Text style={S.topoRodapeTx}>{t.totalLbl} {numeroBr(totalEmp)}</Text>
            </View>
            {creditoEmp > 0.009 && mostrarCredito && (
              <View style={S.topoCredito}>
                <Text style={S.topoCreditoRot}>{t.credito}</Text>
                <Text style={S.topoCreditoVal}>{numeroBr(creditoEmp)}</Text>
              </View>
            )}
          </View>

          {/* ── Cadeia de empréstimos ──
              Fichas para tocar, em vez de caixa + menu. Rolam de lado: um
              cliente com muitas renovações não empurra nada para baixo. Tocar
              noutra troca a ficha (`replace`, para o voltar não empilhar). */}
          {ficha.cadeia?.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={S.cadeia}
              contentContainerStyle={S.cadeiaConteudo}
            >
              {ficha.cadeia.map(elo => (
                <TouchableOpacity
                  key={elo.id}
                  style={[S.elo, elo.atual && S.eloAtual]}
                  activeOpacity={elo.atual ? 1 : 0.7}
                  onPress={() => {
                    if (elo.atual) return;
                    navigation.replace('FichaEmprestimo', { emprestimoId: elo.id });
                  }}
                >
                  <Text style={[S.eloTx, elo.atual && S.eloTxAtual]}>
                    {numeroBr(elo.valor_principal ?? 0)} · {fmtData(elo.data_emprestimo) || '—'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Conferência ──
              Uma linha pequena quando confere. Quando NÃO confere vira caixa
              vermelha: um empréstimo que não fecha tem de gritar. */}
          {tudoConfere ? (
            <View style={S.confOk}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={S.confOkTx}>{t.confereOk}</Text>
            </View>
          ) : (
            <View style={S.seloErro}>
              <Ionicons name="warning" size={18} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={S.seloTx}>{t.confereErro}</Text>
                {!conf?.caixa_confere && <Text style={S.seloDetalhe}>{t.caixaErro}</Text>}
                {!conf?.credito_confere && <Text style={S.seloDetalhe}>{t.creditoErro}</Text>}
              </View>
            </View>
          )}

          {/* ── Linha do tempo ──
              A aba Parcelas saiu em 18/11/2026: a lista de parcelas, com
              estorno, pagar e anexar comprovante, vive na tela de Parcelas
              aberta pelo card. A ficha é a HISTÓRIA do empréstimo. */}
          <Text style={S.secaoTitulo}>{t.linhaTempo}</Text>

          {ficha.eventos.length === 0 ? (
              <Text style={S.vazio}>{t.semEventos}</Text>
            ) : (
              ficha.eventos.map((ev, i) => {
                const cor = ev.estornado ? '#9CA3AF' : (CORES[ev.tipo] || '#6B7280');
                const chave = ev.operacao_id || `${ev.tipo}-${i}`;
                const aberto = expandido === chave;
                // `anexos` vem contado pelo banco. Sem anexo, o botão não
                // aparece: abria uma lista vazia por PAGAMENTO — uma quitação
                // de 8 parcelas virava 8 caixas "Nenhum anexo enviado".
                const temAnexo = ev.anexos == null
                  ? !!ev.pagamento_ids?.length
                  : ev.anexos > 0;
                const temDetalhe = temAnexo || !!ev.observacoes;
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
                          {(ev.credito_usado || 0) > 0 && mostrarCredito && (
                            <Text style={[S.chip, S.chipRoxo]}>
                              {t.creditoUsado}: {fmt(ev.credito_usado)}
                            </Text>
                          )}
                          {(ev.credito_gerado || 0) > 0 && mostrarCredito && (
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
                            {(ev.saldo_credito || 0) > 0 && mostrarCredito ? ` · ${fmt(ev.saldo_credito)} ${t.credito.toLowerCase()}` : ''}
                          </Text>
                        )}

                        {temDetalhe && (
                          <TouchableOpacity
                            style={S.btDetalhe}
                            onPress={() => setExpandido(aberto ? null : chave)}
                          >
                            <Text style={S.btDetalheTx}>
                              {aberto ? '▲' : '▼'} {temAnexo
                                ? `${t.comprovantes}${ev.anexos != null ? ` (${ev.anexos})` : ''}`
                                : t.observacoes}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {aberto && (
                          <View style={S.detalhe}>
                            {!!ev.observacoes && (
                              <Text style={S.obsTx}>{ev.observacoes}</Text>
                            )}
                            {temAnexo && ev.pagamento_ids?.map(pid => (
                              <AnexosLista
                                key={pid}
                                clienteId={ficha.cliente?.id}
                                pagamentoId={pid}
                                lang={lang}
                                podeEditar={false}
                                ocultarVazio
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}

          {/* ── Documentos do cliente ── */}
          {!!ficha.cliente?.id && (
            // Sem documento: uma linha só, em vez da caixa vazia. Com erro
            // a contagem não chega e o cartão inteiro aparece com a mensagem.
            <View style={[S.card, docsQtd === 0 && S.docsVazio]}>
              {docsQtd === 0 && (
                <>
                  <Text style={[S.cardTitulo, { flexShrink: 1 }]}>{t.documentos}</Text>
                  <Text style={S.docsVazioTx}>{t.semDocumentos}</Text>
                </>
              )}
              <View style={docsQtd === 0 ? { display: 'none' } : undefined}>
              <Text style={S.cardTitulo}>{t.documentos}</Text>
              <View style={S.divider} />
              <AnexosLista
                clienteId={ficha.cliente.id}
                lang={lang}
                podeEditar={false}
                onContagem={setDocsQtd}
              />
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

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
  docsVazio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  docsVazioTx: { fontSize: 13, color: '#9CA3AF' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },

  // Topo: cópia de `R.topo` do ParcelasModal. Mudou lá, muda aqui.
  topo: { backgroundColor: '#1E40AF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 10 },
  topoLinha: { flexDirection: 'row', gap: 12 },
  topoEsq: { flex: 1, flexShrink: 1 },
  topoDir: { flex: 1, flexShrink: 1, justifyContent: 'center', gap: 2, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.25)', paddingLeft: 10 },
  topoRot: { fontSize: 11, color: 'rgba(255,255,255,0.75)', flexShrink: 1 },
  topoGrande: { fontSize: 20, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  topoValor: { fontSize: 13, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  barra: { height: 6, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 99, overflow: 'hidden' },
  barraFill: { height: '100%', backgroundColor: '#34D399' },
  topoRodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8, rowGap: 2 },
  topoRodapeTx: { fontSize: 11, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  topoCredito: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 6 },
  topoCreditoRot: { fontSize: 12, color: '#DDD6FE', flexShrink: 1 },
  topoCreditoVal: { fontSize: 12, fontWeight: '700', color: '#DDD6FE', fontVariant: ['tabular-nums'] },

  cadeia: { flexGrow: 0, marginBottom: 10 },
  cadeiaConteudo: { gap: 6 },
  elo: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6,
  },
  eloAtual: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  eloTx: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  eloTxAtual: { color: '#fff' },

  confOk: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2, marginBottom: 12 },
  confOkTx: { fontSize: 12, fontWeight: '600', color: '#047857', flexShrink: 1 },
  seloErro: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1,
    backgroundColor: '#FEF2F2', borderColor: '#FECACA',
  },
  seloTx: { fontSize: 13, fontWeight: '700', color: '#991B1B' },
  seloDetalhe: { fontSize: 11, color: '#991B1B', marginTop: 2 },

  secaoTitulo: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },

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
});
