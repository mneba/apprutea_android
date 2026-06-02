// ============================================================
// TIPOS
// ============================================================

export interface Segmento {
  id: string;
  grupo_pt: string;
  nome_pt: string;
  ordem_grupo: number;
  ordem: number;
}

export interface SegmentoGrupo {
  grupo: string;
  itens: Segmento[];
}

export interface DDIOption {
  pais: string;
  codigo: string;
}

export type Lang = 'pt-BR' | 'es';

// ============================================================
// CONSTANTES
// ============================================================

export const DDI_LIST: DDIOption[] = [
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

export const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const FREQ_OPTIONS = [
  { value: 'DIARIO', label_pt: 'Diário', label_es: 'Diario' },
  { value: 'SEMANAL', label_pt: 'Semanal', label_es: 'Semanal' },
  { value: 'QUINZENAL', label_pt: 'Quinzenal', label_es: 'Quincenal' },
  { value: 'MENSAL', label_pt: 'Mensal', label_es: 'Mensual' },
  { value: 'FLEXIVEL', label_pt: 'Flexível', label_es: 'Flexible' },
];

export const FREQ_LABELS: Record<string, string> = {
  DIARIO: 'Diário',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  FLEXIVEL: 'Flexível',
};

// ============================================================
// HELPERS
// ============================================================

/** Retorna a data de amanhã no formato YYYY-MM-DD */
export const amanha = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

/** Para MENSAL: se o dia já passou no mês atual, avança para o mês seguinte */
export const calcularDataMensal = (dia: number): string => {
  if (!dia || dia < 1 || dia > 31) return amanha();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diaHoje = hoje.getDate();
  const mesAlvo = dia > diaHoje ? mes : mes + 1;
  const dataAlvo = new Date(ano, mesAlvo, dia);
  if (dataAlvo.getMonth() !== (mesAlvo % 12)) {
    dataAlvo.setDate(0);
  }
  return dataAlvo.toISOString().split('T')[0];
};

/** Parseia string monetária para number: "500,50" → 500.5 */
export const parseMoeda = (valor: string): number =>
  parseFloat((valor || '').replace(',', '.')) || 0;

/** Formata data YYYY-MM-DD → DD/MM/YYYY */
export const formatarData = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

/** Formata número para exibição monetária */
export const fmt = (v: number): string =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// ============================================================
// TRADUÇÕES
// ============================================================

export const textos = {
  'pt-BR': {
    // Header
    tituloRenegociacao: 'RENEGOCIAÇÃO', tituloRenovacao: 'RENOVAÇÃO', tituloNovaVenda: 'NOVA VENDA', tituloAdicional: 'EMPRÉSTIMO ADICIONAL',
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
    tituloRenegociacao: 'RENEGOCIACIÓN', tituloRenovacao: 'RENOVACIÓN', tituloNovaVenda: 'NUEVA VENTA', tituloAdicional: 'PRÉSTAMO ADICIONAL',
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

export type Textos = typeof textos['pt-BR'];
