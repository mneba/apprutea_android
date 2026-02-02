import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

type Language = 'pt-BR' | 'es';

interface VendedorCompleto {
  id: string;
  nome: string;
  apellidos: string | null;
  codigo_acesso: string;
  foto_url: string | null;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  endereco: string | null;
  data_admissao: string | null;
  status: string;
  codigo_vendedor: string | null;
}

const textos = {
  'pt-BR': {
    titulo: 'Meu Perfil',
    codigo: 'Código',
    infoContato: 'Informações de Contato',
    email: 'Email',
    telefone: 'Telefone',
    dataAdmissao: 'Data Admissão',
    outrasInfos: 'Outras Informações',
    documento: 'Documento',
    endereco: 'Endereço',
    sairConta: 'Sair da Conta',
    confirmarSair: 'Deseja realmente sair do aplicativo?',
    cancelar: 'Cancelar',
    sair: 'Sair',
    semInfo: 'Não informado',
    carregando: 'Carregando perfil...',
    erroCarregar: 'Erro ao carregar dados do perfil',
  },
  'es': {
    titulo: 'Mi Perfil',
    codigo: 'Código',
    infoContato: 'Información de Contacto',
    email: 'Email',
    telefone: 'Teléfono',
    dataAdmissao: 'Fecha Admisión',
    outrasInfos: 'Otras Informaciones',
    documento: 'Documento',
    endereco: 'Dirección',
    sairConta: 'Cerrar Sesión',
    confirmarSair: '¿Desea salir de la aplicación?',
    cancelar: 'Cancelar',
    sair: 'Salir',
    semInfo: 'No informado',
    carregando: 'Cargando perfil...',
    erroCarregar: 'Error al cargar datos del perfil',
  },
};

export default function PerfilScreen({ navigation }: any) {
  const { vendedor, signOut, idioma } = useAuth();
  const [vendedorCompleto, setVendedorCompleto] = useState<VendedorCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const language: Language = (idioma as Language) || 'pt-BR';
  const t = textos[language];

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    if (!vendedor) return;

    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nome, apellidos, codigo_acesso, foto_url, email, telefone, documento, endereco, data_admissao, status, codigo_vendedor')
        .eq('id', vendedor.id)
        .single();

      if (error) throw error;
      setVendedorCompleto(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      // Fallback: usa dados do AuthContext
      setVendedorCompleto({
        id: vendedor.id,
        nome: vendedor.nome,
        apellidos: null,
        codigo_acesso: vendedor.codigo,
        foto_url: vendedor.foto_url,
        email: vendedor.email,
        telefone: null,
        documento: null,
        endereco: null,
        data_admissao: null,
        status: 'ATIVO',
        codigo_vendedor: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t.sairConta,
      t.confirmarSair,
      [
        { text: t.cancelar, style: 'cancel' },
        { text: t.sair, onPress: signOut, style: 'destructive' },
      ]
    );
  };

  const formatarData = (data: string | null) => {
    if (!data) return t.semInfo;
    try {
      const d = new Date(data);
      return d.toLocaleDateString(language === 'pt-BR' ? 'pt-BR' : 'es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return data;
    }
  };

  const formatarTelefone = (tel: string | null) => {
    if (!tel) return t.semInfo;
    // Se já tem formatação, retorna como está
    if (tel.includes('(') || tel.includes('+')) return tel;
    // Tenta formatar brasileiro
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 11) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    }
    if (limpo.length === 13 && limpo.startsWith('55')) {
      return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    return tel;
  };

  const handleLigar = (telefone: string | null) => {
    if (!telefone) return;
    Linking.openURL(`tel:${telefone}`);
  };

  const handleEmail = (email: string | null) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>{t.carregando}</Text>
      </View>
    );
  }

  const v = vendedorCompleto;
  const nomeCompleto = v ? `${v.nome}${v.apellidos ? ' ' + v.apellidos : ''}` : '';
  const temContato = v?.email || v?.telefone || v?.data_admissao;
  const temOutrasInfos = v?.documento || v?.endereco;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.titulo}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Card Avatar + Nome */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarContainer}>
            {v?.foto_url ? (
              <Image source={{ uri: v.foto_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarIcon}>👤</Text>
              </View>
            )}
          </View>
          <Text style={styles.nomeCompleto}>{nomeCompleto}</Text>
          <View style={styles.codigoRow}>
            <Text style={styles.codigoIcon}>🛡️</Text>
            <Text style={styles.codigoText}>{t.codigo}: {v?.codigo_acesso || '-'}</Text>
          </View>
        </View>

        {/* Card Informações de Contato */}
        {temContato && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{t.infoContato}</Text>
            <View style={styles.infoCardDivider} />

            {v?.email && (
              <TouchableOpacity style={styles.infoRow} onPress={() => handleEmail(v.email)}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={styles.infoRowIcon}>✉️</Text>
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowLabel}>{t.email}</Text>
                  <Text style={styles.infoRowValue}>{v.email}</Text>
                </View>
              </TouchableOpacity>
            )}

            {v?.telefone && (
              <TouchableOpacity style={styles.infoRow} onPress={() => handleLigar(v.telefone)}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={styles.infoRowIcon}>📞</Text>
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowLabel}>{t.telefone}</Text>
                  <Text style={styles.infoRowValue}>{formatarTelefone(v.telefone)}</Text>
                </View>
              </TouchableOpacity>
            )}

            {v?.data_admissao && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={styles.infoRowIcon}>📅</Text>
                </View>
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowLabel}>{t.dataAdmissao}</Text>
                  <Text style={styles.infoRowValue}>{formatarData(v.data_admissao)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Card Outras Informações */}
        {temOutrasInfos && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{t.outrasInfos}</Text>
            <View style={styles.infoCardDivider} />

            {v?.documento && (
              <View style={styles.infoRowSimple}>
                <Text style={styles.infoRowSimpleLabel}>{t.documento}</Text>
                <Text style={styles.infoRowSimpleValue}>{v.documento}</Text>
              </View>
            )}

            {v?.endereco && (
              <View style={styles.infoRowSimple}>
                <Text style={styles.infoRowSimpleLabel}>{t.endereco}</Text>
                <Text style={styles.infoRowSimpleValue}>{v.endereco}</Text>
              </View>
            )}
          </View>
        )}

        {/* Botão Sair */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>{t.sairConta}</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },

  // Header
  header: {
    backgroundColor: '#3B82F6',
    paddingTop: 50,
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
  backIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Avatar Card
  avatarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    fontSize: 48,
  },
  nomeCompleto: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  codigoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codigoIcon: {
    fontSize: 14,
  },
  codigoText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoCardDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },

  // Info Row (com ícone)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoRowIcon: {
    fontSize: 20,
  },
  infoRowContent: {
    flex: 1,
  },
  infoRowLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoRowValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },

  // Info Row Simple (sem ícone)
  infoRowSimple: {
    marginBottom: 14,
  },
  infoRowSimpleLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoRowSimpleValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },

  // Logout
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
