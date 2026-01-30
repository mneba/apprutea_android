import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Language } from '../types';

const loginTexts = {
  'pt-BR': {
    title: 'AppRutea',
    subtitle: 'Sistema de Gestão de Rotas',
    cardTitle: 'Acesso do Vendedor',
    codeLabel: 'Código do Vendedor',
    codePlaceholder: 'Digite seu código (ex: 73829)',
    codeHint: 'Digite apenas os números do seu código',
    loginButton: 'Entrar',
    loggingIn: 'Entrando...',
    errorEmptyCode: 'Por favor, digite seu código de vendedor',
    errorOnlyNumbers: 'O código deve conter apenas números',
    successTitle: 'Login realizado!',
    successWelcome: 'Bem-vindo,',
    errorTitle: 'Erro no Login',
  },
  'es': {
    title: 'AppRutea',
    subtitle: 'Sistema de Gestión de Rutas',
    cardTitle: 'Acceso del Vendedor',
    codeLabel: 'Código del Vendedor',
    codePlaceholder: 'Ingrese su código (ej: 73829)',
    codeHint: 'Ingrese solo los números de su código',
    loginButton: 'Ingresar',
    loggingIn: 'Ingresando...',
    errorEmptyCode: 'Por favor, ingrese su código de vendedor',
    errorOnlyNumbers: 'El código debe contener solo números',
    successTitle: '¡Ingreso exitoso!',
    successWelcome: 'Bienvenido,',
    errorTitle: 'Error de Ingreso',
  }
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('pt-BR');

  const t = loginTexts[language];

  const toggleLanguage = () => {
    setLanguage(language === 'pt-BR' ? 'es' : 'pt-BR');
  };

  const handleLogin = async () => {
    // Validações
    if (!codigo.trim()) {
      Alert.alert(t.errorTitle, t.errorEmptyCode);
      return;
    }

    if (!/^\d+$/.test(codigo)) {
      Alert.alert(t.errorTitle, t.errorOnlyNumbers);
      return;
    }

    setLoading(true);

    const result = await signIn(codigo);

    setLoading(false);

    if (!result.success) {
      Alert.alert(t.errorTitle, result.error);
    }
    // Se sucesso, o AuthContext vai atualizar e a navegação muda automaticamente
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Botão de idioma */}
      <TouchableOpacity style={styles.languageButton} onPress={toggleLanguage}>
        <Text style={styles.languageButtonText}>
          {language === 'pt-BR' ? '🇧🇷 PT' : '🇪🇸 ES'}
        </Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📱</Text>
        </View>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
      </View>

      {/* Card de Login */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.cardTitle}</Text>

        <Text style={styles.label}>{t.codeLabel}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.codePlaceholder}
          placeholderTextColor="#999"
          value={codigo}
          onChangeText={setCodigo}
          keyboardType="numeric"
          maxLength={10}
          editable={!loading}
        />
        <Text style={styles.hint}>{t.codeHint}</Text>

        <TouchableOpacity
          style={[styles.button, (!codigo || loading) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!codigo || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t.loginButton}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    padding: 20,
  },
  languageButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
