import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';

interface Props {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export default function BottomNavigation({ currentRoute, onNavigate }: Props) {
  const isActive = (route: string) => currentRoute === route;

  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => onNavigate('Liquidacao')}
      >
        <Text style={[styles.icon, isActive('Liquidacao') && styles.iconActive]}>🏠</Text>
        <Text style={[styles.label, isActive('Liquidacao') && styles.labelActive]}>Home</Text>
      </TouchableOpacity>

      {/* Botão Central (Novo) */}
      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => onNavigate('NovoEmprestimo')}
      >
        <View style={styles.centerButtonInner}>
          <Text style={styles.centerIcon}>+</Text>
        </View>
      </TouchableOpacity>

      {/* Clientes */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => onNavigate('Clientes')}
      >
        <Text style={[styles.icon, isActive('Clientes') && styles.iconActive]}>👥</Text>
        <Text style={[styles.label, isActive('Clientes') && styles.labelActive]}>Clientes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  labelActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  centerButton: {
    marginTop: -30,
  },
  centerButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  centerIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
});
