import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ResumoPagamentoModalProps {
  visible: boolean;
  onClose: () => void;
  parcelaNumero: number;
  clienteNome: string;
  valorPagamento: number;         // valor em espécie a pagar
  saldoEmprestimo: number;
  totalPagoEmprestimo: number;    // (não usado no cálculo; já pago é derivado)
  valorTotalEmprestimo: number;
  processando: boolean;
  onConfirmar: () => void;
  t: {
    parcela: string;
    confirmarPagamento?: string;
    emprestimoLbl?: string;
    jaPagoLbl?: string;
    estePagamento?: string;
    novoSaldoLbl?: string;
    creditoGeradoLbl?: string;
    voltar?: string;
    confirmar?: string;
  };
}

const fmt = (v: number) => '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ResumoPagamentoModal({
  visible,
  onClose,
  parcelaNumero,
  clienteNome,
  valorPagamento,
  saldoEmprestimo,
  valorTotalEmprestimo,
  processando,
  onConfirmar,
  t,
}: ResumoPagamentoModalProps) {
  if (!visible) return null;

  // Já pago DERIVADO (total − saldo) para sempre fechar
  const jaPagoDerivado = Math.max(valorTotalEmprestimo - saldoEmprestimo, 0);
  const novoSaldo = Math.max(saldoEmprestimo - valorPagamento, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.box}>
          <Text style={S.titulo}>{t.confirmarPagamento || 'Confirmar pagamento'}</Text>
          <Text style={S.sub}>{t.parcela} {parcelaNumero} · {clienteNome}</Text>

          <View style={S.cenario}>
            <View style={S.linha}>
              <Text style={S.linhaLbl}>{t.emprestimoLbl || 'Empréstimo'}</Text>
              <Text style={S.linhaVal}>{fmt(valorTotalEmprestimo)}</Text>
            </View>
            <View style={S.linha}>
              <Text style={S.linhaLbl}>{t.jaPagoLbl || 'Já pago'}</Text>
              <Text style={S.linhaVal}>{fmt(jaPagoDerivado)}</Text>
            </View>
            <View style={S.linha}>
              <Text style={S.linhaLbl}>{t.estePagamento || 'Este pagamento (espécie)'}</Text>
              <Text style={[S.linhaVal, { fontWeight: '700' }]}>{fmt(valorPagamento)}</Text>
            </View>
            <View style={S.divider} />
            <View style={S.linha}>
              <Text style={S.novoLbl}>{t.novoSaldoLbl || 'Novo saldo'}</Text>
              <Text style={S.novoVal}>{fmt(novoSaldo)}</Text>
            </View>
          </View>

          <View style={S.botoes}>
            <TouchableOpacity style={S.btnCancel} onPress={onClose} disabled={processando}>
              <Text style={S.btnCancelTx}>{t.voltar || 'Cancelar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.btnOk, processando && { opacity: 0.5 }]} onPress={onConfirmar} disabled={processando}>
              <Text style={S.btnOkTx}>{t.confirmar || 'Confirmar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 16 },
  cenario: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  linhaLbl: { fontSize: 14, color: '#6B7280' },
  linhaVal: { fontSize: 14, color: '#1F2937' },
  divider: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 6 },
  novoLbl: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  novoVal: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  botoes: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnCancelTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnOk: { flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOkTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});