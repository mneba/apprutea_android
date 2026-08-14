import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface ValorLivreModalProps {
  visible: boolean;
  onClose: () => void;
  parcelaNumero: number;
  clienteNome: string;
  saldoEmprestimo: number;         // teto (já líquido de crédito)
  totalPagoEmprestimo: number;
  valorTotalEmprestimo: number;
  processando: boolean;
  onConfirmar: (valorEspecie: number) => void;
  t: {
    parcela: string;
    valorLivre?: string;
    quantoPagar?: string;
    maxLbl?: string;
    valorInvalido?: string;
    valorAcimaMax?: string;
    avancar?: string;
    voltar?: string;
    confirmar?: string;
    confirmarPagamento?: string;
    emprestimoLbl?: string;
    jaPagoLbl?: string;
    estePagamento?: string;
    novoSaldoLbl?: string;
    dinheiro?: string;
  };
}

const fmt = (v: number) => '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseValor = (s: string) => parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;

export default function ValorLivreModal({
  visible,
  onClose,
  parcelaNumero,
  clienteNome,
  saldoEmprestimo,
  totalPagoEmprestimo,
  valorTotalEmprestimo,
  processando,
  onConfirmar,
  t,
}: ValorLivreModalProps) {
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<1 | 2>(1);

  React.useEffect(() => {
    if (visible) { setValor(''); setErro(null); setEtapa(1); }
  }, [visible]);

  const valorNum = useMemo(() => parseValor(valor), [valor]);
  const novoSaldo = Math.max(saldoEmprestimo - valorNum, 0);
  // Já pago DERIVADO (total − saldo) para sempre fechar, mesmo com parcelas anômalas
  const jaPagoDerivado = Math.max(valorTotalEmprestimo - saldoEmprestimo, 0);

  const avancar = () => {
    if (valorNum <= 0) { setErro(t.valorInvalido || 'Informe um valor válido'); return; }
    if (valorNum > saldoEmprestimo + 0.001) {
      setErro(`${t.valorAcimaMax || 'Valor acima do máximo:'} ${fmt(saldoEmprestimo)}`);
      return;
    }
    setErro(null);
    setEtapa(2);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.box}>
          {etapa === 1 ? (
            <>
              <Text style={S.titulo}>{t.valorLivre || 'Valor livre'}</Text>
              <Text style={S.sub}>{t.parcela} {parcelaNumero} · {clienteNome}</Text>

              <Text style={S.label}>{t.quantoPagar || 'Quanto o cliente vai pagar?'}</Text>
              <View style={S.inputBox}>
                <Text style={S.currency}>$</Text>
                <TextInput
                  style={S.input}
                  value={valor}
                  onChangeText={(v) => { setValor(v); if (erro) setErro(null); }}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  underlineColorAndroid="transparent"
                />
              </View>
              <Text style={S.max}>{t.maxLbl || 'Máx:'} {fmt(saldoEmprestimo)}</Text>
              {erro && <Text style={S.erro}>{erro}</Text>}

              <View style={S.botoes}>
                <TouchableOpacity style={S.btnCancel} onPress={onClose}>
                  <Text style={S.btnCancelTx}>{t.voltar || 'Cancelar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.btnOk} onPress={avancar}>
                  <Text style={S.btnOkTx}>{t.avancar || 'Avançar'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
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
                  <Text style={[S.linhaVal, { fontWeight: '700' }]}>{fmt(valorNum)}</Text>
                </View>
                <View style={S.divider} />
                <View style={S.linha}>
                  <Text style={S.novoLbl}>{t.novoSaldoLbl || 'Novo saldo'}</Text>
                  <Text style={S.novoVal}>{fmt(novoSaldo)}</Text>
                </View>
              </View>

              <View style={S.botoes}>
                <TouchableOpacity style={S.btnCancel} onPress={() => setEtapa(1)} disabled={processando}>
                  <Text style={S.btnCancelTx}>{t.voltar || 'Voltar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.btnOk, processando && { opacity: 0.5 }]} onPress={() => onConfirmar(valorNum)} disabled={processando}>
                  <Text style={S.btnOkTx}>{t.confirmar || 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, overflow: 'hidden' },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 16 },
  label: { fontSize: 14, color: '#374151', marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, width: '100%', overflow: 'hidden' },
  currency: { fontSize: 20, fontWeight: '700', color: '#6B7280', marginRight: 8 },
  input: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1F2937', padding: 0, height: 34, minWidth: 0 },
  max: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  erro: { fontSize: 12, color: '#DC2626', marginTop: 6 },
  cenario: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  linhaLbl: { fontSize: 14, color: '#6B7280' },
  linhaVal: { fontSize: 14, color: '#1F2937' },
  divider: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 6 },
  novoLbl: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  novoVal: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btnCancel: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnCancelTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnOk: { flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOkTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
});