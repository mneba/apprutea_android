import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { ClienteRotaDia } from '../types';

export default function ClientesScreen({ navigation }: any) {
  const { vendedor } = useAuth();
  const [clientes, setClientes] = useState<ClienteRotaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'pagos'>('todos');

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    if (!vendedor) return;

    try {
      // Buscar clientes do dia pela view
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('vw_clientes_rota_dia')
        .select('*')
        .eq('rota_id', vendedor.rota_id)
        .eq('data_vencimento', hoje)
        .order('ordem_visita_dia', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        
        // Fallback: buscar direto das tabelas
        const { data: parcelas, error: parcelasError } = await supabase
          .from('emprestimo_parcelas')
          .select(`
            id,
            numero_parcela,
            valor_parcela,
            valor_pago,
            status,
            data_vencimento,
            ordem_visita,
            emprestimos!inner (
              id,
              valor_principal,
              saldo_atual,
              numero_parcelas,
              status,
              rota_id,
              clientes!inner (
                id,
                nome,
                telefone_celular,
                endereco
              )
            )
          `)
          .eq('emprestimos.rota_id', vendedor.rota_id)
          .eq('data_vencimento', hoje);

        if (!parcelasError && parcelas) {
          // Mapear para o formato esperado
          const clientesMapeados = parcelas.map((p: any) => ({
            cliente_id: p.emprestimos.clientes.id,
            nome: p.emprestimos.clientes.nome,
            telefone_celular: p.emprestimos.clientes.telefone_celular,
            endereco: p.emprestimos.clientes.endereco,
            emprestimo_id: p.emprestimos.id,
            saldo_emprestimo: p.emprestimos.saldo_atual,
            valor_principal: p.emprestimos.valor_principal,
            numero_parcelas: p.emprestimos.numero_parcelas,
            status_emprestimo: p.emprestimos.status,
            rota_id: p.emprestimos.rota_id,
            parcela_id: p.id,
            numero_parcela: p.numero_parcela,
            valor_parcela: p.valor_parcela,
            valor_pago_parcela: p.valor_pago || 0,
            saldo_parcela: p.valor_parcela - (p.valor_pago || 0),
            status_parcela: p.status,
            data_vencimento: p.data_vencimento,
            ordem_visita_dia: p.ordem_visita,
            status_dia: p.status === 'PAGO' ? 'PAGO' : (p.valor_pago > 0 ? 'PARCIAL' : 'PENDENTE'),
          }));
          setClientes(clientesMapeados);
        }
      } else {
        setClientes(data || []);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarClientes();
  };

  const clientesFiltrados = useMemo(() => {
    let resultado = clientes;

    // Filtro por busca
    if (busca) {
      const buscaLower = busca.toLowerCase();
      resultado = resultado.filter(c => 
        c.nome.toLowerCase().includes(buscaLower) ||
        c.endereco?.toLowerCase().includes(buscaLower)
      );
    }

    // Filtro por status
    if (filtro === 'pendentes') {
      resultado = resultado.filter(c => c.status_dia !== 'PAGO');
    } else if (filtro === 'pagos') {
      resultado = resultado.filter(c => c.status_dia === 'PAGO');
    }

    return resultado;
  }, [clientes, busca, filtro]);

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAGO': return '#10B981';
      case 'PARCIAL': return '#F59E0B';
      case 'EM_ATRASO': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PAGO': return '✅ Pago';
      case 'PARCIAL': return '⚡ Parcial';
      case 'EM_ATRASO': return '⚠️ Atraso';
      default: return '⏳ Pendente';
    }
  };

  const handleWhatsApp = (telefone: string | null, nome: string) => {
    if (!telefone) {
      Alert.alert('Aviso', 'Cliente não possui telefone cadastrado');
      return;
    }
    const numero = telefone.replace(/\D/g, '');
    const mensagem = `Olá ${nome}, tudo bem?`;
    Linking.openURL(`whatsapp://send?phone=55${numero}&text=${encodeURIComponent(mensagem)}`);
  };

  const handlePagar = (cliente: ClienteRotaDia) => {
    navigation.navigate('Pagamento', {
      cliente,
      parcela_id: cliente.parcela_id,
      emprestimo_id: cliente.emprestimo_id,
    });
  };

  const renderCliente = ({ item }: { item: ClienteRotaDia }) => (
    <TouchableOpacity 
      style={styles.clienteCard}
      onPress={() => navigation.navigate('ClienteDetalhe', { cliente: item })}
    >
      <View style={styles.clienteHeader}>
        <View style={styles.clienteInfo}>
          <Text style={styles.clienteNome}>{item.nome}</Text>
          <Text style={styles.clienteEndereco} numberOfLines={1}>
            📍 {item.endereco || 'Sem endereço'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status_dia) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status_dia) }]}>
            {getStatusText(item.status_dia)}
          </Text>
        </View>
      </View>

      <View style={styles.clienteBody}>
        <View style={styles.valorContainer}>
          <Text style={styles.valorLabel}>Parcela {item.numero_parcela}/{item.numero_parcelas}</Text>
          <Text style={styles.valorParcela}>{formatarMoeda(item.valor_parcela)}</Text>
          {item.valor_pago_parcela > 0 && (
            <Text style={styles.valorPago}>
              Pago: {formatarMoeda(item.valor_pago_parcela)}
            </Text>
          )}
        </View>

        <View style={styles.acoes}>
          <TouchableOpacity
            style={styles.acaoButton}
            onPress={() => handleWhatsApp(item.telefone_celular, item.nome)}
          >
            <Text style={styles.acaoIcon}>💬</Text>
          </TouchableOpacity>

          {item.status_dia !== 'PAGO' && (
            <TouchableOpacity
              style={[styles.acaoButton, styles.acaoButtonPrimary]}
              onPress={() => handlePagar(item)}
            >
              <Text style={styles.acaoButtonText}>Pagar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando clientes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barra de busca */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar cliente..."
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      {/* Filtros */}
      <View style={styles.filtrosContainer}>
        <TouchableOpacity
          style={[styles.filtroButton, filtro === 'todos' && styles.filtroButtonActive]}
          onPress={() => setFiltro('todos')}
        >
          <Text style={[styles.filtroText, filtro === 'todos' && styles.filtroTextActive]}>
            Todos ({clientes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroButton, filtro === 'pendentes' && styles.filtroButtonActive]}
          onPress={() => setFiltro('pendentes')}
        >
          <Text style={[styles.filtroText, filtro === 'pendentes' && styles.filtroTextActive]}>
            Pendentes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroButton, filtro === 'pagos' && styles.filtroButtonActive]}
          onPress={() => setFiltro('pagos')}
        >
          <Text style={[styles.filtroText, filtro === 'pagos' && styles.filtroTextActive]}>
            Pagos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de clientes */}
      <FlatList
        data={clientesFiltrados}
        renderItem={renderCliente}
        keyExtractor={(item) => `${item.cliente_id}-${item.parcela_id}`}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Nenhum cliente encontrado</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  filtrosContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filtroButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filtroButtonActive: {
    backgroundColor: '#2563EB',
  },
  filtroText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filtroTextActive: {
    color: '#fff',
  },
  lista: {
    padding: 16,
  },
  clienteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clienteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clienteInfo: {
    flex: 1,
    marginRight: 12,
  },
  clienteNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  clienteEndereco: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clienteBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valorContainer: {
    flex: 1,
  },
  valorLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  valorParcela: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  valorPago: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  acoes: {
    flexDirection: 'row',
    gap: 8,
  },
  acaoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acaoButtonPrimary: {
    backgroundColor: '#2563EB',
    width: 'auto',
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  acaoIcon: {
    fontSize: 20,
  },
  acaoButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
