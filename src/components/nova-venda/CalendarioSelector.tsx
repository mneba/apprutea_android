import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DIAS_SEMANA_CURTO, MESES_NOME, type Lang } from '../../constants/novaVendaConstants';

// ============================================================
// COMPONENTE CALENDÁRIO
// ============================================================

interface CalendarioSelectorProps {
  dataSelecionada: string;
  onSelect: (dateStr: string) => void;
  trabalhaDomingo?: boolean;
  feriadosSet?: Set<string>;
  lang?: Lang;
  minDate?: string; // YYYY-MM-DD — datas antes disso ficam desabilitadas
}

export default function CalendarioSelector({
  dataSelecionada,
  onSelect,
  trabalhaDomingo = true,
  feriadosSet,
  lang = 'pt-BR',
  minDate,
}: CalendarioSelectorProps) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Data mínima selecionável (se fornecida)
  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : hoje;

  const [mesVis, setMesVis] = useState(
    dataSelecionada
      ? new Date(dataSelecionada + 'T00:00:00').getMonth()
      : hoje.getMonth()
  );
  const [anoVis, setAnoVis] = useState(
    dataSelecionada
      ? new Date(dataSelecionada + 'T00:00:00').getFullYear()
      : hoje.getFullYear()
  );

  // ⭐ Helpers para dias não-úteis
  const ehFeriado = (dateStr: string): boolean => {
    return feriadosSet ? feriadosSet.has(dateStr) : false;
  };

  const ehDiaNaoUtil = (dateStr: string, dayOfWeek: number): boolean => {
    if (!trabalhaDomingo && dayOfWeek === 0) return true;
    if (ehFeriado(dateStr)) return true;
    return false;
  };

  // Gerar dias do mês
  const gerarDias = () => {
    const primeiroDia = new Date(anoVis, mesVis, 1);
    const ultimoDia = new Date(anoVis, mesVis + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const inicioSemana = primeiroDia.getDay();

    const dias: Array<{
      dia: number;
      dateStr: string;
      ehHoje: boolean;
      ehPassado: boolean;
      ehFeriadoFlag: boolean;
      ehNaoUtil: boolean;
    } | null> = [];

    for (let i = 0; i < inicioSemana; i++) {
      dias.push(null);
    }

    for (let d = 1; d <= diasNoMes; d++) {
      const date = new Date(anoVis, mesVis, d);
      const dateStr = `${anoVis}-${String(mesVis + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = date.getDay();
      dias.push({
        dia: d,
        dateStr,
        ehHoje: date.getTime() === hoje.getTime(),
        ehPassado: date < minDateObj,
        ehFeriadoFlag: ehFeriado(dateStr),
        ehNaoUtil: ehDiaNaoUtil(dateStr, dow),
      });
    }

    return dias;
  };

  const navMes = (dir: number) => {
    let novoMes = mesVis + dir;
    let novoAno = anoVis;
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    setMesVis(novoMes);
    setAnoVis(novoAno);
  };

  const dias = gerarDias();

  return (
    <View style={styles.container}>
      {/* Navegação mês/ano */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={() => navMes(-1)} style={styles.navBtn} activeOpacity={0.6}>
          <Text style={styles.navBtnText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{MESES_NOME[mesVis]} {anoVis}</Text>
        <TouchableOpacity onPress={() => navMes(1)} style={styles.navBtn} activeOpacity={0.6}>
          <Text style={styles.navBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Header dias da semana */}
      <View style={styles.weekRow}>
        {DIAS_SEMANA_CURTO.map((dia, i) => (
          <View key={i} style={styles.weekCell}>
            <Text style={[
              styles.weekText,
              i === 0 && { color: trabalhaDomingo ? '#EF4444' : '#9CA3AF' }
            ]}>{dia}</Text>
          </View>
        ))}
      </View>

      {/* Grid de dias */}
      <View style={styles.daysGrid}>
        {dias.map((item, index) => {
          if (!item) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const selecionado = item.dateStr === dataSelecionada;
          const desabilitado = item.ehPassado || item.ehNaoUtil;

          return (
            <TouchableOpacity
              key={item.dateStr}
              style={[
                styles.dayCell,
                item.ehHoje && styles.dayCellHoje,
                selecionado && styles.dayCellSelecionado,
                desabilitado && styles.dayCellDesabilitado,
              ]}
              onPress={() => {
                if (desabilitado) return;
                onSelect(item.dateStr);
              }}
              activeOpacity={desabilitado ? 1 : 0.6}
              disabled={desabilitado}
            >
              <Text style={[
                styles.dayText,
                item.ehPassado && !item.ehHoje && styles.dayTextPassado,
                item.ehHoje && styles.dayTextHoje,
                selecionado && styles.dayTextSelecionado,
                item.ehNaoUtil && !item.ehPassado && styles.dayTextNaoUtil,
              ]}>
                {item.dia}
              </Text>
              {item.ehFeriadoFlag && !item.ehPassado && (
                <Text style={styles.feriadoDot}>•</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legenda */}
      {(!trabalhaDomingo || (feriadosSet && feriadosSet.size > 0)) && (
        <View style={styles.legendaRow}>
          {!trabalhaDomingo && (
            <Text style={styles.legendaText}>
              {lang === 'es' ? 'Domingo no laborable' : 'Domingo não é dia útil'}
            </Text>
          )}
          {feriadosSet && feriadosSet.size > 0 && (
            <Text style={styles.legendaText}>
              • {lang === 'es' ? 'Feriado' : 'Feriado'}
            </Text>
          )}
        </View>
      )}

      {/* Botão Hoje */}
      {(() => {
        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        const hojeNaoUtil = ehDiaNaoUtil(hojeStr, hoje.getDay());
        const hojeAntesDeMim = hoje < minDateObj;
        if (hojeNaoUtil || hojeAntesDeMim) return null;
        return (
          <TouchableOpacity
            style={styles.hojeBtn}
            onPress={() => {
              setMesVis(hoje.getMonth());
              setAnoVis(hoje.getFullYear());
              onSelect(hojeStr);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.hojeBtnText}>📅 {lang === 'es' ? 'Hoy' : 'Hoje'} ({hoje.toLocaleDateString(lang === 'es' ? 'es-CO' : 'pt-BR')})</Text>
          </TouchableOpacity>
        );
      })()}
    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 16,
    color: '#374151',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  dayCellHoje: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  dayCellSelecionado: {
    backgroundColor: '#2563EB',
  },
  dayText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  dayTextPassado: {
    color: '#C0C5CE',
  },
  dayTextHoje: {
    color: '#2563EB',
    fontWeight: '700',
  },
  dayTextSelecionado: {
    color: '#fff',
    fontWeight: '700',
  },
  dayCellDesabilitado: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  dayTextNaoUtil: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  feriadoDot: {
    fontSize: 16,
    color: '#F59E0B',
    position: 'absolute',
    bottom: -2,
    fontWeight: '700',
  },
  legendaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    justifyContent: 'center',
  },
  legendaText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  hojeBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  hojeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
});