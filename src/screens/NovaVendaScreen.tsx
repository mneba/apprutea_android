import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { supabase } from '../services/supabase';

// ============================================================
// TIPOS
// ============================================================

interface Segmento {
  id: string;
  grupo_pt: string;
  nome_pt: string;
  ordem_grupo: number;
  ordem: number;
}

interface SegmentoGrupo {
  grupo: string;
  itens: Segmento[];
}

interface DDIOption {
  pais: string;
  codigo: string;
}

// ============================================================
// CONSTANTES
// ============================================================

const DDI_LIST: DDIOption[] = [
  { pais: 'Argentina', codigo: '+54' },
  { pais: 'Bolívia', codigo: '+591' },
  { pais: 'Brasil', codigo: '+55' },
  { pais: 'Chile', codigo: '+56' },
  { pais: 'Colômbia', codigo: '+57' },
  { pais: 'Costa Rica', codigo: '+506' },
  { pais: 'Equador', codigo: '+593' },
  { pais: 'El Salvador', codigo: '+503' },
  { pais: 'Guatemala', codigo: '+502' },
  { pais: 'Guiana', codigo: '+592' },
  { pais: 'Honduras', codigo: '+504' },
  { pais: 'México', codigo: '+52' },
  { pais: 'Nicarágua', codigo: '+505' },
  { pais: 'Paraguai', codigo: '+595' },
  { pais: 'Peru', codigo: '+51' },
  { pais: 'Suriname', codigo: '+597' },
  { pais: 'Uruguai', codigo: '+598' },
  { pais: 'Venezuela', codigo: '+58' },
];

