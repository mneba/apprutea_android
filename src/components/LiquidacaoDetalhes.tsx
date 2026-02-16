// =====================================================
// MODAIS DE DETALHE DA LIQUIDAÇÃO DIÁRIA
// Arquivo: src/components/LiquidacaoDetalhes.tsx
// =====================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../services/supabase';

const { width, height } = Dimensions.get('window');

// =====================================================
// HELPERS
// =====================================================
const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (d: string | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR');
};

const fmtHora = (d: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// =====================================================
// HEADER PADRÃO DOS MODAIS
// =====================================================
const ModalHeader = ({
  titulo,
  icone,
  cor,
  onClose,
}: {
  titulo: string;
  icone: string;
  cor: string;
  onClose: () => void;
}) => (
  <View style={[dStyles.header, { backgroundColor: cor }]}>  
    <View style={dStyles.headerLeft}>
      <Text style={dStyles.headerIcone}>{icone}</Text>
      <Text style={dStyles.headerTitulo}>{titulo}</Text>
    </View>
    <TouchableOpacity onPress={onClose} style={dStyles.headerClose}>
      <Text style={dStyles.headerCloseText}>✕</Text>
    </TouchableOpacity>
  </View>
);

// =====================================================
// 1. MODAL EXTRATO (CAIXA)
// =====================================================
interface ExtratoProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  caixaInicial: number;
  caixaFinal: number;
}

// =====================================================
// 1. MODAL EXTRATO (CAIXA) - ESTILO CUPOM FISCAL
// =====================================================
interface ExtratoProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  caixaInicial: number;
  caixaFinal: number;
  rotaNome?: string;
}

