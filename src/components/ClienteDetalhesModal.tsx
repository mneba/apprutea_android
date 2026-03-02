import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../services/supabase';

// ==================== TIPOS ====================
interface ClienteInfo {
  id: string;
  nome: string;
  telefone?: string | null;
  documento?: string | null;
  endereco?: string | null;
  codigo_cliente?: string | number | null;
  status?: string | null;
}

interface Emprestimo {
  id: string;
  valor_principal: number;
  valor_total: number;
  valor_pago: number;
  valor_saldo: number;
  numero_parcelas: number;
  taxa_juros: number;
  data_emprestimo: string;
  frequencia_pagamento: string;
  status: string;
  total_parcelas: number;
  parcelas_pagas: number;
  parcelas_vencidas: number;
  proximo_vencimento: string | null;
}

interface Parcela {
  id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago: number;
  valor_saldo: number;
  data_vencimento: string;
  status: string;
  dias_atraso: number;
}

type Aba = 'pessoais' | 'emprestimo' | 'historico';
type Language = 'pt-BR' | 'es';

// ==================== TEXTOS ====================
const T = {
  'pt-BR': {
    pessoais: 'Pessoais', emprestimo: 'Empréstimo', historico: 'Histórico',
    nome: 'Nome', telefone: 'Telefone', documento: 'Documento', endereco: 'Endereço',
    codigo: 'Código', status: 'Status',
    valorPrincipal: 'Principal', valorTotal: 'Total', valorPago: 'Pago', saldo: 'Saldo',
    taxa: 'Taxa', parcelas: 'Parcelas', frequencia: 'Frequência', data: 'Data',
    proxVencimento: 'Próximo Vencimento', pagas: 'Pagas', vencidas: 'Vencidas',
    progresso: 'Progresso', verParcelas: 'Ver Parcelas', fecharParcelas: 'Fechar Parcelas',
    semEmprestimo: 'Nenhum empréstimo ativo', semHistorico: 'Nenhum empréstimo anterior',
    carregando: 'Carregando...', ligar: 'Ligar',
    ativo: 'ATIVO', quitado: 'QUITADO', cancelado: 'CANCELADO', renegociado: 'RENEGOCIADO',
    vencido: 'VENCIDO', pendente: 'PENDENTE', parcial: 'PARCIAL', pago: 'PAGO',
    restantes: 'restantes',
  },
  'es': {
    pessoais: 'Personales', emprestimo: 'Préstamo', historico: 'Historial',
    nome: 'Nombre', telefone: 'Teléfono', documento: 'Documento', endereco: 'Dirección',
    codigo: 'Código', status: 'Estado',
    valorPrincipal: 'Principal', valorTotal: 'Total', valorPago: 'Pagado', saldo: 'Saldo',
    taxa: 'Tasa', parcelas: 'Cuotas', frequencia: 'Frecuencia', data: 'Fecha',
    proxVencimento: 'Próximo Vencimiento', pagas: 'Pagadas', vencidas: 'Vencidas',
    progresso: 'Progreso', verParcelas: 'Ver Cuotas', fecharParcelas: 'Cerrar Cuotas',
    semEmprestimo: 'Ningún préstamo activo', semHistorico: 'Ningún préstamo anterior',
    carregando: 'Cargando...', ligar: 'Llamar',
    ativo: 'ACTIVO', quitado: 'LIQUIDADO', cancelado: 'CANCELADO', renegociado: 'RENEGOCIADO',
    vencido: 'VENCIDO', pendente: 'PENDIENTE', parcial: 'PARCIAL', pago: 'PAGADO',
    restantes: 'restantes',
  },
};

