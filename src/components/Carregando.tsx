// =====================================================================
// CARREGANDO — padrão único de espera
// Arquivo: src/components/Carregando.tsx
// =====================================================================
//
// Cada tela fazia o seu: um `ActivityIndicator` solto com `marginTop: 40`
// aqui, outro centralizado ali, tamanhos e cores diferentes. O resultado é
// que abrir a ficha, os detalhes ou as notas parecia três aplicativos.
//
// Aqui o espaçamento, a cor e o tamanho são os mesmos em todo lugar, e existe
// espaço para dizer O QUE está carregando — numa rota com sinal ruim, "Abrindo
// a ficha…" é a diferença entre esperar e achar que travou.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Props {
  /** O que está sendo carregado. Sem isto fica só o spinner. */
  texto?: string;
  /** `tela` ocupa o espaço disponível e centraliza; `bloco` fica em fluxo. */
  variante?: 'tela' | 'bloco';
  tamanho?: 'small' | 'large';
  cor?: string;
}

export default function Carregando({
  texto,
  variante = 'tela',
  tamanho = 'large',
  cor = '#3B82F6',
}: Props) {
  return (
    <View style={variante === 'tela' ? S.tela : S.bloco}>
      <ActivityIndicator size={tamanho} color={cor} />
      {!!texto && <Text style={S.texto}>{texto}</Text>}
    </View>
  );
}

const S = StyleSheet.create({
  tela: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bloco: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  texto: { marginTop: 12, fontSize: 13, color: '#6B7280', textAlign: 'center' },
});
