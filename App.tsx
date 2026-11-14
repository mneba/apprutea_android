import {
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_400Regular_Italic,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_700Bold_Italic,
  Roboto_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/roboto';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

/**
 * A LETRA DO APP É NOSSA — ver `src/components/texto.tsx` para o porquê.
 *
 * Aqui só se carregam os arquivos. Os seis pesos cobrem exatamente os seis
 * que o app usa, e os dois itálicos os 10 lugares que pedem itálico. Peso
 * pedido sem arquivo registrado faz o Android cair na fonte do sistema EM
 * SILÊNCIO, que é o defeito que isto existe para fechar — então acrescentar
 * um peso novo no estilo pede acrescentar o arquivo aqui.
 */
const FONTES = {
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_800ExtraBold,
  Roboto_400Regular_Italic,
  Roboto_700Bold_Italic,
};

/**
 * O splash fica de pé até a fonte estar carregada, senão o app abre na letra
 * do sistema e troca para o Roboto um quadro depois — piscada visível em
 * todo início frio.
 *
 * ⚠ Os dois `catch` e o prazo abaixo NÃO são zelo excessivo: app preso no
 * splash é tela morta sem mensagem, e o vendedor está na porta do cliente.
 * Qualquer falha daqui tem de degradar para "abre na letra do sistema", que
 * é o comportamento de antes de 13/11/2026 — nunca para "não abre".
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Teto de espera pela fonte. Passado ele, abre de qualquer jeito. */
const PRAZO_FONTE_MS = 3000;

export default function App() {
  const [carregou, erro] = useFonts(FONTES);
  const [expirou, setExpirou] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setExpirou(true), PRAZO_FONTE_MS);
    return () => clearTimeout(t);
  }, []);

  const pronto = carregou || !!erro || expirou;

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync().catch(() => {});
  }, [pronto]);

  if (!pronto) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
