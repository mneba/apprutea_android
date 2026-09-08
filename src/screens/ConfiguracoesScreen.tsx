// =====================================================
// CONFIGURAÇÕES
// Arquivo: src/screens/ConfiguracoesScreen.tsx
// =====================================================
//
// Substitui o PlaceholderScreen que a engrenagem do header abria ("🚧 Em
// construção"). Por ora tem só a versão do app.
//
// A versão vem do campo `version` do app.json, escrito à mão a cada entrega.
// É rótulo, não numeração automática: o `versionCode` que o EAS incrementa
// (`appVersionSource: "remote"` no eas.json) continua correndo por fora e não
// é tocado aqui.
//
// Serve ao suporte. Quando o campo relata "continua igual", a primeira coisa a
// saber é QUAL build está no aparelho — sem isso não dá para distinguir entre
// a correção não ter funcionado e o vendedor estar com a versão anterior.

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

type Language = 'pt-BR' | 'es';

const textos = {
  'pt-BR': {
    titulo: 'Configurações',
    sobre: 'Sobre o aplicativo',
    versao: 'Versão',
    semVersao: 'não informada',
  },
  'es': {
    titulo: 'Configuración',
    sobre: 'Acerca de la aplicación',
    versao: 'Versión',
    semVersao: 'no informada',
  },
};

export default function ConfiguracoesScreen({ navigation }: any) {
  const { idioma } = useAuth();
  const insets = useSafeAreaInsets();
  const language: Language = (idioma as Language) || 'pt-BR';
  const t = textos[language];

  const versao = Constants.expoConfig?.version;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.titulo}</Text>
        {/* Espaçador da mesma largura do botão: mantém o título centrado. */}
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.sobre}</Text>
          <View style={styles.divider} />

          <View style={styles.linha}>
            <View style={styles.iconeBox}>
              <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rotulo}>{t.versao}</Text>
              <Text style={styles.valor}>{versao || t.semVersao}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  header: {
    backgroundColor: '#3B82F6',
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconeBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotulo: {
    fontSize: 12,
    color: '#6B7280',
  },
  valor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 1,
  },
});
