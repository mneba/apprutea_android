import React, { useCallback, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface AlphabetSidebarProps {
  data: { nome: string }[];
  flatRef: React.RefObject<FlatList>;
  activeLetter: string | null;
  setActive: (l: string | null) => void;
}

export default function AlphabetSidebar({ data, flatRef, activeLetter, setActive }: AlphabetSidebarProps) {
  const sidebarRef = useRef<View>(null);
  const sidebarYRef = useRef(0);
  const letterHeightRef = useRef(0);
  const alphabetTimeoutRef = useRef<any>(null);
  const lastLetterRef = useRef<string | null>(null);

  const normalizeChar = (char: string) => {
    return char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  };

  const getAvailableLetters = useCallback((items: { nome: string }[]) => {
    const letters = new Set<string>();
    items.forEach(item => {
      const first = item.nome.trim().charAt(0).toUpperCase();
      if (first && /[A-ZÀ-Ü]/.test(first)) {
        letters.add(normalizeChar(first));
      }
    });
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => letters.has(l));
  }, []);

  const scrollToLetter = useCallback((letter: string) => {
    // Evitar scroll repetido para mesma letra
    if (lastLetterRef.current === letter) return;
    lastLetterRef.current = letter;

    const normalLetter = normalizeChar(letter);
    
    // Encontrar o índice do primeiro item que começa com essa letra ou posterior
    const targetIndex = data.findIndex(item => {
      const first = normalizeChar(item.nome.trim().charAt(0));
      return first >= normalLetter;
    });
    
    if (targetIndex >= 0 && flatRef.current) {
      try {
        flatRef.current.scrollToIndex({ 
          index: targetIndex, 
          animated: false,
          viewPosition: 0
        });
      } catch (e) {
        // Fallback se scrollToIndex falhar
        console.warn('scrollToIndex falhou, usando fallback');
      }
    }
    
    setActive(letter);
    if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
    alphabetTimeoutRef.current = setTimeout(() => {
      setActive(null);
      lastLetterRef.current = null;
    }, 1200);
  }, [data, flatRef, setActive]);

  const handleTouch = useCallback((pageY: number) => {
    const letters = getAvailableLetters(data);
    if (letters.length === 0 || letterHeightRef.current === 0) return;
    
    const idx = Math.floor((pageY - sidebarYRef.current) / letterHeightRef.current);
    const clampedIdx = Math.max(0, Math.min(idx, letters.length - 1));
    scrollToLetter(letters[clampedIdx]);
  }, [data, getAvailableLetters, scrollToLetter]);

  const letters = getAvailableLetters(data);

  if (letters.length === 0) return null;

  return (
    <View
      ref={sidebarRef}
      style={S.alphaBar}
      onLayout={() => {
        sidebarRef.current?.measureInWindow((_x, y, _w, h) => {
          sidebarYRef.current = y;
          letterHeightRef.current = letters.length > 0 ? h / letters.length : 0;
        });
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => handleTouch(e.nativeEvent.pageY)}
      onResponderMove={(e) => handleTouch(e.nativeEvent.pageY)}
      onResponderRelease={() => {
        if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
        alphabetTimeoutRef.current = setTimeout(() => {
          setActive(null);
          lastLetterRef.current = null;
        }, 800);
      }}
    >
      {letters.map(l => (
        <Text key={l} style={[S.alphaLetter, activeLetter === l && S.alphaLetterActive]}>{l}</Text>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  alphaBar: { 
    position: 'absolute', 
    right: 2, 
    top: 15, 
    bottom: 100, 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: 22, 
    zIndex: 100, 
    backgroundColor: 'rgba(255,255,255,0.85)', 
    borderRadius: 11, 
    paddingVertical: 4 
  },
  alphaLetter: { 
    fontSize: 10, 
    color: '#9CA3AF', 
    fontWeight: '600', 
    paddingVertical: 1.5, 
    paddingHorizontal: 4, 
    textAlign: 'center' 
  },
  alphaLetterActive: { 
    color: '#3B82F6', 
    fontWeight: '800', 
    fontSize: 12, 
    backgroundColor: '#EFF6FF', 
    borderRadius: 8, 
    overflow: 'hidden' 
  },
});