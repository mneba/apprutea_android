import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import {
  amanha,
  calcularDataMensal,
  parseMoeda,
  DDI_LIST,
  type DDIOption,
  type Segmento,
  type Textos,
} from '../constants/novaVendaConstants';

// ============================================================
// HOOK: Estados do formulário + validação + handlers
// ============================================================

interface UseNovaVendaFormParams {
  clienteExistente: any;
  renegociacao: any;
  isRenegociacao: boolean;
  t: Textos;
}

export function useNovaVendaForm({
  clienteExistente,
  renegociacao,
  isRenegociacao,
  t,
}: UseNovaVendaFormParams) {

  // -----------------------------------------------------------
  // ESTADOS - CLIENTE
  // -----------------------------------------------------------
  const [nome, setNome] = useState(clienteExistente?.nome || renegociacao?.cliente_nome || '');
  const [documento, setDocumento] = useState(clienteExistente?.documento || '');
  const [ddiCelular, setDdiCelular] = useState('+55');
  const [telefoneCelular, setTelefoneCelular] = useState(clienteExistente?.telefone_celular || renegociacao?.telefone_celular || '');
  const [ddiFixo, setDdiFixo] = useState('+55');
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState(clienteExistente?.endereco || '');
  const [enderecoComercial, setEnderecoComercial] = useState('');
  const [segmentoId, setSegmentoId] = useState<string | null>(null);
  const [segmentoNome, setSegmentoNome] = useState('');
  const [fotoCliente, setFotoCliente] = useState<string | null>(null);
  const [observacoesCliente, setObservacoesCliente] = useState('');

  // Validação visual
  const [camposComErro, setCamposComErro] = useState<Set<string>>(new Set());

  // Seções colapsáveis
  const [clienteExpanded, setClienteExpanded] = useState(!clienteExistente && !isRenegociacao);
  const [emprestimoExpanded, setEmprestimoExpanded] = useState(true);
  const [microseguroExpanded, setMicroseguroExpanded] = useState(true);

  // -----------------------------------------------------------
  // ESTADOS - EMPRÉSTIMO
  // -----------------------------------------------------------
  const [valorEmprestimo, setValorEmprestimo] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('');
  const [taxaJuros, setTaxaJuros] = useState('');
  const [taxaJurosPersonalizada, setTaxaJurosPersonalizada] = useState(false);
  const [frequencia, setFrequencia] = useState('DIARIO');
  const [diaSemanaPagamento, setDiaSemanaPagamento] = useState('1');
  const [diaMesPagamento, setDiaMesPagamento] = useState('15');
  const [diasMesFlexivel, setDiasMesFlexivel] = useState<number[]>([]);
  const [iniciarProximoMes, setIniciarProximoMes] = useState(false);
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(amanha());
  const [observacoesEmprestimo, setObservacoesEmprestimo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDiaSemanaModal, setShowDiaSemanaModal] = useState(false);

  // -----------------------------------------------------------
  // ESTADOS - MICROSEGURO
  // -----------------------------------------------------------
  const [valorMicroseguro, setValorMicroseguro] = useState('');

  // -----------------------------------------------------------
  // MODAIS DE SELEÇÃO
  // -----------------------------------------------------------
  const [showDdiModal, setShowDdiModal] = useState(false);
  const [ddiTarget, setDdiTarget] = useState<'celular' | 'fixo'>('celular');
  const [showSegmentoModal, setShowSegmentoModal] = useState(false);
  const [segmentoBusca, setSegmentoBusca] = useState('');
  const segmentoBuscaRef = useRef<TextInput>(null);

  // -----------------------------------------------------------
  // CÁLCULOS AUTOMÁTICOS
  // -----------------------------------------------------------
  const valorPrincipal = parseMoeda(valorEmprestimo);
  const taxaNum = parseFloat(taxaJuros?.replace(',', '.') || '0') || 0;
  const parcelasNum = Math.max(1, parseInt(numeroParcelas) || 1);
  const valorTotal = valorPrincipal * (1 + taxaNum / 100);
  const valorParcela = valorTotal / parcelasNum;
  const totalJuros = valorTotal - valorPrincipal;
  const microValor = parseMoeda(valorMicroseguro);

  // -----------------------------------------------------------
  // DIAS DA SEMANA
  // -----------------------------------------------------------
  const DIAS_SEMANA = [
    { value: '0', label: t.domingo },
    { value: '1', label: t.segunda },
    { value: '2', label: t.terca },
    { value: '3', label: t.quarta },
    { value: '4', label: t.quinta },
    { value: '5', label: t.sexta },
    { value: '6', label: t.sabado },
  ];

  const getDiaSemanaLabel = () => {
    return DIAS_SEMANA.find(d => d.value === diaSemanaPagamento)?.label || t.selecione;
  };

  const toggleDiaFlexivel = (dia: number) => {
    setDiasMesFlexivel(prev => {
      if (prev.includes(dia)) return prev.filter(d => d !== dia);
      return [...prev, dia].sort((a, b) => a - b);
    });
    limparErroCampo('diasMesFlexivel');
  };

  // -----------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------
  const handleValorEmprestimoChange = (text: string) => {
    setValorEmprestimo(text.replace(/[^\d.,]/g, '').replace(',', '.'));
  };

  const handleValorMicroseguroChange = (text: string) => {
    setValorMicroseguro(text.replace(/[^\d.,]/g, '').replace(',', '.'));
  };

  const handleSelectDdi = (ddi: DDIOption) => {
    if (ddiTarget === 'celular') setDdiCelular(ddi.codigo);
    else setDdiFixo(ddi.codigo);
    setShowDdiModal(false);
  };

  const openDdiModal = (target: 'celular' | 'fixo') => {
    setDdiTarget(target);
    setShowDdiModal(true);
  };

  const getDdiLabel = (tipo: 'celular' | 'fixo') => {
    const codigo = tipo === 'celular' ? ddiCelular : ddiFixo;
    const found = DDI_LIST.find(d => d.codigo === codigo);
    return found ? `${found.pais} ${found.codigo}` : codigo;
  };

  const handleSelectSegmento = (seg: Segmento) => {
    setSegmentoId(seg.id);
    setSegmentoNome(seg.nome_pt);
    setShowSegmentoModal(false);
  };

  // -----------------------------------------------------------
  // FOTO
  // -----------------------------------------------------------
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.permissaoNecessaria, t.permissaoCameraMsg);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        setFotoCliente(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
      }
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
      Alert.alert(t.erro, t.erroFoto);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.permissaoNecessaria, t.permissaoGaleriaMsg);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        setFotoCliente(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
      }
    } catch (err) {
      console.error('Erro ao selecionar foto:', err);
    }
  };

  const handlePhotoOptions = () => {
    Alert.alert(t.fotoCliente2, t.fotoMsg, [
      { text: t.camera, onPress: handlePickPhoto },
      { text: t.galeria, onPress: handlePickFromGallery },
      ...(fotoCliente ? [{ text: t.removerFoto, style: 'destructive' as const, onPress: () => setFotoCliente(null) }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  // -----------------------------------------------------------
  // VALIDAÇÃO
  // -----------------------------------------------------------
  const clienteEncontradoId: string | null = null; // será sobrescrito externamente via busca doc
  const isClienteExistente = !!(clienteExistente?.id || isRenegociacao);

  const isValido = (clienteEncontradoIdExt?: string | null): boolean => {
    const hasClienteId = !!(clienteExistente?.id || clienteEncontradoIdExt || isRenegociacao);
    const clienteValido = hasClienteId
      ? !!(nome.trim())
      : !!(nome.trim() && documento.trim() && telefoneCelular.trim() && endereco.trim() && enderecoComercial.trim());

    const emprestimoValido = !!(
      valorPrincipal > 0 &&
      taxaJuros &&
      numeroParcelas &&
      parseInt(numeroParcelas) > 0 &&
      dataPrimeiroVencimento &&
      frequencia
    );

    return clienteValido && emprestimoValido;
  };

  const validarCamposComFeedback = (clienteEncontradoIdExt?: string | null): boolean => {
    const erros = new Set<string>();
    const hasClienteId = !!(clienteExistente?.id || clienteEncontradoIdExt || isRenegociacao);

    if (!nome.trim()) erros.add('nome');
    if (!hasClienteId) {
      if (!documento.trim()) erros.add('documento');
      if (!telefoneCelular.trim()) erros.add('telefoneCelular');
      if (!endereco.trim()) erros.add('endereco');
      if (!enderecoComercial.trim()) erros.add('enderecoComercial');
    }

    if (!valorPrincipal || valorPrincipal <= 0) erros.add('valorEmprestimo');
    if (!numeroParcelas || parseInt(numeroParcelas) <= 0) erros.add('numeroParcelas');
    if (!taxaJuros) erros.add('taxaJuros');
    if (!dataPrimeiroVencimento) erros.add('dataPrimeiroVencimento');
    if (!frequencia) erros.add('frequencia');

    if (frequencia === 'SEMANAL' && !diaSemanaPagamento) erros.add('diaSemanaPagamento');
    if (frequencia === 'MENSAL' && !diaMesPagamento) erros.add('diaMesPagamento');
    if (frequencia === 'FLEXIVEL' && diasMesFlexivel.length === 0) erros.add('diasMesFlexivel');

    setCamposComErro(erros);
    return erros.size === 0;
  };

  const limparErroCampo = (campo: string) => {
    if (camposComErro.has(campo)) {
      setCamposComErro(prev => {
        const novo = new Set(prev);
        novo.delete(campo);
        return novo;
      });
    }
  };

  // -----------------------------------------------------------
  // LIMPAR FORMULÁRIO
  // -----------------------------------------------------------
  const limparFormulario = () => {
    setNome(''); setDocumento('');
    setDdiCelular('+55'); setTelefoneCelular('');
    setDdiFixo('+55'); setTelefoneFixo('');
    setEmail(''); setEndereco(''); setEnderecoComercial('');
    setSegmentoId(null); setSegmentoNome('');
    setFotoCliente(null); setObservacoesCliente('');
    setValorEmprestimo(''); setNumeroParcelas('12');
    setTaxaJuros(''); setTaxaJurosPersonalizada(false);
    setFrequencia('DIARIO'); setDiaSemanaPagamento('1');
    setDiaMesPagamento('15'); setDiasMesFlexivel([]);
    setIniciarProximoMes(false); setDataPrimeiroVencimento(amanha());
    setObservacoesEmprestimo(''); setValorMicroseguro('');
    setCamposComErro(new Set());
  };

  return {
    // --- Estados Cliente ---
    nome, setNome,
    documento, setDocumento,
    ddiCelular, setDdiCelular,
    telefoneCelular, setTelefoneCelular,
    ddiFixo, setDdiFixo,
    telefoneFixo, setTelefoneFixo,
    email, setEmail,
    endereco, setEndereco,
    enderecoComercial, setEnderecoComercial,
    segmentoId, setSegmentoId,
    segmentoNome, setSegmentoNome,
    fotoCliente, setFotoCliente,
    observacoesCliente, setObservacoesCliente,
    camposComErro, setCamposComErro,

    // --- Seções colapsáveis ---
    clienteExpanded, setClienteExpanded,
    emprestimoExpanded, setEmprestimoExpanded,
    microseguroExpanded, setMicroseguroExpanded,

    // --- Estados Empréstimo ---
    valorEmprestimo, setValorEmprestimo,
    numeroParcelas, setNumeroParcelas,
    taxaJuros, setTaxaJuros,
    taxaJurosPersonalizada, setTaxaJurosPersonalizada,
    frequencia, setFrequencia,
    diaSemanaPagamento, setDiaSemanaPagamento,
    diaMesPagamento, setDiaMesPagamento,
    diasMesFlexivel, setDiasMesFlexivel,
    iniciarProximoMes, setIniciarProximoMes,
    dataPrimeiroVencimento, setDataPrimeiroVencimento,
    observacoesEmprestimo, setObservacoesEmprestimo,
    showDatePicker, setShowDatePicker,
    showDiaSemanaModal, setShowDiaSemanaModal,

    // --- Microseguro ---
    valorMicroseguro, setValorMicroseguro,

    // --- Modais ---
    showDdiModal, setShowDdiModal,
    ddiTarget, setDdiTarget,
    showSegmentoModal, setShowSegmentoModal,
    segmentoBusca, setSegmentoBusca,
    segmentoBuscaRef,

    // --- Cálculos ---
    valorPrincipal, taxaNum, parcelasNum,
    valorTotal, valorParcela, totalJuros, microValor,

    // --- Dias da semana ---
    DIAS_SEMANA, getDiaSemanaLabel, toggleDiaFlexivel,

    // --- Handlers ---
    handleValorEmprestimoChange,
    handleValorMicroseguroChange,
    handleSelectDdi, openDdiModal, getDdiLabel,
    handleSelectSegmento, handlePhotoOptions,

    // --- Validação ---
    isValido, validarCamposComFeedback, limparErroCampo,

    // --- Reset ---
    limparFormulario,
  };
}
