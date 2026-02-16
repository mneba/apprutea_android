import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      icon: '👤',
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
      icon: '💰',
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
                        <Text style={styles.optionIconText}>{acao.icon}</Text>
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
                    {bloqueado && <Text style={styles.optionLock}>🔒</Text>}
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

// Tab Navigator principal com modal
function MainTabsContent({ navigation }: any) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
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
              <Text style={{ fontSize: 24 }}>🏠</Text>
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
                <Text style={[
                  styles.fabButtonText,
                  modalVisible && styles.fabButtonTextActive
                ]}>
                  {modalVisible ? '✕' : '+'}
                </Text>
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
              <Text style={{ fontSize: 24 }}>👥</Text>
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