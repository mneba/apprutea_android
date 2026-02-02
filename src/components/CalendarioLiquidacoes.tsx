import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';

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
  data: Date; diaNumero: number; mesAtual: boolean;
  ehHoje: boolean; ehFuturo: boolean; liquidacao: LiquidacaoDiaria | null;
}

const textos = {
  'pt-BR': {
    selecioneData: 'Selecione uma Data',
    semLiquidacao: 'Não há liquidação aberta para hoje. Selecione uma data no calendário abaixo para visualizar os dados.',
    legenda: 'Legenda:', aberto: 'Aberto', fechado: 'Fechado', aprovado: 'Aprovado', semRegistro: 'Sem registro',
    verRota: 'Ver', abrir: 'Abrir',
    meses: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    diasSemana: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
  },
  'es': {
    selecioneData: 'Seleccione una Fecha',
    semLiquidacao: 'No hay liquidación abierta para hoy. Seleccione una fecha en el calendario a continuación para ver los datos.',
    legenda: 'Leyenda:', aberto: 'Abierto', fechado: 'Cerrado', aprovado: 'Aprobado', semRegistro: 'Sin registro',
    verRota: 'Ver', abrir: 'Abrir',
    meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    diasSemana: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  },
};

export default function CalendarioLiquidacoes({
  liquidacoes, onSelecionarDia, onVerRotaFutura, onAbrirHoje,
  temLiquidacaoAberta, idioma = 'pt-BR', onVoltar,
}: CalendarioLiquidacoesProps) {
  const t = textos[idioma];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Sempre inicia no mês atual
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  // Bloqueia navegação para meses futuros
  const ehMesAtualOuFuturo = anoAtual > hoje.getFullYear() ||
    (anoAtual === hoje.getFullYear() && mesAtual >= hoje.getMonth());

  const diasDoMes = useMemo(() => {
    const dias: DiaCalendario[] = [];
    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const diaSemanaInicio = primeiroDia.getDay();
    const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();

    const ultimoDiaMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const dia = ultimoDiaMesAnterior - i;
      const data = new Date(anoAtual, mesAtual - 1, dia);
      dias.push({ data, diaNumero: dia, mesAtual: false, ehHoje: false, ehFuturo: data > hoje, liquidacao: null });
    }

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
    if (ehMesAtualOuFuturo) return;
    if (mesAtual === 11) { setMesAtual(0); setAnoAtual(anoAtual + 1); }
    else { setMesAtual(mesAtual + 1); }
  };

  const handleClickDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual || dia.ehFuturo) return;
    if (dia.ehHoje && !dia.liquidacao && !temLiquidacaoAberta) { onAbrirHoje(dia.data); }
    else if (dia.liquidacao) { onSelecionarDia(dia.liquidacao, dia.data); }
    else { onSelecionarDia(null, dia.data); }
  };

  const getCorDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual) return st.diaOutroMes;
    if (dia.ehFuturo) return st.diaFuturo;
    if (!dia.liquidacao) return st.diaSemRegistro;
    switch (dia.liquidacao.status) {
      case 'ABERTO': case 'REABERTO': return st.diaAberto;
      case 'FECHADO': return st.diaFechado;
      case 'APROVADO': return st.diaAprovado;
      default: return st.diaSemRegistro;
    }
  };

  const getIconeDia = (dia: DiaCalendario) => {
    if (!dia.mesAtual || dia.ehFuturo) return null;
    if (!dia.liquidacao) return <Text style={st.iconeX}>⊘</Text>;
    switch (dia.liquidacao.status) {
      case 'ABERTO': case 'REABERTO': return <Text style={st.iconeAberto}>○</Text>;
      case 'FECHADO': return <Text style={st.iconeFechado}>✓</Text>;
      case 'APROVADO': return <Text style={st.iconeAprovado}>✓</Text>;
      default: return <Text style={st.iconeX}>⊘</Text>;
    }
  };

  return (
    <View style={st.container}>
      <View style={st.infoCard}>
        <Text style={st.infoTitulo}>📅 {t.selecioneData}</Text>
        <Text style={st.infoTexto}>{t.semLiquidacao}</Text>
      </View>

      <View style={st.calendario}>
        <View style={st.mesHeader}>
          <TouchableOpacity onPress={irMesAnterior} style={st.mesNavBtn}>
            <Text style={st.mesNavText}>‹</Text>
          </TouchableOpacity>
          <Text style={st.mesTitulo}>{t.meses[mesAtual]} {anoAtual}</Text>
          <TouchableOpacity onPress={irProximoMes} style={[st.mesNavBtn, ehMesAtualOuFuturo && st.mesNavOff]} disabled={ehMesAtualOuFuturo}>
            <Text style={[st.mesNavText, ehMesAtualOuFuturo && st.mesNavTxOff]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={st.diasSemanaRow}>
          {t.diasSemana.map((dia, i) => (<View key={i} style={st.diaSemanaCell}><Text style={st.diaSemanaText}>{dia}</Text></View>))}
        </View>

        <View style={st.diasGrid}>
          {diasDoMes.map((dia, i) => (
            <TouchableOpacity key={i} style={[st.diaCell, dia.ehHoje && st.diaCellHoje]} onPress={() => handleClickDia(dia)} disabled={!dia.mesAtual || dia.ehFuturo}>
              <Text style={[st.diaNumero, !dia.mesAtual && st.diaNumeroOutroMes, dia.ehHoje && st.diaNumeroHoje, dia.ehFuturo && dia.mesAtual && st.diaNumeroFuturo]}>{dia.diaNumero}</Text>
              {dia.mesAtual && <View style={[st.diaIndicador, getCorDia(dia)]}>{getIconeDia(dia)}</View>}
              {dia.ehHoje && !dia.liquidacao && !temLiquidacaoAberta && dia.mesAtual && (
                <View style={st.btnAbrir}><Text style={st.btnAbrirTx}>{t.abrir}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={st.legenda}>
          <Text style={st.legendaTitulo}>{t.legenda}</Text>
          <View style={st.legendaItens}>
            <View style={st.legendaItem}><View style={[st.legendaCor, st.legAberto]} /><Text style={st.legendaTexto}>{t.aberto}</Text></View>
            <View style={st.legendaItem}><View style={[st.legendaCor, st.legFechado]} /><Text style={st.legendaTexto}>{t.fechado}</Text></View>
            <View style={st.legendaItem}><View style={[st.legendaCor, st.legAprovado]} /><Text style={st.legendaTexto}>{t.aprovado}</Text></View>
            <View style={st.legendaItem}><View style={[st.legendaCor, st.legSem]} /><Text style={st.legendaTexto}>{t.semRegistro}</Text></View>
          </View>
        </View>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');
const cellSize = (width - 64) / 7;

const st = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  infoTitulo: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  infoTexto: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  calendario: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16 },
  mesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  mesNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  mesNavText: { fontSize: 24, color: '#6B7280', fontWeight: '300' },
  mesNavOff: { opacity: 0.25 },
  mesNavTxOff: { color: '#D1D5DB' },
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
  diaNumeroFuturo: { color: '#D1D5DB' },
  diaIndicador: { width: 20, height: 20, borderRadius: 10, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  diaAberto: { backgroundColor: '#D1FAE5', borderWidth: 2, borderColor: '#10B981' },
  diaFechado: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#3B82F6' },
  diaAprovado: { backgroundColor: '#E9D5FF', borderWidth: 2, borderColor: '#8B5CF6' },
  diaSemRegistro: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  diaOutroMes: { backgroundColor: 'transparent' },
  diaFuturo: { backgroundColor: 'transparent' },
  iconeAberto: { fontSize: 10, color: '#10B981', fontWeight: 'bold' },
  iconeFechado: { fontSize: 10, color: '#3B82F6', fontWeight: 'bold' },
  iconeAprovado: { fontSize: 10, color: '#8B5CF6', fontWeight: 'bold' },
  iconeX: { fontSize: 10, color: '#9CA3AF' },
  btnAbrir: { position: 'absolute', bottom: 2, backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  btnAbrirTx: { fontSize: 8, color: '#fff', fontWeight: '600' },
  legenda: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  legendaTitulo: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  legendaItens: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 16, height: 16, borderRadius: 8 },
  legAberto: { backgroundColor: '#D1FAE5', borderWidth: 2, borderColor: '#10B981' },
  legFechado: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#3B82F6' },
  legAprovado: { backgroundColor: '#E9D5FF', borderWidth: 2, borderColor: '#8B5CF6' },
  legSem: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  legendaTexto: { fontSize: 12, color: '#6B7280' },
});
