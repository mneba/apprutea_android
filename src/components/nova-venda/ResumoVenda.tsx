import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles/novaVendaStyles';
import { fmt, formatarData, FREQ_LABELS, type Textos } from '../../constants/novaVendaConstants';

interface Props {
  nome: string;
  segmentoNome: string;
  valorPrincipal: number;
  totalJuros: number;
  valorTotal: number;
  taxaJuros: string;
  parcelasNum: number;
  valorParcela: number;
  frequencia: string;
  dataPrimeiroVencimento: string;
  microValor: number;
  isRenegociacao: boolean;
  renegociacao: any;
  t: Textos;
}

export default function ResumoVenda(props: Props) {
  const {
    nome, segmentoNome,
    valorPrincipal, totalJuros, valorTotal, taxaJuros,
    parcelasNum, valorParcela, frequencia, dataPrimeiroVencimento,
    microValor, isRenegociacao, renegociacao, t,
  } = props;

  return (
    <>
      {/* Bloco 1 - Cliente */}
      <View style={styles.resumoBloco}>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>{t.lblCliente}</Text>
          <Text style={styles.resumoValue}>{nome || '—'}</Text>
        </View>
        {segmentoNome ? (
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>{t.lblSegmento}</Text>
            <Text style={styles.resumoValue}>{segmentoNome}</Text>
          </View>
        ) : null}
      </View>

      {/* Bloco 2 - Valores */}
      <View style={styles.resumoBloco}>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>{t.lblEmprestimo}</Text>
          <Text style={styles.resumoValue}>$ {fmt(valorPrincipal)}</Text>
        </View>
        {totalJuros > 0 && (
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>+ Juros ({taxaJuros}%):</Text>
            <Text style={[styles.resumoValue, { color: '#EF4444' }]}>$ {fmt(totalJuros)}</Text>
          </View>
        )}
        <View style={styles.resumoRow}>
          <Text style={[styles.resumoLabel, { fontWeight: '700' }]}>{t.lblTotal}</Text>
          <Text style={[styles.resumoValue, { fontWeight: '700' }]}>$ {fmt(valorTotal)}</Text>
        </View>
      </View>

      {/* Bloco 3 - Detalhes parcelas */}
      <View style={styles.resumoBloco}>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabelSmall}>{t.lblParcelas}</Text>
          <Text style={styles.resumoValueSmall}>{parcelasNum}x de $ {fmt(valorParcela)}</Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabelSmall}>{t.lblFrequencia}</Text>
          <Text style={styles.resumoValueSmall}>
            {FREQ_LABELS[frequencia] || frequencia}
          </Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabelSmall}>{t.lblVencimento}</Text>
          <Text style={styles.resumoValueSmall}>{formatarData(dataPrimeiroVencimento)}</Text>
        </View>
      </View>

      {/* Bloco 4 - Microseguro */}
      {microValor > 0 && (
        <View style={styles.resumoBloco}>
          <View style={styles.resumoRow}>
            <Text style={styles.resumoLabel}>{t.lblMicroseguro}</Text>
            <Text style={styles.resumoValue}>$ {fmt(microValor)}</Text>
          </View>
        </View>
      )}

      {/* Total a receber */}
      <View style={styles.resumoTotal}>
        <Text style={styles.resumoTotalLabel}>{t.totalReceber}</Text>
        <Text style={styles.resumoTotalValue}>$ {fmt(valorTotal + microValor)}</Text>
      </View>

      {/* Aviso saldo renegociação */}
      {isRenegociacao && renegociacao?.saldo_devedor > 0 && (
        <View style={{ backgroundColor: '#FFF7ED', padding: 12, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#F97316' }}>
          <Text style={{ fontSize: 12, color: '#9A3412', fontWeight: '600' }}>
            ⚠ Saldo devedor do empréstimo anterior: $ {fmt(renegociacao.saldo_devedor)}
          </Text>
        </View>
      )}
    </>
  );
}
