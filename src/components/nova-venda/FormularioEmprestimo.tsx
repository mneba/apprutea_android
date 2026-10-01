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
  diaSemanaDe,
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
  /**
   * Termos definidos pelo administrador: trava o VALOR e a TAXA, que são o
   * que foi autorizado. Parcelas, frequência e datas seguem por conta do
   * vendedor — antes tudo ficava travado e ele não conseguia ajustar o
   * parcelamento ao combinado com o cliente.
   */
  isVendaAprovadaTravada: boolean;
  camposComErro: Set<string>;
  /**
   * `data_liquidacao` da liquidação em que a venda está sendo lançada — a data
   * operacional. Toda data de vencimento calculada aqui sai dela, nunca do
   * relógio: o vendedor que recupera 25/08 precisa de vencimentos contados de
   * 25/08. Ver CLAUDE.md, "A liquidação é a régua do tempo".
   *
   * A tela já passava esta prop; o `Props` é que não a declarava, então o React
   * a descartava em silêncio e o `tsc` acusava desde então.
   */
  dataOperacional?: string;
  lang: Lang;
  // Handlers
  handleValorEmprestimoChange: (text: string) => void;
  limparErroCampo: (campo: string) => void;
  getDiaSemanaLabel: () => string;
  onOpenDiaSemanaModal: () => void;
  onOpenDatePicker: () => void;
  onOpenCarrosselFlexivel: () => void;
  // i18n
  t: Textos;
}

