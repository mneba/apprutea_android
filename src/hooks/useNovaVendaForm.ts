import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import {
  amanha,
  DDI_LIST,
  parseMoeda,
  type DDIOption,
  type Segmento,
  type Textos
} from '../constants/novaVendaConstants';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { useRascunho } from './useRascunho';

// ============================================================
// HOOK: Estados do formulário + validação + handlers
// ============================================================

interface SolicitacaoRenovacao {
  solic_id: string;
  /** APROVADO trava valor e taxa; PENDENTE mantém livre */
  status?: string;
  valor_principal: number;
  numero_parcelas: number;
  taxa_juros: number;
  frequencia: string;
  dia_semana_cobranca?: number | null;
  dias_semana_cobranca?: number[] | null;
  dia_mes_cobranca?: number | null;
  data_primeiro_vencimento?: string | null;
  dias_mes_cobranca?: number[] | null;
  iniciar_proximo_mes?: boolean | null;
  observacoes_emprestimo?: string | null;
  microseguro_valor?: number | null;
}

interface UseNovaVendaFormParams {
  clienteExistente: any;
  renegociacao: any;
  isRenegociacao: boolean;
  solicitacaoRenovacao?: SolicitacaoRenovacao | null;
  /**
   * `data_liquidacao` da liquidação aberta — a data operacional. É a base do 1º
   * vencimento, tanto no estado inicial quanto no `limparFormulario`. Ver
   * CLAUDE.md, "A liquidação é a régua do tempo".
   */
  dataOperacional?: string;
  t: Textos;
}