const FREQ: Record<string, Record<string, string>> = {
  'pt-BR': { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' },
  'es': { DIARIO: 'Diario', SEMANAL: 'Semanal', QUINCENAL: 'Quincenal', MENSUAL: 'Mensual', FLEXIVEL: 'Flexible' },
};

// ==================== HELPERS ====================
const fmt = (v: number) => {
  const abs = Math.abs(v);
  const str = abs.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}$ ${str}`;
};

const fmtData = (d: string | null) => {
  if (!d) return '—';
  const dt = new Date(d.includes('T') ? d : d + 'T00:00:00');
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const getIni = (nome: string) => {
  const p = nome.trim().split(' ');
  return (p[0]?.[0] || '') + (p[p.length > 1 ? p.length - 1 : 0]?.[0] || '');
};

// Formata número para WhatsApp: remove tudo exceto dígitos, adiciona código país se necessário
const fmtWhatsApp = (tel: string): string => {
  let digits = tel.replace(/\D/g, '');
  // Se começa com 0, remove
  if (digits.startsWith('0')) digits = digits.substring(1);
  // Se não tem código país (menos de 11 dígitos ou não começa com 55/57/51)
  if (digits.length <= 11 && !digits.startsWith('55') && !digits.startsWith('57') && !digits.startsWith('51')) {
    // Tenta detectar: BR (11 dígitos celular), CO (10 dígitos), PE (9 dígitos)
    if (digits.length === 11 || digits.length === 10) digits = '55' + digits; // Assume BR
    else if (digits.length === 10) digits = '57' + digits; // CO
    else if (digits.length === 9) digits = '51' + digits; // PE
    else digits = '55' + digits; // Default BR
  }
  return digits;
};

const abrirMapa = (endereco: string) => {
  const enc = encodeURIComponent(endereco);
  const url = Platform.OS === 'ios' ? `maps:?daddr=${enc}` : `google.navigation:q=${enc}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${enc}`).catch(() => {});
  });
};

const corStatus: Record<string, { bg: string; text: string }> = {
  ATIVO: { bg: '#D1FAE5', text: '#059669' },
  VENCIDO: { bg: '#FEE2E2', text: '#DC2626' },
  QUITADO: { bg: '#D1FAE5', text: '#059669' },
  CANCELADO: { bg: '#FEE2E2', text: '#DC2626' },
  RENEGOCIADO: { bg: '#EDE9FE', text: '#7C3AED' },
  PAGO: { bg: '#D1FAE5', text: '#059669' },
  PENDENTE: { bg: '#F3F4F6', text: '#6B7280' },
  PARCIAL: { bg: '#FEF3C7', text: '#D97706' },
};

// ==================== PROPS ====================
interface Props {
  visible: boolean;
  onClose: () => void;
  cliente: ClienteInfo | null;
  lang?: Language;
}

// ==================== COMPONENTE ====================
export default function ClienteDetalhesModal({ visible, onClose, cliente, lang = 'pt-BR' }: Props) {
  const t = T[lang];
  const [aba, setAba] = useState<Aba>('pessoais');
  const [loading, setLoading] = useState(false);
  const [empAtivos, setEmpAtivos] = useState<Emprestimo[]>([]);
  const [empHistorico, setEmpHistorico] = useState<Emprestimo[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<Map<string, Parcela[]>>(new Map());
  const [loadingParcelas, setLoadingParcelas] = useState<string | null>(null);
  const [clienteCompleto, setClienteCompleto] = useState<any>(null);

  const carregarDados = useCallback(async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      // 1. Dados completos do cliente
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nome, documento, telefone_celular, endereco, status, codigo_cliente, created_at')
        .eq('id', cliente.id)
        .single();
      setClienteCompleto(cliData);

      // 2. Empréstimos via view completa
      const { data: emps } = await supabase
        .from('vw_emprestimos_completos')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('data_emprestimo', { ascending: false });

      const all = (emps || []) as any[];
      setEmpAtivos(all.filter(e => e.status === 'ATIVO' || e.status === 'VENCIDO'));
      setEmpHistorico(all.filter(e => e.status !== 'ATIVO' && e.status !== 'VENCIDO'));
    } catch (e) {
      console.error('Erro ao carregar detalhes:', e);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id]);

  useEffect(() => {
    if (visible && cliente?.id) {
      setAba('pessoais');
      setExpandedEmp(null);
      setParcelas(new Map());
      carregarDados();
    }
  }, [visible, cliente?.id, carregarDados]);

  const carregarParcelas = useCallback(async (empId: string) => {
    if (parcelas.has(empId)) return;
    setLoadingParcelas(empId);
    try {
      const { data } = await supabase
        .from('emprestimo_parcelas')
        .select('id, numero_parcela, valor_parcela, valor_pago, valor_saldo, data_vencimento, status, dias_atraso')
        .eq('emprestimo_id', empId)
        .order('numero_parcela', { ascending: true });
      setParcelas(prev => new Map(prev).set(empId, (data || []) as Parcela[]));
    } catch (e) {
      console.error('Erro ao carregar parcelas:', e);
    } finally {
      setLoadingParcelas(null);
    }
  }, [parcelas]);

  const toggleExpand = useCallback((empId: string) => {
    if (expandedEmp === empId) {
      setExpandedEmp(null);
    } else {
      setExpandedEmp(empId);
      carregarParcelas(empId);
    }
  }, [expandedEmp, carregarParcelas]);

  if (!cliente) return null;

  const cli = clienteCompleto || cliente;

  // ==================== ABA PESSOAIS ====================
  const renderPessoais = () => (
    <ScrollView style={S.abaContent} showsVerticalScrollIndicator={false}>
      {/* Avatar + Nome */}
      <View style={S.perfilHeader}>
        <View style={S.avatarGrande}>
          <Text style={S.avatarGrandeText}>{getIni(cli.nome || cliente.nome).toUpperCase()}</Text>
        </View>
        <Text style={S.perfilNome}>{(cli.nome || cliente.nome).toLowerCase()}</Text>
        {cli.status && (
          <View style={[S.statusBadge, { backgroundColor: (corStatus[cli.status] || corStatus.PENDENTE).bg }]}>
            <Text style={[S.statusBadgeText, { color: (corStatus[cli.status] || corStatus.PENDENTE).text }]}>
              {cli.status}
            </Text>
          </View>
        )}
      </View>

      {/* Dados */}
      <View style={S.dadosCard}>
        {cli.codigo_cliente && (
          <View style={S.dadoRow}>
            <Text style={S.dadoLabel}>🏷 {t.codigo}</Text>
            <Text style={S.dadoValue}>{cli.codigo_cliente}</Text>
          </View>
        )}
        {(cli.documento || cliente.documento) && (
          <View style={S.dadoRow}>
            <Text style={S.dadoLabel}>📄 {t.documento}</Text>
            <Text style={S.dadoValue}>{cli.documento || cliente.documento}</Text>
          </View>
        )}
        {(cli.telefone_celular || cliente.telefone) && (() => {
          const tel = cli.telefone_celular || cliente.telefone || '';
          return (
            <View style={S.dadoRow}>
              <Text style={S.dadoLabel}>📱 {t.telefone}</Text>
              <View style={S.dadoActions}>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${tel.replace(/\D/g, '')}`)}>
                  <Text style={[S.dadoValue, { color: '#2563EB' }]}>{tel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.whatsappBtn} onPress={() => {
                  const num = fmtWhatsApp(tel);
                  Linking.openURL(`https://wa.me/${num}`);
                }}>
                  <Text style={S.whatsappIcon}>💬</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
        {(cli.endereco || cliente.endereco) && (() => {
          const end = cli.endereco || cliente.endereco || '';
          return (
            <View style={S.dadoRow}>
              <Text style={S.dadoLabel}>📍 {t.endereco}</Text>
              <View style={S.dadoActions}>
                <Text style={S.dadoValue} numberOfLines={2}>{end}</Text>
                <TouchableOpacity style={S.mapaBtn} onPress={() => abrirMapa(end)}>
                  <Text style={S.mapaIcon}>🧭</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Resumo rápido empréstimos */}
      {empAtivos.length > 0 && (
        <View style={S.resumoCard}>
          <Text style={S.resumoTitle}>{empAtivos.length} {t.emprestimo}(s) {t.ativo.toLowerCase()}(s)</Text>
          <View style={S.resumoGrid}>
            <View style={S.resumoItem}>
              <Text style={S.resumoLabel}>{t.saldo}</Text>
              <Text style={[S.resumoValue, { color: '#EF4444' }]}>{fmt(empAtivos.reduce((s, e) => s + e.valor_saldo, 0))}</Text>
            </View>
            <View style={S.resumoItem}>
              <Text style={S.resumoLabel}>{t.vencidas}</Text>
              <Text style={[S.resumoValue, { color: empAtivos.reduce((s, e) => s + e.parcelas_vencidas, 0) > 0 ? '#EF4444' : '#10B981' }]}>
                {empAtivos.reduce((s, e) => s + e.parcelas_vencidas, 0)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ==================== CARD EMPRÉSTIMO (reutilizado) ====================
  const renderEmprestimoCard = (emp: Emprestimo, somenteLeitura: boolean) => {
    const isExp = expandedEmp === emp.id;
    const cor = corStatus[emp.status] || corStatus.PENDENTE;
    const pct = emp.numero_parcelas > 0 ? Math.round((emp.parcelas_pagas / emp.numero_parcelas) * 100) : 0;
    const parcs = parcelas.get(emp.id) || [];

    return (
      <View key={emp.id} style={S.empCard}>
        {/* Header clicável */}
        <TouchableOpacity style={S.empHeader} onPress={() => toggleExpand(emp.id)} activeOpacity={0.7}>
          <View style={S.empHeaderLeft}>
            <Text style={S.empValor}>{fmt(emp.valor_principal)}</Text>
            {emp.parcelas_vencidas > 0 && (
              <View style={S.empVencBadge}>
                <Text style={S.empVencText}>{emp.parcelas_vencidas} {t.vencidas.toLowerCase()}</Text>
              </View>
            )}
          </View>
          <View style={[S.empStatusBadge, { backgroundColor: cor.bg }]}>
            <Text style={[S.empStatusText, { color: cor.text }]}>{t[emp.status.toLowerCase() as keyof typeof t] || emp.status}</Text>
          </View>
        </TouchableOpacity>

        {/* Info compacta */}
        <View style={S.empInfoRow}>
          <Text style={S.empInfoItem}>{fmtData(emp.data_emprestimo)}</Text>
          <Text style={S.empInfoDot}>•</Text>
          <Text style={S.empInfoItem}>{emp.parcelas_pagas}/{emp.numero_parcelas} {t.parcelas.toLowerCase()}</Text>
          <Text style={S.empInfoDot}>•</Text>
          <Text style={S.empInfoItem}>{pct}%</Text>
        </View>

        {/* Barra de progresso */}
        <View style={S.empBarBg}>
          <View style={[S.empBarFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B' }]} />
        </View>

        {/* Expandido */}
        {isExp && (
          <View style={S.empExpanded}>
            {/* Grid de dados */}
            <View style={S.empGrid}>
              <View style={S.empGridItem}>
                <Text style={S.empGridLabel}>{t.valorTotal}</Text>
                <Text style={S.empGridValue}>{fmt(emp.valor_total)}</Text>
              </View>
              <View style={S.empGridItem}>
                <Text style={S.empGridLabel}>{t.taxa}</Text>
                <Text style={S.empGridValue}>{emp.taxa_juros}%</Text>
              </View>
              <View style={S.empGridItem}>
                <Text style={S.empGridLabel}>{t.valorPago}</Text>
                <Text style={[S.empGridValue, { color: '#10B981' }]}>{fmt(emp.valor_pago)}</Text>
              </View>
              <View style={S.empGridItem}>
                <Text style={S.empGridLabel}>{t.saldo}</Text>
                <Text style={[S.empGridValue, { color: '#EF4444' }]}>{fmt(emp.valor_saldo)}</Text>
              </View>
            </View>

            {/* Frequência */}
            <View style={S.empFreqRow}>
              <Text style={S.empFreqLabel}>{t.frequencia}:</Text>
              <Text style={S.empFreqValue}>{FREQ[lang]?.[emp.frequencia_pagamento] || emp.frequencia_pagamento}</Text>
            </View>

            {/* Próximo vencimento */}
            {emp.proximo_vencimento && (
              <View style={S.empProxRow}>
                <Text style={S.empProxLabel}>{t.proxVencimento}:</Text>
                <Text style={S.empProxValue}>{fmtData(emp.proximo_vencimento)}</Text>
              </View>
            )}

            {/* Parcelas */}
            {loadingParcelas === emp.id ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 12 }} />
            ) : parcs.length > 0 ? (
              <View style={S.parcelasBox}>
                <Text style={S.parcelasTitle}>{t.parcelas} ({parcs.length})</Text>
                {parcs.map(p => {
                  const isPago = p.status === 'PAGO';
                  const isVencida = p.status === 'VENCIDO' || p.status === 'VENCIDA';
                  const isParcial = p.status === 'PARCIAL';
                  const icon = isPago ? '✅' : isVencida ? '❌' : isParcial ? '🟡' : '📅';
                  const corP = corStatus[isPago ? 'PAGO' : isVencida ? 'VENCIDO' : isParcial ? 'PARCIAL' : 'PENDENTE'];
                  return (
                    <View key={p.id} style={S.parcelaRow}>
                      <Text style={S.parcelaIcon}>{icon}</Text>
                      <View style={S.parcelaInfo}>
                        <View style={S.parcelaTopRow}>
                          <Text style={S.parcelaNum}>#{p.numero_parcela}</Text>
                          <Text style={S.parcelaData}>{fmtData(p.data_vencimento)}</Text>
                        </View>
                        <View style={S.parcelaValRow}>
                          <Text style={S.parcelaValor}>{fmt(p.valor_parcela)}</Text>
                          {isPago && <Text style={S.parcelaPago}>{t.pago.toLowerCase()}: {fmt(p.valor_pago)}</Text>}
                          {isParcial && <Text style={S.parcelaParcial}>{t.parcial}: {fmt(p.valor_pago)}/{fmt(p.valor_parcela)}</Text>}
                          {isVencida && p.dias_atraso > 0 && <Text style={S.parcelaAtraso}>{p.dias_atraso}d</Text>}
                        </View>
                      </View>
                      <View style={[S.parcelaStatusBadge, { backgroundColor: corP.bg }]}>
                        <Text style={[S.parcelaStatusText, { color: corP.text }]}>
                          {isPago ? t.pago : isVencida ? t.vencido : isParcial ? t.parcial : t.pendente}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  // ==================== ABA EMPRÉSTIMO ====================
  const renderEmprestimo = () => (
    <ScrollView style={S.abaContent} showsVerticalScrollIndicator={false}>
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
      ) : empAtivos.length === 0 ? (
        <View style={S.emptyBox}>
          <Text style={S.emptyIcon}>📋</Text>
          <Text style={S.emptyText}>{t.semEmprestimo}</Text>
        </View>
      ) : (
        empAtivos.map(emp => renderEmprestimoCard(emp, false))
      )}
    </ScrollView>
  );

  // ==================== ABA HISTÓRICO ====================
  const renderHistorico = () => (
    <ScrollView style={S.abaContent} showsVerticalScrollIndicator={false}>
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
      ) : empHistorico.length === 0 ? (
        <View style={S.emptyBox}>
          <Text style={S.emptyIcon}>📂</Text>
          <Text style={S.emptyText}>{t.semHistorico}</Text>
        </View>
      ) : (
        empHistorico.map(emp => renderEmprestimoCard(emp, true))
      )}
    </ScrollView>
  );

  // ==================== RENDER ====================
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.container}>
          {/* Header */}
          <View style={S.header}>
            <View style={S.headerInfo}>
              <View style={S.avatarPequeno}>
                <Text style={S.avatarPequenoText}>{getIni(cliente.nome).toUpperCase()}</Text>
              </View>
              <View style={S.headerTexts}>
                <Text style={S.headerNome} numberOfLines={1}>{cliente.nome.toLowerCase()}</Text>
                {cliente.telefone && <Text style={S.headerTel}>📱 {cliente.telefone}</Text>}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={S.closeBtn}>
              <Text style={S.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={S.tabs}>
            {(['pessoais', 'emprestimo', 'historico'] as Aba[]).map(a => (
              <TouchableOpacity
                key={a}
                style={[S.tab, aba === a && S.tabAtivo]}
                onPress={() => setAba(a)}
              >
                <Text style={[S.tabText, aba === a && S.tabTextAtivo]}>
                  {a === 'pessoais' ? '👤' : a === 'emprestimo' ? '💰' : '📂'} {t[a]}
                </Text>
                {a === 'emprestimo' && empAtivos.length > 0 && (
                  <View style={S.tabBadge}><Text style={S.tabBadgeText}>{empAtivos.length}</Text></View>
                )}
                {a === 'historico' && empHistorico.length > 0 && (
                  <View style={S.tabBadgeHist}><Text style={S.tabBadgeHistText}>{empHistorico.length}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Conteúdo */}
          {aba === 'pessoais' && renderPessoais()}
          {aba === 'emprestimo' && renderEmprestimo()}
          {aba === 'historico' && renderHistorico()}
        </View>
      </View>
    </Modal>
  );
}

// ==================== ESTILOS ====================
const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '95%', minHeight: '85%', flex: 1 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatarPequeno: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  avatarPequenoText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  headerTexts: { flex: 1 },
  headerNome: { fontSize: 15, fontWeight: '700', color: '#1F2937', textTransform: 'capitalize' },
  headerTel: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 16, color: '#6B7280', fontWeight: '600' },

  // Tabs
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabAtivo: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  tabText: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  tabTextAtivo: { color: '#2563EB', fontWeight: '600' },
  tabBadge: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  tabBadgeHist: { backgroundColor: '#6B7280', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeHistText: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  abaContent: { padding: 16, paddingBottom: 30 },

  // Pessoais
  perfilHeader: { alignItems: 'center', marginBottom: 16 },
  avatarGrande: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarGrandeText: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  perfilNome: { fontSize: 18, fontWeight: '700', color: '#1F2937', textTransform: 'capitalize' },
  statusBadge: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  dadosCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, gap: 12 },
  dadoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dadoLabel: { fontSize: 13, color: '#6B7280', minWidth: 80 },
  dadoValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', textAlign: 'right', flex: 1, marginLeft: 12 },
  dadoActions: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: 8 },
  whatsappBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  whatsappIcon: { fontSize: 15 },
  mapaBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  mapaIcon: { fontSize: 15 },

  resumoCard: { marginTop: 16, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BFDBFE' },
  resumoTitle: { fontSize: 13, fontWeight: '600', color: '#1E40AF', marginBottom: 8 },
  resumoGrid: { flexDirection: 'row', gap: 16 },
  resumoItem: { flex: 1 },
  resumoLabel: { fontSize: 11, color: '#6B7280' },
  resumoValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },

  // Empréstimo Card
  empCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  empHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empValor: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  empVencBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  empVencText: { fontSize: 10, fontWeight: '600', color: '#DC2626' },
  empStatusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  empStatusText: { fontSize: 10, fontWeight: '700' },

  empInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  empInfoItem: { fontSize: 11, color: '#6B7280' },
  empInfoDot: { fontSize: 11, color: '#D1D5DB' },

  empBarBg: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  empBarFill: { height: 4, borderRadius: 2 },

  // Expandido
  empExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  empGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empGridItem: { width: '47%', backgroundColor: '#FFF', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  empGridLabel: { fontSize: 10, color: '#6B7280' },
  empGridValue: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  empFreqRow: { flexDirection: 'row', marginTop: 10, gap: 4 },
  empFreqLabel: { fontSize: 12, color: '#6B7280' },
  empFreqValue: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  empProxRow: { flexDirection: 'row', marginTop: 4, gap: 4 },
  empProxLabel: { fontSize: 12, color: '#6B7280' },
  empProxValue: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },

  // Parcelas
  parcelasBox: { marginTop: 12 },
  parcelasTitle: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  parcelaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  parcelaIcon: { fontSize: 14, width: 22 },
  parcelaInfo: { flex: 1 },
  parcelaTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  parcelaNum: { fontSize: 12, fontWeight: '600', color: '#374151' },
  parcelaData: { fontSize: 11, color: '#6B7280' },
  parcelaValRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  parcelaValor: { fontSize: 12, color: '#374151' },
  parcelaPago: { fontSize: 10, color: '#059669' },
  parcelaParcial: { fontSize: 10, color: '#D97706' },
  parcelaAtraso: { fontSize: 10, color: '#DC2626', fontWeight: '600' },
  parcelaStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  parcelaStatusText: { fontSize: 9, fontWeight: '600' },

  // Empty
  emptyBox: { alignItems: 'center', paddingTop: 50 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
});