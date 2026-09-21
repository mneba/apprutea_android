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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
    semEventos: 'Ninguna movimentación registrada',
    comprovantes: 'Comprobantes',
    documentos: 'Documentos del cliente',
    observacoes: 'Observaciones',
    abertas: 'Pendientes',
    todas: 'Todas',
  },
};

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
  const [soAbertas, setSoAbertas] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);

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
        <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Resumo ── */}
          <View style={S.card}>
            <View style={S.resumoLinha}>
              <View style={S.resumoItem}>
                <Text style={S.resumoRot}>{t.emprestado}</Text>
                <Text style={S.resumoVal}>{fmt(ficha.totais.valor_total)}</Text>
              </View>
              <View style={S.resumoItem}>
                <Text style={S.resumoRot}>{t.saldo}</Text>
                <Text style={[S.resumoVal, { color: ficha.totais.saldo_atual > 0 ? '#DC2626' : '#059669' }]}>
                  {fmt(ficha.totais.saldo_atual)}
                </Text>
              </View>
            </View>
            <View style={S.divider} />
            <View style={S.resumoLinha}>
              <View style={S.resumoItem}>
                <Text style={S.resumoRot}>{t.recebido}</Text>
                <Text style={S.resumoValPeq}>{fmt(ficha.totais.dinheiro_recebido)}</Text>
              </View>
              <View style={S.resumoItem}>
                <Text style={S.resumoRot}>{t.credito}</Text>
                <Text style={[S.resumoValPeq, ficha.totais.credito_disponivel > 0 && { color: '#4F46E5' }]}>
                  {fmt(ficha.totais.credito_disponivel)}
                </Text>
              </View>
              <View style={S.resumoItem}>
                <Text style={S.resumoRot}>{t.parcelas}</Text>
                <Text style={S.resumoValPeq}>
                  {ficha.totais.parcelas_pagas}/{ficha.totais.parcelas_total}
                </Text>
              </View>
            </View>
          </View>

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

          {/* ── Cadeia (renovações) ── */}
          {ficha.cadeia?.length > 1 && (
            <View style={S.card}>
              <Text style={S.cardTitulo}>{t.cadeia}</Text>
              <View style={S.divider} />
              {ficha.cadeia.map(elo => {
                const cor = elo.status === 'QUITADO' ? '#10B981'
                  : elo.status === 'RENEGOCIADO' ? '#9333EA'
                  : elo.status === 'CANCELADO' ? '#9CA3AF' : '#3B82F6';
                return (
                  <TouchableOpacity
                    key={elo.id}
                    style={[S.eloLinha, elo.atual && S.eloAtual]}
                    // Continua tocável quando é o atual: um botão morto parece
                    // quebrado. Só não navega — recarregar a própria ficha
                    // empilharia a mesma tela e o voltar deixaria de funcionar.
                    activeOpacity={elo.atual ? 1 : 0.7}
                    onPress={() => {
                      if (elo.atual) return;
                      navigation.replace('FichaEmprestimo', { emprestimoId: elo.id });
                    }}
                  >
                    <View style={[S.eloPonto, { backgroundColor: elo.atual ? '#fff' : cor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[S.eloTx, elo.atual && S.eloTxAtual]}>
                        {elo.tipo_emprestimo || '—'} · {fmtData(elo.data_emprestimo)}
                      </Text>
                      <Text style={[S.eloSub, elo.atual && S.eloSubAtual]}>
                        {fmt(elo.valor_total)} · {elo.status}
                        {(elo.valor_saldo || 0) > 0 ? ` · ${t.saldo.toLowerCase()} ${fmt(elo.valor_saldo)}` : ''}
                      </Text>
                    </View>
                    {elo.atual ? (
                      <View style={S.eloBadge}><Text style={S.eloBadgeTx}>{t.atual}</Text></View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
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
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },

  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  resumoItem: { flex: 1 },
  resumoRot: { fontSize: 11, color: '#6B7280' },
  resumoVal: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 2 },
  resumoValPeq: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 2 },

  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1,
  },
  seloOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  seloErro: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  seloTx: { fontSize: 13, fontWeight: '700' },
  seloDetalhe: { fontSize: 11, color: '#991B1B', marginTop: 2 },

  eloLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 11, marginTop: 8,
    borderRadius: 10, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  // O selecionado escurece em vez de desbotar: desbotado lê como desabilitado,
  // e o empréstimo que se está vendo é o mais importante da lista.
  eloAtual: { backgroundColor: '#4338CA', borderColor: '#4338CA' },
  eloPonto: { width: 8, height: 8, borderRadius: 4 },
  eloTx: { fontSize: 13, fontWeight: '700', color: '#111827' },
  eloTxAtual: { color: '#fff' },
  eloSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  eloSubAtual: { color: 'rgba(255,255,255,0.85)' },
  eloBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  eloBadgeTx: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

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
