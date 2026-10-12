import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../services/supabase';
import { definirIdiomaDasMensagens } from '../utils/mensagemErro';

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
  /**
   * Refaz a sessão do Supabase com o código guardado. Devolve `false`
   * quando não dá — e nesse caso já derrubou o vendedor para o login.
   *
   * Quem pega um erro de permissão chama isto e manda o vendedor repetir,
   * em vez de deixá-lo numa tela que lê e não grava.
   */
  recuperarSessao: () => Promise<boolean>;
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

  /**
   * O relógio de renovação do token e a volta do segundo plano.
   *
   * `autoRefreshToken: true` no cliente NÃO BASTA em React Native: o
   * temporizador não roda com o app em segundo plano, e o supabase-js pede
   * explicitamente que se chame `startAutoRefresh` e `stopAutoRefresh` a cada
   * mudança de estado. Sem isso, o vendedor que sai para responder um
   * WhatsApp e volta meia hora depois pode achar a sessão vencida.
   *
   * E ao voltar, confere: se a sessão caiu de vez, refaz. É o mesmo caminho
   * da abertura do app, no momento em que ele volta a precisar dela.
   */
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        supabase.auth.startAutoRefresh();
        if (vendedor) void garantirSessao(vendedor);
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    return () => assinatura.remove();
  }, [vendedor]);

  /**
   * Garante que o pedido sai como `authenticated`, e não como `anon`.
   *
   * O QUE ACONTECIA ANTES, e foi visto no campo em 09/10/2026 às 21h49: o
   * app restaurava o vendedor do AsyncStorage, via que a sessão do Supabase
   * tinha caído, escrevia um aviso no console e SEGUIA como se estivesse
   * logado. A tela carregava normalmente, porque as funções de leitura
   * (`fn_liquidacao_dia_completa`, `fn_data_hoje_rota`, `fn_listar_notas`)
   * têm `anon` no ACL. Aí o vendedor tentava abrir o dia e levava
   *
   *     permission denied for function fn_abrir_liquidacao_diaria
   *
   * porque as funções de ESCRITA só aceitam `authenticated`. O mesmo valia
   * para registrar pagamento.
   *
   * POR QUE DÁ PARA RELOGAR SOZINHO: a senha do vendedor É o código de
   * acesso dele, e o código já está no `vendedor_data` desde o primeiro
   * login. Reautenticar não expõe nada que não estivesse guardado — e poupa
   * o vendedor de descobrir o problema no meio da rua, com o cliente na
   * frente.
   *
   * SE FALHAR, derruba. Código trocado ou vendedor desativado têm de levar ao
   * login; seguir com a tela carregada e as escritas negadas é o pior dos
   * mundos, que foi exatamente o que aconteceu.
   */
  const garantirSessao = async (v: VendedorAuth): Promise<boolean> => {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return true;

    const { error } = await supabase.auth.signInWithPassword({
      email: `${v.codigo}@apprutea.internal`,
      password: v.codigo,
    });

    if (error) {
      console.warn('Não foi possível refazer a sessão:', error.message);
      await AsyncStorage.removeItem('vendedor_data');
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('vendedor_data');
      }
      setVendedor(null);
      return false;
    }
    return true;
  };

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
        const v: VendedorAuth = JSON.parse(vendedorRaw);
        setVendedor(v);
        await garantirSessao(v);
      }

      if (idiomaRaw === 'pt-BR' || idiomaRaw === 'es') {
        setIdiomaState(idiomaRaw);
        definirIdiomaDasMensagens(idiomaRaw);
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
      definirIdiomaDasMensagens(novoIdioma);
    } catch (error) {
      console.error('Erro ao salvar idioma:', error);
    }
  };

  const signIn = async (codigo: string): Promise<{ success: boolean; error?: string }> => {
    const t = errorTexts[idioma];
    
    try {
      // 1. Fazer login no Supabase primeiro (email = codigo@apprutea.internal)
      const authEmail = `${codigo}@apprutea.internal`;
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: codigo,
      });

      if (authError) {
        return { success: false, error: t.invalidCode };
      }

      // 2. Agora autenticado — buscar dados do vendedor
      const { data: vendedorData, error: vendedorError } = await supabase
        .from('vendedores')
        .select('*')
        .eq('codigo_acesso', codigo)
        .single();

      if (vendedorError || !vendedorData) {
        await supabase.auth.signOut();
        return { success: false, error: t.invalidCode };
      }

      if (vendedorData.status && vendedorData.status.toLowerCase() === 'inativo') {
        await supabase.auth.signOut();
        return { success: false, error: t.inactive };
      }

      // 3. Buscar rota do vendedor
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select('id, nome')
        .eq('vendedor_id', vendedorData.id)
        .single();

      if (rotaError || !rotaData) {
        await supabase.auth.signOut();
        return { success: false, error: t.noRoute };
      }

      // 4. Montar objeto do vendedor autenticado
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

      // 5. Salvar no AsyncStorage e localStorage
      await AsyncStorage.setItem('vendedor_data', JSON.stringify(vendedorAuth));
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('vendedor_data', JSON.stringify(vendedorAuth));
      }
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
      recuperarSessao: async () => (vendedor ? garantirSessao(vendedor) : false),
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