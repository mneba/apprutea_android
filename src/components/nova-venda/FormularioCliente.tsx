import React from 'react';
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../styles/novaVendaStyles';
import type { Textos } from '../../constants/novaVendaConstants';

interface Props {
  // Dados
  nome: string; setNome: (v: string) => void;
  documento: string; setDocumento: (v: string) => void;
  telefoneCelular: string; setTelefoneCelular: (v: string) => void;
  telefoneFixo: string; setTelefoneFixo: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  endereco: string; setEndereco: (v: string) => void;
  enderecoComercial: string; setEnderecoComercial: (v: string) => void;
  segmentoNome: string;
  fotoCliente: string | null;
  observacoesCliente: string; setObservacoesCliente: (v: string) => void;
  // Flags
  isReadOnly: boolean; // clienteExistente || clienteEncontradoId
  isDisabled: boolean; // isRenegociacao || isVendaAprovadaTravada
  camposComErro: Set<string>;
  // Handlers
  limparErroCampo: (campo: string) => void;
  getDdiLabel: (tipo: 'celular' | 'fixo') => string;
  openDdiModal: (target: 'celular' | 'fixo') => void;
  onOpenSegmentoModal: () => void;
  handlePhotoOptions: () => void;
  setFotoCliente: (v: string | null) => void;
  // i18n
  t: Textos;
}

