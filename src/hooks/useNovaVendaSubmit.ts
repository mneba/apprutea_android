import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { Lang, Textos } from '../constants/novaVendaConstants';
import { supabase } from '../services/supabase';
import { registrarAcao } from '../services/auditoriaApp';
import { moeda } from '../utils/formato';

// ============================================================
// HOOK: Submit (4 fluxos) + pedido alteração + fechar
// ============================================================

interface SubmitFormValues {
  nome: string;
  documento: string;
  ddiCelular: string;
  telefoneCelular: string;
  ddiFixo: string;
  telefoneFixo: string;
  email: string;
  endereco: string;
  enderecoComercial: string;
  segmentoId: string | null;
  fotoCliente: string | null;
  observacoesCliente: string;
  valorPrincipal: number;
  valorEmprestimo: string;
  numeroParcelas: string;
  taxaJuros: string;
  frequencia: string;
  diaSemanaPagamento: string;
  /** Conjunto de dias da semana. O escalar acima e o primeiro dele. */
  diasSemanaPagamento: number[];
  diaMesPagamento: string;
  diasMesFlexivel: number[];
  iniciarProximoMes: boolean;
  dataPrimeiroVencimento: string;
  observacoesEmprestimo: string;
  microValor: number;
  valorTotal: number;
}

interface SubmitContext {
  vendedor: any;
  liqCtx: any;
  lang: Lang;
  t: Textos;
  navigation: any;
  clienteExistente: any;
  renegociacao: any;
  isRenegociacao: boolean;
  clienteEncontradoId: string | null;
  clienteEncontradoCodigo: string | null;
  tipoEmprestimoDetectado: string | null;
  emprestimOrigemId: string | null;
  vendaPendenteId: string | null;
  isVendaAprovadaTravada: boolean;
  /** Renovação aprovada: o valor não pode passar do aprovado. `null` = sem teto. */
  tetoRenovacao?: number | null;
  validarMaxVendas: boolean;
  valorMaxVendas: number;
  validarCamposComFeedback: (clienteEncontradoIdExt?: string | null) => boolean;
  limparFormulario: () => void;
}

// Teto de espera pelo GPS NO CONFIRMAR, quando a posição ainda não chegou.
// Era 5 s, em fila, antes de qualquer consulta — e cada venda e renovação
// pagava isso inteiro em aparelho com GPS fraco (Julio, 07/11/2026). O banco
// nunca foi o gargalo: medido em 19/11/2026, fn_nova_venda_completa 42 ms em
// média (máx. 139) e fn_renovar_emprestimo 28 ms (máx. 75).
const ESPERA_GPS_CONFIRMAR_MS = 1500;

type PosicaoVenda = { latitude: number; longitude: number };

