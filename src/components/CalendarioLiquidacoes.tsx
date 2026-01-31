import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

// ==================== TIPOS ====================
interface LiquidacaoDiaria {
  id: string;
  data_abertura: string;
  status: 'ABERTO' | 'FECHADO' | 'APROVADO' | 'REABERTO';
}

interface CalendarioLiquidacoesProps {
  liquidacoes: LiquidacaoDiaria[];
  onSelecionarDia: (liquidacao: LiquidacaoDiaria | null, data: Date) => void;
  onVerRotaFutura: (data: Date) => void;
  onAbrirHoje: (data: Date) => void;
  temLiquidacaoAberta: boolean;
  idioma?: 'pt-BR' | 'es';
  onVoltar: () => void;
}

interface DiaCalendario {
  data: Date;
  diaNumero: number;
  mesAtual: boolean;
  ehHoje: boolean;
  ehFuturo: boolean;
  liquidacao: LiquidacaoDiaria | null;
}

// ==================== TEXTOS ====================
const textos = {
  'pt-BR': {
    selecioneData: 'Selecione uma Data',
    semLiquidacao: 'Não há liquidação aberta para hoje. Selecione uma data no calendário abaixo para visualizar os dados.',
    legenda: 'Legenda:',
    aberto: 'Aberto',
    fechado: 'Fechado',
    aprovado: 'Aprovado',
    semRegistro: 'Sem registro',
    verRota: 'Ver',
    abrir: 'Abrir',
    meses: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    diasSemana: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
  },
  'es': {
    selecioneData: 'Seleccione una Fecha',
    semLiquidacao: 'No hay liquidación abierta para hoy. Seleccione una fecha en el calendario a continuación para ver los datos.',
    legenda: 'Leyenda:',
    aberto: 'Abierto',
    fechado: 'Cerrado',
    aprovado: 'Aprobado',
    semRegistro: 'Sin registro',
    verRota: 'Ver',
    abrir: 'Abrir',
    meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    diasSemana: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  },
};

