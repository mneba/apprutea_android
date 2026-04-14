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

  const getAvailableLetters = useCallback((items: { nome: string }[]) => {
    const letters = new Set<string>();
    items.forEach(item => {
      const first = item.nome.trim().charAt(0).toUpperCase();
      if (first && /[A-ZÀ-Ü]/.test(first)) letters.add(first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0));
    });
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => letters.has(l));
  }, []);

  const scrollToLetter = useCallback((letter: string) => {
    const normalLetter = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
    const targetIndex = data.findIndex(item => {
      const first = item.nome.trim().charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
      return first >= normalLetter;
    });
    if (targetIndex >= 0 && flatRef.current) {
      flatRef.current.scrollToOffset({ offset: targetIndex * 92, animated: false });
    }
    setActive(letter);
    if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
    alphabetTimeoutRef.current = setTimeout(() => setActive(null), 1200);
  }, [data, flatRef, setActive]);

  const letters = getAvailableLetters(data);

  return (
    <View
      ref={sidebarRef}
      style={S.alphaBar}
      onLayout={() => {
        sidebarRef.current?.measureInWindow((_x, y, _w, h) => {
          sidebarYRef.current = y;
          letterHeightRef.current = h / letters.length;
        });
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        const idx = Math.floor((e.nativeEvent.pageY - sidebarYRef.current) / letterHeightRef.current);
        if (idx >= 0 && idx < letters.length) scrollToLetter(letters[idx]);
      }}
      onResponderMove={(e) => {
        const idx = Math.floor((e.nativeEvent.pageY - sidebarYRef.current) / letterHeightRef.current);
        if (idx >= 0 && idx < letters.length) scrollToLetter(letters[idx]);
      }}
      onResponderRelease={() => {
        if (alphabetTimeoutRef.current) clearTimeout(alphabetTimeoutRef.current);
        alphabetTimeoutRef.current = setTimeout(() => setActive(null), 800);
      }}
    >
      {letters.map(l => (
        <Text key={l} style={[S.alphaLetter, activeLetter === l && S.alphaLetterActive]}>{l}</Text>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  alphaBar: { position: 'absolute', right: 2, top: 15, bottom: 100, justifyContent: 'center', alignItems: 'center', width: 22, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 11, paddingVertical: 4 },
  alphaLetter: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', paddingVertical: 1.5, paddingHorizontal: 4, textAlign: 'center' },
  alphaLetterActive: { color: '#3B82F6', fontWeight: '800', fontSize: 12, backgroundColor: '#EFF6FF', borderRadius: 8, overflow: 'hidden' },
});