export function ModalExtrato({ visible, onClose, liquidacaoId, caixaInicial, caixaFinal, rotaNome }: ExtratoProps) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef<ScrollView>(null);
  const extratoRef = React.useRef<View>(null);

  useEffect(() => {
    if (visible && liquidacaoId) carregarExtrato();
  }, [visible, liquidacaoId]);

  const carregarExtrato = async () => {
    setLoading(true);
    try {
      // Busca movimentações financeiras
      const { data, error } = await supabase
        .from('financeiro')
        .select('id, tipo, categoria, descricao, valor, data_lancamento, created_at, forma_pagamento, cliente_nome, status')
        .eq('liquidacao_id', liquidacaoId)
        .eq('status', 'PAGO')
        .order('created_at', { ascending: true });

      if (!error) setRegistros(data || []);

      // Busca pagamentos de parcelas (cobranças)
      const { data: pags, error: errPag } = await supabase
        .from('pagamentos_parcelas')
        .select(`
          id, numero_parcela, valor_pago_total, forma_pagamento, created_at,
          cliente:cliente_id(nome, consecutivo)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .eq('estornado', false)
        .order('created_at', { ascending: true });

      if (!errPag) setPagamentos(pags || []);
    } catch (e) {
      console.error('Erro extrato:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalEntradas = registros.filter(r => r.tipo === 'RECEBER').reduce((s, r) => s + parseFloat(r.valor), 0);
  const totalSaidas = registros.filter(r => r.tipo === 'PAGAR').reduce((s, r) => s + parseFloat(r.valor), 0);
  const totalPagamentos = pagamentos.reduce((s, p) => s + parseFloat(p.valor_pago_total || 0), 0);
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const DIV = '- - - - - - - - - - - -';
  const DDIV = '= = = = = = = = = = = =';

  const compartilharExtrato = async () => {
    try {
      let txt = '';
      txt += `${rotaNome || 'Rota'}\n`;
      txt += `EXTRATO LIQUIDAÇÃO DIÁRIA\n`;
      txt += `= = = = = = = = = = = =\n`;
      txt += `${dataHoje}  ${horaAgora}\n`;
      txt += `- - - - - - - - - - - -\n`;
      txt += `CAIXA INICIAL     ${fmt(caixaInicial)}\n`;
      txt += `- - - - - - - - - - - -\n`;
      txt += `(+) ENTRADAS      ${fmt(totalEntradas)}\n`;
      txt += `(-) SAIDAS        ${fmt(totalSaidas)}\n`;
      txt += `(+) COBRANÇAS     ${fmt(totalPagamentos)}\n`;
      txt += `= = = = = = = = = = = =\n`;
      txt += `CAIXA FINAL       ${fmt(caixaFinal)}\n`;
      txt += `= = = = = = = = = = = =\n\n`;

      txt += `MOVIMENTAÇÕES (${registros.length})\n`;
      txt += `- - - - - - - - - - - -\n`;
      registros.forEach((item, idx) => {
        const sinal = item.tipo === 'RECEBER' ? '+' : '-';
        txt += `${String(idx + 1).padStart(2, '0')} ${formatarCategoria(item.categoria)}\n`;
        txt += `   ${sinal}${fmt(parseFloat(item.valor))}  ${fmtHora(item.created_at)}\n`;
      });

      if (pagamentos.length > 0) {
        txt += `\nCOBRANÇAS (${pagamentos.length})\n`;
        txt += `- - - - - - - - - - - -\n`;
        pagamentos.forEach((p) => {
          const nome = p.cliente?.nome || 'Cliente';
          txt += `${nome}  +${fmt(parseFloat(p.valor_pago_total))}\n`;
        });
      }

      txt += `= = = = = = = = = = = =\n`;
      txt += `TOTAL ENTRADAS:  ${fmt(totalEntradas)}\n`;
      txt += `TOTAL COBRANÇAS: ${fmt(totalPagamentos)}\n`;
      txt += `TOTAL SAIDAS:    ${fmt(totalSaidas)}\n`;
      txt += `- - - - - - - - - - - -\n`;
      txt += `SALDO FINAL:     ${fmt(caixaFinal)}\n`;
      txt += `= = = = = = = = = = = =\n`;
      txt += `*** FIM DO EXTRATO ***\n`;

      const { Share } = require('react-native');
      await Share.share({ message: txt, title: `Extrato ${dataHoje}` });
    } catch (e) {
      console.error('Erro compartilhar:', e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={cupom.container}>
        {/* Header */}
        <View style={cupom.header}>
          <Text style={cupom.headerTxt}>EXTRATO DO DIA</Text>
          <TouchableOpacity onPress={onClose} style={cupom.closeBtn}>
            <Text style={cupom.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={cupom.scroll} showsVerticalScrollIndicator={false}>
          <View ref={extratoRef} style={cupom.papel}>
            {/* Cabeçalho */}
            <Text style={cupom.centro}>{rotaNome || 'Rota'}</Text>
            <Text style={cupom.centroSub}>EXTRATO LIQUIDAÇÃO DIÁRIA</Text>
            <Text style={cupom.div2}>{DDIV}</Text>
            <Text style={cupom.centro}>{dataHoje}  {horaAgora}</Text>
            <Text style={cupom.div1}>{DIV}</Text>

            {/* Resumo */}
            <View style={cupom.linha}>
              <Text style={cupom.txt}>CAIXA INICIAL</Text>
              <Text style={cupom.txt}>{fmt(caixaInicial)}</Text>
            </View>
            <Text style={cupom.div1}>{DIV}</Text>
            <View style={cupom.linha}>
              <Text style={cupom.txtVerde}>(+) ENTRADAS</Text>
              <Text style={cupom.txtVerde}>{fmt(totalEntradas)}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={cupom.txtVerde}>(+) COBRANÇAS</Text>
              <Text style={cupom.txtVerde}>{fmt(totalPagamentos)}</Text>
            </View>
            <View style={cupom.linha}>
              <Text style={cupom.txtVerm}>(-) SAIDAS</Text>
              <Text style={cupom.txtVerm}>{fmt(totalSaidas)}</Text>
            </View>
            <Text style={cupom.div2}>{DDIV}</Text>
            <View style={cupom.linha}>
              <Text style={cupom.txtBold}>CAIXA FINAL</Text>
              <Text style={cupom.txtBold}>{fmt(caixaFinal)}</Text>
            </View>
            <Text style={cupom.div2}>{DDIV}</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#333" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* Movimentações */}
                <Text style={[cupom.centro, { marginTop: 10 }]}>MOVIMENTAÇÕES ({registros.length})</Text>
                <Text style={cupom.div1}>{DIV}</Text>

                {registros.length === 0 ? (
                  <Text style={cupom.centro}>Nenhuma movimentação</Text>
                ) : (
                  registros.map((item, idx) => {
                    const isEntrada = item.tipo === 'RECEBER';
                    const sinal = isEntrada ? '+' : '-';
                    return (
                      <View key={item.id}>
                        <View style={cupom.itemRow}>
                          <Text style={cupom.itemIdx}>{String(idx + 1).padStart(2, '0')}</Text>
                          <Text style={cupom.itemCat} numberOfLines={1}>{formatarCategoria(item.categoria)}</Text>
                          <Text style={[cupom.itemVal, { color: isEntrada ? '#059669' : '#DC2626' }]}>{sinal}{fmt(parseFloat(item.valor))}</Text>
                        </View>
                        {(item.cliente_nome || item.descricao) && (
                          <Text style={cupom.itemSub} numberOfLines={1}>   {item.cliente_nome || item.descricao}</Text>
                        )}
                        <View style={cupom.itemMeta}>
                          <Text style={cupom.itemHora}>   {fmtHora(item.created_at)}</Text>
                          {item.forma_pagamento && <Text style={cupom.itemHora}>{item.forma_pagamento}</Text>}
                        </View>
                        {idx < registros.length - 1 && <Text style={cupom.divPonto}>· · · · · · · · · · · ·</Text>}
                      </View>
                    );
                  })
                )}

                {/* Cobranças (Pagamentos de Parcelas) */}
                {pagamentos.length > 0 && (
                  <>
                    <Text style={cupom.div1}>{DIV}</Text>
                    <Text style={[cupom.centro, { marginTop: 4 }]}>COBRANÇAS ({pagamentos.length})</Text>
                    <Text style={cupom.div1}>{DIV}</Text>
                    {pagamentos.map((p, idx) => {
                      const nome = p.cliente?.nome || 'Cliente';
                      return (
                        <View key={p.id} style={cupom.linha}>
                          <Text style={cupom.txtSmall} numberOfLines={1}>{nome}</Text>
                          <Text style={cupom.txtSmallVerde}>+{fmt(parseFloat(p.valor_pago_total || 0))}</Text>
                        </View>
                      );
                    })}
                  </>
                )}

                {/* Totais finais */}
                <Text style={cupom.div2}>{DDIV}</Text>
                <View style={cupom.linha}>
                  <Text style={cupom.txt}>TOTAL ENTRADAS</Text>
                  <Text style={cupom.txtVerde}>{fmt(totalEntradas)}</Text>
                </View>
                <View style={cupom.linha}>
                  <Text style={cupom.txt}>TOTAL COBRANÇAS</Text>
                  <Text style={cupom.txtVerde}>{fmt(totalPagamentos)}</Text>
                </View>
                <View style={cupom.linha}>
                  <Text style={cupom.txt}>TOTAL SAIDAS</Text>
                  <Text style={cupom.txtVerm}>{fmt(totalSaidas)}</Text>
                </View>
                <Text style={cupom.div1}>{DIV}</Text>
                <View style={cupom.linha}>
                  <Text style={cupom.txtBold}>SALDO FINAL</Text>
                  <Text style={cupom.txtBold}>{fmt(caixaFinal)}</Text>
                </View>
                <Text style={cupom.div2}>{DDIV}</Text>
                <Text style={[cupom.centro, { marginTop: 8, fontSize: 10 }]}>*** FIM DO EXTRATO ***</Text>
              </>
            )}
            <View style={{ height: 24 }} />
          </View>
        </ScrollView>

        {/* Botão Compartilhar */}
        <View style={cupom.shareBar}>
          <TouchableOpacity style={cupom.shareBtn} onPress={compartilharExtrato}>
            <Text style={cupom.shareTxt}>📤 Compartilhar Extrato</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const cupom = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E4DF' },
  header: { backgroundColor: '#333', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTxt: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: MONO },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  closeTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  papel: { backgroundColor: '#FFFEF7', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  centro: { textAlign: 'center', fontSize: 12, color: '#1F2937', fontFamily: MONO, fontWeight: '700' },
  centroSub: { textAlign: 'center', fontSize: 10, color: '#6B7280', fontFamily: MONO, marginTop: 2 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  txt: { fontSize: 11, color: '#1F2937', fontFamily: MONO },
  txtBold: { fontSize: 12, color: '#1F2937', fontFamily: MONO, fontWeight: '700' },
  txtVerde: { fontSize: 11, color: '#059669', fontFamily: MONO },
  txtVerm: { fontSize: 11, color: '#DC2626', fontFamily: MONO },
  txtSmall: { fontSize: 10, color: '#1F2937', fontFamily: MONO, flex: 1 },
  txtSmallVerde: { fontSize: 10, color: '#059669', fontFamily: MONO, fontWeight: '600' },
  div1: { textAlign: 'center', fontSize: 9, color: '#D1D5DB', fontFamily: MONO, marginVertical: 3 },
  div2: { textAlign: 'center', fontSize: 9, color: '#9CA3AF', fontFamily: MONO, marginVertical: 3 },
  divPonto: { textAlign: 'center', fontSize: 8, color: '#E5E7EB', fontFamily: MONO, marginVertical: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  itemIdx: { fontSize: 10, color: '#9CA3AF', width: 20, fontFamily: MONO },
  itemCat: { flex: 1, fontSize: 11, color: '#1F2937', fontFamily: MONO, fontWeight: '600' },
  itemVal: { fontSize: 11, fontWeight: '700', fontFamily: MONO },
  itemSub: { fontSize: 10, color: '#6B7280', fontFamily: MONO },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  itemHora: { fontSize: 9, color: '#9CA3AF', fontFamily: MONO },
  shareBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#E8E4DF' },
  shareBtn: { backgroundColor: '#333', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  shareTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

// =====================================================
// 2. MODAL PAGAMENTOS (PARCELAS)
// =====================================================
interface PagamentosProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalPagos: number;
  totalNaoPagos: number;
  valorRecebido: number;
}

export function ModalPagamentos({ visible, onClose, liquidacaoId, totalPagos, totalNaoPagos, valorRecebido }: PagamentosProps) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && liquidacaoId) carregarPagamentos();
  }, [visible, liquidacaoId]);

  const carregarPagamentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos_parcelas')
        .select(`
          id, numero_parcela, valor_pago_total, valor_parcela, valor_saldo,
          forma_pagamento, valor_credito_usado, valor_credito_gerado,
          status_parcela_atual, created_at,
          cliente:cliente_id(nome, consecutivo),
          emprestimo:emprestimo_id(valor_principal, numero_parcelas)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .eq('estornado', false)
        .order('created_at', { ascending: false });

      if (!error) setRegistros(data || []);
    } catch (e) {
      console.error('Erro pagamentos:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalDinheiro = registros.filter(r => r.forma_pagamento === 'DINHEIRO').reduce((s, r) => s + parseFloat(r.valor_pago_total || 0), 0);
  const totalTransf = registros.filter(r => r.forma_pagamento !== 'DINHEIRO').reduce((s, r) => s + parseFloat(r.valor_pago_total || 0), 0);

  const renderItem = ({ item }: any) => {
    const clienteNome = item.cliente?.nome || 'Cliente';
    const clienteCod = item.cliente?.consecutivo || '';
    const isPago = item.status_parcela_atual === 'PAGO';

    return (
      <View style={dStyles.pagItem}>
        <View style={dStyles.pagItemTop}>
          <View style={{ flex: 1 }}>
            <Text style={dStyles.pagClienteNome}>{clienteNome}</Text>
            {clienteCod ? <Text style={dStyles.pagClienteCod}>#{clienteCod}</Text> : null}
          </View>
          <View style={[dStyles.pagBadge, { backgroundColor: isPago ? '#D1FAE5' : '#FEF3C7' }]}>
            <Text style={[dStyles.pagBadgeText, { color: isPago ? '#059669' : '#D97706' }]}>
              {item.status_parcela_atual}
            </Text>
          </View>
        </View>
        <View style={dStyles.pagItemBottom}>
          <View style={dStyles.pagDetail}>
            <Text style={dStyles.pagDetailLabel}>Parcela</Text>
            <Text style={dStyles.pagDetailValue}>{item.numero_parcela}/{item.emprestimo?.numero_parcelas || '?'}</Text>
          </View>
          <View style={dStyles.pagDetail}>
            <Text style={dStyles.pagDetailLabel}>Valor</Text>
            <Text style={[dStyles.pagDetailValue, { color: '#059669', fontWeight: '700' }]}>{fmt(parseFloat(item.valor_pago_total || 0))}</Text>
          </View>
          <View style={dStyles.pagDetail}>
            <Text style={dStyles.pagDetailLabel}>Forma</Text>
            <Text style={dStyles.pagDetailValue}>{item.forma_pagamento === 'DINHEIRO' ? '💵' : '📲'} {item.forma_pagamento}</Text>
          </View>
          <View style={dStyles.pagDetail}>
            <Text style={dStyles.pagDetailLabel}>Hora</Text>
            <Text style={dStyles.pagDetailValue}>{fmtHora(item.created_at)}</Text>
          </View>
        </View>
        {(item.valor_credito_usado > 0 || item.valor_credito_gerado > 0) && (
          <View style={dStyles.pagCredito}>
            {item.valor_credito_usado > 0 && <Text style={dStyles.pagCreditoText}>Crédito usado: {fmt(item.valor_credito_usado)}</Text>}
            {item.valor_credito_gerado > 0 && <Text style={dStyles.pagCreditoText}>Crédito gerado: {fmt(item.valor_credito_gerado)}</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dStyles.container}>
        <ModalHeader titulo="Pagamentos" icone="💰" cor="#EF4444" onClose={onClose} />

        {/* Resumo */}
        <View style={dStyles.pagResumo}>
          <View style={dStyles.pagResumoItem}>
            <Text style={[dStyles.pagResumoValor, { color: '#059669' }]}>{totalPagos}</Text>
            <Text style={dStyles.pagResumoLabel}>Pagos</Text>
          </View>
          <View style={dStyles.pagResumoDivider} />
          <View style={dStyles.pagResumoItem}>
            <Text style={[dStyles.pagResumoValor, { color: '#DC2626' }]}>{totalNaoPagos}</Text>
            <Text style={dStyles.pagResumoLabel}>Não Pagos</Text>
          </View>
          <View style={dStyles.pagResumoDivider} />
          <View style={dStyles.pagResumoItem}>
            <Text style={dStyles.pagResumoValor}>{fmt(valorRecebido)}</Text>
            <Text style={dStyles.pagResumoLabel}>Recebido</Text>
          </View>
        </View>

        {/* Subtotais */}
        <View style={dStyles.pagSubtotais}>
          <View style={dStyles.pagSubItem}>
            <Text style={dStyles.pagSubIcon}>💵</Text>
            <Text style={dStyles.pagSubLabel}>Dinheiro</Text>
            <Text style={dStyles.pagSubValue}>{fmt(totalDinheiro)}</Text>
          </View>
          <View style={dStyles.pagSubItem}>
            <Text style={dStyles.pagSubIcon}>📲</Text>
            <Text style={dStyles.pagSubLabel}>Transf/PIX</Text>
            <Text style={dStyles.pagSubValue}>{fmt(totalTransf)}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 40 }} />
        ) : registros.length === 0 ? (
          <View style={dStyles.emptyState}>
            <Text style={dStyles.emptyIcon}>💳</Text>
            <Text style={dStyles.emptyText}>Nenhum pagamento registrado</Text>
          </View>
        ) : (
          <FlatList
            data={registros}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// =====================================================
// 3. MODAL VENDAS / RECEITAS / DESPESAS (FINANCEIRO)
// =====================================================
type TipoFinanceiro = 'VENDAS' | 'RECEITAS' | 'DESPESAS';

interface FinanceiroProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  tipo: TipoFinanceiro;
  totalValor: number;
  totalQtd: number;
}

const configFinanceiro: Record<TipoFinanceiro, { titulo: string; icone: string; cor: string; filtro: any }> = {
  VENDAS: { titulo: 'Vendas / Empréstimos', icone: '💼', cor: '#10B981', filtro: { tipo: 'PAGAR', categoria: 'EMPRESTIMO' } },
  RECEITAS: { titulo: 'Receitas', icone: '📥', cor: '#3B82F6', filtro: { tipo: 'RECEBER' } },
  DESPESAS: { titulo: 'Despesas', icone: '📤', cor: '#EF4444', filtro: { tipo: 'PAGAR' } },
};

export function ModalFinanceiro({ visible, onClose, liquidacaoId, tipo, totalValor, totalQtd }: FinanceiroProps) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const config = configFinanceiro[tipo];

  useEffect(() => {
    if (visible && liquidacaoId) carregarRegistros();
  }, [visible, liquidacaoId]);

  const carregarRegistros = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('financeiro')
        .select('id, tipo, categoria, descricao, valor, created_at, forma_pagamento, cliente_nome, vendedor_nome, status')
        .eq('liquidacao_id', liquidacaoId)
        .eq('status', 'PAGO')
        .order('created_at', { ascending: false });

      if (tipo === 'VENDAS') {
        // Vendas = empréstimos (PAGAR com categoria EMPRESTIMO)
        query = query.eq('categoria', 'EMPRESTIMO');
      } else if (tipo === 'RECEITAS') {
        query = query.eq('tipo', 'RECEBER');
      } else if (tipo === 'DESPESAS') {
        query = query.eq('tipo', 'PAGAR').neq('categoria', 'EMPRESTIMO');
      }

      const { data, error } = await query;
      if (!error) setRegistros(data || []);
    } catch (e) {
      console.error(`Erro ${tipo}:`, e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={dStyles.finItem}>
      <View style={dStyles.finItemTop}>
        <View style={[dStyles.finItemDot, { backgroundColor: config.cor }]} />
        <View style={{ flex: 1 }}>
          <Text style={dStyles.finItemCategoria}>{formatarCategoria(item.categoria)}</Text>
          {item.cliente_nome && <Text style={dStyles.finItemCliente}>{item.cliente_nome}</Text>}
          {item.descricao && !item.cliente_nome && <Text style={dStyles.finItemCliente}>{item.descricao}</Text>}
        </View>
        <Text style={[dStyles.finItemValor, { color: config.cor }]}>{fmt(parseFloat(item.valor))}</Text>
      </View>
      <View style={dStyles.finItemBottom}>
        <Text style={dStyles.finItemHora}>{fmtHora(item.created_at)}</Text>
        {item.forma_pagamento && <Text style={dStyles.finItemForma}>{item.forma_pagamento}</Text>}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dStyles.container}>
        <ModalHeader titulo={config.titulo} icone={config.icone} cor={config.cor} onClose={onClose} />

        {/* Resumo */}
        <View style={[dStyles.finResumo, { borderLeftColor: config.cor }]}>
          <View>
            <Text style={dStyles.finResumoLabel}>Total</Text>
            <Text style={[dStyles.finResumoValor, { color: config.cor }]}>{fmt(totalValor)}</Text>
          </View>
          <View style={dStyles.finResumoBadge}>
            <Text style={dStyles.finResumoBadgeText}>{totalQtd} {tipo === 'VENDAS' ? 'emp.' : 'lanç.'}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={config.cor} style={{ marginTop: 40 }} />
        ) : registros.length === 0 ? (
          <View style={dStyles.emptyState}>
            <Text style={dStyles.emptyIcon}>{config.icone}</Text>
            <Text style={dStyles.emptyText}>Nenhum registro encontrado</Text>
          </View>
        ) : (
          <FlatList
            data={registros}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// =====================================================
// 4. MODAL MICROSEGURO
// =====================================================
interface MicroseguroProps {
  visible: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalValor: number;
  totalQtd: number;
}

export function ModalMicroseguro({ visible, onClose, liquidacaoId, totalValor, totalQtd }: MicroseguroProps) {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && liquidacaoId) carregarVendas();
  }, [visible, liquidacaoId]);

  const carregarVendas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('microseguro_vendas')
        .select(`
          id, valor, data_venda, created_at,
          cliente:cliente_id(nome, consecutivo),
          emprestimo:emprestimo_id(valor_principal, numero_parcelas),
          vendedor:vendedor_id(nome)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro query microseguro:', error);
        setVendas([]);
      } else {
        setVendas(data || []);
      }
    } catch (e) {
      console.error('Erro microseguro:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => {
    const clienteNome = item.cliente?.nome || 'Cliente';
    const clienteCod = item.cliente?.consecutivo || '';
    const vendedorNome = item.vendedor?.nome || '';

    return (
      <View style={dStyles.microItem}>
        <View style={dStyles.microItemLeft}>
          <View style={dStyles.microItemAvatar}>
            <Text style={{ fontSize: 18 }}>🛡️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={dStyles.microItemNome}>{clienteNome}</Text>
            {clienteCod ? <Text style={dStyles.microItemCod}>#{clienteCod}</Text> : null}
            {item.emprestimo && (
              <Text style={dStyles.microItemEmprestimo}>
                Empréstimo: {fmt(item.emprestimo.valor_principal)} ({item.emprestimo.numero_parcelas}x)
              </Text>
            )}
            {vendedorNome ? <Text style={dStyles.microItemVendedor}>Vendedor: {vendedorNome}</Text> : null}
          </View>
          <View style={dStyles.microItemRight}>
            <Text style={dStyles.microItemValor}>{fmt(parseFloat(item.valor))}</Text>
            <Text style={dStyles.microItemHora}>{fmtHora(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dStyles.container}>
        <ModalHeader titulo="Microseguro" icone="🛡️" cor="#D97706" onClose={onClose} />

        {/* Resumo */}
        <View style={dStyles.microResumo}>
          <View style={dStyles.microResumoItem}>
            <Text style={dStyles.microResumoValor}>{fmt(totalValor)}</Text>
            <Text style={dStyles.microResumoLabel}>Total Vendido</Text>
          </View>
          <View style={dStyles.microResumoDivider} />
          <View style={dStyles.microResumoItem}>
            <Text style={dStyles.microResumoValor}>{totalQtd}</Text>
            <Text style={dStyles.microResumoLabel}>Contratos</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#D97706" style={{ marginTop: 40 }} />
        ) : vendas.length === 0 ? (
          <View style={dStyles.emptyState}>
            <Text style={dStyles.emptyIcon}>🛡️</Text>
            <Text style={dStyles.emptyText}>Nenhum microseguro vendido</Text>
          </View>
        ) : (
          <FlatList
            data={vendas}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// =====================================================
// HELPER: Formatar categorias
// =====================================================
function formatarCategoria(cat: string): string {
  const map: Record<string, string> = {
    COBRANCA_CUOTAS: 'Cobrança de Parcela',
    EMPRESTIMO: 'Empréstimo',
    MICROSEGURO: 'Microseguro',
    PRESTAMO: 'Empréstimo',
    APORTE: 'Aporte de Capital',
    AJUSTE_CAJA: 'Ajuste de Caixa',
    GASOLINA: 'Gasolina',
    MANUTENCAO: 'Manutenção',
    ALIMENTACAO: 'Alimentação',
    TRANSPORTE: 'Transporte',
    ESTORNO_PAGAMENTO: 'Estorno de Pagamento',
    MULTA: 'Multa',
    OUTROS: 'Outros',
  };
  return map[cat] || cat?.replace(/_/g, ' ') || 'Outros';
}

// =====================================================
// ESTILOS
// =====================================================
const dStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcone: { fontSize: 22 },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  headerCloseText: { fontSize: 16, color: '#fff', fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },

  // ── EXTRATO ──
  extratoResumo: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, elevation: 2 },
  extratoResumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  extratoResumoLabel: { fontSize: 14, color: '#6B7280' },
  extratoResumoValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  extratoDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  extratoListHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  extratoListTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  extratoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  extratoItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  extratoIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  extratoCategoria: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  extratoCliente: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  extratoHora: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  extratoValor: { fontSize: 14, fontWeight: '700' },

  // Share bar
  shareBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12 },
  shareIcon: { fontSize: 16, marginRight: 8 },
  shareText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // ── PAGAMENTOS ──
  pagResumo: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, elevation: 2 },
  pagResumoItem: { flex: 1, alignItems: 'center' },
  pagResumoDivider: { width: 1, backgroundColor: '#E5E7EB' },
  pagResumoValor: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  pagResumoLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  pagSubtotais: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, gap: 8 },
  pagSubItem: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 8, gap: 6 },
  pagSubIcon: { fontSize: 14 },
  pagSubLabel: { fontSize: 12, color: '#6B7280', flex: 1 },
  pagSubValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  pagItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  pagItemTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pagClienteNome: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  pagClienteCod: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  pagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pagBadgeText: { fontSize: 10, fontWeight: '700' },
  pagItemBottom: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  pagDetail: { },
  pagDetailLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' },
  pagDetailValue: { fontSize: 13, color: '#1F2937', fontWeight: '500', marginTop: 1 },
  pagCredito: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pagCreditoText: { fontSize: 11, color: '#6B7280' },

  // ── FINANCEIRO ──
  finResumo: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4 },
  finResumoLabel: { fontSize: 13, color: '#6B7280' },
  finResumoValor: { fontSize: 22, fontWeight: '700' },
  finResumoBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  finResumoBadgeText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  finItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
  finItemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  finItemDot: { width: 10, height: 10, borderRadius: 5 },
  finItemCategoria: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  finItemCliente: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  finItemValor: { fontSize: 15, fontWeight: '700' },
  finItemBottom: { flexDirection: 'row', gap: 16, marginTop: 8, marginLeft: 20 },
  finItemHora: { fontSize: 11, color: '#9CA3AF' },
  finItemForma: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },

  // ── MICROSEGURO ──
  microResumo: { flexDirection: 'row', backgroundColor: '#FEF9C3', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FDE047' },
  microResumoItem: { flex: 1, alignItems: 'center' },
  microResumoDivider: { width: 1, backgroundColor: '#FDE047' },
  microResumoValor: { fontSize: 22, fontWeight: '700', color: '#92400E' },
  microResumoLabel: { fontSize: 12, color: '#A16207', marginTop: 4 },
  microItem: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  microItemLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  microItemAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF9C3', justifyContent: 'center', alignItems: 'center' },
  microItemNome: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  microItemCod: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  microItemEmprestimo: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  microItemVendedor: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  microItemRight: { alignItems: 'flex-end' },
  microItemValor: { fontSize: 16, fontWeight: '700', color: '#D97706' },
  microItemHora: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  microItemCancelado: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  microItemCanceladoText: { fontSize: 9, fontWeight: '700', color: '#DC2626' },
});