export default function FormularioCliente(props: Props) {
  const {
    nome, setNome, documento, setDocumento,
    telefoneCelular, setTelefoneCelular, telefoneFixo, setTelefoneFixo,
    email, setEmail, endereco, setEndereco,
    enderecoComercial, setEnderecoComercial,
    segmentoNome, fotoCliente, observacoesCliente, setObservacoesCliente,
    isReadOnly, isDisabled, camposComErro,
    limparErroCampo, getDdiLabel, openDdiModal,
    onOpenSegmentoModal, handlePhotoOptions, setFotoCliente,
    t,
  } = props;

  if (isReadOnly) {
    return (
      <View style={styles.clienteReadOnlyBox}>
        {nome ? (
          <View style={styles.clienteReadOnlyRow}>
            <Text style={styles.clienteReadOnlyLabel}>Nome</Text>
            <Text style={styles.clienteReadOnlyValue}>{nome}</Text>
          </View>
        ) : null}
        {documento ? (
          <View style={styles.clienteReadOnlyRow}>
            <Text style={styles.clienteReadOnlyLabel}>{t.documento}</Text>
            <Text style={styles.clienteReadOnlyValue}>{documento}</Text>
          </View>
        ) : null}
        {telefoneCelular ? (
          <View style={styles.clienteReadOnlyRow}>
            <Text style={styles.clienteReadOnlyLabel}>Celular</Text>
            <Text style={styles.clienteReadOnlyValue}>{telefoneCelular}</Text>
          </View>
        ) : null}
        {endereco ? (
          <View style={styles.clienteReadOnlyRow}>
            <Text style={styles.clienteReadOnlyLabel}>{t.endResidencial}</Text>
            <Text style={styles.clienteReadOnlyValue} numberOfLines={2}>{endereco}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {/* Nome completo */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          Nome completo <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, camposComErro.has('nome') && styles.inputError, isDisabled && styles.inputDisabled]}
          value={nome}
          onChangeText={(text) => { setNome(text); limparErroCampo('nome'); }}
          placeholder={t.phNomeCliente}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          editable={!isDisabled}
        />
      </View>

      {/* Documento */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('documento') && styles.fieldLabelError]}>
          {t.documento} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, camposComErro.has('documento') && styles.inputError, isDisabled && styles.inputDisabled]}
          value={documento}
          onChangeText={(text) => { setDocumento(text); limparErroCampo('documento'); }}
          placeholder={t.phDoc}
          placeholderTextColor="#9CA3AF"
          editable={!isDisabled}
        />
      </View>

      {/* Celular */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('telefoneCelular') && styles.fieldLabelError]}>
          Celular <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.rowFields}>
          <TouchableOpacity
            style={[styles.ddiSelector, isDisabled && styles.inputDisabled]}
            onPress={() => { if (!isDisabled) openDdiModal('celular'); }}
            activeOpacity={isDisabled ? 1 : 0.7}
            disabled={isDisabled}
          >
            <Text style={styles.ddiText}>{getDdiLabel('celular')}</Text>
            <Text style={styles.ddiChevron}>▼</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { flex: 1 }, camposComErro.has('telefoneCelular') && styles.inputError, isDisabled && styles.inputDisabled]}
            value={telefoneCelular}
            onChangeText={(text) => { setTelefoneCelular(text.replace(/[^\d]/g, '')); limparErroCampo('telefoneCelular'); }}
            placeholder={t.phTelefone}
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            editable={!isDisabled}
          />
        </View>
      </View>

      {/* Telefone fixo */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.telefoneFixo}</Text>
        <View style={styles.rowFields}>
          <TouchableOpacity
            style={[styles.ddiSelector, isDisabled && styles.inputDisabled]}
            onPress={() => { if (!isDisabled) openDdiModal('fixo'); }}
            activeOpacity={isDisabled ? 1 : 0.7}
            disabled={isDisabled}
          >
            <Text style={styles.ddiText}>{getDdiLabel('fixo')}</Text>
            <Text style={styles.ddiChevron}>▼</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { flex: 1 }, isDisabled && styles.inputDisabled]}
            value={telefoneFixo}
            onChangeText={(text) => setTelefoneFixo(text.replace(/[^\d]/g, ''))}
            placeholder={t.phTelefone}
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            editable={!isDisabled}
          />
        </View>
      </View>

      {/* Email */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.email}</Text>
        <TextInput
          style={[styles.input, isDisabled && styles.inputDisabled]}
          value={email}
          onChangeText={setEmail}
          placeholder={t.phEmail}
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isDisabled}
        />
      </View>

      {/* Endereço Residencial */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('endereco') && styles.fieldLabelError]}>
          {t.endResidencial} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, camposComErro.has('endereco') && styles.inputError, isDisabled && styles.inputDisabled]}
          value={endereco}
          onChangeText={(text) => { setEndereco(text); limparErroCampo('endereco'); }}
          placeholder={t.phEndRes}
          placeholderTextColor="#9CA3AF"
          editable={!isDisabled}
        />
      </View>

      {/* Endereço Comercial */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, camposComErro.has('enderecoComercial') && styles.fieldLabelError]}>
          {t.endComercial} <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, camposComErro.has('enderecoComercial') && styles.inputError, isDisabled && styles.inputDisabled]}
          value={enderecoComercial}
          onChangeText={(text) => { setEnderecoComercial(text); limparErroCampo('enderecoComercial'); }}
          placeholder={t.phEndCom}
          placeholderTextColor="#9CA3AF"
          editable={!isDisabled}
        />
      </View>

      {/* Segmento */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.segmento}</Text>
        <TouchableOpacity
          style={[styles.selectField, isDisabled && styles.inputDisabled]}
          onPress={() => { if (!isDisabled) onOpenSegmentoModal(); }}
          activeOpacity={isDisabled ? 1 : 0.7}
          disabled={isDisabled}
        >
          <Text style={segmentoNome ? styles.selectFieldText : styles.selectFieldPlaceholder}>
            {segmentoNome || 'Selecione o segmento...'}
          </Text>
          <Text style={styles.selectFieldChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Foto */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.fotoCliente}</Text>
        <TouchableOpacity
          style={[styles.photoContainer, isDisabled && { opacity: 0.6 }]}
          onPress={() => { if (!isDisabled) handlePhotoOptions(); }}
          activeOpacity={isDisabled ? 1 : 0.7}
          disabled={isDisabled}
        >
          {fotoCliente ? (
            <View style={styles.photoPreviewWrapper}>
              <Image source={{ uri: fotoCliente }} style={styles.photoPreview} />
              {!isDisabled && (
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setFotoCliente(null)} activeOpacity={0.7}>
                  <Text style={styles.photoRemoveBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>{t.cliqueFoto}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Observações */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t.observacoes}</Text>
        <TextInput
          style={[styles.input, styles.textArea, isDisabled && styles.inputDisabled]}
          value={observacoesCliente}
          onChangeText={setObservacoesCliente}
          placeholder={t.phObs}
          placeholderTextColor="#9CA3AF"
          multiline numberOfLines={2}
          textAlignVertical="top"
          editable={!isDisabled}
        />
      </View>
    </>
  );
}
