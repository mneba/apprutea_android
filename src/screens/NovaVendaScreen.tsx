import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { amanha, textos } from '../constants/novaVendaConstants';
import { useAuth } from '../contexts/AuthContext';
import { useLiquidacaoContext } from '../contexts/LiquidacaoContext';
import { styles } from '../styles/novaVendaStyles';

// Hooks
import { useBuscaDocumento } from '../hooks/useBuscaDocumento';
import { useNovaVendaConfig } from '../hooks/useNovaVendaConfig';
import { useNovaVendaForm } from '../hooks/useNovaVendaForm';
import { useNovaVendaSubmit } from '../hooks/useNovaVendaSubmit';
import { supabase } from '../services/supabase';

// Componentes
import FormularioCliente from '../components/nova-venda/FormularioCliente';
import FormularioEmprestimo from '../components/nova-venda/FormularioEmprestimo';
import ModalBuscaDocumento from '../components/nova-venda/ModalBuscaDocumento';
import ModalResultado from '../components/nova-venda/ModalResultado';
import {
  ModalAlteracao,
  ModalCalendario,
  ModalDDI,
  ModalDiaSemana,
  ModalSegmento,
} from '../components/nova-venda/PickerModals';
import ResumoVenda from '../components/nova-venda/ResumoVenda';
import SecaoMicroseguro from '../components/nova-venda/SecaoMicroseguro';

// ============================================================
// TELA PRINCIPAL — NOVA VENDA
// ============================================================

