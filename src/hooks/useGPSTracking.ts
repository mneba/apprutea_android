import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Coords {
  lat: number;
  lng: number;
  acc: number;
}

export default function useGPSTracking() {
  const [gpsStatus, setGpsStatus] = useState<'ok' | 'erro' | 'carregando'>('carregando');
  const [coords, setCoords] = useState<Coords | null>(null);
  const gpsInicializado = useRef(false);

  const carregarGPS = useCallback(async () => {
    setGpsStatus('carregando');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsStatus('erro'); return; }

      // Tenta com precisão alta primeiro (timeout 5s)
      try {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
        setGpsStatus('ok');
        return;
      } catch {
        console.log('⚠️ GPS High falhou, tentando Balanced...');
      }

      // Fallback: precisão balanceada (mais rápido)
      try {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
        setGpsStatus('ok');
        return;
      } catch {
        console.log('⚠️ GPS Balanced falhou, tentando última posição conhecida...');
      }

      // Último recurso: última posição conhecida
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setCoords({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude, acc: lastKnown.coords.accuracy || 999 });
        setGpsStatus('ok');
      } else {
        setGpsStatus('erro');
      }
    } catch { setGpsStatus('erro'); }
  }, []);

  // Iniciar GPS ao montar + watch contínuo
  useEffect(() => {
    if (!gpsInicializado.current) {
      gpsInicializado.current = true;
      carregarGPS();
    }
    let watchSub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        watchSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 },
          (loc) => {
            setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy || 0 });
            setGpsStatus('ok');
          }
        );
      } catch (e) { console.log('⚠️ watchPosition falhou:', e); }
    })();
    return () => { watchSub?.remove(); };
  }, [carregarGPS]);

  return { gpsStatus, coords, carregarGPS };
}