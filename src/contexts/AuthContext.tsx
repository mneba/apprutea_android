import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

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
  idioma: 'pt-BR' | 'es';
  setIdioma: (idioma: 'pt-BR' | 'es') => void;
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
  const [idioma, setIdiomaState] = useState<'pt-BR' | 'es'>('pt-BR');

  // Carregar vendedor e idioma salvos ao iniciar
  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const [storedVendedor, storedIdioma] = await Promise.all([
        AsyncStorage.getItem('vendedor_data'),
        AsyncStorage.getItem('app_idioma'),
      ]);

      // Fallback para localStorage no web
      const vendedorRaw = storedVendedor
        || (typeof window !== 'undefined' ? window.localStorage?.getItem('vendedor_data') : null);
      const idiomaRaw = storedIdioma
        || (typeof window !== 'undefined' ? window.localStorage?.getItem('app_idioma') : null);

      if (vendedorRaw) {
        setVendedor(JSON.parse(vendedorRaw));
        // Verificar se já há sessão ativa (Supabase persiste automaticamente)
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          console.warn('Sessão Supabase expirada — usuário precisará relogar para operações avançadas');
        }
      }

      if (idiomaRaw === 'pt-BR' || idiomaRaw === 'es') {
        setIdiomaState(idiomaRaw);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setIdioma = async (novoIdioma: 'pt-BR' | 'es') => {
    try {
      await AsyncStorage.setItem('app_idioma', novoIdioma);
      setIdiomaState(novoIdioma);
    } catch (error) {
      console.error('Erro ao salvar idioma:', error);
    }
  };

  const signIn = async (codigo: string): Promise<{ success: boolean; error?: string }> => {
    const t = errorTexts[idioma];
    
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

      // Salvar no AsyncStorage (e localStorage no web)
      await AsyncStorage.setItem('vendedor_data', JSON.stringify(vendedorAuth));
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('vendedor_data', JSON.stringify(vendedorAuth));
      }
      setVendedor(vendedorAuth);

      // Login real no Supabase usando padrão codigo@apprutea.internal
      const authEmail = `${codigo}@apprutea.internal`;
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: codigo,
      });
      if (authError) {
        console.warn('Aviso: login Supabase falhou:', authError.message);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erro no login:', error);
      return { success: false, error: error.message || t.invalidCode };
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('vendedor_data');
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('vendedor_data');
      }
      await supabase.auth.signOut();
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
      idioma,
      setIdioma,
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