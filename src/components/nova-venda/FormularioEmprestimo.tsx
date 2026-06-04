import React from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  amanha,
  calcularDataMensal,
  formatarData,
  type Lang,
  type Textos
} from '../../constants/novaVendaConstants';
import { styles } from '../../styles/novaVendaStyles';

interface Props {
  // Valores
  valorEmprestimo: string; setValorEmprestimo: (v: string) => void;
  numeroParcelas: string; setNumeroParcelas: (v: string) => void;
  taxaJuros: string; setTaxaJuros: (v: string) => void;
  taxaJurosPersonalizada: boolean; setTaxaJurosPersonalizada: (v: boolean) => void;
  frequencia: string; setFrequencia: (v: string) => void;
  diaSemanaPagamento: string; setDiaSemanaPagamento: (v: string) => void;
  diaMesPagamento: string; setDiaMesPagamento: (v: string) => void;
  diasMesFlexivel: number[];
  iniciarProximoMes: boolean; setIniciarProximoMes: (v: boolean) => void;
  dataPrimeiroVencimento: string; setDataPrimeiroVencimento: (v: string) => void;
  observacoesEmprestimo: string; setObservacoesEmprestimo: (v: string) => void;
  // Cálculos
  valorPrincipal: number; taxaNum: number; parcelasNum: number;
  valorTotal: number; valorParcela: number; totalJuros: number;
  // Config
  taxasPermitidas: number[];
  taxasLivre: boolean;
  // Flags
  isRenegociacao: boolean;
  isVendaAprovadaTravada: boolean;
  camposComErro: Set<string>;
  lang: Lang;
  // Handlers
  handleValorEmprestimoChange: (text: string) => void;
  limparErroCampo: (campo: string) => void;
  toggleDiaFlexivel: (dia: number) => void;
  getDiaSemanaLabel: () => string;
  onOpenDiaSemanaModal: () => void;
  onOpenDatePicker: () => void;
  // i18n
  t: Textos;
}