export default function NovaVendaScreen({ navigation, route }: any) {
  const { vendedor } = useAuth();
  const liqCtx = useLiquidacaoContext();
  const lang = liqCtx.language;
  const t = textos[lang];

  // Data base da liquidação: route param → context → busca direta
  const dataLiqParam = route?.params?.dataLiq as string | undefined;
  const [dataLiqFetched, setDataLiqFetched] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!dataLiqParam && !liqCtx.liquidacaoAtual && vendedor?.rota_id) {
      (async () => {
        const { data } = await supabase
          .from('liquidacoes_diarias')
          .select('data_liquidacao, data_abertura')
          .eq('rota_id', vendedor.rota_id)
          .in('status', ['ABERTO', 'ABERTA', 'REABERTO'])
          .order('data_abertura', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          const dt = data.data_liquidacao || data.data_abertura?.split('T')[0];
          if (dt) setDataLiqFetched(dt);
        }
      })();
    }
  }, [dataLiqParam, liqCtx.liquidacaoAtual, vendedor?.rota_id]);

  const dataLiquidacaoBase: string | undefined =
    dataLiqParam ||
    liqCtx.dataVisualizacao ||
    (liqCtx.liquidacaoAtual as any)?.data_liquidacao ||
    (liqCtx.liquidacaoAtual as any)?.data_abertura?.split('T')[0] ||
    dataLiqFetched ||
    undefined;
  const dataOperacional: string | undefined = dataLiquidacaoBase || undefined;

  const clienteExistente = route?.params?.clienteExistente || null;
  const renegociacao = route?.params?.renegociacao || null;
  const isRenegociacao = !!renegociacao;
  const vendaPendenteParam = route?.params?.vendaPendente || null;
  // ⭐ Solicitação de renovação pendente — pré-preenche o formulário com os dados da solicitação
  const solicitacaoRenovacaoParam = route?.params?.solicitacaoRenovacao || null;

  // -----------------------------------------------------------
  // HOOKS
  // -----------------------------------------------------------
  const form = useNovaVendaForm({ clienteExistente, renegociacao, isRenegociacao, solicitacaoRenovacao: solicitacaoRenovacaoParam, t });

  const config = useNovaVendaConfig({
    vendedorId: vendedor?.id,
    rotaId: vendedor?.rota_id,
  });

  // Ajustar data default do 1º vencimento para dia seguinte à liquidação
  React.useEffect(() => {
    if (dataLiquidacaoBase && !clienteExistente && !renegociacao) {
      form.setDataPrimeiroVencimento(amanha(dataLiquidacaoBase));
    }
  }, [dataLiquidacaoBase]);

  const buscaDoc = useBuscaDocumento({
    vendedor,
    clienteExistente,
    renegociacao,
    isRenegociacao,
    vendaPendenteParam,
    solicitacaoRenovacaoParam,
    lang,
    navigation,
    formSetters: {
      setNome: form.setNome,
      setDocumento: form.setDocumento,
      setTelefoneCelular: form.setTelefoneCelular,
      setTelefoneFixo: form.setTelefoneFixo,
      setEmail: form.setEmail,
      setEndereco: form.setEndereco,
      setEnderecoComercial: form.setEnderecoComercial,
      setSegmentoId: form.setSegmentoId,
      setSegmentoNome: form.setSegmentoNome,
      setFotoCliente: form.setFotoCliente,
      setObservacoesCliente: form.setObservacoesCliente,
      setValorEmprestimo: form.setValorEmprestimo,
      setNumeroParcelas: form.setNumeroParcelas,
      setTaxaJuros: form.setTaxaJuros,
      setTaxaJurosPersonalizada: form.setTaxaJurosPersonalizada,
      setFrequencia: form.setFrequencia,
      setDataPrimeiroVencimento: form.setDataPrimeiroVencimento,
      setDiaSemanaPagamento: form.setDiaSemanaPagamento,
      setDiaMesPagamento: form.setDiaMesPagamento,
      setDiasMesFlexivel: form.setDiasMesFlexivel,
      setIniciarProximoMes: form.setIniciarProximoMes,
      setObservacoesEmprestimo: form.setObservacoesEmprestimo,
      setValorMicroseguro: form.setValorMicroseguro,
      setClienteExpanded: form.setClienteExpanded,
    },
  });

  const submit = useNovaVendaSubmit({
    vendedor,
    liqCtx,
    lang,
    t,
    navigation,
    clienteExistente,
    renegociacao,
    isRenegociacao,
    clienteEncontradoId: buscaDoc.clienteEncontradoId,
    clienteEncontradoCodigo: buscaDoc.clienteEncontradoCodigo,
    tipoEmprestimoDetectado: buscaDoc.tipoEmprestimoDetectado,
    emprestimOrigemId: buscaDoc.emprestimOrigemId,
    vendaPendenteId: buscaDoc.vendaPendenteId,
    isVendaAprovadaTravada: buscaDoc.isVendaAprovadaTravada || form.isRenovacaoTravada || !!(buscaDoc.solicitacaoRenovacaoDetectada),
    validarMaxVendas: config.validarMaxVendas,
    valorMaxVendas: config.valorMaxVendas,
    validarCamposComFeedback: form.validarCamposComFeedback,
    limparFormulario: form.limparFormulario,
  });

  // -----------------------------------------------------------
  // DERIVADOS
  // -----------------------------------------------------------
  const isClienteReadOnly = !!(clienteExistente?.id || buscaDoc.clienteEncontradoId);
  const isDisabled = isRenegociacao || buscaDoc.isVendaAprovadaTravada || form.isRenovacaoTravada || !!(buscaDoc.solicitacaoRenovacaoDetectada);

  const titulo = isRenegociacao
    ? t.tituloRenegociacao
    : buscaDoc.tipoEmprestimoDetectado === 'RENOVACAO'
    ? t.tituloRenovacao
    : buscaDoc.tipoEmprestimoDetectado === 'ADICIONAL'
    ? t.tituloAdicional
    : t.tituloNovaVenda;

  const handleConfirm = () => {
    submit.handleSubmit({
      nome: form.nome,
      documento: form.documento,
      ddiCelular: form.ddiCelular,
      telefoneCelular: form.telefoneCelular,
      ddiFixo: form.ddiFixo,
      telefoneFixo: form.telefoneFixo,
      email: form.email,
      endereco: form.endereco,
      enderecoComercial: form.enderecoComercial,
      segmentoId: form.segmentoId,
      fotoCliente: form.fotoCliente,
      observacoesCliente: form.observacoesCliente,
      valorPrincipal: form.valorPrincipal,
      valorEmprestimo: form.valorEmprestimo,
      numeroParcelas: form.numeroParcelas,
      taxaJuros: form.taxaJuros,
      frequencia: form.frequencia,
      diaSemanaPagamento: form.diaSemanaPagamento,
      diaMesPagamento: form.diaMesPagamento,
      diasMesFlexivel: form.diasMesFlexivel,
      iniciarProximoMes: form.iniciarProximoMes,
      dataPrimeiroVencimento: form.dataPrimeiroVencimento,
      observacoesEmprestimo: form.observacoesEmprestimo,
      microValor: form.microValor,
      valorTotal: form.valorTotal,
    });
  };

  const handleClose = () => {
    if (clienteExistente || isRenegociacao || vendaPendenteParam) {
      navigation.goBack();
      return;
    }
    const temDados = form.nome || form.documento || form.telefoneCelular || form.telefoneFixo ||
                     form.email || form.endereco || form.enderecoComercial || form.segmentoId ||
                     form.fotoCliente || form.observacoesCliente;

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

  const isFormValido = form.isValido(buscaDoc.clienteEncontradoId);

  // -----------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{titulo}</Text>
        <TouchableOpacity style={styles.headerCloseBtn} onPress={handleClose} activeOpacity={0.7}>
          <Text style={styles.headerCloseBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Banner venda aprovada */}
          {buscaDoc.isVendaAprovadaTravada && (
            <View style={styles.bannerAprovada}>
              <Text style={styles.bannerAprovadaTitulo}>
                ✅ {lang === 'es' ? 'Venta autorizada por el administrador' : 'Venda autorizada pelo administrador'}
              </Text>
              <Text style={styles.bannerAprovadaTexto}>
                {lang === 'es'
                  ? 'Los datos fueron aprobados. Confirme la venta para registrarla.'
                  : 'Os dados foram aprovados. Confirme a venda para registrá-la.'}
              </Text>
            </View>
          )}

          {/* ===== SEÇÃO CLIENTE ===== */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => form.setClienteExpanded(!form.clienteExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>👤</Text>
                <Text style={styles.sectionTitle}>{t.secCliente}</Text>
              </View>
              <Text style={styles.sectionChevron}>{form.clienteExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {form.clienteExpanded && (
              <View style={styles.sectionBody}>
                <FormularioCliente
                  nome={form.nome} setNome={form.setNome}
                  documento={form.documento} setDocumento={form.setDocumento}
                  telefoneCelular={form.telefoneCelular} setTelefoneCelular={form.setTelefoneCelular}
                  telefoneFixo={form.telefoneFixo} setTelefoneFixo={form.setTelefoneFixo}
                  email={form.email} setEmail={form.setEmail}
                  endereco={form.endereco} setEndereco={form.setEndereco}
                  enderecoComercial={form.enderecoComercial} setEnderecoComercial={form.setEnderecoComercial}
                  segmentoNome={form.segmentoNome}
                  fotoCliente={form.fotoCliente}
                  observacoesCliente={form.observacoesCliente} setObservacoesCliente={form.setObservacoesCliente}
                  isReadOnly={isClienteReadOnly}
                  isDisabled={isDisabled}
                  camposComErro={form.camposComErro}
                  limparErroCampo={form.limparErroCampo}
                  getDdiLabel={form.getDdiLabel}
                  openDdiModal={form.openDdiModal}
                  onOpenSegmentoModal={() => form.setShowSegmentoModal(true)}
                  handlePhotoOptions={form.handlePhotoOptions}
                  setFotoCliente={form.setFotoCliente}
                  t={t}
                />
              </View>
            )}
          </View>

          {/* ===== SEÇÃO EMPRÉSTIMO ===== */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => form.setEmprestimoExpanded(!form.emprestimoExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>💰</Text>
                <Text style={styles.sectionTitle}>{t.secEmprestimo}</Text>
              </View>
              <Text style={styles.sectionChevron}>{form.emprestimoExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {form.emprestimoExpanded && (
              <View style={styles.sectionBody}>
                <FormularioEmprestimo
                  valorEmprestimo={form.valorEmprestimo} setValorEmprestimo={form.setValorEmprestimo}
                  numeroParcelas={form.numeroParcelas} setNumeroParcelas={form.setNumeroParcelas}
                  taxaJuros={form.taxaJuros} setTaxaJuros={form.setTaxaJuros}
                  taxaJurosPersonalizada={form.taxaJurosPersonalizada} setTaxaJurosPersonalizada={form.setTaxaJurosPersonalizada}
                  frequencia={form.frequencia} setFrequencia={form.setFrequencia}
                  diaSemanaPagamento={form.diaSemanaPagamento} setDiaSemanaPagamento={form.setDiaSemanaPagamento}
                  diaMesPagamento={form.diaMesPagamento} setDiaMesPagamento={form.setDiaMesPagamento}
                  diasMesFlexivel={form.diasMesFlexivel}
                  iniciarProximoMes={form.iniciarProximoMes} setIniciarProximoMes={form.setIniciarProximoMes}
                  dataPrimeiroVencimento={form.dataPrimeiroVencimento} setDataPrimeiroVencimento={form.setDataPrimeiroVencimento}
                  observacoesEmprestimo={form.observacoesEmprestimo} setObservacoesEmprestimo={form.setObservacoesEmprestimo}
                  valorPrincipal={form.valorPrincipal} taxaNum={form.taxaNum} parcelasNum={form.parcelasNum}
                  valorTotal={form.valorTotal} valorParcela={form.valorParcela} totalJuros={form.totalJuros}
                  taxasPermitidas={config.taxasPermitidas} taxasLivre={config.taxasLivre}
                  isRenegociacao={isRenegociacao} isVendaAprovadaTravada={buscaDoc.isVendaAprovadaTravada || form.isRenovacaoTravada}
                  camposComErro={form.camposComErro} lang={lang}
                  handleValorEmprestimoChange={form.handleValorEmprestimoChange}
                  limparErroCampo={form.limparErroCampo}
                  toggleDiaFlexivel={form.toggleDiaFlexivel}
                  getDiaSemanaLabel={form.getDiaSemanaLabel}
                  onOpenDiaSemanaModal={() => form.setShowDiaSemanaModal(true)}
                  onOpenDatePicker={() => form.setShowDatePicker(true)}
                  dataOperacional={dataOperacional}
                  t={t}
                />
              </View>
            )}
          </View>

          {/* ===== SEÇÃO MICROSEGURO ===== */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => form.setMicroseguroExpanded(!form.microseguroExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>🔵</Text>
                <Text style={styles.sectionTitle}>{t.secMicroseguro}</Text>
                <Text style={styles.sectionSubtitle}>{t.opcional}</Text>
              </View>
              <Text style={styles.sectionChevron}>{form.microseguroExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {form.microseguroExpanded && (
              <View style={styles.sectionBody}>
                <SecaoMicroseguro
                  valorMicroseguro={form.valorMicroseguro}
                  handleValorMicroseguroChange={form.handleValorMicroseguroChange}
                  t={t}
                />
              </View>
            )}
          </View>

          {/* ===== RESUMO ===== */}
          <View style={[styles.section, styles.resumoSection]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>📋</Text>
                <Text style={styles.sectionTitle}>{t.secResumo}</Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              <ResumoVenda
                nome={form.nome} segmentoNome={form.segmentoNome}
                valorPrincipal={form.valorPrincipal} totalJuros={form.totalJuros}
                valorTotal={form.valorTotal} taxaJuros={form.taxaJuros}
                parcelasNum={form.parcelasNum} valorParcela={form.valorParcela}
                frequencia={form.frequencia} dataPrimeiroVencimento={form.dataPrimeiroVencimento}
                microValor={form.microValor}
                isRenegociacao={isRenegociacao} renegociacao={renegociacao}
                t={t}
              />
            </View>
          </View>

          {/* Botão alterar (venda aprovada) */}
          {buscaDoc.isVendaAprovadaTravada && (
            <TouchableOpacity
              style={styles.btnAlterarSolicitado}
              onPress={() => submit.setModalAlterarVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnAlterarSolicitadoText}>
                {lang === 'es' ? '✎ Alterar préstamo solicitado' : '✎ Alterar empréstimo solicitado'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER - BOTÃO CONFIRMAR */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            isFormValido ? styles.confirmButtonEnabled : styles.confirmButtonDisabled,
            submit.submitting && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          activeOpacity={0.8}
          disabled={submit.submitting || !isFormValido}
        >
          {submit.submitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.confirmButtonText}>{t.processando}</Text>
            </View>
          ) : (
            <Text style={[styles.confirmButtonText, !isFormValido && styles.confirmButtonTextDisabled]}>
              ✓ {isRenegociacao ? 'CONFIRMAR RENEGOCIAÇÃO' : 'CONFIRMAR VENDA'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ===== MODAIS ===== */}
      <ModalBuscaDocumento
        visible={buscaDoc.modalDocVisible}
        lang={lang}
        docBusca={buscaDoc.docBusca}
        setDocBusca={buscaDoc.setDocBusca}
        buscandoDoc={buscaDoc.buscandoDoc}
        onBuscar={buscaDoc.buscarClientePorDocumento}
        onCancel={() => { buscaDoc.setModalDocVisible(false); navigation.goBack(); }}
      />

      <ModalResultado
        visible={submit.showResultado}
        resultado={submit.resultado}
        t={t}
        onClose={submit.handleFecharResultado}
      />

      <ModalDDI
        visible={form.showDdiModal}
        ddiAtivo={form.ddiTarget === 'celular' ? form.ddiCelular : form.ddiFixo}
        t={t}
        onSelect={form.handleSelectDdi}
        onClose={() => form.setShowDdiModal(false)}
      />

      <ModalSegmento
        visible={form.showSegmentoModal}
        segmentos={config.segmentos}
        segmentosLoading={config.segmentosLoading}
        segmentoId={form.segmentoId}
        segmentoBusca={form.segmentoBusca}
        segmentoBuscaRef={form.segmentoBuscaRef}
        t={t}
        onSelect={form.handleSelectSegmento}
        onClear={() => { form.setSegmentoId(null); form.setSegmentoNome(''); }}
        onSetBusca={form.setSegmentoBusca}
        onClose={() => form.setShowSegmentoModal(false)}
      />

      <ModalDiaSemana
        visible={form.showDiaSemanaModal}
        diasSemana={form.DIAS_SEMANA}
        diaSemanaPagamento={form.diaSemanaPagamento}
        t={t}
        onSelect={form.setDiaSemanaPagamento}
        onClose={() => form.setShowDiaSemanaModal(false)}
      />

      <ModalCalendario
        visible={form.showDatePicker}
        dataSelecionada={form.dataPrimeiroVencimento}
        trabalhaDomingo={config.trabalhaDomingo}
        feriadosSet={config.feriadosSet}
        lang={lang}
        t={t}
        minDate={dataOperacional}
        onSelect={form.setDataPrimeiroVencimento}
        onClose={() => form.setShowDatePicker(false)}
      />

      <ModalAlteracao
        visible={submit.modalAlterarVisible}
        lang={lang}
        textoAlteracao={submit.textoAlteracao}
        setTextoAlteracao={submit.setTextoAlteracao}
        enviandoAlteracao={submit.enviandoAlteracao}
        onEnviar={submit.enviarPedidoAlteracao}
        onClose={() => submit.setModalAlterarVisible(false)}
      />
    </View>
  );
}