import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { ClienteRotaDia } from '../types';

interface Props {
  route: {
    params: {
      cliente: ClienteRotaDia;
      parcela_id: string;
      emprestimo_id: string;
    };
  };
  navigation: any;
}

export default function PagamentoScreen({ route, navigation }: Props) {
  const { cliente, parcela_id, emprestimo_id } = route.params;
  const { vendedor } = useAuth();
  
  const [valor, setValor] = useState(cliente.saldo_parcela.toString());
  const [tipoPagamento, setTipoPagamento] = useState<'DINHEIRO' | 'TRANSFERENCIA'>('DINHEIRO');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  const valorNumerico = parseFloat(valor.replace(',', '.')) || 0;
  const saldoParcela = cliente.saldo_parcela;

  const formatarMoeda = (v: number) => {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePagar = async () => {
    if (valorNumerico <= 0) {
      Alert.alert('Erro', 'Informe um valor válido');
      return;
    }

    if (valorNumerico > saldoParcela * 1.5) {
      Alert.alert('Aviso', 'O valor informado é muito maior que o saldo da parcela. Deseja continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => processarPagamento() },
      ]);
      return;
    }

    processarPagamento();
  };

  const processarPagamento = async () => {
    setLoading(true);

    try {
      // Chamar função RPC do Supabase para registrar pagamento
      const { data, error } = await supabase.rpc('fn_registrar_pagamento_parcela', {
        p_parcela_id: parcela_id,
        p_valor_pago: valorNumerico,
        p_forma_pagamento: tipoPagamento,
        p_observacoes: observacoes || null,
        p_user_id: vendedor?.user_id || null,
      });

      if (error) {
        // Fallback: inserir diretamente se a função não existir
        const { error: insertError } = await supabase
          .from('emprestimo_parcelas')
          .update({
            valor_pago: cliente.valor_pago_parcela + valorNumerico,
            status: valorNumerico >= saldoParcela ? 'PAGO' : 'PARCIAL',
            data_pagamento: new Date().toISOString(),
            forma_pagamento: tipoPagamento,
            observacoes_pagamento: observacoes,
          })
          .eq('id', parcela_id);

        if (insertError) throw insertError;
      }

      Alert.alert(
        '✅ Pagamento Registrado!',
        `Valor: ${formatarMoeda(valorNumerico)}\nCliente: ${cliente.nome}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error);
      Alert.alert('Erro', error.message || 'Não foi possível registrar o pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Info do Cliente */}
        <View style={styles.clienteCard}>
          <Text style={styles.clienteNome}>{cliente.nome}</Text>
          <Text style={styles.clienteInfo}>
            Parcela {cliente.numero_parcela}/{cliente.numero_parcelas}
          </Text>
        </View>

        {/* Valores */}
        <View style={styles.valoresCard}>
          <View style={styles.valorRow}>
            <Text style={styles.valorLabel}>Valor da Parcela:</Text>
            <Text style={styles.valorText}>{formatarMoeda(cliente.valor_parcela)}</Text>
          </View>
          <View style={styles.valorRow}>
            <Text style={styles.valorLabel}>Já Pago:</Text>
            <Text style={[styles.valorText, styles.valorPago]}>
              {formatarMoeda(cliente.valor_pago_parcela)}
            </Text>
          </View>
          <View style={styles.separador} />
          <View style={styles.valorRow}>
            <Text style={styles.valorLabelDestaque}>Saldo Restante:</Text>
            <Text style={styles.valorDestaque}>{formatarMoeda(saldoParcela)}</Text>
          </View>
        </View>

        {/* Input de Valor */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Valor a Pagar</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputPrefix}>R$</Text>
            <TextInput
              style={styles.input}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
              placeholder="0,00"
              editable={!loading}
            />
          </View>
          
          {/* Botões de valor rápido */}
          <View style={styles.valoresRapidos}>
            <TouchableOpacity
              style={styles.valorRapidoButton}
              onPress={() => setValor(saldoParcela.toString())}
            >
              <Text style={styles.valorRapidoText}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.valorRapidoButton}
              onPress={() => setValor((saldoParcela / 2).toFixed(2))}
            >
              <Text style={styles.valorRapidoText}>Metade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.valorRapidoButton}
              onPress={() => setValor(cliente.valor_parcela.toString())}
            >
              <Text style={styles.valorRapidoText}>Parcela</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tipo de Pagamento */}
        <View style={styles.tipoContainer}>
          <Text style={styles.inputLabel}>Forma de Pagamento</Text>
          <View style={styles.tipoButtons}>
            <TouchableOpacity
              style={[
                styles.tipoButton,
                tipoPagamento === 'DINHEIRO' && styles.tipoButtonActive
              ]}
              onPress={() => setTipoPagamento('DINHEIRO')}
            >
              <Text style={styles.tipoIcon}>💵</Text>
              <Text style={[
                styles.tipoText,
                tipoPagamento === 'DINHEIRO' && styles.tipoTextActive
              ]}>Dinheiro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tipoButton,
                tipoPagamento === 'TRANSFERENCIA' && styles.tipoButtonActive
              ]}
              onPress={() => setTipoPagamento('TRANSFERENCIA')}
            >
              <Text style={styles.tipoIcon}>📱</Text>
              <Text style={[
                styles.tipoText,
                tipoPagamento === 'TRANSFERENCIA' && styles.tipoTextActive
              ]}>Transferência</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Observações */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Observações (opcional)</Text>
          <TextInput
            style={styles.textArea}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Alguma observação sobre o pagamento..."
            multiline
            numberOfLines={3}
            editable={!loading}
          />
        </View>

        {/* Botão de Confirmar */}
        <TouchableOpacity
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
          onPress={handlePagar}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>
                Confirmar Pagamento
              </Text>
              <Text style={styles.confirmButtonValor}>
                {formatarMoeda(valorNumerico)}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Botão Cancelar */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  clienteCard: {
    backgroundColor: '#1E40AF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  clienteNome: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  clienteInfo: {
    color: '#93C5FD',
    fontSize: 14,
    marginTop: 4,
  },
  valoresCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  valorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  valorLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  valorText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
  },
  valorPago: {
    color: '#10B981',
  },
  separador: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  valorLabelDestaque: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  valorDestaque: {
    color: '#2563EB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  inputPrefix: {
    paddingLeft: 16,
    fontSize: 20,
    color: '#6B7280',
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  valoresRapidos: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  valorRapidoButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  valorRapidoText: {
    color: '#374151',
    fontWeight: '500',
  },
  tipoContainer: {
    marginBottom: 16,
  },
  tipoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  tipoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  tipoButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  tipoIcon: {
    fontSize: 20,
  },
  tipoText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  tipoTextActive: {
    color: '#2563EB',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmButton: {
    backgroundColor: '#10B981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmButtonValor: {
    color: '#D1FAE5',
    fontSize: 14,
    marginTop: 4,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
});
