import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import type { Lang, Textos } from '../constants/novaVendaConstants';

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
  validarMaxVendas: boolean;
  valorMaxVendas: number;
  validarCamposComFeedback: (clienteEncontradoIdExt?: string | null) => boolean;
  limparFormulario: () => void;
}

export function useNovaVendaSubmit(ctx: SubmitContext) {
  const [submitting, setSubmitting] = useState(false);
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
      // ETAPA 3 - GPS
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
          if (loc?.coords) { latitude = loc.coords.latitude; longitude = loc.coords.longitude; }
        }
      } catch (gpsErr) { console.log('GPS indisponível:', gpsErr); }

      // ETAPA 4 - Liquidação aberta
      const { data: liqData, error: liqError } = await supabase
        .from('liquidacoes_diarias')
        .select('id')
        .eq('rota_id', rotaId)
        .in('status', ['ABERTO', 'ABERTA'])
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liqError || !liqData) {
        Alert.alert('Liquidação não encontrada', 'Nenhuma liquidação aberta encontrada. Abra uma liquidação antes de registrar vendas.');
        setSubmitting(false);
        return;
      }

      let liqId = ctx.liqCtx.liquidacaoAtual?.id || null;
      if (!liqId) {
        const { data: ld } = await supabase
          .from('liquidacoes_diarias').select('id')
          .eq('rota_id', rotaId).in('status', ['ABERTO', 'REABERTO']).limit(1).single();
        liqId = ld?.id || null;
      }

      // ETAPA 5 - Montar e enviar
      let data: any, error: any;

      // Params comuns de frequência
      const freqParams = {
        dia_semana: fv.frequencia === 'SEMANAL' ? parseInt(fv.diaSemanaPagamento) : null,
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
          p_dia_mes_cobranca: freqParams.dia_mes,
          p_dias_mes_cobranca: freqParams.dias_mes,
          p_iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
          p_latitude: latitude, p_longitude: longitude,
          p_microseguro_valor: fv.microValor > 0 ? fv.microValor : null,
        }));
      } else if (ctx.clienteExistente?.id || ctx.clienteEncontradoId) {
        const clienteId = ctx.clienteExistente?.id || ctx.clienteEncontradoId;
        const isAdicional = ctx.tipoEmprestimoDetectado === 'ADICIONAL';

        // Atualizar dados cadastrais
        const updateData: Record<string, any> = {};
        if (fv.nome.trim()) updateData.nome = fv.nome.trim();
        if (fv.documento.trim()) updateData.documento = fv.documento.trim();
        if (fv.telefoneCelular) updateData.telefone_celular = `${fv.ddiCelular}${fv.telefoneCelular}`;
        if (fv.telefoneFixo) updateData.telefone_fixo = `${fv.ddiFixo}${fv.telefoneFixo}`;
        if (fv.email.trim()) updateData.email = fv.email.trim();
        if (fv.endereco.trim()) updateData.endereco = fv.endereco.trim();
        if (fv.enderecoComercial.trim()) updateData.endereco_comercial = fv.enderecoComercial.trim();
        if (fv.observacoesCliente.trim()) updateData.observacoes = fv.observacoesCliente.trim();
        if (Object.keys(updateData).length > 0 && clienteId) {
          await supabase.from('clientes').update(updateData).eq('id', clienteId);
        }

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
            p_dia_mes_cobranca: freqParams.dia_mes,
            p_dias_mes_cobranca: freqParams.dias_mes,
            p_iniciar_proximo_mes: freqParams.iniciar_proximo_mes,
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
        if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erro', msg);
        return;
      }

      // Reset flags
      const idParaReset = ctx.clienteEncontradoId || ctx.clienteExistente?.id || ctx.renegociacao?.cliente_id;
      if (idParaReset) {
        if (ctx.tipoEmprestimoDetectado === 'ADICIONAL') {
          await supabase.from('clientes').update({ permite_emprestimo_adicional: false }).eq('id', idParaReset);
        } else if (ctx.isRenegociacao || (ctx.tipoEmprestimoDetectado === 'RENOVACAO' && ctx.emprestimOrigemId)) {
          await supabase.from('clientes').update({ permite_renegociacao: false }).eq('id', idParaReset);
        }
      }

      if (ctx.vendaPendenteId && ctx.isVendaAprovadaTravada) {
        await supabase.from('vendas_pendentes').update({ status: 'CONCLUIDO' }).eq('id', ctx.vendaPendenteId);
      }

      ctx.liqCtx.recarregarLiquidacao();
      setResultado(res);
      setShowResultado(true);
    } catch (err: any) {
      console.error('❌ Erro ao registrar venda:', err);
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