export default function FormularioEmprestimo(props: Props) {
  const {
    valorEmprestimo, numeroParcelas, setNumeroParcelas,
    taxaJuros, setTaxaJuros, taxaJurosPersonalizada, setTaxaJurosPersonalizada,
    frequencia, setFrequencia,
    diaSemanaPagamento, setDiaSemanaPagamento, diaMesPagamento, setDiaMesPagamento,
    diasMesFlexivel,
    dataPrimeiroVencimento, setDataPrimeiroVencimento,
    observacoesEmprestimo, setObservacoesEmprestimo,
    valorPrincipal, taxaNum, parcelasNum,
    valorTotal, valorParcela, totalJuros,
    taxasPermitidas,
    isRenegociacao, isVendaAprovadaTravada, camposComErro, dataOperacional, lang,
    handleValorEmprestimoChange, limparErroCampo,
    getDiaSemanaLabel, onOpenDiaSemanaModal, onOpenDatePicker, onOpenCarrosselFlexivel,
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
          {!isRenegociacao && isVendaAprovadaTravada && (
            <Text style={styles.hintRenegociacao}>
              🔒 {lang === 'es' ? 'Valor autorizado por el administrador' : 'Valor autorizado pelo administrador'}
            </Text>
          )}
        </View>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={[styles.fieldLabel, camposComErro.has('numeroParcelas') && styles.fieldLabelError]}>
            Parcelas <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, camposComErro.has('numeroParcelas') && styles.inputError]}
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
                style={[
                  styles.taxaButton,
                  taxaJuros === String(taxa) && styles.taxaButtonActive,
                  isVendaAprovadaTravada && taxaJuros !== String(taxa) && { opacity: 0.4 },
                ]}
                onPress={() => {
                  if (isVendaAprovadaTravada) return;
                  setTaxaJuros(String(taxa)); setTaxaJurosPersonalizada(false); limparErroCampo('taxaJuros');
                }}
                activeOpacity={isVendaAprovadaTravada ? 1 : 0.7}
              >
                <Text style={[styles.taxaButtonText, taxaJuros === String(taxa) && styles.taxaButtonTextActive]}>
                  {taxa}%
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.taxaButton,
                taxaJurosPersonalizada && styles.taxaButtonActive,
                isVendaAprovadaTravada && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (isVendaAprovadaTravada) return;
                setTaxaJurosPersonalizada(true); setTaxaJuros('');
              }}
              activeOpacity={isVendaAprovadaTravada ? 1 : 0.7}
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
              ]}
              onPress={() => {
                setFrequencia(freq.value);
                limparErroCampo('frequencia');
                if (freq.value === 'DIARIO') {
                  setDataPrimeiroVencimento(amanha(dataOperacional));
                } else if (freq.value === 'MENSAL' && diaMesPagamento) {
                  setDataPrimeiroVencimento(calcularDataMensal(parseInt(diaMesPagamento), dataOperacional));
                } else if (freq.value === 'SEMANAL' && frequencia !== 'SEMANAL') {
                  // Sugere o dia em que o vendedor está operando, em vez de
                  // cair sempre em segunda. Pedido do Julio em 23/09/2026.
                  //
                  // A condição `frequencia !== 'SEMANAL'` importa: só sugere
                  // ao ENTRAR na frequência. Sem ela, tocar de novo em
                  // "Semanal" apagaria o dia que o vendedor tivesse escolhido
                  // à mão.
                  setDiaSemanaPagamento(diaSemanaDe(dataOperacional));
                } else if (freq.value === 'FLEXIVEL') {
                  // A folha abre no próprio toque em "Flexível": não existe
                  // botão intermediário. Tocar de novo em "Flexível", já
                  // selecionado, é o caminho de volta para reconfigurar.
                  limparErroCampo('diasMesFlexivel');
                  onOpenCarrosselFlexivel();
                }
              }}
              activeOpacity={0.7}
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
            style={[styles.selectField, camposComErro.has('diaSemanaPagamento') && styles.inputError]}
            onPress={() => { onOpenDiaSemanaModal(); limparErroCampo('diaSemanaPagamento'); }}
            activeOpacity={0.7}
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
            style={[styles.input, camposComErro.has('diaMesPagamento') && styles.inputError]}
            value={diaMesPagamento}
            onChangeText={(text) => {
              const num = text.replace(/[^\d]/g, '');
              const val = Math.min(31, Math.max(0, parseInt(num) || 0));
              setDiaMesPagamento(num ? String(val) : '');
              if (val > 0) setDataPrimeiroVencimento(calcularDataMensal(val, dataOperacional));
              limparErroCampo('diaMesPagamento');
            }}
            placeholder="1-31"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={2}
          />
        </View>
      )}

      {/* Flexível: a folha abre no toque em "Flexível", sem botão
          intermediário — ver o onPress da grade de frequências acima.
          Aqui sobra só o retorno do que ficou configurado. A explicação da
          regra saiu: o passo 0 da folha já a dá, na hora em que importa. */}
      {frequencia === 'FLEXIVEL' && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, camposComErro.has('diasMesFlexivel') && styles.fieldLabelError]}>
            {lang === 'es' ? 'Cronograma flexible' : 'Cronograma flexível'} <Text style={styles.required}>*</Text>
          </Text>

          {diasMesFlexivel.length > 0 ? (
            <View style={{ backgroundColor: '#EEF2FF', borderRadius: 10, padding: 11, gap: 3 }}>
              <Text style={{ fontSize: 13, color: '#3730A3' }}>
                {lang === 'es' ? '1ª cuota' : '1ª parcela'}:{' '}
                <Text style={{ fontWeight: '800' }}>{formatarData(dataPrimeiroVencimento)}</Text>
              </Text>
              <Text style={{ fontSize: 13, color: '#3730A3' }}>
                {lang === 'es' ? 'Días' : 'Dias'}:{' '}
                <Text style={{ fontWeight: '800' }}>{diasMesFlexivel.join(', ')}</Text>
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 11 }}>
              <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 17 }}>
                {lang === 'es'
                  ? 'Toque otra vez en "Flexible" para configurar el cronograma.'
                  : 'Toque novamente em "Flexível" para configurar o cronograma.'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Data 1º vencimento */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('dataPrimeiroVencimento') && styles.fieldLabelError]}>
          Data 1º vencimento <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[styles.selectField, camposComErro.has('dataPrimeiroVencimento') && styles.inputError]}
          onPress={() => { onOpenDatePicker(); limparErroCampo('dataPrimeiroVencimento'); }}
          activeOpacity={0.7}
        >
          <Text style={styles.selectFieldText}>{formatarData(dataPrimeiroVencimento)}</Text>
          <Text style={styles.selectFieldChevron}>📅</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 16 }}>
          ℹ️ {lang === 'es'
            ? 'Esta es la fecha de la primera cobranza al cliente.'
            : 'Esta é a data da primeira cobrança ao cliente.'}
        </Text>
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