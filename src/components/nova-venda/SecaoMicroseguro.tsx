import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { styles } from '../../styles/novaVendaStyles';
import type { Textos } from '../../constants/novaVendaConstants';

interface Props {
  valorMicroseguro: string;
  handleValorMicroseguroChange: (text: string) => void;
  t: Textos;
}

export default function SecaoMicroseguro({ valorMicroseguro, handleValorMicroseguroChange, t }: Props) {
  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.valorMicroseguro}</Text>
        <TextInput
          style={styles.input}
          value={valorMicroseguro}
          onChangeText={handleValorMicroseguroChange}
          placeholder="$ 0,00"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
        />
      </View>
      <View style={styles.infoBox}>
        <Text style={styles.infoBoxText}>
          ℹ️ O microseguro será cobrado junto com a primeira parcela.
        </Text>
      </View>
    </>
  );
}