export function useNovaVendaSubmit(ctx: SubmitContext) {
  const [submitting, setSubmitting] = useState(false);

  // ── GPS pedido ao ABRIR a tela, não ao confirmar ──
  // É o que o pagamento já faz (useGPSTracking, com a posição acompanhada
  // desde a montagem): quando o vendedor aperta Confirmar, a posição já está
  // na mão. Primeiro a última conhecida (instantânea), depois a atual por
  // cima. O lugar é o mesmo — o vendedor preenche a venda parado na porta.
  const posicaoRef = useRef<PosicaoVenda | null>(null);
  const posicaoEmVooRef = useRef<Promise<PosicaoVenda | null> | null>(null);
  useEffect(() => {
    let vivo = true;
    posicaoEmVooRef.current = (async () => {
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        try {
          const ultima = await Location.getLastKnownPositionAsync();
          if (vivo && ultima?.coords) {
            posicaoRef.current = { latitude: ultima.coords.latitude, longitude: ultima.coords.longitude };
          }
        } catch { /* sem última posição: segue para a atual */ }
        const atual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (vivo && atual?.coords) {
          posicaoRef.current = { latitude: atual.coords.latitude, longitude: atual.coords.longitude };
        }
        return posicaoRef.current;
      } catch (e) {
        console.log('GPS indisponível:', e);
        return posicaoRef.current;
      }
    })();
    return () => { vivo = false; };
  }, []);

  /** A posição para gravar na venda: a que já chegou, ou no máximo 1,5 s de espera. */
  const posicaoParaVenda = async (): Promise<PosicaoVenda | null> => {
    if (posicaoRef.current) return posicaoRef.current;
    const emVoo = posicaoEmVooRef.current;
    if (!emVoo) return null;
    const limite = new Promise<null>(r => setTimeout(() => r(null), ESPERA_GPS_CONFIRMAR_MS));
    const r = await Promise.race([emVoo, limite]);
    return r || posicaoRef.current;
  };
  const [resultado, setResultado] = useState<any>(null);
  const [showResultado, setShowResultado] = useState(false);
  const [modalAlterarVisible, setModalAlterarVisible] = useState(false);
  const [textoAlteracao, setTextoAlteracao] = useState('');
  const [enviandoAlteracao, setEnviandoAlteracao] = useState(false);

  // -----------------------------------------------------------
  // SUBMIT
  // -----------------------------------------------------------
  const handleSubmit = async (formValues: SubmitFormValues) => {
    const fv = formValues;

    // ETAPA 1 - Validação
    if (!ctx.validarCamposComFeedback(ctx.clienteEncontradoId)) {
      Alert.alert(ctx.t.dadosIncompletos, ctx.t.dadosIncompletosMsg);
      return;
    }

    // ETAPA 2 - IDs
    const vendedorId = ctx.vendedor?.id;
    const userId = ctx.vendedor?.user_id;
    let empresaId = ctx.vendedor?.empresa_id || null;
    let rotaId = ctx.vendedor?.rota_id || null;

    if (!userId) {
      Alert.alert(ctx.t.erroAutenticacao, ctx.t.sessaoExpirada);
      return;
    }

    // Renovação aprovada: até o valor aprovado, nunca acima. O banco também
    // recusa (pediria nova autorização), mas aqui o vendedor lê o motivo.
    if (ctx.tetoRenovacao != null && fv.valorPrincipal > ctx.tetoRenovacao + 0.001) {
      const msg = ctx.lang === 'es'
        ? `El valor autorizado es hasta ${moeda(ctx.tetoRenovacao)}. Ingrese un valor menor o igual.`
        : `O valor autorizado é até ${moeda(ctx.tetoRenovacao)}. Informe um valor menor ou igual.`;
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert(ctx.lang === 'es' ? 'Valor' : 'Valor', msg);
      return;
    }

    if (!rotaId && vendedorId) {
      try {
        const { data: rotaData } = await supabase
          .from('rotas').select('id, empresa_id').eq('vendedor_id', vendedorId).single();
        if (rotaData) { rotaId = rotaData.id; empresaId = empresaId || rotaData.empresa_id; }
      } catch (err) { console.error('Erro ao buscar rota:', err); }
    }
    if (!empresaId && rotaId) {
      try {
        const { data: rotaData } = await supabase
          .from('rotas').select('empresa_id').eq('id', rotaId).single();
        if (rotaData) empresaId = rotaData.empresa_id;
      } catch (err) { console.error('Erro ao buscar empresa:', err); }
    }

    setSubmitting(true);
    try {
      // ETAPA 3 + 4 - GPS e liquidação aberta, EM PARALELO.
      // Antes iam em fila: até 5 s de GPS e só então a consulta.
      // ETAPA 4 - Liquidação aberta
      // Status válidos = os mesmos de temLiquidacaoAberta no contexto.
      // Uma liquidação REABERTA (reaberta pelo web) é uma liquidação de
      // trabalho como qualquer outra — antes ela era barrada aqui porque
      // este filtro omitia 'REABERTO', bloqueando a venda com "Liquidação
      // não encontrada" mesmo havendo liquidação válida.
      const STATUS_LIQ_ABERTA = ['ABERTO', 'ABERTA', 'REABERTO'];

      const [{ data: liqData, error: liqError }, posicao] = await Promise.all([
        supabase
          .from('liquidacoes_diarias')
          .select('id')
          .eq('rota_id', rotaId)
          .in('status', STATUS_LIQ_ABERTA)
          .order('data_abertura', { ascending: false })
          .limit(1)
          .maybeSingle(),
        posicaoParaVenda(),
      ]);
      const latitude: number | null = posicao?.latitude ?? null;
      const longitude: number | null = posicao?.longitude ?? null;

      if (liqError || !liqData) {
        Alert.alert('Liquidação não encontrada', 'Nenhuma liquidação aberta encontrada. Abra uma liquidação antes de registrar vendas.');
        setSubmitting(false);
        return;
      }

      // Reaproveita a liquidação já encontrada acima; o contexto tem
      // precedência quando presente. Antes havia uma segunda query aqui,
      // com lista de status ainda diferente ('ABERTO','REABERTO', sem
      // 'ABERTA') — agora eliminada.
      const liqId = ctx.liqCtx.liquidacaoAtual?.id || liqData.id;

      // ETAPA 5 - Montar e enviar
      let data: any, error: any;

      // Params comuns de frequência
      const freqParams = {
        dia_semana: fv.frequencia === 'SEMANAL' ? parseInt(fv.diaSemanaPagamento) : null,
        // O conjunto manda no cronograma; o escalar acima fica para os
        // leitores antigos. Fora do SEMANAL vai nulo, e as funcoes do
        // Postgres ainda descartam por CASE — duas guardas, de proposito.
        dias_semana: fv.frequencia === 'SEMANAL' ? fv.diasSemanaPagamento : null,
        dia_mes: fv.frequencia === 'MENSAL' ? parseInt(fv.diaMesPagamento) : null,
        dias_mes: fv.frequencia === 'FLEXIVEL' ? fv.diasMesFlexivel : null,
        iniciar_proximo_mes: fv.frequencia === 'FLEXIVEL' ? fv.iniciarProximoMes : false,
      };

      if (ctx.isRenegociacao) {
        // RENEGOCIAÇÃO via params
        if (!liqId) {
          const msg = 'Não há liquidação aberta para esta rota. Inicie o dia primeiro.';
          if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erro', msg);
          return;
        }
        console.log('🔄 Renegociação - fn_renegociar_emprestimo para:', ctx.renegociacao.cliente_nome);
        ({ data, error } = await supabase.rpc('fn_renegociar_emprestimo', {
          p_emprestimo_original_id: ctx.renegociacao.emprestimo_id,
          p_novo_valor_principal: fv.valorPrincipal,
          p_numero_parcelas: parseInt(fv.numeroParcelas),
          p_taxa_juros: parseFloat(fv.taxaJuros.replace(',', '.')) || 0,
          p_frequencia_pagamento: fv.frequencia,
          p_data_primeiro_vencimento: fv.dataPrimeiroVencimento,
          p_user_id: userId, p_liquidacao_id: liqId,
          p_observacoes: fv.observacoesEmprestimo.trim() || null,
          p_dia_semana_cobranca: freqParams.dia_semana,
          p_dias_semana_cobranca: freqParams.dias_semana,
          p_dia_mes_cobranca: freqParams.dia_mes,
          p_dias_mes_cobranca: freqParams.dias_mes,
          p_iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
          p_latitude: latitude, p_longitude: longitude,
          p_microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
          // ⚠ SEMPRE false no app. A via que CANCELA o emprestimo atual saiu
          //    daqui em 12/11/2026: ela servia para consertar emprestimo
          //    lancado errado, e conserto e operacao de ADMIN, no web -- o
          //    vendedor nao alcanca um emprestimo de dias atras por causa da
          //    regra de dias retroativos. O parametro continua na funcao,
          //    esperando o processo de recriacao do web.
          p_substituir: false,
        }));
      } else if (ctx.clienteExistente?.id || ctx.clienteEncontradoId) {
        const clienteId = ctx.clienteExistente?.id || ctx.clienteEncontradoId;
        const isAdicional = ctx.tipoEmprestimoDetectado === 'ADICIONAL';

        // ⚠ NAO reescreve o cadastro do cliente, e isso nao e omissao.
        //
        // Este ramo e EXATAMENTE a condicao em que o bloco cadastral abre
        // SOMENTE-LEITURA: `isClienteReadOnly` em NovaVendaScreen e
        // `clienteExistente?.id || clienteEncontradoId`, a mesma linha do
        // `else if` acima. O vendedor nao digita nome, documento nem telefone
        // aqui -- logo um UPDATE nunca carrega edicao dele, so o valor que o
        // formulario recebeu como semente.
        //
        // E a semente estava errada: `ClientesScreen` mandava
        // `documento: cli.codigo_cliente` no `clienteExistente`, e este
        // UPDATE gravava o CODIGO sobre o documento de verdade. Medido em
        // 14/11/2026: 1.083 dos 3.297 clientes (33%) ficaram com
        // `documento = codigo_cliente`, por 43 autores diferentes -- e foi
        // isto que o Julio reportou como "a migracao nao trouxe os
        // documentos iguais ao Excel". A importacao estava certa; esta linha
        // apagava depois.
        //
        // O telefone era o mesmo defeito, CUMULATIVO: `telefoneCelular`
        // nascia com o numero JA com DDI e `ddiCelular` com o DDI da rota,
        // entao `${fv.ddiCelular}${fv.telefoneCelular}` virava
        // `+555519988801833`, e na venda seguinte `+55+555519...`. 234
        // telefones na base.
        //
        // E a forma de erro que o CLAUDE.md ja registra em "o Salvar generico
        // dessuspendia em silencio": formulario que reenvia o estado inteiro
        // sobrescreve o que outro caminho gravou, e o bug e silencioso porque
        // o valor reenviado e plausivel. Cadastro tem UM dono -- a tela de
        // cliente, por `fn_atualizar_cliente`. Nao e a venda.

        const isRenegociacaoViaDoc = ctx.tipoEmprestimoDetectado === 'RENOVACAO' && !!ctx.emprestimOrigemId;

        if (isRenegociacaoViaDoc) {
          console.log('🔄 Renegociação (doc) - fn_renegociar_emprestimo, origem:', ctx.emprestimOrigemId);
          ({ data, error } = await supabase.rpc('fn_renegociar_emprestimo', {
            p_emprestimo_original_id: ctx.emprestimOrigemId,
            p_novo_valor_principal: fv.valorPrincipal,
            p_numero_parcelas: parseInt(fv.numeroParcelas),
            p_taxa_juros: parseFloat(fv.taxaJuros.replace(',', '.')) || 0,
            p_frequencia_pagamento: fv.frequencia,
            p_data_primeiro_vencimento: fv.dataPrimeiroVencimento,
            p_user_id: userId, p_liquidacao_id: liqId,
            p_observacoes: fv.observacoesEmprestimo.trim() || null,
            p_dia_semana_cobranca: freqParams.dia_semana,
            p_dias_semana_cobranca: freqParams.dias_semana,
            p_dia_mes_cobranca: freqParams.dia_mes,
            p_dias_mes_cobranca: freqParams.dias_mes,
            p_iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
            // ⚠ SEMPRE false aqui, de proposito: este caminho e a
            //    renegociacao detectada pelo DOCUMENTO, onde ninguem
            //    perguntou nada ao vendedor. A via NOVA exige escolha
            //    explicita, e a escolha vive no ClienteDetalhesModal.
            p_substituir: false,
          }));
        } else if (isAdicional) {
          console.log('➕ Novo empréstimo adicional - fn_nova_venda_adicional para:', fv.nome);
          ({ data, error } = await supabase.rpc('fn_nova_venda_adicional', {
            p_cliente_id: clienteId,
            p_valor_principal: fv.valorPrincipal,
            p_numero_parcelas: parseInt(fv.numeroParcelas),
            p_taxa_juros: parseFloat(fv.taxaJuros.replace(',', '.')) || 0,
            p_frequencia: fv.frequencia,
            p_data_primeiro_vencimento: fv.dataPrimeiroVencimento,
            p_empresa_id: empresaId, p_rota_id: rotaId, p_vendedor_id: vendedorId, p_user_id: userId,
            p_dia_semana_cobranca: freqParams.dia_semana,
            p_dias_semana_cobranca: freqParams.dias_semana,
            p_dia_mes_cobranca: freqParams.dia_mes,
            p_dias_mes_cobranca: freqParams.dias_mes,
            p_iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
            p_observacoes: fv.observacoesEmprestimo.trim() || null,
            p_latitude: latitude, p_longitude: longitude,
            p_microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
          }));
        } else {
          console.log('🔄 Renovação - fn_renovar_emprestimo para:', ctx.clienteExistente?.nome || fv.nome);
          ({ data, error } = await supabase.rpc('fn_renovar_emprestimo', {
            p_cliente_id: clienteId,
            p_valor_principal: fv.valorPrincipal,
            p_numero_parcelas: parseInt(fv.numeroParcelas),
            p_taxa_juros: parseFloat(fv.taxaJuros.replace(',', '.')) || 0,
            p_frequencia: fv.frequencia,
            p_data_primeiro_vencimento: fv.dataPrimeiroVencimento,
            p_dia_semana_cobranca: freqParams.dia_semana,
            p_dias_semana_cobranca: freqParams.dias_semana,
            p_dia_mes_cobranca: freqParams.dia_mes,
            p_dias_mes_cobranca: freqParams.dias_mes,
            p_iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
            p_observacoes: fv.observacoesEmprestimo.trim() || null,
            p_microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
            p_empresa_id: empresaId, p_rota_id: rotaId, p_vendedor_id: vendedorId, p_user_id: userId,
            p_latitude: latitude, p_longitude: longitude,
          }));
        }
      } else {
        // VENDA NOVA - cliente novo
        const vendaJaAprovada = !!ctx.vendaPendenteId && ctx.isVendaAprovadaTravada;
        if (
          !vendaJaAprovada &&
          ctx.validarMaxVendas &&
          ctx.valorMaxVendas > 0 &&
          fv.valorPrincipal > ctx.valorMaxVendas
        ) {
          // Grava venda pendente + solicitação
          const { data: vp, error: vpErr } = await supabase
            .from('vendas_pendentes')
            .insert({
              vendedor_id: vendedorId, rota_id: rotaId, empresa_id: empresaId,
              status: 'PENDENTE',
              cliente_nome: fv.nome.trim(),
              cliente_documento: fv.documento.trim() || null,
              cliente_telefone: fv.telefoneCelular ? `${fv.ddiCelular}${fv.telefoneCelular}` : null,
              cliente_telefone_fixo: fv.telefoneFixo ? `${fv.ddiFixo}${fv.telefoneFixo}` : null,
              cliente_email: fv.email.trim() || null,
              cliente_endereco: fv.endereco.trim() || null,
              cliente_endereco_comercial: fv.enderecoComercial.trim() || null,
              cliente_segmento_id: fv.segmentoId || null,
              cliente_foto_url: fv.fotoCliente || null,
              cliente_observacoes: fv.observacoesCliente.trim() || null,
              valor_principal: fv.valorPrincipal,
              numero_parcelas: parseInt(fv.numeroParcelas),
              taxa_juros: parseFloat(fv.taxaJuros.replace(',', '.')) || 0,
              frequencia: fv.frequencia,
              data_primeiro_vencimento: fv.dataPrimeiroVencimento,
              dia_semana_cobranca: freqParams.dia_semana,
              dias_semana_cobranca: freqParams.dias_semana,
              dia_mes_cobranca: freqParams.dia_mes,
              dias_mes_cobranca: freqParams.dias_mes,
              iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
              observacoes_emprestimo: fv.observacoesEmprestimo.trim() || null,
              microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
              valor_limite: ctx.valorMaxVendas,
            })
            .select('id').single();
          if (vpErr) throw vpErr;

          const { data: sol, error: solErr } = await supabase
            .from('solicitacoes_autorizacao')
            .insert({
              vendedor_id: vendedorId, rota_id: rotaId,
              tipo_solicitacao: 'VENDA_EXCEDE_LIMITE',
              valor_solicitado: fv.valorPrincipal,
              valor_limite: ctx.valorMaxVendas,
              motivo_solicitacao: `Venda nova de ${fv.nome.trim()} no valor de $ ${fv.valorPrincipal.toFixed(2)} excede o limite de $ ${ctx.valorMaxVendas.toFixed(2)}.`,
              status: 'PENDENTE',
              venda_pendente_id: vp.id,
            })
            .select('id').single();
          if (solErr) throw solErr;

          await supabase.from('vendas_pendentes').update({ solicitacao_id: sol.id }).eq('id', vp.id);

          setSubmitting(false);
          const msg = ctx.lang === 'es'
            ? `La venta de $ ${fv.valorPrincipal.toFixed(2)} excede el límite de $ ${ctx.valorMaxVendas.toFixed(2)}. Se envió una solicitud al administrador.`
            : `A venda de $ ${fv.valorPrincipal.toFixed(2)} excede o limite de $ ${ctx.valorMaxVendas.toFixed(2)}. Foi enviada uma solicitação ao administrador.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(ctx.lang === 'es' ? 'Autorización requerida' : 'Autorização necessária', msg);
          ctx.navigation.goBack();
          return;
        }

        console.log('🆕 Venda nova - chamando fn_nova_venda_completa');
        ({ data, error } = await supabase.rpc('fn_nova_venda_completa', {
          p_cliente_id: null,
          p_cliente_nome: fv.nome.trim(),
          p_cliente_documento: fv.documento.trim() || null,
          p_cliente_telefone: fv.telefoneCelular ? `${fv.ddiCelular}${fv.telefoneCelular}` : null,
          p_cliente_telefone_fixo: fv.telefoneFixo ? `${fv.ddiFixo}${fv.telefoneFixo}` : null,
          p_cliente_email: fv.email.trim() || null,
          p_cliente_endereco: fv.endereco.trim() || null,
          p_cliente_endereco_comercial: fv.enderecoComercial.trim() || null,
          p_cliente_segmento_id: fv.segmentoId || null,
          p_cliente_foto_url: fv.fotoCliente || null,
          p_cliente_observacoes: fv.observacoesCliente.trim() || null,
          p_valor_principal: fv.valorPrincipal,
          p_numero_parcelas: parseInt(fv.numeroParcelas),
          p_taxa_juros: parseFloat(fv.taxaJuros.replace(',', '.')) || 0,
          p_frequencia: fv.frequencia,
          p_data_primeiro_vencimento: fv.dataPrimeiroVencimento,
          p_dia_semana_cobranca: freqParams.dia_semana,
          p_dias_semana_cobranca: freqParams.dias_semana,
          p_dia_mes_cobranca: freqParams.dia_mes,
          p_dias_mes_cobranca: freqParams.dias_mes,
          p_iniciar_proximo_mes: fv.frequencia === 'FLEXIVEL' ? fv.iniciarProximoMes : null,
          p_observacoes: fv.observacoesEmprestimo.trim() || null,
          p_microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
          p_empresa_id: empresaId, p_rota_id: rotaId, p_vendedor_id: vendedorId, p_user_id: userId,
          p_latitude: latitude, p_longitude: longitude,
        }));
      }

      if (error) throw error;

      // ETAPA 6 - Tratamento da resposta
      const raw = Array.isArray(data) ? data[0] : data;

      let codigoCliente = ctx.renegociacao?.codigo_cliente || ctx.clienteExistente?.codigo_cliente || ctx.clienteEncontradoCodigo || null;
      const clienteIdParaBuscarCodigo = ctx.renegociacao?.cliente_id || ctx.clienteExistente?.id || ctx.clienteEncontradoId;
      if (!codigoCliente && clienteIdParaBuscarCodigo) {
        const { data: cliData } = await supabase.from('clientes').select('codigo_cliente').eq('id', clienteIdParaBuscarCodigo).single();
        codigoCliente = cliData?.codigo_cliente || null;
      }

      const isRenegociacaoViaDoc = !ctx.isRenegociacao && !!ctx.emprestimOrigemId && !!ctx.clienteEncontradoId;

      const valorTotalReneg = parseFloat(raw?.novo_valor) || fv.valorPrincipal * (1 + (parseFloat(fv.taxaJuros.replace(',', '.')) || 0) / 100);
      const valorParcelaReneg = parseInt(fv.numeroParcelas) > 0 ? valorTotalReneg / parseInt(fv.numeroParcelas) : 0;

      const limparIdDaMensagem = (msg: string | undefined): string => {
        if (!msg) return 'Renegociação registrada com sucesso';
        return msg.replace(/\s*Novo empréstimo:\s*[a-f0-9-]+\s*\.?\s*$/i, '').replace(/!\s*$/, '!').trim()
          || 'Renegociação registrada com sucesso';
      };

      const res = ctx.isRenegociacao ? {
        sucesso: raw?.sucesso,
        mensagem: raw?.sucesso ? limparIdDaMensagem(raw?.mensagem) : (raw?.mensagem || 'Renegociação registrada com sucesso'),
        cliente_id: ctx.renegociacao.cliente_id, cliente_nome: ctx.renegociacao.cliente_nome,
        cliente_codigo: codigoCliente,
        emprestimo_id: raw?.novo_emprestimo_id,
        valor_total: raw?.novo_valor || fv.valorPrincipal,
        valor_parcela: valorParcelaReneg,
        microseguro_id: null, microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
        parcelas: null,
        saldo_anterior: raw?.saldo_original, parcelas_canceladas: raw?.parcelas_canceladas,
      } : isRenegociacaoViaDoc ? {
        sucesso: raw?.sucesso,
        mensagem: raw?.sucesso ? limparIdDaMensagem(raw?.mensagem) : (raw?.mensagem || 'Renegociação registrada com sucesso'),
        cliente_id: ctx.clienteEncontradoId, cliente_nome: fv.nome,
        cliente_codigo: codigoCliente,
        emprestimo_id: raw?.novo_emprestimo_id,
        valor_total: raw?.novo_valor || fv.valorPrincipal,
        valor_parcela: valorParcelaReneg,
        microseguro_id: null, microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
        parcelas: null,
        saldo_anterior: raw?.saldo_original, parcelas_canceladas: raw?.parcelas_canceladas,
      } : ctx.clienteExistente?.id || ctx.clienteEncontradoId ? {
        sucesso: raw?.sucesso, mensagem: raw?.mensagem,
        cliente_id: raw?.out_cliente_id || raw?.cliente_id || ctx.clienteEncontradoId,
        cliente_nome: raw?.out_cliente_nome || raw?.cliente_nome || fv.nome,
        cliente_codigo: raw?.out_cliente_codigo || raw?.cliente_codigo || codigoCliente || null,
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
        // Detectar solicitação de autorização criada pelo banco (renovação excede anterior)
        if (msg.startsWith('[AUTORIZAÇÃO]')) {
          const msgLimpa = msg.replace('[AUTORIZAÇÃO] ', '');
          if (Platform.OS === 'web') window.alert(msgLimpa);
          else Alert.alert(
            ctx.lang === 'es' ? 'Autorización requerida' : 'Autorização necessária',
            msgLimpa
          );
          ctx.navigation.goBack();
          return;
        }
        if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erro', msg);
        return;
      }

      // Reset flags — as duas escritas são independentes: vão JUNTAS, uma ida
      // à rede em vez de duas em fila.
      const idParaReset = ctx.clienteEncontradoId || ctx.clienteExistente?.id || ctx.renegociacao?.cliente_id;
      const posVenda: PromiseLike<any>[] = [];
      if (idParaReset) {
        if (ctx.tipoEmprestimoDetectado === 'ADICIONAL') {
          posVenda.push(supabase.from('clientes').update({ permite_emprestimo_adicional: false }).eq('id', idParaReset));
        } else if (ctx.isRenegociacao || (ctx.tipoEmprestimoDetectado === 'RENOVACAO' && ctx.emprestimOrigemId)) {
          posVenda.push(supabase.from('clientes').update({ permite_renegociacao: false }).eq('id', idParaReset));
        }
      }

      if (ctx.vendaPendenteId && ctx.isVendaAprovadaTravada) {
        posVenda.push(supabase.from('vendas_pendentes').update({ status: 'CONCLUIDO' }).eq('id', ctx.vendaPendenteId));
      }
      if (posVenda.length > 0) await Promise.all(posVenda);

      ctx.liqCtx.recarregarLiquidacao();
      // `recarregarLiquidacao` relê só a linha de liquidacoes_diarias. A lista
      // de clientes e a aba "Todos" ficavam com o empréstimo velho: a
      // ClientesScreen só recarrega ao ganhar foco se os dados tiverem mais de
      // 30s, e quem acabou de vender volta antes disso. Este sinal fura a
      // janela para este caso específico.
      ctx.liqCtx.invalidarClientes();
      setResultado(res);
      setShowResultado(true);
    } catch (err: any) {
      console.error('❌ Erro ao registrar venda:', err);
      // Venda que nao completou nao vira linha em `emprestimos`, entao nao ha
      // `criado_por_user_id` para contar a historia. E o caso de "preenchi
      // tudo e sumiu".
      registrarAcao('VENDA_FALHOU', {
        vendedorId: vendedorId || '',
        registroId: ctx.clienteExistente?.id || null,
        detalhe: err?.message || 'erro sem mensagem',
        dados: {
          valor: fv.valorPrincipal,
          parcelas: fv.numeroParcelas,
          frequencia: fv.frequencia,
          tipo: ctx.tipoEmprestimoDetectado,
          code: err?.code || null,
        },
      });
      const msg = err?.message || 'Erro inesperado ao registrar venda.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erro', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------
  // PEDIDO DE ALTERAÇÃO
  // -----------------------------------------------------------
  const enviarPedidoAlteracao = async () => {
    if (!ctx.vendaPendenteId || !textoAlteracao.trim()) return;
    setEnviandoAlteracao(true);
    try {
      await supabase.from('vendas_pendentes')
        .update({ status: 'PENDENTE', motivo_alteracao: textoAlteracao.trim(), valor_aprovado: null })
        .eq('id', ctx.vendaPendenteId);

      await supabase.from('solicitacoes_autorizacao')
        .update({ status: 'PENDENTE', data_resolucao: null, motivo_resolucao: null, motivo_solicitacao: `Pedido de alteração: ${textoAlteracao.trim()}` })
        .eq('venda_pendente_id', ctx.vendaPendenteId);

      setEnviandoAlteracao(false);
      setModalAlterarVisible(false);
      const msg = ctx.lang === 'es' ? 'Solicitud de cambio enviada al administrador.' : 'Pedido de alteração enviado ao administrador.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('✓', msg);
      ctx.navigation.goBack();
    } catch (e: any) {
      setEnviandoAlteracao(false);
      const msg = e?.message || 'Erro ao enviar alteração';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erro', msg);
    }
  };

  // -----------------------------------------------------------
  // FECHAR
  // -----------------------------------------------------------
  const handleFecharResultado = () => {
    setShowResultado(false);
    ctx.limparFormulario();
    ctx.navigation.goBack();
  };

  const handleClose = () => {
    if (ctx.clienteExistente || ctx.isRenegociacao || ctx.vendaPendenteId) {
      ctx.navigation.goBack();
      return;
    }
    // Verifica se tem dados preenchidos via callback
  };

  return {
    submitting,
    resultado,
    showResultado, setShowResultado,
    modalAlterarVisible, setModalAlterarVisible,
    textoAlteracao, setTextoAlteracao,
    enviandoAlteracao,
    handleSubmit,
    enviarPedidoAlteracao,
    handleFecharResultado,
    handleClose,
  };
}