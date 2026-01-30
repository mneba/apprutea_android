import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { Vendedor, Rota } from '../types';

interface VendedorAuth {
  id: string;
  codigo: string;
  nome: string;
  email: string | null;
  empresa_id: string | null;
  user_id: string | null;
  foto_url: string | null;
  rota_id: string;
  rota_nome: string;
}

interface AuthContextType {
  vendedor: VendedorAuth | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (codigo: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Textos em PT-BR e ES
const errorTexts = {
  'pt-BR': {
    invalidCode: 'Código de vendedor inválido',
    inactive: 'Vendedor inativo. Entre em contato com o suporte.',
    noRoute: 'Você não possui uma rota vinculada. Entre em contato com o administrador.',
  },
  'es': {
    invalidCode: 'Código de vendedor inválido',
    inactive: 'Vendedor inactivo. Contacte al soporte.',
    noRoute: 'No tiene una ruta vinculada. Contacte al administrador.',
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [vendedor, setVendedor] = useState<VendedorAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar vendedor salvo ao iniciar
  useEffect(() => {
    loadStoredVendedor();
  }, []);

  const loadStoredVendedor = async () => {
    try {
      const storedVendedor = await AsyncStorage.getItem('vendedor_data');
      if (storedVendedor) {
        setVendedor(JSON.parse(storedVendedor));
      }
    } catch (error) {
      console.error('Erro ao carregar vendedor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (codigo: string): Promise<{ success: boolean; error?: string }> => {
    const t = errorTexts['pt-BR']; // TODO: implementar seleção de idioma

    try {
      // Buscar vendedor pelo código
      const { data: vendedorData, error: vendedorError } = await supabase
        .from('vendedores')
        .select('*')
        .eq('codigo_acesso', codigo)
        .single();

      if (vendedorError || !vendedorData) {
        return { success: false, error: t.invalidCode };
      }

      // Verificar se está ativo
      if (vendedorData.status && vendedorData.status.toLowerCase() === 'inativo') {
        return { success: false, error: t.inactive };
      }

      // Buscar rota do vendedor
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select('id, nome')
        .eq('vendedor_id', vendedorData.id)
        .single();

      if (rotaError || !rotaData) {
        return { success: false, error: t.noRoute };
      }

      // Montar objeto do vendedor autenticado
      const vendedorAuth: VendedorAuth = {
        id: vendedorData.id,
        codigo: codigo,
        nome: vendedorData.nome,
        email: vendedorData.email,
        empresa_id: vendedorData.empresa_id,
        user_id: vendedorData.user_id,
        foto_url: vendedorData.foto_url,
        rota_id: rotaData.id,
        rota_nome: rotaData.nome,
      };

      // Salvar no AsyncStorage
      await AsyncStorage.setItem('vendedor_data', JSON.stringify(vendedorAuth));
      
      setVendedor(vendedorAuth);
      return { success: true };

    } catch (error: any) {
      console.error('Erro no login:', error);
      return { success: false, error: error.message || t.invalidCode };
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('vendedor_data');
      setVendedor(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      vendedor,
      isLoading,
      isAuthenticated: !!vendedor,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
