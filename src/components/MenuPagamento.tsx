import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MenuPagamentoParcela {
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_saldo?: number;
  valor_pago?: number;
  status: string;
}

interface MenuPagamentoProps {
  visible: boolean;
  onClose: () => void;
  parcela: MenuPagamentoParcela | null;
  clienteNome: string;
  totalParcelas: number;
  saldoEmprestimo: number;
  creditoDisponivel: number;
  /** Pagamentos parciais desta parcela (para a faixa informativa). */
  pagamentosParciais?: { valor: number; dataLiq: string | null }[];
  // Ações (o ClientesScreen implementa cada uma)
  onPagar1Parcela: () => void;      // paga valor cheio da parcela atual
  onValorLivre: () => void;         // abre campo para valor livre
  onUsarCredito: () => void;        // aplica crédito em cascata
  onPagarMultiplas: () => void;     // abre seleção de parcelas
  onQuitarEmprestimo: () => void;   // quita o empréstimo
  t: {
    parcela: string;
    menuTitulo?: string;
    parcelaLbl?: string;
    creditoLbl?: string;
    saldoTotalLbl?: string;
    pagar1?: string;
    pagarVarias?: string;
    valorLivre?: string;
    usarCredito?: string;
    quitarEmprestimo?: string;
    parcialmentePaga?: string;
    liquidacaoLbl?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ─── Componente ─────────────────────────────────────────────────────────────

export default function MenuPagamento({
  visible,
  onClose,
  parcela,
  clienteNome,
  totalParcelas,
  saldoEmprestimo,
  creditoDisponivel,
  pagamentosParciais,
  onPagar1Parcela,
  onValorLivre,
  onUsarCredito,
  onPagarMultiplas,
  onQuitarEmprestimo,
  t,
}: MenuPagamentoProps) {
  if (!visible || !parcela) return null;

  const temCredito = creditoDisponivel > 0;
  const parciais = (pagamentosParciais || []).filter(p => p.valor > 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.sheet}>
          {/* Handle */}
          <View style={S.handle} />

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Cabeçalho */}
            <View style={S.header}>
              <Text style={S.titulo}>{t.parcela} {parcela.numero_parcela}/{totalParcelas}</Text>
              <TouchableOpacity onPress={onClose} style={S.closeBtn}>
                <Text style={S.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={S.cliente}>{clienteNome}</Text>

            {/* Faixa de parcial */}
            {parciais.length > 0 && (
              <View style={S.faixaParcial}>
                {parciais.map((p, i) => (
                  <Text key={i} style={S.faixaParcialTx}>
                    ⓘ {(t.parcialmentePaga || 'Parcialmente paga')} · {(t.liquidacaoLbl || 'liquidação')} {fmtData(p.dataLiq) || '—'} · {fmt(p.valor)}
                  </Text>
                ))}
              </View>
            )}

            {/* Resumo: Parcela | Crédito | Saldo total */}
            <View style={S.resumo}>
              <View style={S.resumoCol}>
                <Text style={S.resumoLbl}>{t.parcelaLbl || 'Parcela'}</Text>
                <Text style={S.resumoVal}>{fmt(parcela.valor_parcela)}</Text>
              </View>
              <View style={[S.resumoCol, S.resumoColMid]}>
                <Text style={S.resumoLbl}>{t.creditoLbl || 'Crédito'}</Text>
                <Text style={[S.resumoVal, temCredito && S.resumoValCredito]}>{fmt(creditoDisponivel)}</Text>
              </View>
              <View style={S.resumoCol}>
                <Text style={S.resumoLbl}>{t.saldoTotalLbl || 'Saldo total'}</Text>
                <Text style={S.resumoVal}>{fmt(saldoEmprestimo)}</Text>
              </View>
            </View>

            {/* Botões */}
            <TouchableOpacity style={[S.btn, S.btnPrimary]} onPress={onPagar1Parcela}>
              <Text style={S.btnPrimaryTx}>{t.pagar1 || 'Pagar 1 parcela'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[S.btn, S.btnOutline]} onPress={onPagarMultiplas}>
              <Text style={S.btnOutlineTx}>{t.pagarVarias || 'Pagar mais de 1 parcela'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[S.btn, S.btnOutline]} onPress={onValorLivre}>
              <Text style={S.btnOutlineTx}>{t.valorLivre || 'Valor livre'}</Text>
            </TouchableOpacity>

            {temCredito && (
              <TouchableOpacity style={[S.btn, S.btnCredito]} onPress={onUsarCredito}>
                <Text style={S.btnCreditoTx}>{t.usarCredito || 'Usar crédito'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[S.btn, S.btnOutline]} onPress={onQuitarEmprestimo}>
              <Text style={S.btnOutlineTx}>{t.quitarEmprestimo || 'Quitar empréstimo'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 20, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  titulo: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  closeX: { fontSize: 15, color: '#6B7280' },
  cliente: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 12 },
  faixaParcial: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12 },
  faixaParcialTx: { fontSize: 12, color: '#B45309', lineHeight: 18 },
  resumo: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 12, marginBottom: 16 },
  resumoCol: { flex: 1, alignItems: 'center' },
  resumoColMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E5E7EB' },
  resumoLbl: { fontSize: 11, color: '#9CA3AF' },
  resumoVal: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  resumoValCredito: { color: '#4F46E5' },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 8 },
  btnPrimary: { backgroundColor: '#10B981' },
  btnPrimaryTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB' },
  btnOutlineTx: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  btnCredito: { backgroundColor: '#EEF2FF' },
  btnCreditoTx: { fontSize: 15, fontWeight: '600', color: '#4F46E5' },
});