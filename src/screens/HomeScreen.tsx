import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { LiquidacaoDiaria } from '../types';

export default function HomeScreen({ navigation }: any) {
  const { vendedor, signOut } = useAuth();
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    if (!vendedor) return;

    try {
      // Buscar liquidação aberta
      const { data, error } = await supabase
        .from('liquidacoes_diarias')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .eq('status', 'ABERTA')
        .order('data_abertura', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setLiquidacao(data);
      } else {
        setLiquidacao(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarDados();
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair do aplicativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', onPress: signOut, style: 'destructive' },
      ]
    );
  };

  const formatarMoeda = (valor: number | null) => {
    if (valor === null) return 'R$ 0,00';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header com info do vendedor */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.welcomeText}>Olá,</Text>
          <Text style={styles.vendedorNome}>{vendedor?.nome}</Text>
          <Text style={styles.rotaNome}>📍 {vendedor?.rota_nome}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Status da Liquidação */}
      <View style={styles.statusCard}>
        {liquidacao ? (
          <>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>🟢 DIA ABERTO</Text>
            </View>
            <Text style={styles.statusData}>
              Aberto em: {new Date(liquidacao.data_abertura).toLocaleDateString('pt-BR')}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.statusBadge, styles.statusBadgeClosed]}>
              <Text style={styles.statusBadgeText}>🔴 DIA FECHADO</Text>
            </View>
            <Text style={styles.statusData}>Nenhuma liquidação aberta</Text>
          </>
        )}
      </View>

      {/* Cards de Resumo */}
      {liquidacao && (
        <View style={styles.resumoContainer}>
          <View style={styles.resumoRow}>
            <View style={[styles.resumoCard, styles.resumoCardBlue]}>
              <Text style={styles.resumoLabel}>Caixa Inicial</Text>
              <Text style={styles.resumoValue}>
                {formatarMoeda(liquidacao.caixa_inicial)}
              </Text>
            </View>
            <View style={[styles.resumoCard, styles.resumoCardGreen]}>
              <Text style={styles.resumoLabel}>Recebido Hoje</Text>
              <Text style={styles.resumoValue}>
                {formatarMoeda(liquidacao.valor_recebido_dia)}
              </Text>
            </View>
          </View>
          <View style={styles.resumoRow}>
            <View style={[styles.resumoCard, styles.resumoCardPurple]}>
              <Text style={styles.resumoLabel}>Meta do Dia</Text>
              <Text style={styles.resumoValue}>
                {formatarMoeda(liquidacao.valor_esperado_dia)}
              </Text>
            </View>
            <View style={[styles.resumoCard, styles.resumoCardOrange]}>
              <Text style={styles.resumoLabel}>% Atingido</Text>
              <Text style={styles.resumoValue}>
                {liquidacao.percentual_recebimento?.toFixed(1) || 0}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Menu de Ações */}
      <View style={styles.menuContainer}>
        <Text style={styles.menuTitle}>Menu</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Clientes')}
        >
          <Text style={styles.menuIcon}>👥</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Clientes do Dia</Text>
            <Text style={styles.menuItemSubtitle}>Ver lista de cobranças</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Liquidacao')}
        >
          <Text style={styles.menuIcon}>📊</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Liquidação</Text>
            <Text style={styles.menuItemSubtitle}>Abrir/Fechar dia</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('NovoEmprestimo')}
        >
          <Text style={styles.menuIcon}>💰</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Novo Empréstimo</Text>
            <Text style={styles.menuItemSubtitle}>Cadastrar venda</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Despesas')}
        >
          <Text style={styles.menuIcon}>📝</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Despesas</Text>
            <Text style={styles.menuItemSubtitle}>Registrar gastos</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#1E40AF',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  welcomeText: {
    color: '#93C5FD',
    fontSize: 16,
  },
  vendedorNome: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  rotaNome: {
    color: '#BFDBFE',
    fontSize: 14,
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusBadgeClosed: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  statusData: {
    color: '#6B7280',
    fontSize: 14,
  },
  resumoContainer: {
    paddingHorizontal: 16,
  },
  resumoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  resumoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  resumoCardBlue: {
    backgroundColor: '#DBEAFE',
  },
  resumoCardGreen: {
    backgroundColor: '#D1FAE5',
  },
  resumoCardPurple: {
    backgroundColor: '#E9D5FF',
  },
  resumoCardOrange: {
    backgroundColor: '#FED7AA',
  },
  resumoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  resumoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  menuContainer: {
    padding: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 24,
    color: '#9CA3AF',
  },
});