// ============================================================
// COMPONENTE CALENDÁRIO
// ============================================================

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function CalendarioSelector({
  dataSelecionada,
  onSelect,
}: {
  dataSelecionada: string;
  onSelect: (dateStr: string) => void;
}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

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

  // Gerar dias do mês
  const gerarDias = () => {
    const primeiroDia = new Date(anoVis, mesVis, 1);
    const ultimoDia = new Date(anoVis, mesVis + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const inicioSemana = primeiroDia.getDay(); // 0=Dom

    const dias: Array<{ dia: number; dateStr: string; ehHoje: boolean; ehPassado: boolean } | null> = [];

    // Espaços vazios antes do dia 1
    for (let i = 0; i < inicioSemana; i++) {
      dias.push(null);
    }

    // Dias do mês
    for (let d = 1; d <= diasNoMes; d++) {
      const date = new Date(anoVis, mesVis, d);
      const dateStr = `${anoVis}-${String(mesVis + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({
        dia: d,
        dateStr,
        ehHoje: date.getTime() === hoje.getTime(),
        ehPassado: date < hoje,
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
    <View style={calStyles.container}>
      {/* Navegação mês/ano */}
      <View style={calStyles.navRow}>
        <TouchableOpacity onPress={() => navMes(-1)} style={calStyles.navBtn} activeOpacity={0.6}>
          <Text style={calStyles.navBtnText}>◀</Text>
        </TouchableOpacity>
        <Text style={calStyles.navTitle}>{MESES_NOME[mesVis]} {anoVis}</Text>
        <TouchableOpacity onPress={() => navMes(1)} style={calStyles.navBtn} activeOpacity={0.6}>
          <Text style={calStyles.navBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Header dias da semana */}
      <View style={calStyles.weekRow}>
        {DIAS_SEMANA_CURTO.map((dia, i) => (
          <View key={i} style={calStyles.weekCell}>
            <Text style={[calStyles.weekText, i === 0 && { color: '#EF4444' }]}>{dia}</Text>
          </View>
        ))}
      </View>

      {/* Grid de dias */}
      <View style={calStyles.daysGrid}>
        {dias.map((item, index) => {
          if (!item) {
            return <View key={`empty-${index}`} style={calStyles.dayCell} />;
          }

          const selecionado = item.dateStr === dataSelecionada;

          return (
            <TouchableOpacity
              key={item.dateStr}
              style={[
                calStyles.dayCell,
                item.ehHoje && calStyles.dayCellHoje,
                selecionado && calStyles.dayCellSelecionado,
              ]}
              onPress={() => onSelect(item.dateStr)}
              activeOpacity={0.6}
            >
              <Text style={[
                calStyles.dayText,
                item.ehPassado && !item.ehHoje && calStyles.dayTextPassado,
                item.ehHoje && calStyles.dayTextHoje,
                selecionado && calStyles.dayTextSelecionado,
              ]}>
                {item.dia}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Botão Hoje */}
      <TouchableOpacity
        style={calStyles.hojeBtn}
        onPress={() => {
          const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
          setMesVis(hoje.getMonth());
          setAnoVis(hoje.getFullYear());
          onSelect(hojeStr);
        }}
        activeOpacity={0.7}
      >
        <Text style={calStyles.hojeBtnText}>📅 Hoje ({hoje.toLocaleDateString('pt-BR')})</Text>
      </TouchableOpacity>
    </View>
  );
}

const calStyles = StyleSheet.create({
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

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function NovaVendaScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();
  const liqCtx = useLiquidacaoContext();
  const clienteExistente = route?.params?.clienteExistente || null;

  // -----------------------------------------------------------
  // ESTADOS - CLIENTE
  // -----------------------------------------------------------
  const [nome, setNome] = useState(clienteExistente?.nome || '');
  const [documento, setDocumento] = useState(clienteExistente?.documento || '');
  const [ddiCelular, setDdiCelular] = useState('+55');
  const [telefoneCelular, setTelefoneCelular] = useState(clienteExistente?.telefone_celular || '');
  const [ddiFixo, setDdiFixo] = useState('+55');
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState(clienteExistente?.endereco || '');
  const [enderecoComercial, setEnderecoComercial] = useState('');
  const [segmentoId, setSegmentoId] = useState<string | null>(null);
  const [fotoCliente, setFotoCliente] = useState<string | null>(null);
  const [observacoesCliente, setObservacoesCliente] = useState('');

  // Seções colapsáveis - Se cliente existente, colapsa dados e expande empréstimo
  const [clienteExpanded, setClienteExpanded] = useState(!clienteExistente);
  const [emprestimoExpanded, setEmprestimoExpanded] = useState(true);
  const [microseguroExpanded, setMicroseguroExpanded] = useState(true);

  // -----------------------------------------------------------
  // ESTADOS - EMPRÉSTIMO
  // -----------------------------------------------------------
  const [valorEmprestimo, setValorEmprestimo] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('12');
  const [taxaJuros, setTaxaJuros] = useState('');
  const [taxaJurosPersonalizada, setTaxaJurosPersonalizada] = useState(false);
  const [taxasPermitidas, setTaxasPermitidas] = useState<number[]>([5, 10, 15, 20, 25]);
  const [frequencia, setFrequencia] = useState('DIARIO');
  const [diaSemanaPagamento, setDiaSemanaPagamento] = useState('1'); // Segunda
  const [diaMesPagamento, setDiaMesPagamento] = useState('15');
  const [diasMesFlexivel, setDiasMesFlexivel] = useState<number[]>([]);
  const [iniciarProximoMes, setIniciarProximoMes] = useState(false);
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [observacoesEmprestimo, setObservacoesEmprestimo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDiaSemanaModal, setShowDiaSemanaModal] = useState(false);

  // -----------------------------------------------------------
  // ESTADOS - MICROSEGURO
  // -----------------------------------------------------------
  const [valorMicroseguro, setValorMicroseguro] = useState('');

  // Segmentos do Supabase
  const [segmentos, setSegmentos] = useState<SegmentoGrupo[]>([]);
  const [segmentosLoading, setSegmentosLoading] = useState(false);
  const [segmentoNome, setSegmentoNome] = useState('');

  // Modais de seleção
  const [showDdiModal, setShowDdiModal] = useState(false);
  const [ddiTarget, setDdiTarget] = useState<'celular' | 'fixo'>('celular');
  const [showSegmentoModal, setShowSegmentoModal] = useState(false);
  const [segmentoBusca, setSegmentoBusca] = useState('');
  const segmentoBuscaRef = useRef<TextInput>(null);

  // Loading geral
  const [submitting, setSubmitting] = useState(false);

  // Resultado do backend (pós-confirmação)
  const [resultado, setResultado] = useState<any>(null);
  const [showResultado, setShowResultado] = useState(false);

  // -----------------------------------------------------------
  // CARREGAR SEGMENTOS E TAXAS PERMITIDAS
  // -----------------------------------------------------------
  useEffect(() => {
    loadSegmentos();
    loadTaxasPermitidas();
  }, []);

  const loadTaxasPermitidas = async () => {
    if (!vendedor?.id) return;
    try {
      const { data, error } = await supabase
        .from('restricoes_vendedor')
        .select('taxas_juros_permitidas')
        .eq('vendedor_id', vendedor.id)
        .maybeSingle();

      if (!error && data?.taxas_juros_permitidas && data.taxas_juros_permitidas.length > 0) {
        setTaxasPermitidas(data.taxas_juros_permitidas);
      }
      // Se não encontrou, mantém o padrão [5, 10, 15, 20, 25]
    } catch (err) {
      console.error('Erro ao carregar taxas:', err);
    }
  };

  const loadSegmentos = async () => {
    setSegmentosLoading(true);
    try {
      const { data, error } = await supabase
        .from('segmentos')
        .select('id, grupo_pt, nome_pt, ordem_grupo, ordem')
        .eq('ativo', true)
        .order('ordem_grupo')
        .order('ordem');

      if (error) throw error;

      // Agrupar por grupo_pt
      const grupos: Record<string, Segmento[]> = {};
      (data || []).forEach((seg: Segmento) => {
        const grupo = seg.grupo_pt || 'Outros';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(seg);
      });

      const agrupados: SegmentoGrupo[] = Object.entries(grupos).map(([grupo, itens]) => ({
        grupo,
        itens,
      }));

      setSegmentos(agrupados);
    } catch (err) {
      console.error('Erro ao carregar segmentos:', err);
    } finally {
      setSegmentosLoading(false);
    }
  };

  // -----------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------

  // -----------------------------------------------------------
  // HELPERS DE FORMATAÇÃO MONETÁRIA
  // -----------------------------------------------------------
  const formatarMoeda = (valor: string): string => {
    const numeros = valor.replace(/[^\d]/g, '');
    if (!numeros) return '';
    const numero = parseInt(numeros, 10) / 100;
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const parseMoeda = (valor: string): number => {
    if (!valor) return 0;
    return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const handleValorEmprestimoChange = (text: string) => {
    const numeros = text.replace(/[^\d]/g, '');
    setValorEmprestimo(formatarMoeda(numeros));
  };

  const handleValorMicroseguroChange = (text: string) => {
    const numeros = text.replace(/[^\d]/g, '');
    setValorMicroseguro(formatarMoeda(numeros));
  };

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

  // Formatar para exibição
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  // -----------------------------------------------------------
  // HELPERS DIAS DA SEMANA
  // -----------------------------------------------------------
  const DIAS_SEMANA = [
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira' },
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' },
  ];

  const getDiaSemanaLabel = () => {
    return DIAS_SEMANA.find(d => d.value === diaSemanaPagamento)?.label || 'Selecione';
  };

  // Flexível - toggle dia
  const toggleDiaFlexivel = (dia: number) => {
    setDiasMesFlexivel(prev => {
      if (prev.includes(dia)) {
        return prev.filter(d => d !== dia);
      } else {
        return [...prev, dia].sort((a, b) => a - b);
      }
    });
  };

  // Formatar data para exibição
  const formatarData = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // -----------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------

  const handleSelectDdi = (ddi: DDIOption) => {
    if (ddiTarget === 'celular') {
      setDdiCelular(ddi.codigo);
    } else {
      setDdiFixo(ddi.codigo);
    }
    setShowDdiModal(false);
  };

  const openDdiModal = (target: 'celular' | 'fixo') => {
    setDdiTarget(target);
    setShowDdiModal(true);
  };

  const handleSelectSegmento = (seg: Segmento) => {
    setSegmentoId(seg.id);
    setSegmentoNome(seg.nome_pt);
    setShowSegmentoModal(false);
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar a foto.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          setFotoCliente(`data:${mimeType};base64,${asset.base64}`);
        }
      }
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
      Alert.alert('Erro', 'Não foi possível capturar a foto.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          setFotoCliente(`data:${mimeType};base64,${asset.base64}`);
        }
      }
    } catch (err) {
      console.error('Erro ao selecionar foto:', err);
    }
  };

  const handlePhotoOptions = () => {
    Alert.alert('Foto do cliente', 'Como deseja adicionar a foto?', [
      { text: 'Câmera', onPress: handlePickPhoto },
      { text: 'Galeria', onPress: handlePickFromGallery },
      ...(fotoCliente ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: () => setFotoCliente(null) }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  // Obter label do DDI selecionado
  const getDdiLabel = (tipo: 'celular' | 'fixo') => {
    const codigo = tipo === 'celular' ? ddiCelular : ddiFixo;
    const found = DDI_LIST.find(d => d.codigo === codigo);
    return found ? `${found.pais} ${found.codigo}` : codigo;
  };

  // -----------------------------------------------------------
  // VALIDAÇÃO
  // -----------------------------------------------------------
  const isValido = (): boolean => {
    return !!(
      nome.trim() &&
      valorPrincipal > 0 &&
      taxaJuros &&
      numeroParcelas &&
      parseInt(numeroParcelas) > 0 &&
      dataPrimeiroVencimento &&
      frequencia
    );
  };

  // -----------------------------------------------------------
  // LIMPAR FORMULÁRIO
  // -----------------------------------------------------------
  const limparFormulario = () => {
    setNome('');
    setDocumento('');
    setDdiCelular('+55');
    setTelefoneCelular('');
    setDdiFixo('+55');
    setTelefoneFixo('');
    setEmail('');
    setEndereco('');
    setEnderecoComercial('');
    setSegmentoId(null);
    setSegmentoNome('');
    setFotoCliente(null);
    setObservacoesCliente('');
    setValorEmprestimo('');
    setNumeroParcelas('12');
    setTaxaJuros('');
    setTaxaJurosPersonalizada(false);
    setFrequencia('DIARIO');
    setDiaSemanaPagamento('1');
    setDiaMesPagamento('15');
    setDiasMesFlexivel([]);
    setIniciarProximoMes(false);
    setDataPrimeiroVencimento(new Date().toISOString().split('T')[0]);
    setObservacoesEmprestimo('');
    setValorMicroseguro('');
    setResultado(null);
  };

  // -----------------------------------------------------------
  // SUBMIT - CONFIRMAR VENDA
  // -----------------------------------------------------------
  const handleSubmit = async () => {
    // ETAPA 1 - Validação local
    if (!isValido()) {
      Alert.alert('Dados incompletos', 'Preencha todos os campos obrigatórios marcados com *.');
      return;
    }

    if (frequencia === 'SEMANAL' && !diaSemanaPagamento) {
      Alert.alert('Campo obrigatório', 'Selecione o dia da semana para cobrança.');
      return;
    }
    if (frequencia === 'MENSAL' && !diaMesPagamento) {
      Alert.alert('Campo obrigatório', 'Informe o dia do mês para cobrança.');
      return;
    }
    if (frequencia === 'FLEXIVEL' && diasMesFlexivel.length === 0) {
      Alert.alert('Campo obrigatório', 'Selecione pelo menos um dia de cobrança.');
      return;
    }

    // ETAPA 2 - Verificar IDs de contexto
    const vendedorId = vendedor?.id;
    const userId = vendedor?.user_id;
    let empresaId = vendedor?.empresa_id || null;
    let rotaId = vendedor?.rota_id || null;

    if (!userId) {
      Alert.alert('Erro de autenticação', 'Sessão expirada. Faça login novamente.');
      return;
    }

    // Se não tem rota_id, buscar
    if (!rotaId && vendedorId) {
      try {
        const { data: rotaData } = await supabase
          .from('rotas')
          .select('id, empresa_id')
          .eq('vendedor_id', vendedorId)
          .single();
        if (rotaData) {
          rotaId = rotaData.id;
          empresaId = empresaId || rotaData.empresa_id;
        }
      } catch (err) {
        console.error('Erro ao buscar rota:', err);
      }
    }

    // Se não tem empresa_id, buscar da rota
    if (!empresaId && rotaId) {
      try {
        const { data: rotaData } = await supabase
          .from('rotas')
          .select('empresa_id')
          .eq('id', rotaId)
          .single();
        if (rotaData) {
          empresaId = rotaData.empresa_id;
        }
      } catch (err) {
        console.error('Erro ao buscar empresa:', err);
      }
    }

    setSubmitting(true);
    try {
      // ETAPA 3 - GPS (timeout 5s, não bloqueia)
      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000)),
          ]) as any;
          if (loc?.coords) {
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;
          }
        }
      } catch (gpsErr) {
        // GPS falhou — não bloqueia a venda
        console.log('GPS indisponível:', gpsErr);
      }

      // ETAPA 4 - Validar liquidação aberta (obrigatória)
      const { data: liqData, error: liqError } = await supabase
        .from('liquidacoes_diarias')
        .select('id')
        .eq('rota_id', rotaId)
        .in('status', ['ABERTO', 'ABERTA'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liqError || !liqData) {
        Alert.alert(
          'Liquidação não encontrada',
          'Nenhuma liquidação aberta encontrada. Abra uma liquidação antes de registrar vendas.'
        );
        setSubmitting(false);
        return;
      }

      // ETAPA 5 - Montar e enviar parâmetros
      const params: Record<string, any> = {
        // Cliente
        p_cliente_id: clienteExistente?.id || null,
        p_cliente_nome: nome.trim(),
        p_cliente_documento: documento.trim() || null,
        p_cliente_telefone: telefoneCelular ? `${ddiCelular}${telefoneCelular}` : null,
        p_cliente_telefone_fixo: telefoneFixo ? `${ddiFixo}${telefoneFixo}` : null,
        p_cliente_email: email.trim() || null,
        p_cliente_endereco: endereco.trim() || null,
        p_cliente_endereco_comercial: enderecoComercial.trim() || null,
        p_cliente_segmento_id: segmentoId || null,
        p_cliente_foto_url: fotoCliente || null,
        p_cliente_observacoes: observacoesCliente.trim() || null,
        // Empréstimo
        p_valor_principal: valorPrincipal,
        p_numero_parcelas: parseInt(numeroParcelas),
        p_taxa_juros: parseFloat(taxaJuros.replace(',', '.')) || 0,
        p_frequencia: frequencia,
        p_data_primeiro_vencimento: dataPrimeiroVencimento,
        p_dia_semana_cobranca: frequencia === 'SEMANAL' ? parseInt(diaSemanaPagamento) : null,
        p_dia_mes_cobranca: frequencia === 'MENSAL' ? parseInt(diaMesPagamento) : null,
        p_dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesFlexivel : null,
        p_iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : null,
        p_observacoes: observacoesEmprestimo.trim() || null,
        // Microseguro
        p_microseguro_valor: microValor > 0 ? microValor : null,
        // Contexto
        p_empresa_id: empresaId,
        p_rota_id: rotaId,
        p_vendedor_id: vendedorId,
        p_user_id: userId,
        p_latitude: latitude,
        p_longitude: longitude,
      };

      const { data, error } = await supabase.rpc('fn_nova_venda_completa', params);

      if (error) throw error;

      // ETAPA 6 - Tratamento da resposta
      const res = Array.isArray(data) ? data[0] : data;

      if (!res?.sucesso) {
        Alert.alert('Erro', res?.mensagem || 'Erro ao registrar venda.');
        return;
      }

      // Sucesso — atualizar liquidação e mostrar resultado
      liqCtx.recarregarLiquidacao();
      setResultado(res);
      setShowResultado(true);
    } catch (err: any) {
      console.error('Erro ao registrar venda:', err);
      Alert.alert('Erro', err?.message || 'Erro inesperado ao registrar venda.');
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------
  // FECHAR RESULTADO E VOLTAR
  // -----------------------------------------------------------
  const handleFecharResultado = () => {
    setShowResultado(false);
    limparFormulario();
    navigation.goBack();
  };

  // -----------------------------------------------------------
  // FECHAR TELA
  // -----------------------------------------------------------
  const handleClose = () => {
    // Se tem algum campo preenchido, pedir confirmação
    const temDados = nome || documento || telefoneCelular || telefoneFixo || 
                     email || endereco || enderecoComercial || segmentoId || 
                     fotoCliente || observacoesCliente;
    
    if (temDados) {
      Alert.alert(
        'Cancelar venda?',
        'Os dados preenchidos serão perdidos.',
        [
          { text: 'Não', style: 'cancel' },
          { text: 'Sim, cancelar', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // -----------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NOVA VENDA</Text>
        <TouchableOpacity style={styles.headerCloseBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={styles.headerCloseBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ================================================ */}
          {/* SEÇÃO: CLIENTE                                   */}
          {/* ================================================ */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setClienteExpanded(!clienteExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>👤</Text>
                <Text style={styles.sectionTitle}>CLIENTE</Text>
              </View>
              <Text style={styles.sectionChevron}>{clienteExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {clienteExpanded && (
              <View style={styles.sectionBody}>
                {/* Nome completo */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Nome completo <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Nome do cliente"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                  />
                </View>

                {/* Documento */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Documento</Text>
                  <TextInput
                    style={styles.input}
                    value={documento}
                    onChangeText={setDocumento}
                    placeholder="123.456.789-00"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Celular (DDI + número) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Celular <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.rowFields}>
                    <TouchableOpacity
                      style={styles.ddiSelector}
                      onPress={() => openDdiModal('celular')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ddiText}>{getDdiLabel('celular')}</Text>
                      <Text style={styles.ddiChevron}>▼</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={telefoneCelular}
                      onChangeText={(text) => setTelefoneCelular(text.replace(/[^\d]/g, ''))}
                      placeholder="Apenas números"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Telefone fixo (DDI + número) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Telefone fixo</Text>
                  <View style={styles.rowFields}>
                    <TouchableOpacity
                      style={styles.ddiSelector}
                      onPress={() => openDdiModal('fixo')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ddiText}>{getDdiLabel('fixo')}</Text>
                      <Text style={styles.ddiChevron}>▼</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={telefoneFixo}
                      onChangeText={(text) => setTelefoneFixo(text.replace(/[^\d]/g, ''))}
                      placeholder="Apenas números"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@exemplo.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Endereço Residencial */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Endereço Residencial</Text>
                  <TextInput
                    style={styles.input}
                    value={endereco}
                    onChangeText={setEndereco}
                    placeholder="Rua, número, bairro"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Endereço Comercial */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Endereço Comercial</Text>
                  <TextInput
                    style={styles.input}
                    value={enderecoComercial}
                    onChangeText={setEnderecoComercial}
                    placeholder="Rua, número, loja"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Segmento */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Segmento</Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    onPress={() => setShowSegmentoModal(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={segmentoId ? styles.selectFieldText : styles.selectFieldPlaceholder}>
                      {segmentoNome || 'Selecione o segmento...'}
                    </Text>
                    <Text style={styles.selectFieldChevron}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Foto do cliente */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Foto do cliente</Text>
                  <TouchableOpacity
                    style={styles.photoContainer}
                    onPress={handlePhotoOptions}
                    activeOpacity={0.7}
                  >
                    {fotoCliente ? (
                      <View style={styles.photoPreviewWrapper}>
                        <Image source={{ uri: fotoCliente }} style={styles.photoPreview} />
                        <TouchableOpacity
                          style={styles.photoRemoveBtn}
                          onPress={() => setFotoCliente(null)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.photoRemoveBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoPlaceholderIcon}>📷</Text>
                        <Text style={styles.photoPlaceholderText}>Clique para adicionar foto</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Observações */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Observações</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={observacoesCliente}
                    onChangeText={setObservacoesCliente}
                    placeholder="Anotações sobre o cliente"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}
          </View>

          {/* ================================================ */}
          {/* SEÇÃO: EMPRÉSTIMO                                */}
          {/* ================================================ */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setEmprestimoExpanded(!emprestimoExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>💰</Text>
                <Text style={styles.sectionTitle}>EMPRÉSTIMO</Text>
              </View>
              <Text style={styles.sectionChevron}>{emprestimoExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {emprestimoExpanded && (
              <View style={styles.sectionBody}>
                {/* Valor + Parcelas na mesma linha */}
                <View style={styles.rowFields}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>  
                    <Text style={styles.fieldLabel}>
                      Valor <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={valorEmprestimo ? `$ ${valorEmprestimo}` : ''}
                      onChangeText={handleValorEmprestimoChange}
                      placeholder="$ 1.000,00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      Parcelas <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={numeroParcelas}
                      onChangeText={(text) => {
                        const num = text.replace(/[^\d]/g, '');
                        setNumeroParcelas(num);
                      }}
                      placeholder="12"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </View>
                </View>

                {/* Taxa de juros */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Taxa de juros (%) <Text style={styles.required}>*</Text>
                  </Text>
                  
                  {!taxaJurosPersonalizada ? (
                    <View style={styles.taxaButtonsRow}>
                      {taxasPermitidas.map((taxa) => (
                        <TouchableOpacity
                          key={taxa}
                          style={[
                            styles.taxaButton,
                            taxaJuros === String(taxa) && styles.taxaButtonActive,
                          ]}
                          onPress={() => { setTaxaJuros(String(taxa)); setTaxaJurosPersonalizada(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.taxaButtonText,
                            taxaJuros === String(taxa) && styles.taxaButtonTextActive,
                          ]}>
                            {taxa}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.taxaButton, taxaJurosPersonalizada && styles.taxaButtonActive]}
                        onPress={() => { setTaxaJurosPersonalizada(true); setTaxaJuros(''); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.taxaButtonText,
                          taxaJurosPersonalizada && styles.taxaButtonTextActive,
                        ]}>
                          Outro
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.rowFields}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={taxaJuros}
                        onChangeText={(text) => setTaxaJuros(text.replace(/[^\d.,]/g, ''))}
                        placeholder="Ex: 18.5"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.taxaCancelBtn}
                        onPress={() => { setTaxaJurosPersonalizada(false); setTaxaJuros(''); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.taxaCancelBtnText}>Voltar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Frequência de pagamento */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Frequência de pagamento <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.frequenciaGrid}>
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
                        onPress={() => setFrequencia(freq.value)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.radioCircle,
                          frequencia === freq.value && styles.radioCircleActive,
                        ]}>
                          {frequencia === freq.value && <View style={styles.radioCircleDot} />}
                        </View>
                        <Text style={[
                          styles.radioLabel,
                          frequencia === freq.value && styles.radioLabelActive,
                        ]}>
                          {freq.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Dia da semana (SEMANAL) */}
                {frequencia === 'SEMANAL' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Dia da semana <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.selectField}
                      onPress={() => setShowDiaSemanaModal(true)}
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
                    <Text style={styles.fieldLabel}>
                      Dia do mês <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={diaMesPagamento}
                      onChangeText={(text) => {
                        const num = text.replace(/[^\d]/g, '');
                        const val = Math.min(31, Math.max(0, parseInt(num) || 0));
                        setDiaMesPagamento(num ? String(val) : '');
                      }}
                      placeholder="1-31"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                )}

                {/* Dias do mês (FLEXIVEL) */}
                {frequencia === 'FLEXIVEL' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      Dias de cobrança <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.diasGrid}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                        <TouchableOpacity
                          key={dia}
                          style={[
                            styles.diaGridItem,
                            diasMesFlexivel.includes(dia) && styles.diaGridItemActive,
                          ]}
                          onPress={() => toggleDiaFlexivel(dia)}
                          activeOpacity={0.6}
                        >
                          <Text style={[
                            styles.diaGridText,
                            diasMesFlexivel.includes(dia) && styles.diaGridTextActive,
                          ]}>
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

                    {/* Iniciar próximo mês */}
                    {diasMesFlexivel.length > 0 && (
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setIniciarProximoMes(!iniciarProximoMes)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, iniciarProximoMes && styles.checkboxActive]}>
                          {iniciarProximoMes && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>Iniciar cobrança no próximo mês</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Data 1º vencimento */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Data 1º vencimento <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectFieldText}>
                      {formatarData(dataPrimeiroVencimento)}
                    </Text>
                    <Text style={styles.selectFieldChevron}>📅</Text>
                  </TouchableOpacity>
                </View>

                {/* Observações */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Observações</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={observacoesEmprestimo}
                    onChangeText={setObservacoesEmprestimo}
                    placeholder="Anotações"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>

                {/* Cálculo automático */}
                {valorPrincipal > 0 && taxaNum > 0 && (
                  <View style={styles.calculoBox}>
                    <Text style={styles.calculoTitle}>CÁLCULO AUTOMÁTICO</Text>
                    <View style={styles.calculoRow}>
                      <Text style={styles.calculoLabel}>Valor total:</Text>
                      <Text style={styles.calculoValue}>$ {fmt(valorTotal)}</Text>
                    </View>
                    <View style={styles.calculoRow}>
                      <Text style={styles.calculoLabel}>Valor parcela:</Text>
                      <Text style={styles.calculoValue}>$ {fmt(valorParcela)}</Text>
                    </View>
                    <View style={styles.calculoRow}>
                      <Text style={styles.calculoLabel}>Total de juros:</Text>
                      <Text style={[styles.calculoValue, { color: '#EF4444' }]}>$ {fmt(totalJuros)}</Text>
                    </View>
                    <View style={[styles.calculoRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 }]}>
                      <Text style={[styles.calculoLabel, { fontWeight: '700' }]}>
                        {parcelasNum}x de
                      </Text>
                      <Text style={[styles.calculoValue, { fontWeight: '700', color: '#2563EB' }]}>
                        $ {fmt(valorParcela)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ================================================ */}
          {/* SEÇÃO: MICROSEGURO                               */}
          {/* ================================================ */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setMicroseguroExpanded(!microseguroExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>🔵</Text>
                <Text style={styles.sectionTitle}>MICROSEGURO</Text>
                <Text style={styles.sectionSubtitle}>(opcional)</Text>
              </View>
              <Text style={styles.sectionChevron}>{microseguroExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {microseguroExpanded && (
              <View style={styles.sectionBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Valor do microseguro</Text>
                  <TextInput
                    style={styles.input}
                    value={valorMicroseguro ? `$ ${valorMicroseguro}` : ''}
                    onChangeText={handleValorMicroseguroChange}
                    placeholder="$ 0,00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    ℹ️ O microseguro será cobrado junto com a primeira parcela.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ================================================ */}
          {/* RESUMO DA VENDA (formulário)                     */}
          {/* ================================================ */}
          <View style={[styles.section, styles.resumoSection]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>📋</Text>
                <Text style={styles.sectionTitle}>RESUMO DA VENDA</Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              {/* Bloco 1 - Cliente */}
              <View style={styles.resumoBloco}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Cliente:</Text>
                  <Text style={styles.resumoValue}>{nome || '—'}</Text>
                </View>
                {segmentoNome ? (
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>Segmento:</Text>
                    <Text style={styles.resumoValue}>{segmentoNome}</Text>
                  </View>
                ) : null}
              </View>

              {/* Bloco 2 - Valores */}
              <View style={styles.resumoBloco}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Empréstimo:</Text>
                  <Text style={styles.resumoValue}>$ {fmt(valorPrincipal)}</Text>
                </View>
                {totalJuros > 0 && (
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>+ Juros ({taxaJuros}%):</Text>
                    <Text style={[styles.resumoValue, { color: '#EF4444' }]}>$ {fmt(totalJuros)}</Text>
                  </View>
                )}
                <View style={styles.resumoRow}>
                  <Text style={[styles.resumoLabel, { fontWeight: '700' }]}>= Total:</Text>
                  <Text style={[styles.resumoValue, { fontWeight: '700' }]}>$ {fmt(valorTotal)}</Text>
                </View>
              </View>

              {/* Bloco 3 - Detalhes parcelas */}
              <View style={styles.resumoBloco}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabelSmall}>Parcelas:</Text>
                  <Text style={styles.resumoValueSmall}>{parcelasNum}x de $ {fmt(valorParcela)}</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabelSmall}>Frequência:</Text>
                  <Text style={styles.resumoValueSmall}>
                    {{ DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' }[frequencia] || frequencia}
                  </Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabelSmall}>1º Vencimento:</Text>
                  <Text style={styles.resumoValueSmall}>{formatarData(dataPrimeiroVencimento)}</Text>
                </View>
              </View>

              {/* Bloco 4 - Microseguro (condicional) */}
              {microValor > 0 && (
                <View style={styles.resumoBloco}>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>Microseguro:</Text>
                    <Text style={styles.resumoValue}>$ {fmt(microValor)}</Text>
                  </View>
                </View>
              )}

              {/* Total a receber */}
              <View style={styles.resumoTotal}>
                <Text style={styles.resumoTotalLabel}>💵 TOTAL A RECEBER:</Text>
                <Text style={styles.resumoTotalValue}>$ {fmt(valorTotal + microValor)}</Text>
              </View>
            </View>
          </View>

          {/* Espaço inferior */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Botão CONFIRMAR VENDA (fixo no rodapé) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            isValido() ? styles.confirmButtonEnabled : styles.confirmButtonDisabled,
            submitting && styles.confirmButtonDisabled,
          ]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={submitting || !isValido()}
        >
          {submitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.confirmButtonText}>Processando...</Text>
            </View>
          ) : (
            <Text style={[
              styles.confirmButtonText,
              !isValido() && styles.confirmButtonTextDisabled,
            ]}>
              ✓ CONFIRMAR VENDA
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ================================================ */}
      {/* MODAL: Resultado da Venda (RESUMO 2)             */}
      {/* ================================================ */}
      <Modal visible={showResultado} transparent animationType="fade" onRequestClose={handleFecharResultado}>
        <View style={styles.resultadoOverlay}>
          <View style={styles.resultadoCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header sucesso */}
              <View style={styles.resultadoHeader}>
                <Text style={styles.resultadoHeaderIcon}>✅</Text>
                <Text style={styles.resultadoHeaderTitle}>Venda Registrada!</Text>
                <Text style={styles.resultadoHeaderMsg}>{resultado?.mensagem}</Text>
              </View>

              {/* Bloco 1 - Cliente */}
              <View style={[styles.resultadoBloco, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.resultadoBlocoTitle}>👤 Cliente</Text>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>Nome:</Text>
                  <Text style={styles.resultadoValue}>{resultado?.cliente_nome}</Text>
                </View>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>Código:</Text>
                  <Text style={[styles.resultadoValue, { fontWeight: '700', color: '#2563EB' }]}>
                    #{resultado?.cliente_codigo}
                  </Text>
                </View>
              </View>

              {/* Bloco 2 - Empréstimo */}
              <View style={[styles.resultadoBloco, { backgroundColor: '#F0FDF4' }]}>
                <Text style={styles.resultadoBlocoTitle}>💰 Empréstimo</Text>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>Valor Total:</Text>
                  <Text style={styles.resultadoValue}>$ {fmt(resultado?.valor_total || 0)}</Text>
                </View>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>Valor Parcela:</Text>
                  <Text style={styles.resultadoValue}>$ {fmt(resultado?.valor_parcela || 0)}</Text>
                </View>
                {resultado?.microseguro_valor ? (
                  <View style={styles.resultadoRow}>
                    <Text style={styles.resultadoLabel}>Microseguro:</Text>
                    <Text style={styles.resultadoValue}>$ {fmt(resultado.microseguro_valor)}</Text>
                  </View>
                ) : null}
              </View>

              {/* Bloco 3 - Parcelas */}
              {resultado?.parcelas && resultado.parcelas.length > 0 && (
                <View style={[styles.resultadoBloco, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={styles.resultadoBlocoTitle}>
                    📅 Parcelas ({resultado.parcelas.length}x)
                  </Text>
                  {/* Header da tabela */}
                  <View style={styles.parcelaHeaderRow}>
                    <Text style={[styles.parcelaHeaderText, { width: 30 }]}>#</Text>
                    <Text style={[styles.parcelaHeaderText, { flex: 1 }]}>Vencimento</Text>
                    <Text style={[styles.parcelaHeaderText, { width: 100, textAlign: 'right' }]}>Valor</Text>
                  </View>
                  {resultado.parcelas.map((p: any) => (
                    <View key={p.numero} style={styles.parcelaRow}>
                      <Text style={[styles.parcelaText, { width: 30 }]}>{p.numero}</Text>
                      <Text style={[styles.parcelaText, { flex: 1 }]}>
                        {new Date(p.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </Text>
                      <Text style={[styles.parcelaText, { width: 100, textAlign: 'right' }]}>
                        $ {fmt(p.valor)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Botão Fechar */}
            <TouchableOpacity
              style={styles.resultadoCloseBtn}
              onPress={handleFecharResultado}
              activeOpacity={0.8}
            >
              <Text style={styles.resultadoCloseBtnText}>✓ Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================ */}
      {/* MODAL: Seleção de DDI                            */}
      {/* ================================================ */}
      <Modal visible={showDdiModal} transparent animationType="fade" onRequestClose={() => setShowDdiModal(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDdiModal(false)}>
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecione o país</Text>
              <TouchableOpacity onPress={() => setShowDdiModal(false)}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {DDI_LIST.map((ddi) => {
                const ddiAtivo = ddiTarget === 'celular' ? ddiCelular : ddiFixo;
                return (
                  <TouchableOpacity
                    key={ddi.codigo}
                    style={[
                      styles.pickerItem,
                      ddiAtivo === ddi.codigo && styles.pickerItemActive,
                    ]}
                    onPress={() => handleSelectDdi(ddi)}
                    activeOpacity={0.6}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      ddiAtivo === ddi.codigo && styles.pickerItemTextActive,
                    ]}>
                      {ddi.pais}
                    </Text>
                    <Text style={[
                      styles.pickerItemCode,
                      ddiAtivo === ddi.codigo && styles.pickerItemTextActive,
                    ]}>
                      {ddi.codigo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ================================================ */}
      {/* MODAL: Seleção de Segmento                       */}
      {/* ================================================ */}
      <Modal
        visible={showSegmentoModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowSegmentoModal(false); setSegmentoBusca(''); }}
        onShow={() => setTimeout(() => segmentoBuscaRef.current?.focus(), 300)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => { setShowSegmentoModal(false); setSegmentoBusca(''); }}>
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecione o segmento</Text>
              <TouchableOpacity onPress={() => { setShowSegmentoModal(false); setSegmentoBusca(''); }}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Campo de busca */}
            <View style={styles.pickerSearchWrapper}>
              <TextInput
                ref={segmentoBuscaRef}
                style={styles.pickerSearchInput}
                value={segmentoBusca}
                onChangeText={setSegmentoBusca}
                placeholder="Buscar segmento..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {segmentoBusca.length > 0 && (
                <TouchableOpacity style={styles.pickerSearchClear} onPress={() => setSegmentoBusca('')}>
                  <Text style={styles.pickerSearchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {segmentosLoading ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator color="#2563EB" />
                <Text style={styles.pickerLoadingText}>Carregando segmentos...</Text>
              </View>
            ) : (
              <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Opção vazia */}
                {segmentoBusca.length === 0 && (
                  <TouchableOpacity
                    style={[styles.pickerItem, !segmentoId && styles.pickerItemActive]}
                    onPress={() => { setSegmentoId(null); setSegmentoNome(''); setShowSegmentoModal(false); setSegmentoBusca(''); }}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.pickerItemText, { fontStyle: 'italic', color: '#9CA3AF' }]}>
                      Nenhum segmento
                    </Text>
                  </TouchableOpacity>
                )}

                {segmentos.map((grupo) => {
                  // Filtrar itens pela busca
                  const busca = segmentoBusca.toLowerCase().trim();
                  const itensFiltrados = busca
                    ? grupo.itens.filter(seg =>
                        seg.nome_pt.toLowerCase().includes(busca) ||
                        grupo.grupo.toLowerCase().includes(busca)
                      )
                    : grupo.itens;

                  if (itensFiltrados.length === 0) return null;

                  return (
                    <View key={grupo.grupo}>
                      <View style={styles.pickerGroupHeader}>
                        <Text style={styles.pickerGroupTitle}>{grupo.grupo}</Text>
                      </View>
                      {itensFiltrados.map((seg) => (
                        <TouchableOpacity
                          key={seg.id}
                          style={[
                            styles.pickerItem,
                            styles.pickerItemIndented,
                            segmentoId === seg.id && styles.pickerItemActive,
                          ]}
                          onPress={() => { handleSelectSegmento(seg); setSegmentoBusca(''); }}
                          activeOpacity={0.6}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            segmentoId === seg.id && styles.pickerItemTextActive,
                          ]}>
                            {seg.nome_pt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}

                {/* Nenhum resultado */}
                {segmentoBusca.length > 0 && segmentos.every(g => {
                  const busca = segmentoBusca.toLowerCase().trim();
                  return g.itens.filter(s => s.nome_pt.toLowerCase().includes(busca) || g.grupo.toLowerCase().includes(busca)).length === 0;
                }) && (
                  <View style={styles.pickerLoading}>
                    <Text style={styles.pickerLoadingText}>Nenhum segmento encontrado</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
      {/* ================================================ */}
      {/* MODAL: Seleção de Dia da Semana                  */}
      {/* ================================================ */}
      <Modal visible={showDiaSemanaModal} transparent animationType="fade" onRequestClose={() => setShowDiaSemanaModal(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDiaSemanaModal(false)}>
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Dia da semana</Text>
              <TouchableOpacity onPress={() => setShowDiaSemanaModal(false)}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {DIAS_SEMANA.map((dia) => (
                <TouchableOpacity
                  key={dia.value}
                  style={[
                    styles.pickerItem,
                    diaSemanaPagamento === dia.value && styles.pickerItemActive,
                  ]}
                  onPress={() => { setDiaSemanaPagamento(dia.value); setShowDiaSemanaModal(false); }}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.pickerItemText,
                    diaSemanaPagamento === dia.value && styles.pickerItemTextActive,
                  ]}>
                    {dia.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ================================================ */}
      {/* MODAL: Calendário para seleção de data           */}
      {/* ================================================ */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)}>
          <View style={[styles.pickerCard, { maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Data do 1º vencimento</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <CalendarioSelector
              dataSelecionada={dataPrimeiroVencimento}
              onSelect={(dateStr) => {
                setDataPrimeiroVencimento(dateStr);
                setShowDatePicker(false);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  // Header
  header: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCloseBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },

  // Seções
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
    marginLeft: 4,
  },
  sectionChevron: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sectionBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Campos
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },

  // Row fields (DDI + telefone)
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  ddiSelector: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
  },
  ddiText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  ddiChevron: {
    fontSize: 10,
    color: '#9CA3AF',
  },

  // Select field (Segmento)
  selectField: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectFieldText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  selectFieldPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
    flex: 1,
  },
  selectFieldChevron: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  // Foto
  photoContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  photoPlaceholderIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  photoPlaceholderText: {
    fontSize: 13,
    color: '#6B7280',
  },
  photoPreviewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowColor: 'transparent',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Taxa de juros
  taxaButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taxaButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    minWidth: 56,
    alignItems: 'center',
  },
  taxaButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  taxaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  taxaButtonTextActive: {
    color: '#fff',
  },
  taxaCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
  },
  taxaCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  frequenciaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  radioOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#2563EB',
  },
  radioCircleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  radioLabel: {
    fontSize: 14,
    color: '#374151',
  },
  radioLabelActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  diasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  diaGridItem: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaGridItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  diaGridText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  diaGridTextActive: {
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxCheck: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  calculoBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  calculoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  calculoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calculoLabel: {
    fontSize: 14,
    color: '#374151',
  },
  calculoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  resumoSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    backgroundColor: '#F8FAFF',
  },
  resumoBloco: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
    marginBottom: 10,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  resumoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  resumoLabelSmall: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resumoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  resumoValueSmall: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  resumoTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  resumoTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  resumoTotalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Botão confirmar - estados
  confirmButtonEnabled: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  confirmButtonTextDisabled: {
    color: '#9CA3AF',
  },

  // Modal Resultado
  resultadoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultadoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  resultadoHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  resultadoHeaderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  resultadoHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  resultadoHeaderMsg: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
  },
  resultadoBloco: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
  },
  resultadoBlocoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  resultadoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  resultadoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  resultadoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  parcelaHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  parcelaHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  parcelaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  parcelaText: {
    fontSize: 13,
    color: '#374151',
  },
  resultadoCloseBtn: {
    backgroundColor: '#16A34A',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  resultadoCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Picker modais
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '88%',
    maxHeight: '70%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  pickerCloseText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerSearchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerSearchInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  pickerSearchClear: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerSearchClearText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerItemIndented: {
    paddingLeft: 32,
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#374151',
  },
  pickerItemTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  pickerItemCode: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  pickerGroupHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  pickerGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerLoading: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  pickerLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
});