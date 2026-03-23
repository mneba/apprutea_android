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
// TRADUÇÕES
// ============================================================
type Lang = 'pt-BR' | 'es';
const textos = {
  'pt-BR': {
    // Header
    tituloRenegociacao: 'RENEGOCIAÇÃO', tituloRenovacao: 'RENOVAÇÃO', tituloNovaVenda: 'NOVA VENDA',
    // Seções
    secCliente: 'CLIENTE', secEmprestimo: 'EMPRÉSTIMO', secMicroseguro: 'MICROSEGURO',
    secCalculo: 'CÁLCULO AUTOMÁTICO', secResumo: 'RESUMO DA VENDA',
    // Labels cliente
    documento: 'Documento', telefoneFixo: 'Telefone fixo', email: 'Email',
    endResidencial: 'Endereço Residencial', endComercial: 'Endereço Comercial',
    segmento: 'Segmento', fotoCliente: 'Foto do cliente', observacoes: 'Observações',
    cliqueFoto: 'Clique para adicionar foto',
    // Placeholders
    phNomeCliente: 'Nome do cliente', phDoc: '123.456.789-00',
    phTelefone: 'Apenas números', phEmail: 'email@exemplo.com',
    phEndRes: 'Rua, número, bairro', phEndCom: 'Rua, número, loja',
    phObs: 'Anotações sobre o cliente', phObsEmp: 'Anotações',
    phJuros: 'Ex: 18.5',
    // Empréstimo
    voltar: 'Voltar',
    iniciarProxMes: 'Iniciar cobrança no próximo mês',
    // Cálculo
    valorTotal: 'Valor total:', valorParcela: 'Valor parcela:', totalJuros: 'Total de juros:',
    // Microseguro
    opcional: '(opcional)', valorMicroseguro: 'Valor do microseguro',
    // Resumo
    lblCliente: 'Cliente:', lblSegmento: 'Segmento:', lblEmprestimo: 'Empréstimo:',
    lblTotal: '= Total:', lblParcelas: 'Parcelas:', lblFrequencia: 'Frequência:',
    lblVencimento: '1º Vencimento:', lblMicroseguro: 'Microseguro:',
    totalReceber: '💵 TOTAL A RECEBER:',
    // Confirmação
    processando: 'Processando...',
    vendaRegistrada: 'Venda Registrada!',
    secClienteConf: '👤 Cliente', nome: 'Nome:', codigo: 'Código:',
    secEmprestimoConf: '💰 Empréstimo', valorTotalConf: 'Valor Total:',
    valorParcelaConf: 'Valor Parcela:', microseguroConf: 'Microseguro:',
    vencimento: 'Vencimento', valor: 'Valor',
    fechar: '✓ Fechar',
    // Modais auxiliares
    selecionePais: 'Selecione o país',
    selecioneSegmento: 'Selecione o segmento',
    buscarSegmento: 'Buscar segmento...',
    carregandoSegmentos: 'Carregando segmentos...',
    nenhumSegmento: 'Nenhum segmento encontrado',
    diaSemana: 'Dia da semana', dataPrimVenc: 'Data do 1º vencimento',
    selecione: 'Selecione',
    // Dias da semana
    domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira',
    quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado',
    // Frequências
    freqDiario: 'Diário', freqSemanal: 'Semanal', freqQuinzenal: 'Quinzenal', freqMensal: 'Mensal',
    // Alerts
    permissaoNecessaria: 'Permissão necessária',
    permissaoCameraMsg: 'Precisamos de acesso à câmera para tirar a foto.',
    permissaoGaleriaMsg: 'Precisamos de acesso à galeria.',
    erro: 'Erro', erroFoto: 'Não foi possível capturar a foto.',
    fotoCliente2: 'Foto do cliente', fotoMsg: 'Como deseja adicionar a foto?',
    camera: 'Câmera', galeria: 'Galeria', removerFoto: 'Remover foto',
    dadosIncompletos: 'Dados incompletos', dadosIncompletosMsg: 'Preencha todos os campos obrigatórios marcados com *.',
    campoObrigatorio: 'Campo obrigatório',
    selecioneDiaSemana: 'Selecione o dia da semana para cobrança.',
    informeDiaMes: 'Informe o dia do mês para cobrança.',
    selecionePeloMenosDia: 'Selecione pelo menos um dia de cobrança.',
    erroAutenticacao: 'Erro de autenticação', sessaoExpirada: 'Sessão expirada. Faça login novamente.',
    liquidacaoNaoEncontrada: 'Liquidação não encontrada',
    liquidacaoNaoEncontradaMsg: 'Nenhuma liquidação aberta encontrada. Abra uma liquidação antes de registrar vendas.',
    cancelarVenda: 'Cancelar venda?', cancelarMsg: 'Os dados preenchidos serão perdidos.',
    simCancelar: 'Sim, cancelar', nao: 'Não',
  },
  'es': {
    tituloRenegociacao: 'RENEGOCIACIÓN', tituloRenovacao: 'RENOVACIÓN', tituloNovaVenda: 'NUEVA VENTA',
    secCliente: 'CLIENTE', secEmprestimo: 'PRÉSTAMO', secMicroseguro: 'MICROSEGURO',
    secCalculo: 'CÁLCULO AUTOMÁTICO', secResumo: 'RESUMEN DE VENTA',
    documento: 'Documento', telefoneFixo: 'Teléfono fijo', email: 'Email',
    endResidencial: 'Dirección Residencial', endComercial: 'Dirección Comercial',
    segmento: 'Segmento', fotoCliente: 'Foto del cliente', observacoes: 'Observaciones',
    cliqueFoto: 'Toque para agregar foto',
    phNomeCliente: 'Nombre del cliente', phDoc: '123.456.789-00',
    phTelefone: 'Solo números', phEmail: 'email@ejemplo.com',
    phEndRes: 'Calle, número, barrio', phEndCom: 'Calle, número, local',
    phObs: 'Notas sobre el cliente', phObsEmp: 'Notas',
    phJuros: 'Ej: 18.5',
    voltar: 'Volver',
    iniciarProxMes: 'Iniciar cobro el próximo mes',
    valorTotal: 'Valor total:', valorParcela: 'Valor cuota:', totalJuros: 'Total intereses:',
    opcional: '(opcional)', valorMicroseguro: 'Valor del microseguro',
    lblCliente: 'Cliente:', lblSegmento: 'Segmento:', lblEmprestimo: 'Préstamo:',
    lblTotal: '= Total:', lblParcelas: 'Cuotas:', lblFrequencia: 'Frecuencia:',
    lblVencimento: '1º Vencimiento:', lblMicroseguro: 'Microseguro:',
    totalReceber: '💵 TOTAL A RECIBIR:',
    processando: 'Procesando...',
    vendaRegistrada: '¡Venta Registrada!',
    secClienteConf: '👤 Cliente', nome: 'Nombre:', codigo: 'Código:',
    secEmprestimoConf: '💰 Préstamo', valorTotalConf: 'Valor Total:',
    valorParcelaConf: 'Valor Cuota:', microseguroConf: 'Microseguro:',
    vencimento: 'Vencimiento', valor: 'Valor',
    fechar: '✓ Cerrar',
    selecionePais: 'Seleccione el país',
    selecioneSegmento: 'Seleccione el segmento',
    buscarSegmento: 'Buscar segmento...',
    carregandoSegmentos: 'Cargando segmentos...',
    nenhumSegmento: 'Ningún segmento encontrado',
    diaSemana: 'Día de la semana', dataPrimVenc: 'Fecha del 1º vencimiento',
    selecione: 'Seleccione',
    domingo: 'Domingo', segunda: 'Lunes', terca: 'Martes',
    quarta: 'Miércoles', quinta: 'Jueves', sexta: 'Viernes', sabado: 'Sábado',
    freqDiario: 'Diario', freqSemanal: 'Semanal', freqQuinzenal: 'Quincenal', freqMensal: 'Mensual',
    permissaoNecessaria: 'Permiso necesario',
    permissaoCameraMsg: 'Necesitamos acceso a la cámara para tomar la foto.',
    permissaoGaleriaMsg: 'Necesitamos acceso a la galería.',
    erro: 'Error', erroFoto: 'No fue posible capturar la foto.',
    fotoCliente2: 'Foto del cliente', fotoMsg: '¿Cómo desea agregar la foto?',
    camera: 'Cámara', galeria: 'Galería', removerFoto: 'Quitar foto',
    dadosIncompletos: 'Datos incompletos', dadosIncompletosMsg: 'Complete todos los campos obligatorios marcados con *.',
    campoObrigatorio: 'Campo obligatorio',
    selecioneDiaSemana: 'Seleccione el día de la semana para cobro.',
    informeDiaMes: 'Informe el día del mes para cobro.',
    selecionePeloMenosDia: 'Seleccione al menos un día de cobro.',
    erroAutenticacao: 'Error de autenticación', sessaoExpirada: 'Sesión expirada. Inicie sesión nuevamente.',
    liquidacaoNaoEncontrada: 'Liquidación no encontrada',
    liquidacaoNaoEncontradaMsg: 'Ninguna liquidación abierta. Abra una liquidación antes de registrar ventas.',
    cancelarVenda: '¿Cancelar venta?', cancelarMsg: 'Los datos ingresados se perderán.',
    simCancelar: 'Sí, cancelar', nao: 'No',
  },
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function NovaVendaScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();
  const liqCtx = useLiquidacaoContext();
  const lang = liqCtx.language;
  const t = textos[lang];
  const clienteExistente = route?.params?.clienteExistente || null;
  const renegociacao = route?.params?.renegociacao || null;
  const isRenegociacao = !!renegociacao;

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
  const [fotoCliente, setFotoCliente] = useState<string | null>(null);
  const [observacoesCliente, setObservacoesCliente] = useState('');

  // -----------------------------------------------------------
  // POPUP BUSCA POR DOCUMENTO (somente fluxo novo cliente)
  // -----------------------------------------------------------
  const [modalDocVisible, setModalDocVisible] = useState(!clienteExistente && !isRenegociacao);
  const [docBusca, setDocBusca] = useState('');
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [clienteEncontradoId, setClienteEncontradoId] = useState<string | null>(null);
  const [tipoEmprestimoDetectado, setTipoEmprestimoDetectado] = useState<'RENOVACAO' | 'ADICIONAL' | null>(null);

  const buscarClientePorDocumento = async () => {
    const doc = docBusca.replace(/\D/g, '');
    if (!doc) return;
    setBuscandoDoc(true);
    try {
      const docSemMask = docBusca.replace(/\D/g, '');
      // Busca pelo documento com e sem formatação
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome, documento, telefone_celular, endereco, codigo_cliente, permite_emprestimo_adicional, permite_renegociacao')
        .or(`documento.ilike.%${docSemMask}%,documento.ilike.%${docBusca}%`)
        .limit(1);

      const cli = clientes?.[0];
      if (!cli) {
        // Novo cliente — pré-preenche documento e fecha popup
        setDocumento(docBusca);
        setModalDocVisible(false);
        return;
      }

      // Cliente encontrado — verificar empréstimos
      const { data: emps } = await supabase
        .from('emprestimos')
        .select('id, status, valor_saldo')
        .eq('cliente_id', cli.id)
        .in('status', ['ATIVO', 'VENCIDO'])
        .order('created_at', { ascending: false })
        .limit(1);

      const emp = emps?.[0];

      if (!emp) {
        // Já teve empréstimo mas não tem ativo — renovação
        // Preenche dados do cliente e fecha popup com aviso
        setNome(cli.nome || '');
        setTelefoneCelular(cli.telefone_celular || '');
        setDocumento(cli.documento || docBusca);
        setEndereco(cli.endereco || '');
        setClienteEncontradoId(cli.id);
        setTipoEmprestimoDetectado('RENOVACAO');
        setModalDocVisible(false);
        const msg = lang === 'es'
          ? `Cliente encontrado: ${cli.nome}. Este es un préstamo de renovación.`
          : `Cliente encontrado: ${cli.nome}. Este é um empréstimo de renovação.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(lang === 'es' ? 'Renovación' : 'Renovação', msg, [{ text: 'OK' }]);
        return;
      }

      // Tem empréstimo ativo — verificar parcelas atrasadas
      const { data: atrasadas } = await supabase
        .from('emprestimo_parcelas')
        .select('id')
        .eq('emprestimo_id', emp.id)
        .eq('status', 'VENCIDO')
        .limit(1);

      const temAtraso = (atrasadas?.length || 0) > 0;
      const permiteAdicional = cli.permite_emprestimo_adicional === true;
      const permiteReneg = cli.permite_renegociacao === true;

      if (temAtraso) {
        if (permiteReneg) {
          // Autorizado para renegociar — preenche dados e avisa
          setNome(cli.nome || '');
          setTelefoneCelular(cli.telefone_celular || '');
          setDocumento(cli.documento || docBusca);
          setEndereco(cli.endereco || '');
          setClienteEncontradoId(cli.id);
          setTipoEmprestimoDetectado('RENOVACAO');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Está autorizado para renegociar la deuda. Complete los datos del nuevo préstamo.`
            : `Cliente encontrado: ${cli.nome}. Está autorizado para renegociar a dívida. Preencha os dados do novo empréstimo.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Renegociación autorizada' : 'Renegociação autorizada', msg, [{ text: 'OK' }]);
        } else {
          // Sem autorização
          const titulo = lang === 'es' ? 'Parcelas atrasadas' : 'Parcelas atrasadas';
          const msg = lang === 'es'
            ? `El cliente ${cli.nome} tiene parcelas atrasadas. Solicite autorización al administrador para renegociar la deuda.`
            : `O cliente ${cli.nome} tem parcelas atrasadas. Solicite autorização ao administrador para renegociar a dívida.`;
          if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
          else Alert.alert(titulo, msg, [{ text: 'OK' }]);
        }
      } else {
        if (permiteAdicional) {
          // Autorizado para empréstimo adicional — preenche dados e avisa
          setNome(cli.nome || '');
          setTelefoneCelular(cli.telefone_celular || '');
          setDocumento(cli.documento || docBusca);
          setEndereco(cli.endereco || '');
          setClienteEncontradoId(cli.id);
          setTipoEmprestimoDetectado('ADICIONAL');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Está autorizado a recibir un préstamo adicional. Complete los datos del nuevo préstamo.`
            : `Cliente encontrado: ${cli.nome}. Está autorizado a receber um novo empréstimo. Preencha os dados do empréstimo.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Préstamo adicional autorizado' : 'Empréstimo adicional autorizado', msg, [{ text: 'OK' }]);
        } else {
          // Sem autorização
          const titulo = lang === 'es' ? 'Préstamo activo' : 'Empréstimo ativo';
          const msg = lang === 'es'
            ? `El cliente ${cli.nome} tiene un préstamo vigente. Solicite autorización al administrador para un préstamo adicional.`
            : `O cliente ${cli.nome} tem um empréstimo em dia. Solicite autorização ao administrador para um empréstimo adicional.`;
          if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
          else Alert.alert(titulo, msg, [{ text: 'OK' }]);
        }
      }
    } catch (e) {
      console.error('Erro busca documento:', e);
    } finally {
      setBuscandoDoc(false);
    }
  };
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
  const [taxasPermitidas, setTaxasPermitidas] = useState<number[]>([5, 10, 15, 20, 25]);
  const [frequencia, setFrequencia] = useState('DIARIO');
  const [diaSemanaPagamento, setDiaSemanaPagamento] = useState('1'); // Segunda
  const [diaMesPagamento, setDiaMesPagamento] = useState('15');
  const [diasMesFlexivel, setDiasMesFlexivel] = useState<number[]>([]);
  const [iniciarProximoMes, setIniciarProximoMes] = useState(false);
  const amanha = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(amanha());
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
  // CARREGAR DADOS DO EMPRÉSTIMO ORIGINAL (RENEGOCIAÇÃO)
  // -----------------------------------------------------------
  useEffect(() => {
    if (!isRenegociacao || !renegociacao?.emprestimo_id) return;
    (async () => {
      try {
        const { data: emp } = await supabase
          .from('emprestimos')
          .select('valor_saldo, valor_parcela, numero_parcelas, taxa_juros, frequencia_pagamento, dia_semana_cobranca, dia_mes_cobranca, dias_mes_cobranca')
          .eq('id', renegociacao.emprestimo_id)
          .single();
        if (emp) {
          setValorEmprestimo(String(Math.round(emp.valor_saldo || 0)));
          setNumeroParcelas(String(emp.numero_parcelas || 12));
          if (emp.taxa_juros != null) setTaxaJuros(String(emp.taxa_juros));
          if (emp.frequencia_pagamento) setFrequencia(emp.frequencia_pagamento);
          if (emp.dia_semana_cobranca != null) setDiaSemanaPagamento(String(emp.dia_semana_cobranca));
          if (emp.dia_mes_cobranca != null) setDiaMesPagamento(String(emp.dia_mes_cobranca));
          if (emp.dias_mes_cobranca) setDiasMesFlexivel(emp.dias_mes_cobranca);
          console.log('📋 Dados do empréstimo original carregados:', { saldo: emp.valor_saldo, freq: emp.frequencia_pagamento, parcelas: emp.numero_parcelas });
        }
      } catch (e) { console.error('Erro ao carregar empréstimo original:', e); }
    })();
  }, [isRenegociacao, renegociacao?.emprestimo_id]);

  // -----------------------------------------------------------
  // CARREGAR SEGMENTOS E TAXAS PERMITIDAS
  // -----------------------------------------------------------
  useEffect(() => {
    loadSegmentos();
    loadTaxasPermitidas();
  }, []);

  const [taxasLivre, setTaxasLivre] = useState(false); // true = qualquer taxa permitida

  const loadTaxasPermitidas = async () => {
    if (!vendedor?.id) return;
    try {
      const { data, error } = await supabase
        .rpc('fn_listar_taxas_juros', { p_vendedor_id: vendedor.id });

      if (!error && data) {
        // Se algum registro tem is_livre=true OU lista vazia → qualquer taxa é permitida
        const livre = data.length === 0 || data.some((r: any) => r.is_livre === true);
        if (livre) {
          setTaxasLivre(true);
          // Mantém botões padrão só como atalho visual, mas não bloqueia taxa personalizada
          setTaxasPermitidas([5, 10, 15, 20, 25]);
        } else {
          setTaxasLivre(false);
          const taxas = data.map((r: any) => Number(r.taxa)).filter((t: number) => t > 0);
          if (taxas.length > 0) setTaxasPermitidas(taxas);
        }
      } else {
        // Erro na RPC → assume livre (não bloqueia o vendedor)
        setTaxasLivre(true);
      }
    } catch (err) {
      console.error('Erro ao carregar taxas:', err);
      setTaxasLivre(true);
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
  // Formata número para exibição: 500 → "500,00", 500.5 → "500,50"
  // Entrada natural: digita 500 = R$ 500, digita 0.5 = R$ 0,50
  const parseMoeda = (valor: string): number =>
    parseFloat((valor || '').replace(',', '.')) || 0;

  const handleValorEmprestimoChange = (text: string) => {
    setValorEmprestimo(text.replace(/[^\d.,]/g, '').replace(',', '.'));
  };

  const handleValorMicroseguroChange = (text: string) => {
    setValorMicroseguro(text.replace(/[^\d.,]/g, '').replace(',', '.'));
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
        Alert.alert(t.permissaoNecessaria, t.permissaoCameraMsg);
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
    Alert.alert(t.fotoCliente2, t.fotoMsg, [
      { text: t.camera, onPress: handlePickPhoto },
      { text: t.galeria, onPress: handlePickFromGallery },
      ...(fotoCliente ? [{ text: t.removerFoto, style: 'destructive' as const, onPress: () => setFotoCliente(null) }] : []),
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
    setDataPrimeiroVencimento(amanha());
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
      Alert.alert(t.dadosIncompletos, t.dadosIncompletosMsg);
      return;
    }

    if (frequencia === 'SEMANAL' && !diaSemanaPagamento) {
      Alert.alert(t.campoObrigatorio, t.selecioneDiaSemana);
      return;
    }
    if (frequencia === 'MENSAL' && !diaMesPagamento) {
      Alert.alert(t.campoObrigatorio, t.informeDiaMes);
      return;
    }
    if (frequencia === 'FLEXIVEL' && diasMesFlexivel.length === 0) {
      Alert.alert(t.campoObrigatorio, t.selecionePeloMenosDia);
      return;
    }

    // ETAPA 2 - Verificar IDs de contexto
    const vendedorId = vendedor?.id;
    const userId = vendedor?.user_id;
    let empresaId = vendedor?.empresa_id || null;
    let rotaId = vendedor?.rota_id || null;

    if (!userId) {
      Alert.alert(t.erroAutenticacao, t.sessaoExpirada);
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
      let data: any, error: any;

      if (isRenegociacao) {
        // RENEGOCIAÇÃO - empréstimo existente com atraso
        // Buscar liquidação aberta da rota
        let liqId = liqCtx.liquidacaoAtual?.id || null;
        if (!liqId) {
          const { data: liqData } = await supabase
            .from('liquidacoes_diarias')
            .select('id')
            .eq('rota_id', rotaId)
            .in('status', ['ABERTO', 'REABERTO'])
            .limit(1)
            .single();
          liqId = liqData?.id || null;
        }
        if (!liqId) {
          const msg = 'Não há liquidação aberta para esta rota. Inicie o dia primeiro.';
          if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Erro', msg); }
          return;
        }
        const paramsReneg: Record<string, any> = {
          p_emprestimo_original_id: renegociacao.emprestimo_id,
          p_novo_valor_principal: valorPrincipal,
          p_numero_parcelas: parseInt(numeroParcelas),
          p_taxa_juros: parseFloat(taxaJuros.replace(',', '.')) || 0,
          p_frequencia_pagamento: frequencia,
          p_data_primeiro_vencimento: dataPrimeiroVencimento,
          p_user_id: userId,
          p_liquidacao_id: liqId,
          p_observacoes: observacoesEmprestimo.trim() || null,
          p_dia_semana_cobranca: frequencia === 'SEMANAL' ? parseInt(diaSemanaPagamento) : null,
          p_dia_mes_cobranca: frequencia === 'MENSAL' ? parseInt(diaMesPagamento) : null,
          p_dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesFlexivel : null,
          p_iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : false,
          p_latitude: latitude,
          p_longitude: longitude,
          p_microseguro_valor: microValor > 0 ? microValor : null,
        };
        console.log('🔄 Renegociação - chamando fn_renegociar_emprestimo para:', renegociacao.cliente_nome, 'liqId:', liqId);
        ({ data, error } = await supabase.rpc('fn_renegociar_emprestimo', paramsReneg));
      } else if (clienteExistente?.id || clienteEncontradoId) {
        const clienteId = clienteExistente?.id || clienteEncontradoId;
        const isAdicional = tipoEmprestimoDetectado === 'ADICIONAL';

        // Atualiza dados cadastrais do cliente
        const updateData: Record<string, any> = {};
        if (nome.trim()) updateData.nome = nome.trim();
        if (documento.trim()) updateData.documento = documento.trim();
        if (telefoneCelular) updateData.telefone_celular = `${ddiCelular}${telefoneCelular}`;
        if (telefoneFixo) updateData.telefone_fixo = `${ddiFixo}${telefoneFixo}`;
        if (email.trim()) updateData.email = email.trim();
        if (endereco.trim()) updateData.endereco = endereco.trim();
        if (enderecoComercial.trim()) updateData.endereco_comercial = enderecoComercial.trim();
        if (observacoesCliente.trim()) updateData.observacoes = observacoesCliente.trim();

        if (Object.keys(updateData).length > 0 && clienteId) {
          await supabase.from('clientes').update(updateData).eq('id', clienteId);
        }

        if (isAdicional) {
          // ADICIONAL — cliente tem empréstimo ativo, usa fn_nova_venda_completa com tipo ADICIONAL
          console.log('➕ Adicional - chamando fn_nova_venda_completa ADICIONAL para:', nome);
          const paramsAdic: Record<string, any> = {
            p_cliente_id: clienteId,
            p_cliente_nome: nome.trim(),
            p_cliente_documento: documento.trim() || null,
            p_cliente_telefone: telefoneCelular ? `${ddiCelular}${telefoneCelular}` : null,
            p_cliente_endereco: endereco.trim() || null,
            p_valor_principal: valorPrincipal,
            p_numero_parcelas: parseInt(numeroParcelas),
            p_taxa_juros: parseFloat(taxaJuros.replace(',', '.')) || 0,
            p_frequencia_pagamento: frequencia,
            p_data_primeiro_vencimento: dataPrimeiroVencimento,
            p_dia_semana_cobranca: frequencia === 'SEMANAL' ? parseInt(diaSemanaPagamento) : null,
            p_dia_mes_cobranca: frequencia === 'MENSAL' ? parseInt(diaMesPagamento) : null,
            p_dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesFlexivel : null,
            p_iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : false,
            p_tipo_emprestimo: 'ADICIONAL',
            p_observacoes: observacoesEmprestimo.trim() || null,
            p_microseguro_valor: microValor > 0 ? microValor : null,
            p_empresa_id: empresaId,
            p_rota_id: rotaId,
            p_vendedor_id: vendedorId,
            p_liquidacao_id: liqId,
            p_user_id: userId,
            p_latitude: latitude,
            p_longitude: longitude,
          };
          ({ data, error } = await supabase.rpc('fn_nova_venda_completa', paramsAdic));
        } else {
          // RENOVAÇÃO — empréstimo quitado, usa fn_renovar_emprestimo
          console.log('🔄 Renovação - chamando fn_renovar_emprestimo para:', clienteExistente?.nome || nome);
          const paramsRenov: Record<string, any> = {
            p_cliente_id: clienteId,
            p_valor_principal: valorPrincipal,
            p_numero_parcelas: parseInt(numeroParcelas),
            p_taxa_juros: parseFloat(taxaJuros.replace(',', '.')) || 0,
            p_frequencia: frequencia,
            p_data_primeiro_vencimento: dataPrimeiroVencimento,
            p_dia_semana_cobranca: frequencia === 'SEMANAL' ? parseInt(diaSemanaPagamento) : null,
            p_dia_mes_cobranca: frequencia === 'MENSAL' ? parseInt(diaMesPagamento) : null,
            p_dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesFlexivel : null,
            p_iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : false,
            p_observacoes: observacoesEmprestimo.trim() || null,
            p_microseguro_valor: microValor > 0 ? microValor : null,
            p_empresa_id: empresaId,
            p_rota_id: rotaId,
            p_vendedor_id: vendedorId,
            p_user_id: userId,
            p_latitude: latitude,
            p_longitude: longitude,
          };
          ({ data, error } = await supabase.rpc('fn_renovar_emprestimo', paramsRenov));
        }
      } else {
        // VENDA NOVA - cliente novo
        const params: Record<string, any> = {
          p_cliente_id: null,
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
          p_microseguro_valor: microValor > 0 ? microValor : null,
          p_empresa_id: empresaId,
          p_rota_id: rotaId,
          p_vendedor_id: vendedorId,
          p_user_id: userId,
          p_latitude: latitude,
          p_longitude: longitude,
        };
        console.log('🆕 Venda nova - chamando fn_nova_venda_completa');
        ({ data, error } = await supabase.rpc('fn_nova_venda_completa', params));
      }

      if (error) throw error;

      // ETAPA 6 - Tratamento da resposta
      const raw = Array.isArray(data) ? data[0] : data;
      
      // Normaliza campos - fn_renovar/renegociar retornam com campos diferentes
      let codigoCliente = renegociacao?.codigo_cliente || null;
      if (isRenegociacao && !codigoCliente) {
        const { data: cliData } = await supabase.from('clientes').select('codigo_cliente').eq('id', renegociacao.cliente_id).single();
        codigoCliente = cliData?.codigo_cliente || null;
      }
      const res = isRenegociacao ? {
        sucesso: raw?.sucesso,
        mensagem: 'Renegociação registrada com sucesso',
        cliente_id: renegociacao.cliente_id,
        cliente_nome: renegociacao.cliente_nome,
        cliente_codigo: codigoCliente,
        emprestimo_id: raw?.novo_emprestimo_id,
        valor_total: raw?.novo_valor_principal,
        valor_parcela: parseInt(numeroParcelas) > 0 ? (raw?.novo_valor_principal || 0) / parseInt(numeroParcelas) : 0,
        microseguro_id: null,
        microseguro_valor: microValor > 0 ? microValor : null,
        parcelas: null,
        saldo_anterior: raw?.saldo_anterior,
        parcelas_canceladas: raw?.parcelas_canceladas,
      } : clienteExistente?.id ? {
        sucesso: raw?.sucesso,
        mensagem: raw?.mensagem,
        cliente_id: raw?.out_cliente_id || raw?.cliente_id,
        cliente_nome: raw?.out_cliente_nome || raw?.cliente_nome,
        cliente_codigo: raw?.out_cliente_codigo || raw?.cliente_codigo || null,
        emprestimo_id: raw?.out_novo_emprestimo_id || raw?.emprestimo_id,
        valor_total: raw?.out_valor_total || raw?.valor_total,
        valor_parcela: raw?.out_valor_parcela || raw?.valor_parcela,
        microseguro_id: raw?.out_microseguro_id || raw?.microseguro_id,
        microseguro_valor: raw?.out_microseguro_valor || raw?.microseguro_valor,
        parcelas: raw?.out_parcelas || raw?.parcelas,
      } : raw;

      if (!res?.sucesso) {
        const msg = res?.mensagem || 'Erro ao registrar venda.';
        console.error('❌ Erro da RPC:', msg);
        if (Platform.OS === 'web') { window.alert(msg); }
        else { Alert.alert('Erro', msg); }
        return;
      }

      // Sucesso — atualizar liquidação e mostrar resultado
      liqCtx.recarregarLiquidacao();
      setResultado(res);
      setShowResultado(true);
    } catch (err: any) {
      console.error('❌ Erro ao registrar venda:', err);
      const msg = err?.message || 'Erro inesperado ao registrar venda.';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('Erro', msg); }
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
    // Se é renovação/renegociação, dados já vêm preenchidos — não pedir confirmação
    if (clienteExistente || isRenegociacao) {
      navigation.goBack();
      return;
    }
    // Se tem algum campo preenchido manualmente, pedir confirmação
    const temDados = nome || documento || telefoneCelular || telefoneFixo || 
                     email || endereco || enderecoComercial || segmentoId || 
                     fotoCliente || observacoesCliente;
    
    if (temDados) {
      if (Platform.OS === 'web') {
        if (window.confirm('Os dados preenchidos serão perdidos. Cancelar?')) navigation.goBack();
      } else {
        Alert.alert(t.cancelarVenda, t.cancelarMsg, [
          { text: t.nao, style: 'cancel' },
          { text: t.simCancelar, style: 'destructive', onPress: () => navigation.goBack() },
        ]);
      }
    } else {
      navigation.goBack();
    }
  };

  // -----------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------
  return (
    <View style={styles.container}>

      {/* POPUP BUSCA DOCUMENTO */}
      <Modal visible={modalDocVisible} transparent animationType="fade" onRequestClose={() => navigation.goBack()}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalCardTitle}>
              {lang === 'es' ? 'Nuevo préstamo' : 'Novo empréstimo'}
            </Text>
            <Text style={styles.modalCardDesc}>
              {lang === 'es'
                ? 'Informe el documento del cliente para verificar si ya tiene historial.'
                : 'Informe o documento do cliente para verificar se já tem histórico.'}
            </Text>
            <TextInput
              style={styles.modalCardInput}
              value={docBusca}
              onChangeText={setDocBusca}
              placeholder={lang === 'es' ? 'CPF / Documento' : 'CPF / Documento'}
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.modalCardButtons}>
              <TouchableOpacity
                style={styles.modalCardBtnCancel}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.modalCardBtnCancelText}>
                  {lang === 'es' ? 'Cancelar' : 'Cancelar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCardBtnConfirm, (!docBusca.trim() || buscandoDoc) && { opacity: 0.5 }]}
                onPress={buscarClientePorDocumento}
                disabled={!docBusca.trim() || buscandoDoc}
              >
                {buscandoDoc
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalCardBtnConfirmText}>OK</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRenegociacao ? t.tituloRenegociacao : clienteExistente ? t.tituloRenovacao : t.tituloNovaVenda}</Text>
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
                <Text style={styles.sectionTitle}>{t.secCliente}</Text>
              </View>
              <Text style={styles.sectionChevron}>{clienteExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {clienteExpanded && (
              <View style={styles.sectionBody}>
                {(clienteExistente || clienteEncontradoId) ? (
                  /* Cliente existente — somente leitura */
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
                        <Text style={styles.clienteReadOnlyLabel}>{t.endereco}</Text>
                        <Text style={styles.clienteReadOnlyValue} numberOfLines={2}>{endereco}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <>
                {/* Nome completo */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Nome completo <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder={t.phNomeCliente}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                  />
                </View>

                {/* Documento */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.documento}</Text>
                  <TextInput
                    style={styles.input}
                    value={documento}
                    onChangeText={setDocumento}
                    placeholder={t.phDoc}
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
                      placeholder={t.phTelefone}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Telefone fixo (DDI + número) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.telefoneFixo}</Text>
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
                      placeholder={t.phTelefone}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.email}</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t.phEmail}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Endereço Residencial */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.endResidencial}</Text>
                  <TextInput
                    style={styles.input}
                    value={endereco}
                    onChangeText={setEndereco}
                    placeholder={t.phEndRes}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Endereço Comercial */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.endComercial}</Text>
                  <TextInput
                    style={styles.input}
                    value={enderecoComercial}
                    onChangeText={setEnderecoComercial}
                    placeholder={t.phEndCom}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Segmento */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.segmento}</Text>
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
                  <Text style={styles.fieldLabel}>{t.fotoCliente}</Text>
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
                        <Text style={styles.photoPlaceholderText}>{t.cliqueFoto}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Observações */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.observacoes}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={observacoesCliente}
                    onChangeText={setObservacoesCliente}
                    placeholder={t.phObs}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>
                  </>
                )}
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
                <Text style={styles.sectionTitle}>{t.secEmprestimo}</Text>
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
                      value={valorEmprestimo}
                      onChangeText={handleValorEmprestimoChange}
                      placeholder="500"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
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
                      placeholder="20"
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
                        placeholder={t.phJuros}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.taxaCancelBtn}
                        onPress={() => { setTaxaJurosPersonalizada(false); setTaxaJuros(''); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.taxaCancelBtnText}>{t.voltar}</Text>
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
                        onPress={() => {
                          setFrequencia(freq.value);
                          if (freq.value === 'DIARIO') setDataPrimeiroVencimento(amanha());
                        }}
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
                        <Text style={styles.checkboxLabel}>{t.iniciarProxMes}</Text>
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
                  <Text style={styles.fieldLabel}>{t.observacoes}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={observacoesEmprestimo}
                    onChangeText={setObservacoesEmprestimo}
                    placeholder={t.phObsEmp}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>

                {/* Cálculo automático */}
                {valorPrincipal > 0 && taxaNum > 0 && (
                  <View style={styles.calculoBox}>
                    <Text style={styles.calculoTitle}>{t.secCalculo}</Text>
                    <View style={styles.calculoRow}>
                      <Text style={styles.calculoLabel}>{t.valorTotal}</Text>
                      <Text style={styles.calculoValue}>$ {fmt(valorTotal)}</Text>
                    </View>
                    <View style={styles.calculoRow}>
                      <Text style={styles.calculoLabel}>{t.valorParcela}</Text>
                      <Text style={styles.calculoValue}>$ {fmt(valorParcela)}</Text>
                    </View>
                    <View style={styles.calculoRow}>
                      <Text style={styles.calculoLabel}>{t.totalJuros}</Text>
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
                <Text style={styles.sectionTitle}>{t.secMicroseguro}</Text>
                <Text style={styles.sectionSubtitle}>{t.opcional}</Text>
              </View>
              <Text style={styles.sectionChevron}>{microseguroExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {microseguroExpanded && (
              <View style={styles.sectionBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t.valorMicroseguro}</Text>
                  <TextInput
                    style={styles.input}
                    value={valorMicroseguro}
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
                <Text style={styles.sectionTitle}>{t.secResumo}</Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              {/* Bloco 1 - Cliente */}
              <View style={styles.resumoBloco}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>{t.lblCliente}</Text>
                  <Text style={styles.resumoValue}>{nome || '—'}</Text>
                </View>
                {segmentoNome ? (
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>{t.lblSegmento}</Text>
                    <Text style={styles.resumoValue}>{segmentoNome}</Text>
                  </View>
                ) : null}
              </View>

              {/* Bloco 2 - Valores */}
              <View style={styles.resumoBloco}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>{t.lblEmprestimo}</Text>
                  <Text style={styles.resumoValue}>$ {fmt(valorPrincipal)}</Text>
                </View>
                {totalJuros > 0 && (
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>+ Juros ({taxaJuros}%):</Text>
                    <Text style={[styles.resumoValue, { color: '#EF4444' }]}>$ {fmt(totalJuros)}</Text>
                  </View>
                )}
                <View style={styles.resumoRow}>
                  <Text style={[styles.resumoLabel, { fontWeight: '700' }]}>{t.lblTotal}</Text>
                  <Text style={[styles.resumoValue, { fontWeight: '700' }]}>$ {fmt(valorTotal)}</Text>
                </View>
              </View>

              {/* Bloco 3 - Detalhes parcelas */}
              <View style={styles.resumoBloco}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabelSmall}>{t.lblParcelas}</Text>
                  <Text style={styles.resumoValueSmall}>{parcelasNum}x de $ {fmt(valorParcela)}</Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabelSmall}>{t.lblFrequencia}</Text>
                  <Text style={styles.resumoValueSmall}>
                    {{ DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' }[frequencia] || frequencia}
                  </Text>
                </View>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabelSmall}>{t.lblVencimento}</Text>
                  <Text style={styles.resumoValueSmall}>{formatarData(dataPrimeiroVencimento)}</Text>
                </View>
              </View>

              {/* Bloco 4 - Microseguro (condicional) */}
              {microValor > 0 && (
                <View style={styles.resumoBloco}>
                  <View style={styles.resumoRow}>
                    <Text style={styles.resumoLabel}>{t.lblMicroseguro}</Text>
                    <Text style={styles.resumoValue}>$ {fmt(microValor)}</Text>
                  </View>
                </View>
              )}

              {/* Total a receber */}
              <View style={styles.resumoTotal}>
                <Text style={styles.resumoTotalLabel}>{t.totalReceber}</Text>
                <Text style={styles.resumoTotalValue}>$ {fmt(valorTotal + microValor)}</Text>
              </View>
              {isRenegociacao && renegociacao?.saldo_devedor > 0 && (
                <View style={{ backgroundColor: '#FFF7ED', padding: 12, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#F97316' }}>
                  <Text style={{ fontSize: 12, color: '#9A3412', fontWeight: '600' }}>⚠ Saldo devedor do empréstimo anterior: $ {fmt(renegociacao.saldo_devedor)}</Text>
                </View>
              )}
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
              <Text style={styles.confirmButtonText}>{t.processando}</Text>
            </View>
          ) : (
            <Text style={[
              styles.confirmButtonText,
              !isValido() && styles.confirmButtonTextDisabled,
            ]}>
              ✓ {isRenegociacao ? 'CONFIRMAR RENEGOCIAÇÃO' : 'CONFIRMAR VENDA'}
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
                <Text style={styles.resultadoHeaderTitle}>{t.vendaRegistrada}</Text>
                <Text style={styles.resultadoHeaderMsg}>{resultado?.mensagem}</Text>
              </View>

              {/* Bloco 1 - Cliente */}
              <View style={[styles.resultadoBloco, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.resultadoBlocoTitle}>{t.secClienteConf}</Text>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>{t.nome}</Text>
                  <Text style={styles.resultadoValue}>{resultado?.cliente_nome}</Text>
                </View>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>{t.codigo}</Text>
                  <Text style={[styles.resultadoValue, { fontWeight: '700', color: '#2563EB' }]}>
                    #{resultado?.cliente_codigo}
                  </Text>
                </View>
              </View>

              {/* Bloco 2 - Empréstimo */}
              <View style={[styles.resultadoBloco, { backgroundColor: '#F0FDF4' }]}>
                <Text style={styles.resultadoBlocoTitle}>{t.secEmprestimoConf}</Text>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>{t.valorTotalConf}</Text>
                  <Text style={styles.resultadoValue}>$ {fmt(resultado?.valor_total || 0)}</Text>
                </View>
                <View style={styles.resultadoRow}>
                  <Text style={styles.resultadoLabel}>{t.valorParcelaConf}</Text>
                  <Text style={styles.resultadoValue}>$ {fmt(resultado?.valor_parcela || 0)}</Text>
                </View>
                {resultado?.microseguro_valor ? (
                  <View style={styles.resultadoRow}>
                    <Text style={styles.resultadoLabel}>{t.lblMicroseguro}</Text>
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
                    <Text style={[styles.parcelaHeaderText, { flex: 1 }]}>{t.vencimento}</Text>
                    <Text style={[styles.parcelaHeaderText, { width: 100, textAlign: 'right' }]}>{t.valor}</Text>
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
              <Text style={styles.resultadoCloseBtnText}>{t.fechar}</Text>
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
              <Text style={styles.pickerTitle}>{t.selecionePais}</Text>
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
              <Text style={styles.pickerTitle}>{t.selecioneSegmento}</Text>
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
                placeholder={t.buscarSegmento}
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
                <Text style={styles.pickerLoadingText}>{t.carregandoSegmentos}</Text>
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
                    <Text style={styles.pickerLoadingText}>{t.nenhumSegmento}</Text>
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
              <Text style={styles.pickerTitle}>{t.diaSemana}</Text>
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
              <Text style={styles.pickerTitle}>{t.dataPrimVenc}</Text>
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

  clienteReadOnlyBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clienteReadOnlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  clienteReadOnlyLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    width: 70,
    flexShrink: 0,
  },
  clienteReadOnlyValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
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

  // Modal busca documento
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalCardTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  modalCardDesc: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  modalCardInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1F2937', backgroundColor: '#F9FAFB', marginBottom: 20 },
  modalCardButtons: { flexDirection: 'row', gap: 12 },
  modalCardBtnCancel: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalCardBtnCancelText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  modalCardBtnConfirm: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#3B82F6', alignItems: 'center' },
  modalCardBtnConfirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});