export function useNovaVendaForm({
  clienteExistente,
  renegociacao,
  isRenegociacao,
  solicitacaoRenovacao,
  dataOperacional,
  t,
}: UseNovaVendaFormParams) {
  // Veio de uma solicitação de renovação (aprovada ou pendente).
  const isRenovacaoTravada = !!solicitacaoRenovacao;
  // Só quando APROVADA: o admin definiu valor e taxa e o vendedor não altera.
  // Em PENDENTE o vendedor está justamente alterando o próprio pedido.
  const isRenovacaoAprovada = (solicitacaoRenovacao as any)?.status === 'APROVADO';

  // -----------------------------------------------------------
  // ESTADOS - CLIENTE
  // -----------------------------------------------------------
  const [nome, setNome] = useState(clienteExistente?.nome || renegociacao?.cliente_nome || '');
  const [documento, setDocumento] = useState(clienteExistente?.documento || '');
  // O DDI sugerido vem do PAÍS DA ROTA do vendedor, não de um padrão
  // fixo. Era `+55` chumbado, e foi assim que as rotas colombianas
  // ficaram com 100% dos telefones com DDI brasileiro.
  //
  // A consulta é feita AQUI, e não no login: a do login é a que decide se
  // o vendedor entra no app, e um embed a mais ali transforma qualquer
  // mudança de schema em "não consigo logar". Se esta falhar, o seletor
  // simplesmente abre vazio — que é o comportamento combinado.
  const { vendedor } = useAuth();
  const [ddiSugerido, setDdiSugerido] = useState('');


  // Abre VAZIO: sem país se não tiver país (decisão de 19/10/2026).
  const [ddiCelular, setDdiCelular] = useState('');
  const [telefoneCelular, setTelefoneCelular] = useState(clienteExistente?.telefone_celular || renegociacao?.telefone_celular || '');
  const [ddiFixo, setDdiFixo] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const rotaId = vendedor?.rota_id;
        if (!rotaId) return;
        const { data } = await supabase
          .from('rotas')
          .select('empresas:empresa_id(cidades:cidade_id(hierarquias:hierarquia_id(pais)))')
          .eq('id', rotaId)
          .single();
        const pais = (data as any)?.empresas?.cidades?.hierarquias?.pais;
        const codigo = DDI_LIST.find((p) => p.pais === pais)?.codigo;
        if (vivo && codigo) {
          setDdiSugerido(codigo);
          setDdiCelular((atual) => (atual ? atual : codigo));
          setDdiFixo((atual) => (atual ? atual : codigo));
        }
      } catch {
        // silêncio de propósito: sem país sugerido, abre vazio
      }
    })();
    return () => { vivo = false; };
  }, [vendedor?.rota_id]);
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
  const [valorEmprestimo, setValorEmprestimo] = useState(
    solicitacaoRenovacao ? String(solicitacaoRenovacao.valor_principal) : ''
  );
  const [numeroParcelas, setNumeroParcelas] = useState(
    solicitacaoRenovacao ? String(solicitacaoRenovacao.numero_parcelas) : ''
  );
  const [taxaJuros, setTaxaJuros] = useState(
    solicitacaoRenovacao ? String(solicitacaoRenovacao.taxa_juros) : ''
  );
  // Autorização aprovada → campo livre, igual ao caminho de colar o documento
  // (useBuscaDocumento também faz setTaxaJurosPersonalizada(true)).
  // Com `false`, uma taxa fora dos botões padrão — 14%, por exemplo — não
  // aparecia em lugar nenhum: os botões ficavam todos sem seleção e o
  // vendedor não tinha como saber o juro autorizado.
  const [taxaJurosPersonalizada, setTaxaJurosPersonalizada] = useState(!!solicitacaoRenovacao);
  const [frequencia, setFrequencia] = useState(
    solicitacaoRenovacao?.frequencia || 'DIARIO'
  );
  // ─── DIAS DA SEMANA ────────────────────────────────────────────────
  //
  // O CONJUNTO É O ESTADO; O ESCALAR É DERIVADO.
  //
  // Pedido do cliente em 11/10/2026: cobrar o semanal em mais de um dia da
  // semana. O Postgres guarda os dois — `dias_semana_cobranca` (conjunto,
  // autoridade do cronograma) e `dia_semana_cobranca` (o primeiro do
  // conjunto, lido por ~25 lugares dos dois apps que não vão mudar agora).
  //
  // Aqui o escalar NÃO é um segundo estado. Se fosse, os dois divergiriam na
  // primeira tela que esquecesse de atualizar um deles — e o sintoma seria
  // cronograma num dia e rótulo em outro. Ele sai do conjunto, sempre.
  //
  // `setDiaSemanaPagamento` continua existindo como entrada: `useBuscaDocumento`
  // o chama em quatro lugares ao repetir termos de uma solicitação, e ali o
  // que chega do banco é um dia só. Escrever o escalar é escrever o conjunto
  // de um elemento.
  const [diasSemanaPagamento, setDiasSemanaPagamento] = useState<number[]>(() => {
    const conjunto = solicitacaoRenovacao?.dias_semana_cobranca;
    if (conjunto && conjunto.length > 0) {
      return [...conjunto].map(Number).filter(d => d >= 0 && d <= 6).sort((a, b) => a - b);
    }
    if (solicitacaoRenovacao?.dia_semana_cobranca != null) {
      return [Number(solicitacaoRenovacao.dia_semana_cobranca)];
    }
    return [1];
  });

  const diaSemanaPagamento = diasSemanaPagamento.length > 0 ? String(diasSemanaPagamento[0]) : '';

  const setDiaSemanaPagamento = (v: string) => {
    const n = Number(v);
    setDiasSemanaPagamento(Number.isFinite(n) && n >= 0 && n <= 6 ? [n] : []);
  };

  /** Liga/desliga um dia. O último marcado não desliga: semanal sem dia
   *  nenhum não existe, e a validação só reclamaria depois, no Confirmar. */
  const alternarDiaSemana = (dia: number) => {
    setDiasSemanaPagamento(prev => {
      if (prev.includes(dia)) {
        return prev.length === 1 ? prev : prev.filter(d => d !== dia);
      }
      return [...prev, dia].sort((a, b) => a - b);
    });
    limparErroCampo('diaSemanaPagamento');
  };
  const [diaMesPagamento, setDiaMesPagamento] = useState(
    solicitacaoRenovacao?.dia_mes_cobranca != null ? String(solicitacaoRenovacao.dia_mes_cobranca) : '15'
  );
  const [diasMesFlexivel, setDiasMesFlexivel] = useState<number[]>(
    solicitacaoRenovacao?.dias_mes_cobranca || []
  );
  // Aposentado em 26/09/2026. O gerador de parcelas NUNCA leu este
  // parametro -- descobrimos lendo `fn_gerar_parcelas_emprestimo` -- e
  // agora quem decide o mes e a data da primeira parcela, escolhida no
  // carrossel do flexivel.
  //
  // Continua sendo enviado as RPCs, que o aceitam e ignoram, so para nao
  // mexer nas quatro assinaturas. Fixo em false: nao ha mais como liga-lo.
  const iniciarProximoMes = false;
  const setIniciarProximoMes = (_: boolean) => {};
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(
    solicitacaoRenovacao?.data_primeiro_vencimento || amanha(dataOperacional)
  );
  const [observacoesEmprestimo, setObservacoesEmprestimo] = useState(
    solicitacaoRenovacao?.observacoes_emprestimo || ''
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDiaSemanaModal, setShowDiaSemanaModal] = useState(false);

  // -----------------------------------------------------------
  // ESTADOS - MICROSEGURO
  // -----------------------------------------------------------
  const [valorMicroseguro, setValorMicroseguro] = useState(
    solicitacaoRenovacao?.microseguro_valor != null ? String(solicitacaoRenovacao.microseguro_valor) : ''
  );

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

    if (frequencia === 'SEMANAL' && diasSemanaPagamento.length === 0) erros.add('diaSemanaPagamento');
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
  // RASCUNHO: O QUE FOI DIGITADO SOBREVIVE AO APP SER MORTO
  // -----------------------------------------------------------
  //
  // Relato do Julio em 27/10/2026: o cobrador sai para a câmera ou para o
  // WhatsApp no meio do cadastro, o Android mata o app por memória, e ele
  // volta com o formulário em branco. São 24 campos digitados à vista do
  // cliente — e a câmera, que este formulário abre, é justamente o momento
  // de maior pressão de memória.
  //
  // A CHAVE CARREGA O CONTEXTO. Rascunho de uma rota aparecendo em outra, ou
  // de um cliente no formulário de outro, devolveria dado plausível no lugar
  // errado — pior que devolver nada.
  const chaveRascunho = vendedor?.rota_id
    ? `novaVenda:${vendedor.rota_id}:${clienteExistente?.id || renegociacao?.emprestimo_id || 'novo'}`
    : null;

  // ⚠ DESLIGADO NA RENOVAÇÃO APROVADA, de propósito.
  // Ali o valor e a taxa vieram do ADMIN e o campo está travado. Restaurar um
  // rascunho por cima repetiria o bug de 26/10/2026, em que o formulário
  // sobrescrevia o valor liberado pelo do empréstimo anterior e a venda saía
  // pelo número errado — com a agravante de que ninguém conseguia corrigir,
  // porque o campo não aceita digitação.
  const { restaurado: rascunhoRestaurado, descartar: descartarRascunho } = useRascunho(
    chaveRascunho,
    {
      nome, documento,
      ddiCelular, telefoneCelular, ddiFixo, telefoneFixo, email,
      endereco, enderecoComercial,
      segmentoId, segmentoNome, fotoCliente, observacoesCliente,
      valorEmprestimo, numeroParcelas, taxaJuros, taxaJurosPersonalizada,
      frequencia, diasSemanaPagamento, diaMesPagamento, diasMesFlexivel,
      dataPrimeiroVencimento, observacoesEmprestimo, valorMicroseguro,
    },
    (d) => {
      // `!= null` e não `if (d.x)`: string vazia e `false` são valores que o
      // usuário pode ter deixado de propósito, e com `if` truthy eles seriam
      // descartados — a caixa reapareceria marcada depois de desmarcada.
      if (d.nome != null) setNome(d.nome);
      if (d.documento != null) setDocumento(d.documento);
      if (d.ddiCelular != null) setDdiCelular(d.ddiCelular);
      if (d.telefoneCelular != null) setTelefoneCelular(d.telefoneCelular);
      if (d.ddiFixo != null) setDdiFixo(d.ddiFixo);
      if (d.telefoneFixo != null) setTelefoneFixo(d.telefoneFixo);
      if (d.email != null) setEmail(d.email);
      if (d.endereco != null) setEndereco(d.endereco);
      if (d.enderecoComercial != null) setEnderecoComercial(d.enderecoComercial);
      if (d.segmentoId !== undefined) setSegmentoId(d.segmentoId);
      if (d.segmentoNome != null) setSegmentoNome(d.segmentoNome);
      if (d.fotoCliente !== undefined) setFotoCliente(d.fotoCliente);
      if (d.observacoesCliente != null) setObservacoesCliente(d.observacoesCliente);
      if (d.valorEmprestimo != null) setValorEmprestimo(d.valorEmprestimo);
      if (d.numeroParcelas != null) setNumeroParcelas(d.numeroParcelas);
      if (d.taxaJuros != null) setTaxaJuros(d.taxaJuros);
      if (d.taxaJurosPersonalizada != null) setTaxaJurosPersonalizada(d.taxaJurosPersonalizada);
      if (d.frequencia != null) setFrequencia(d.frequencia);
      if (Array.isArray(d.diasSemanaPagamento)) setDiasSemanaPagamento(d.diasSemanaPagamento);
      if (d.diaMesPagamento != null) setDiaMesPagamento(d.diaMesPagamento);
      if (Array.isArray(d.diasMesFlexivel)) setDiasMesFlexivel(d.diasMesFlexivel);
      if (d.dataPrimeiroVencimento != null) setDataPrimeiroVencimento(d.dataPrimeiroVencimento);
      if (d.observacoesEmprestimo != null) setObservacoesEmprestimo(d.observacoesEmprestimo);
      if (d.valorMicroseguro != null) setValorMicroseguro(d.valorMicroseguro);
    },
    {
      ativo: !isRenovacaoAprovada,
      // Sem nada digitado não há o que salvar — e assim abrir e fechar a tela
      // não deixa rascunho vazio para tropeçar depois.
      temConteudo: (d) => !!(d.nome || d.documento || d.telefoneCelular ||
        d.valorEmprestimo || d.endereco || d.fotoCliente),
      // A foto vai em base64 e é de longe o maior campo. Passando do teto,
      // o rascunho é gravado sem ela em vez de não ser gravado.
      campoPesado: 'fotoCliente',
    },
  );

  // -----------------------------------------------------------
  // LIMPAR FORMULÁRIO
  // -----------------------------------------------------------
  const limparFormulario = () => {
    // Venda gravada: o rascunho cumpriu o papel e some. Sem isto, ele volta
    // na próxima abertura do formulário e o vendedor reenvia o que já fez.
    descartarRascunho();
    setNome(''); setDocumento('');
    setDdiCelular(ddiSugerido); setTelefoneCelular('');
    setDdiFixo(ddiSugerido); setTelefoneFixo('');
    setEmail(''); setEndereco(''); setEnderecoComercial('');
    setSegmentoId(null); setSegmentoNome('');
    setFotoCliente(null); setObservacoesCliente('');
    setValorEmprestimo(''); setNumeroParcelas('12');
    setTaxaJuros(''); setTaxaJurosPersonalizada(false);
    setFrequencia('DIARIO'); setDiaSemanaPagamento('1');
    setDiaMesPagamento('15'); setDiasMesFlexivel([]);
    // A data operacional, não o relógio: este era o pior dos cinco pontos,
    // porque o efeito que corrigia o valor inicial na tela não roda de novo
    // depois de um limparFormulario.
    setIniciarProximoMes(false); setDataPrimeiroVencimento(amanha(dataOperacional));
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
    diasSemanaPagamento, setDiasSemanaPagamento, alternarDiaSemana,
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

    // --- Rascunho ---
    // A tela PRECISA avisar que restaurou. Rascunho que reaparece calado é
    // pior que rascunho nenhum: o vendedor abre "Novo Cliente" para outra
    // pessoa, encontra o formulário preenchido, não repara, e grava um
    // cadastro com dado de quem desistiu meia hora antes.
    rascunhoRestaurado,
    descartarRascunho,

    // --- Solicitação de renovação ---
    isRenovacaoTravada,
    isRenovacaoAprovada,
    solicitacaoRenovacaoId: solicitacaoRenovacao?.solic_id || null,
  };
}