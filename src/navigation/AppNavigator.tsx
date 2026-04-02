import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SolicitacoesWidget } from '../components/SolicitacoesWidget';
import { useAuth } from '../contexts/AuthContext';
import { LiquidacaoProvider, useLiquidacaoContext } from '../contexts/LiquidacaoContext';

// Screens
import ClientesScreen from '../screens/ClientesScreen';
import LiquidacaoScreen from '../screens/LiquidacaoScreen';
import LoginScreen from '../screens/LoginScreen';
import NovaMovimentacaoScreen from '../screens/NovaMovimentacaoScreen';
import NovaVendaScreen from '../screens/NovaVendaScreen';
import PagamentoScreen from '../screens/PagamentoScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Stack para usuários não autenticados
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// Componente do Modal de Ações Rápidas
function AcoesRapidasModal({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) {
  const liqCtx = useLiquidacaoContext();
  const temLiquidacaoAberta = liqCtx.temLiquidacaoAberta;

  const handleAction = (screen: string) => {
    onClose();
    if (!temLiquidacaoAberta) {
      Alert.alert(
        'Liquidação Necessária',
        'Você precisa abrir uma liquidação para realizar esta ação.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ir para Liquidação', onPress: () => navigation.navigate('Home') }
        ]
      );
      return;
    }
    navigation.navigate(screen);
  };

  const acoes = [
    {
      key: 'novo_cliente',
      iconName: 'person-add-outline' as const,
      badge: '+',
      iconBg: '#10B981',
      badgeBorder: '#10B981',
      title: 'Novo Cliente',
      desc: 'Cadastrar cliente e empréstimo',
      screen: 'NovoCliente',
      requerLiquidacao: true,
    },
    {
      key: 'nova_movimentacao',
      iconName: 'wallet-outline' as const,
      badge: null,
      iconBg: '#F59E0B',
      badgeBorder: null,
      title: 'Nova Movimentação',
      desc: 'Registrar despesa ou receita',
      screen: 'NovaMovimentacao',
      requerLiquidacao: true,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            {acoes.map((acao, index) => {
              const bloqueado = acao.requerLiquidacao && !temLiquidacaoAberta;
              return (
                <React.Fragment key={acao.key}>
                  {index > 0 && <View style={styles.separator} />}
                  <TouchableOpacity
                    style={[styles.modalOption, bloqueado && styles.modalOptionDisabled]}
                    onPress={() => handleAction(acao.screen)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.optionIconWrapper}>
                      <View style={[styles.optionIcon, { backgroundColor: bloqueado ? '#D1D5DB' : acao.iconBg }]}>  
                        <Ionicons name={acao.iconName} size={22} color="#fff" />
                        {acao.badge && (
                          <View style={[styles.optionIconBadge, { borderColor: bloqueado ? '#D1D5DB' : acao.badgeBorder }]}>
                            <Text style={[styles.optionIconBadgeText, { color: bloqueado ? '#D1D5DB' : acao.badgeBorder }]}>{acao.badge}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, bloqueado && styles.optionTitleDisabled]}>
                        {acao.title}
                      </Text>
                      <Text style={[styles.optionDesc, bloqueado && styles.optionDescDisabled]}>
                        {acao.desc}
                      </Text>
                    </View>
                    {bloqueado && <Ionicons name="lock-closed" size={16} color="#9CA3AF" style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Header Compartilhado ────────────────────────────────────────────────────
const TAB_TITLES: Record<string, { pt: string; es: string }> = {
  Home:     { pt: 'Liquidação Diária', es: 'Liquidación Diaria' },
  Clientes: { pt: 'Meus Clientes',     es: 'Mis Clientes'       },
};

function SharedHeader({ navigation }: { navigation: any }) {
  const { vendedor, idioma } = useAuth();
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState(true);

  // Nome da aba ativa — SharedHeader está dentro do contexto das tabs
  const activeRoute = useNavigationState(state => {
    if (!state) return 'Home';
    const idx = state.index ?? 0;
    return state.routes?.[idx]?.name ?? 'Home';
  });

  const titles = TAB_TITLES[activeRoute] ?? TAB_TITLES['Home'];
  const titulo = idioma === 'es' ? titles.es : titles.pt;

  // Monitor de conexão
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={[sharedHeaderStyles.header, { paddingTop: insets.top + 14 }]}>
      {/* Esquerda: título + rota */}
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={sharedHeaderStyles.titulo} numberOfLines={1}>{titulo}</Text>
        {(vendedor as any).rota_nome ? (
          <Text style={sharedHeaderStyles.sub} numberOfLines={1}>
            {(vendedor as any).rota_nome}
          </Text>
        ) : null}
      </View>

      {/* Direita: indicador, sino, foto, engrenagem */}
      <View style={sharedHeaderStyles.actions}>
        <View style={[sharedHeaderStyles.dot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />

        {/* Sino de Solicitações */}
        {vendedor?.id && (vendedor as any)?.rota_id && (
          <SolicitacoesWidget 
            vendedorId={vendedor.id} 
            rotaId={(vendedor as any).rota_id} 
            lang={idioma || 'pt-BR'} 
          />
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Perfil')} activeOpacity={0.8}>
          {vendedor?.foto_url ? (
            <Image source={{ uri: (vendedor as any).foto_url }} style={sharedHeaderStyles.avatar} />
          ) : (
            <View style={sharedHeaderStyles.avatarPlaceholder}>
              <Ionicons name="person" size={18} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Configuracoes')} style={sharedHeaderStyles.gearBtn}>
          <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sharedHeaderStyles = StyleSheet.create({
  header: {
    backgroundColor: '#3B82F6',
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub:    { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', marginTop: 2 },
  subRota: { color: 'rgba(255,255,255,0.65)', fontWeight: '400' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  avatar:   { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  gearBtn:  { padding: 4 },
});
// ─────────────────────────────────────────────────────────────────────────────

// Tab Navigator principal com modal
function MainTabsContent({ navigation }: any) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <SharedHeader navigation={navigation} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: 20,
            paddingTop: 10,
            height: 80,
          },
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={LiquidacaoScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={24} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="AcoesRapidas"
          component={PlaceholderScreen}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setModalVisible(prev => !prev);
            },
          }}
          options={{
            tabBarLabel: '',
            tabBarIcon: ({ color }) => (
              <View style={[
                styles.fabButton,
                modalVisible && styles.fabButtonActive
              ]}>
                {modalVisible ? (
                  <Ionicons name="close" size={24} color="#fff" />
                ) : (
                  <Ionicons name="add" size={28} color="#fff" />
                )}
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Clientes"
          component={ClientesScreen}
          options={{
            tabBarLabel: 'Clientes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={24} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Modal de Ações Rápidas */}
      <AcoesRapidasModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        navigation={navigation}
      />
    </>
  );
}

// Wrapper para MainTabs com LiquidacaoProvider
function MainTabs({ navigation }: any) {
  return (
    <LiquidacaoProvider>
      <MainTabsContent navigation={navigation} />
    </LiquidacaoProvider>
  );
}

// Placeholder para telas não implementadas
function PlaceholderScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🚧</Text>
      <Text style={{ fontSize: 18, color: '#6B7280', marginBottom: 24 }}>Em construção</Text>
      <Text 
        style={{ color: '#2563EB', fontSize: 16 }}
        onPress={() => navigation.goBack()}
      >
        Voltar
      </Text>
    </View>
  );
}

// Stack principal (com tabs + telas de detalhe)
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1E40AF' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Pagamento" 
        component={PagamentoScreen}
        options={{ title: 'Registrar Pagamento' }}
      />
      <Stack.Screen 
        name="NovoCliente" 
        component={NovaVendaScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="NovaMovimentacao" 
        component={NovaMovimentacaoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ClienteDetalhe" 
        component={PlaceholderScreen}
        options={{ title: 'Detalhes do Cliente' }}
      />
      <Stack.Screen 
        name="Perfil" 
        component={PerfilScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Configuracoes" 
        component={PlaceholderScreen}
        options={{ title: 'Configurações' }}
      />
    </Stack.Navigator>
  );
}

// Estilos
const styles = StyleSheet.create({
  // FAB Button
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabButtonActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  fabButtonText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  fabButtonTextActive: {
    fontSize: 22,
    fontWeight: '500',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 100,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '85%',
    maxWidth: 340,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    paddingVertical: 6,
  },
  // Opções
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  modalOptionDisabled: {
    opacity: 0.5,
  },
  optionIconWrapper: {
    marginRight: 16,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  optionIconText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
  optionIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  optionIconBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: -1,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 3,
  },
  optionTitleDisabled: {
    color: '#9CA3AF',
  },
  optionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
  optionDescDisabled: {
    color: '#C0C5CE',
  },
  optionLock: {
    fontSize: 16,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },
});

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E40AF' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}