// ==================== COMPONENTE ====================
export default function CalendarioLiquidacoes({
  liquidacoes,
  onSelecionarDia,
  onVerRotaFutura,
  onAbrirHoje,
  temLiquidacaoAberta,
  idioma = 'pt-BR',
  onVoltar,
}: CalendarioLiquidacoesProps) {
  const t = textos[idioma];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  // ==================== GERAR DIAS DO MÊS ====================
  const diasDoMes = useMemo(() => {
    const dias: DiaCalendario[] = [];
    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const diaSemanaInicio = primeiroDia.getDay();
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
    const totalDias = ultimoDia.getDate();

    // Dias do mês anterior
    const ultimoDiaMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const dia = ultimoDiaMesAnterior - i;
      const data = new Date(anoAtual, mesAtual - 1, dia);
      dias.push({ data, diaNumero: dia, mesAtual: false, ehHoje: false, ehFuturo: data > hoje, liquidacao: null });
    }

    // Dias do mês atual
    for (let dia = 1; dia <= totalDias; dia++) {
      const data = new Date(anoAtual, mesAtual, dia);
      data.setHours(0, 0, 0, 0);
      const ehHoje = data.getTime() === hoje.getTime();
      const ehFuturo = data > hoje;
      const liquidacao = liquidacoes.find(liq => {
        const dataLiq = new Date(liq.data_abertura);
        dataLiq.setHours(0, 0, 0, 0);
        return dataLiq.getTime() === data.getTime();
      }) || null;
      dias.push({ data, diaNumero: dia, mesAtual: true, ehHoje, ehFuturo, liquidacao });
    }

    // Dias do próximo mês
    const diasRestantes = 42 - dias.length;
    for (let dia = 1; dia <= diasRestantes; dia++) {
      const data = new Date(anoAtual, mesAtual + 1, dia);
      dias.push({ data, diaNumero: dia, mesAtual: false, ehHoje: false, ehFuturo: data > hoje, liquidacao: null });
    }

    return dias;
  }, [mesAtual, anoAtual, liquidacoes, hoje]);

  const irMesAnterior = () => {
    if (mesAtual === 0) { setMesAtual(11); setAnoAtual(anoAtual - 1); }
    else { setMesAtual(mesAtual - 1); }
  };

  const irProximoMes = () => {
    if (mesAtual === 11) { setMesAtual(0); setAnoAtual(anoAtual + 1); }
    else { setMesAtual(mesAtual + 1); }
  };

  const handleClickDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual) return;
    if (dia.ehFuturo) { onVerRotaFutura(dia.data); }
    else if (dia.ehHoje && !dia.liquidacao && !temLiquidacaoAberta) { onAbrirHoje(dia.data); }
    else if (dia.liquidacao) { onSelecionarDia(dia.liquidacao, dia.data); }
    else { onSelecionarDia(null, dia.data); }
  };

  const getCorDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual) return styles.diaOutroMes;
    if (!dia.liquidacao) return styles.diaSemRegistro;
    switch (dia.liquidacao.status) {
      case 'ABERTO': case 'REABERTO': return styles.diaAberto;
      case 'FECHADO': return styles.diaFechado;
      case 'APROVADO': return styles.diaAprovado;
      default: return styles.diaSemRegistro;
    }
  };

  const getIconeDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual) return null;
    if (!dia.liquidacao) return <Text style={styles.iconeX}>⊘</Text>;
    switch (dia.liquidacao.status) {
      case 'ABERTO': case 'REABERTO': return <Text style={styles.iconeAberto}>○</Text>;
      case 'FECHADO': return <Text style={styles.iconeFechado}>✓</Text>;
      case 'APROVADO': return <Text style={styles.iconeAprovado}>✓</Text>;
      default: return <Text style={styles.iconeX}>⊘</Text>;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitulo}>📅 {t.selecioneData}</Text>
        <Text style={styles.infoTexto}>{t.semLiquidacao}</Text>
      </View>

      <View style={styles.calendario}>
        <View style={styles.mesHeader}>
          <TouchableOpacity onPress={irMesAnterior} style={styles.mesNavBtn}>
            <Text style={styles.mesNavText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.mesTitulo}>{t.meses[mesAtual]} {anoAtual}</Text>
          <TouchableOpacity onPress={irProximoMes} style={styles.mesNavBtn}>
            <Text style={styles.mesNavText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.diasSemanaRow}>
          {t.diasSemana.map((dia, index) => (
            <View key={index} style={styles.diaSemanaCell}>
              <Text style={styles.diaSemanaText}>{dia}</Text>
            </View>
          ))}
        </View>

        <View style={styles.diasGrid}>
          {diasDoMes.map((dia, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.diaCell, dia.ehHoje && styles.diaCellHoje]}
              onPress={() => handleClickDia(dia)}
              disabled={!dia.mesAtual}
            >
              <Text style={[
                styles.diaNumero,
                !dia.mesAtual && styles.diaNumeroOutroMes,
                dia.ehHoje && styles.diaNumeroHoje,
              ]}>{dia.diaNumero}</Text>
              
              {dia.mesAtual && (
                <View style={[styles.diaIndicador, getCorDia(dia)]}>
                  {getIconeDia(dia)}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.legenda}>
          <Text style={styles.legendaTitulo}>{t.legenda}</Text>
          <View style={styles.legendaItens}>
            <View style={styles.legendaItem}>
              <View style={[styles.legendaCor, styles.legendaAberto]} />
              <Text style={styles.legendaTexto}>{t.aberto}</Text>
            </View>
            <View style={styles.legendaItem}>
              <View style={[styles.legendaCor, styles.legendaFechado]} />
              <Text style={styles.legendaTexto}>{t.fechado}</Text>
            </View>
            <View style={styles.legendaItem}>
              <View style={[styles.legendaCor, styles.legendaAprovado]} />
              <Text style={styles.legendaTexto}>{t.aprovado}</Text>
            </View>
            <View style={styles.legendaItem}>
              <View style={[styles.legendaCor, styles.legendaSemRegistro]} />
              <Text style={styles.legendaTexto}>{t.semRegistro}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');
const cellSize = (width - 64) / 7;

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  infoTitulo: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  infoTexto: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  calendario: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16 },
  mesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  mesNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  mesNavText: { fontSize: 24, color: '#6B7280', fontWeight: '300' },
  mesTitulo: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  diasSemanaRow: { flexDirection: 'row', marginBottom: 8 },
  diaSemanaCell: { width: cellSize, alignItems: 'center', paddingVertical: 8 },
  diaSemanaText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  diasGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  diaCell: { width: cellSize, height: cellSize + 10, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  diaCellHoje: { backgroundColor: '#EFF6FF', borderRadius: 8 },
  diaNumero: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  diaNumeroOutroMes: { color: '#D1D5DB' },
  diaNumeroHoje: { color: '#3B82F6', fontWeight: '700' },
  diaIndicador: { width: 20, height: 20, borderRadius: 10, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  diaAberto: { backgroundColor: '#D1FAE5', borderWidth: 2, borderColor: '#10B981' },
  diaFechado: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#3B82F6' },
  diaAprovado: { backgroundColor: '#E9D5FF', borderWidth: 2, borderColor: '#8B5CF6' },
  diaSemRegistro: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  diaOutroMes: { backgroundColor: 'transparent' },
  iconeAberto: { fontSize: 10, color: '#10B981', fontWeight: 'bold' },
  iconeFechado: { fontSize: 10, color: '#3B82F6', fontWeight: 'bold' },
  iconeAprovado: { fontSize: 10, color: '#8B5CF6', fontWeight: 'bold' },
  iconeX: { fontSize: 10, color: '#9CA3AF' },
  legenda: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  legendaTitulo: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  legendaItens: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 16, height: 16, borderRadius: 8 },
  legendaAberto: { backgroundColor: '#D1FAE5', borderWidth: 2, borderColor: '#10B981' },
  legendaFechado: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#3B82F6' },
  legendaAprovado: { backgroundColor: '#E9D5FF', borderWidth: 2, borderColor: '#8B5CF6' },
  legendaSemRegistro: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  legendaTexto: { fontSize: 12, color: '#6B7280' },
});