export default function FormularioEmprestimo(props: Props) {
  const {
    valorEmprestimo, numeroParcelas, setNumeroParcelas,
    taxaJuros, setTaxaJuros, taxaJurosPersonalizada, setTaxaJurosPersonalizada,
    frequencia, setFrequencia,
    diaSemanaPagamento, diaMesPagamento, setDiaMesPagamento,
    diasMesFlexivel, iniciarProximoMes, setIniciarProximoMes,
    dataPrimeiroVencimento, setDataPrimeiroVencimento,
    observacoesEmprestimo, setObservacoesEmprestimo,
    valorPrincipal, taxaNum, parcelasNum,
    valorTotal, valorParcela, totalJuros,
    taxasPermitidas,
    isRenegociacao, isVendaAprovadaTravada, camposComErro, lang,
    handleValorEmprestimoChange, limparErroCampo, toggleDiaFlexivel,
    getDiaSemanaLabel, onOpenDiaSemanaModal, onOpenDatePicker,
    t,
  } = props;

  return (
    <>
      {/* Valor + Parcelas na mesma linha */}
      <View style={styles.rowFields}>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={[styles.fieldLabel, camposComErro.has('valorEmprestimo') && styles.fieldLabelError]}>
            Valor <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              camposComErro.has('valorEmprestimo') && styles.inputError,
              (isRenegociacao || isVendaAprovadaTravada) && styles.inputDisabled,
            ]}
            value={valorEmprestimo}
            onChangeText={(text) => { handleValorEmprestimoChange(text); limparErroCampo('valorEmprestimo'); }}
            placeholder="500"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            editable={!isRenegociacao && !isVendaAprovadaTravada}
          />
          {isRenegociacao && (
            <Text style={styles.hintRenegociacao}>
              🔒 {lang === 'es' ? 'Saldo deudor (no editable)' : 'Saldo devedor (não editável)'}
            </Text>
          )}
        </View>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={[styles.fieldLabel, camposComErro.has('numeroParcelas') && styles.fieldLabelError]}>
            Parcelas <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, camposComErro.has('numeroParcelas') && styles.inputError, isVendaAprovadaTravada && styles.inputDisabled]}
            value={numeroParcelas}
            onChangeText={(text) => {
              const num = text.replace(/[^\d]/g, '');
              setNumeroParcelas(num);
              limparErroCampo('numeroParcelas');
            }}
            placeholder="20"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={3}
            editable={!isVendaAprovadaTravada}
          />
        </View>
      </View>

      {/* Taxa de juros */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('taxaJuros') && styles.fieldLabelError]}>
          Taxa de juros (%) <Text style={styles.required}>*</Text>
        </Text>

        {!taxaJurosPersonalizada ? (
          <View style={[styles.taxaButtonsRow, camposComErro.has('taxaJuros') && { borderWidth: 2, borderColor: '#EF4444', borderRadius: 8, padding: 4 }]}>
            {taxasPermitidas.map((taxa) => (
              <TouchableOpacity
                key={taxa}
                style={[styles.taxaButton, taxaJuros === String(taxa) && styles.taxaButtonActive]}
                onPress={() => { setTaxaJuros(String(taxa)); setTaxaJurosPersonalizada(false); limparErroCampo('taxaJuros'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.taxaButtonText, taxaJuros === String(taxa) && styles.taxaButtonTextActive]}>
                  {taxa}%
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.taxaButton, taxaJurosPersonalizada && styles.taxaButtonActive]}
              onPress={() => { setTaxaJurosPersonalizada(true); setTaxaJuros(''); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.taxaButtonText, taxaJurosPersonalizada && styles.taxaButtonTextActive]}>
                Outro
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rowFields}>
            <TextInput
              style={[styles.input, { flex: 1 }, isVendaAprovadaTravada && styles.inputDisabled]}
              value={taxaJuros}
              onChangeText={(text) => setTaxaJuros(text.replace(/[^\d.,]/g, ''))}
              placeholder={t.phJuros}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              autoFocus={!isVendaAprovadaTravada}
              editable={!isVendaAprovadaTravada}
            />
            {!isVendaAprovadaTravada && (
              <TouchableOpacity
                style={styles.taxaCancelBtn}
                onPress={() => { setTaxaJurosPersonalizada(false); setTaxaJuros(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.taxaCancelBtnText}>{t.voltar}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Frequência de pagamento */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('frequencia') && styles.fieldLabelError]}>
          Frequência de pagamento <Text style={styles.required}>*</Text>
        </Text>
        <View style={[styles.frequenciaGrid, camposComErro.has('frequencia') && { borderWidth: 2, borderColor: '#EF4444', borderRadius: 8, padding: 4 }]}>
          {[
            { value: 'DIARIO', label: 'Diário' },
            { value: 'SEMANAL', label: 'Semanal' },
            { value: 'QUINZENAL', label: 'Quinzenal' },
            { value: 'MENSAL', label: 'Mensal' },
            { value: 'FLEXIVEL', label: 'Flexível' },
          ].map((freq) => (
            <TouchableOpacity
              key={freq.value}
              style={[
                styles.radioOption,
                frequencia === freq.value && styles.radioOptionActive,
                isVendaAprovadaTravada && frequencia !== freq.value && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (isVendaAprovadaTravada) return;
                setFrequencia(freq.value);
                limparErroCampo('frequencia');
                if (freq.value === 'DIARIO') {
                  setDataPrimeiroVencimento(amanha());
                } else if (freq.value === 'MENSAL' && diaMesPagamento) {
                  setDataPrimeiroVencimento(calcularDataMensal(parseInt(diaMesPagamento)));
                }
              }}
              activeOpacity={isVendaAprovadaTravada ? 1 : 0.7}
            >
              <View style={[styles.radioCircle, frequencia === freq.value && styles.radioCircleActive]}>
                {frequencia === freq.value && <View style={styles.radioCircleDot} />}
              </View>
              <Text style={[styles.radioLabel, frequencia === freq.value && styles.radioLabelActive]}>
                {freq.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Dia da semana (SEMANAL) */}
      {frequencia === 'SEMANAL' && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, camposComErro.has('diaSemanaPagamento') && styles.fieldLabelError]}>
            Dia da semana <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.selectField, camposComErro.has('diaSemanaPagamento') && styles.inputError, isVendaAprovadaTravada && styles.inputDisabled]}
            onPress={() => { if (!isVendaAprovadaTravada) { onOpenDiaSemanaModal(); limparErroCampo('diaSemanaPagamento'); } }}
            activeOpacity={isVendaAprovadaTravada ? 1 : 0.7}
            disabled={isVendaAprovadaTravada}
          >
            <Text style={styles.selectFieldText}>{getDiaSemanaLabel()}</Text>
            <Text style={styles.selectFieldChevron}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dia do mês (MENSAL) */}
      {frequencia === 'MENSAL' && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, camposComErro.has('diaMesPagamento') && styles.fieldLabelError]}>
            Dia do mês <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, camposComErro.has('diaMesPagamento') && styles.inputError, isVendaAprovadaTravada && styles.inputDisabled]}
            value={diaMesPagamento}
            onChangeText={(text) => {
              const num = text.replace(/[^\d]/g, '');
              const val = Math.min(31, Math.max(0, parseInt(num) || 0));
              setDiaMesPagamento(num ? String(val) : '');
              if (val > 0) setDataPrimeiroVencimento(calcularDataMensal(val));
              limparErroCampo('diaMesPagamento');
            }}
            placeholder="1-31"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={2}
            editable={!isVendaAprovadaTravada}
          />
        </View>
      )}

      {/* Dias do mês (FLEXIVEL) */}
      {frequencia === 'FLEXIVEL' && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, camposComErro.has('diasMesFlexivel') && styles.fieldLabelError]}>
            Dias de cobrança <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.diasGrid, camposComErro.has('diasMesFlexivel') && { borderWidth: 2, borderColor: '#EF4444', borderRadius: 8, padding: 4 }]}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
              <TouchableOpacity
                key={dia}
                style={[styles.diaGridItem, diasMesFlexivel.includes(dia) && styles.diaGridItemActive]}
                onPress={() => toggleDiaFlexivel(dia)}
                activeOpacity={0.6}
              >
                <Text style={[styles.diaGridText, diasMesFlexivel.includes(dia) && styles.diaGridTextActive]}>
                  {dia}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {diasMesFlexivel.length > 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Selecionados: {diasMesFlexivel.join(', ')} — {diasMesFlexivel.length} cobrança(s) por mês
              </Text>
            </View>
          )}
          {diasMesFlexivel.length > 0 && (
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIniciarProximoMes(!iniciarProximoMes)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, iniciarProximoMes && styles.checkboxActive]}>
                {iniciarProximoMes && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>{t.iniciarProxMes}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Data 1º vencimento */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('dataPrimeiroVencimento') && styles.fieldLabelError]}>
          Data 1º vencimento <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[styles.selectField, camposComErro.has('dataPrimeiroVencimento') && styles.inputError, isVendaAprovadaTravada && styles.inputDisabled]}
          onPress={() => { if (!isVendaAprovadaTravada) { onOpenDatePicker(); limparErroCampo('dataPrimeiroVencimento'); } }}
          activeOpacity={isVendaAprovadaTravada ? 1 : 0.7}
          disabled={isVendaAprovadaTravada}
        >
          <Text style={styles.selectFieldText}>{formatarData(dataPrimeiroVencimento)}</Text>
          <Text style={styles.selectFieldChevron}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* Observações */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.observacoes}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={observacoesEmprestimo}
          onChangeText={setObservacoesEmprestimo}
          placeholder={t.phObsEmp}
          placeholderTextColor="#9CA3AF"
          multiline numberOfLines={2}
          textAlignVertical="top"
        />
      </View>
    </>
  );
}