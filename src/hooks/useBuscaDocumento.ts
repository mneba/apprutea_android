import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import type { Lang } from '../constants/novaVendaConstants';

// ============================================================
// HOOK: Busca por documento + detecção de tipo de empréstimo
// + carregamento de venda pendente + empréstimo original
// ============================================================

interface FormSetters {
  setNome: (v: string) => void;
  setDocumento: (v: string) => void;
  setTelefoneCelular: (v: string) => void;
  setTelefoneFixo: (v: string) => void;
  setEmail: (v: string) => void;
  setEndereco: (v: string) => void;
  setEnderecoComercial: (v: string) => void;
  setSegmentoId: (v: string | null) => void;
  setSegmentoNome: (v: string) => void;
  setFotoCliente: (v: string | null) => void;
  setObservacoesCliente: (v: string) => void;
  setValorEmprestimo: (v: string) => void;
  setNumeroParcelas: (v: string) => void;
  setTaxaJuros: (v: string) => void;
  setTaxaJurosPersonalizada: (v: boolean) => void;
  setFrequencia: (v: string) => void;
  setDataPrimeiroVencimento: (v: string) => void;
  setDiaSemanaPagamento: (v: string) => void;
  setDiaMesPagamento: (v: string) => void;
  setDiasMesFlexivel: (v: number[]) => void;
  setIniciarProximoMes: (v: boolean) => void;
  setObservacoesEmprestimo: (v: string) => void;
  setValorMicroseguro: (v: string) => void;
  setClienteExpanded: (v: boolean) => void;
}

interface UseBuscaDocumentoParams {
  vendedor: any;
  clienteExistente: any;
  renegociacao: any;
  isRenegociacao: boolean;
  vendaPendenteParam: any;
  lang: Lang;
  navigation: any;
  formSetters: FormSetters;
}

export function useBuscaDocumento({
  vendedor,
  clienteExistente,
  renegociacao,
  isRenegociacao,
  vendaPendenteParam,
  lang,
  navigation,
  formSetters,
}: UseBuscaDocumentoParams) {
  const s = formSetters;

  // -----------------------------------------------------------
  // ESTADOS
  // -----------------------------------------------------------
  const [modalDocVisible, setModalDocVisible] = useState(
    !clienteExistente && !isRenegociacao && !vendaPendenteParam
  );
  const [docBusca, setDocBusca] = useState('');
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [clienteEncontradoId, setClienteEncontradoId] = useState<string | null>(null);
  const [clienteEncontradoCodigo, setClienteEncontradoCodigo] = useState<string | null>(null);
  const [tipoEmprestimoDetectado, setTipoEmprestimoDetectado] = useState<'RENOVACAO' | 'ADICIONAL' | 'NOVO' | null>(null);
  const [emprestimOrigemId, setEmprestimoOrigemId] = useState<string | null>(null);

  // Venda pendente
  const [vendaPendenteIdDetectada, setVendaPendenteIdDetectada] = useState<string | null>(null);
  const vendaPendenteId = vendaPendenteParam?.id || vendaPendenteIdDetectada || null;
  const vendaPendenteModo = vendaPendenteParam?.modo || (vendaPendenteIdDetectada ? 'aprovada' : null);
  const isVendaAprovadaTravada = vendaPendenteModo === 'aprovada';
  const [vendaPendenteCarregada, setVendaPendenteCarregada] = useState(false);

  // -----------------------------------------------------------
  // BUSCAR CLIENTE POR DOCUMENTO
  // -----------------------------------------------------------
  const buscarClientePorDocumento = async () => {
    const doc = docBusca.replace(/\D/g, '');
    if (!doc) return;
    setBuscandoDoc(true);
    try {
      const docSemMask = docBusca.replace(/\D/g, '');

      // Verificar venda pendente aprovada
      const { data: vpAprovada } = await supabase
        .from('vendas_pendentes')
        .select('id, cliente_nome')
        .eq('cliente_documento', docSemMask)
        .eq('status', 'APROVADO')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vpAprovada) {
        setBuscandoDoc(false);
        const titulo = lang === 'es' ? 'Venta autorizada' : 'Venda autorizada';
        const msg = lang === 'es'
          ? `Hay una venta autorizada para ${vpAprovada.cliente_nome}. ¿Desea cargarla?`
          : `Há uma venda autorizada para ${vpAprovada.cliente_nome}. Deseja carregá-la?`;
        const carregar = () => {
          setVendaPendenteIdDetectada(vpAprovada.id);
          setModalDocVisible(false);
        };
        if (Platform.OS === 'web') {
          if (window.confirm(`${titulo}\n\n${msg}`)) carregar();
        } else {
          Alert.alert(titulo, msg, [
            { text: lang === 'es' ? 'No' : 'Não', style: 'cancel' },
            { text: lang === 'es' ? 'Sí, cargar' : 'Sim, carregar', onPress: carregar },
          ]);
        }
        return;
      }

      // Busca exata
      let { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome, documento, telefone_celular, endereco, codigo_cliente, permite_emprestimo_adicional, permite_renegociacao')
        .or(`documento.eq.${docSemMask},documento.eq.${docBusca}`)
        .limit(1);

      // Fallback ilike
      if (!clientes?.length && docSemMask.length >= 3) {
        const { data: clientesFallback } = await supabase
          .from('clientes')
          .select('id, nome, documento, telefone_celular, endereco, codigo_cliente, permite_emprestimo_adicional, permite_renegociacao')
          .or(`documento.ilike.%${docSemMask}%,documento.ilike.%${docBusca}%`)
          .limit(1);
        clientes = clientesFallback;
      }

      const cli = clientes?.[0];
      if (!cli) {
        s.setDocumento(docBusca);
        setModalDocVisible(false);
        return;
      }

      // Validar via function
      const { data: validacao } = await supabase.rpc('fn_validar_novo_emprestimo', {
        p_cliente_id: cli.id,
        p_vendedor_id: vendedor?.id || null,
        p_rota_id: vendedor?.rota_id || null,
        p_valor_principal: 0,
        p_numero_parcelas: 1,
        p_frequencia: 'DIARIO',
        p_data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        p_tipo_emprestimo: 'NOVO',
      });

      // Buscar empréstimo ativo
      const { data: emps } = await supabase
        .from('emprestimos')
        .select('id, status, valor_saldo')
        .eq('cliente_id', cli.id)
        .in('status', ['ATIVO', 'VENCIDO'])
        .order('created_at', { ascending: false })
        .limit(1);
      const emp = emps?.[0];

      // Verificar histórico quitado
      const { data: empsQuitados } = await supabase
        .from('emprestimos')
        .select('id')
        .eq('cliente_id', cli.id)
        .eq('status', 'QUITADO')
        .limit(1);
      const temHistoricoQuitado = !!(empsQuitados && empsQuitados.length > 0);

      const temEmprestimoAtivo = !!emp;

      // Verificar atraso
      let temAtraso = emp?.status === 'VENCIDO';
      if (!temAtraso && emp) {
        const hojeDate = new Date();
        hojeDate.setHours(0, 0, 0, 0);
        const hoje = hojeDate.toISOString().split('T')[0];
        const { data: parcAtrasadas } = await supabase
          .from('emprestimo_parcelas')
          .select('id')
          .eq('emprestimo_id', emp.id)
          .lt('data_vencimento', hoje)
          .neq('status', 'PAGO')
          .neq('status', 'CANCELADO')
          .limit(1);
        temAtraso = !!(parcAtrasadas && parcAtrasadas.length > 0);
      }

      const permiteAdicional = cli.permite_emprestimo_adicional === true || cli.permite_emprestimo_adicional === 'true';
      const permiteReneg = cli.permite_renegociacao === true || cli.permite_renegociacao === 'true';

      // Helper para preencher dados do cliente encontrado
      const preencherCliente = () => {
        s.setNome(cli.nome || '');
        s.setTelefoneCelular(cli.telefone_celular || '');
        s.setDocumento(cli.documento || docBusca);
        s.setEndereco(cli.endereco || '');
        setClienteEncontradoId(cli.id);
        setClienteEncontradoCodigo(cli.codigo_cliente || null);
      };

      if (!temEmprestimoAtivo) {
        preencherCliente();
        if (temHistoricoQuitado) {
          setTipoEmprestimoDetectado('RENOVACAO');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Este es un préstamo de renovación.`
            : `Cliente encontrado: ${cli.nome}. Este é um empréstimo de renovação.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Renovación' : 'Renovação', msg, [{ text: 'OK' }]);
        } else {
          setTipoEmprestimoDetectado('NOVO');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Complete los datos del préstamo.`
            : `Cliente encontrado: ${cli.nome}. Preencha os dados do empréstimo.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Cliente encontrado' : 'Cliente encontrado', msg, [{ text: 'OK' }]);
        }
        return;
      }

      if (temAtraso) {
        if (permiteReneg) {
          preencherCliente();
          setEmprestimoOrigemId(emp.id);
          setTipoEmprestimoDetectado('RENOVACAO');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Está autorizado para renegociar la deuda. Complete los datos del nuevo préstamo.`
            : `Cliente encontrado: ${cli.nome}. Está autorizado para renegociar a dívida. Preencha os dados do novo empréstimo.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Renegociación autorizada' : 'Renegociação autorizada', msg, [{ text: 'OK' }]);
        } else {
          const titulo = lang === 'es' ? 'Parcelas atrasadas' : 'Parcelas atrasadas';
          const msg = lang === 'es'
            ? `El cliente ${cli.nome} tiene parcelas atrasadas. Solicite autorización al administrador para renegociar la deuda.`
            : `O cliente ${cli.nome} tem parcelas atrasadas. Solicite autorização ao administrador para renegociar a dívida.`;
          if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
          else Alert.alert(titulo, msg, [{ text: 'OK' }]);
        }
      } else {
        if (permiteAdicional) {
          preencherCliente();
          setTipoEmprestimoDetectado('ADICIONAL');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Está autorizado a recibir un préstamo adicional. Complete los datos del nuevo préstamo.`
            : `Cliente encontrado: ${cli.nome}. Está autorizado a receber um novo empréstimo. Preencha os dados do empréstimo.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Préstamo adicional autorizado' : 'Empréstimo adicional autorizado', msg, [{ text: 'OK' }]);
        } else {
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

  // -----------------------------------------------------------
  // DETECTAR TIPO quando entra com clienteExistente
  // -----------------------------------------------------------
  useEffect(() => {
    if (!clienteExistente?.id || isRenegociacao || tipoEmprestimoDetectado !== null || clienteEncontradoId) return;

    (async () => {
      try {
        const { data: cli } = await supabase
          .from('clientes')
          .select('id, nome, documento, telefone_celular, endereco, codigo_cliente, permite_emprestimo_adicional, permite_renegociacao')
          .eq('id', clienteExistente.id)
          .single();
        if (!cli) return;

        const { data: emps } = await supabase
          .from('emprestimos')
          .select('id, status, valor_saldo')
          .eq('cliente_id', cli.id)
          .in('status', ['ATIVO', 'VENCIDO'])
          .order('created_at', { ascending: false })
          .limit(1);
        const emp = emps?.[0];

        const { data: empsQuitados } = await supabase
          .from('emprestimos')
          .select('id')
          .eq('cliente_id', cli.id)
          .eq('status', 'QUITADO')
          .limit(1);
        const temHistoricoQuitado = !!(empsQuitados && empsQuitados.length > 0);

        const temEmprestimoAtivo = !!emp;
        let temAtraso = emp?.status === 'VENCIDO';
        if (!temAtraso && emp) {
          const hojeDate = new Date();
          hojeDate.setHours(0, 0, 0, 0);
          const hoje = hojeDate.toISOString().split('T')[0];
          const { data: parcAtrasadas } = await supabase
            .from('emprestimo_parcelas')
            .select('id')
            .eq('emprestimo_id', emp.id)
            .lt('data_vencimento', hoje)
            .neq('status', 'PAGO')
            .neq('status', 'CANCELADO')
            .limit(1);
          temAtraso = !!(parcAtrasadas && parcAtrasadas.length > 0);
        }

        const permiteAdicional = cli.permite_emprestimo_adicional === true || (cli.permite_emprestimo_adicional as any) === 'true';
        const permiteReneg = cli.permite_renegociacao === true || (cli.permite_renegociacao as any) === 'true';

        setClienteEncontradoId(cli.id);
        setClienteEncontradoCodigo(cli.codigo_cliente || null);

        if (!temEmprestimoAtivo) {
          setTipoEmprestimoDetectado(temHistoricoQuitado ? 'RENOVACAO' : 'NOVO');
          return;
        }

        if (temAtraso) {
          if (permiteReneg) {
            setEmprestimoOrigemId(emp.id);
            setTipoEmprestimoDetectado('RENOVACAO');
          } else {
            const titulo = lang === 'es' ? 'Parcelas atrasadas' : 'Parcelas atrasadas';
            const msg = lang === 'es'
              ? `El cliente ${cli.nome} tiene parcelas atrasadas. Solicite autorización al administrador para renegociar la deuda.`
              : `O cliente ${cli.nome} tem parcelas atrasadas. Solicite autorização ao administrador para renegociar a dívida.`;
            if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
            else Alert.alert(titulo, msg);
            navigation.goBack();
          }
        } else {
          if (permiteAdicional) {
            setTipoEmprestimoDetectado('ADICIONAL');
          } else {
            const titulo = lang === 'es' ? 'Préstamo activo' : 'Empréstimo ativo';
            const msg = lang === 'es'
              ? `El cliente ${cli.nome} tiene un préstamo vigente. Solicite autorización al administrador para un préstamo adicional.`
              : `O cliente ${cli.nome} tem um empréstimo em dia. Solicite autorização ao administrador para um empréstimo adicional.`;
            if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
            else Alert.alert(titulo, msg);
            navigation.goBack();
          }
        }
      } catch (e) {
        console.error('Erro ao detectar tipo de empréstimo:', e);
      }
    })();
  }, [clienteExistente?.id, isRenegociacao, tipoEmprestimoDetectado, clienteEncontradoId, lang, navigation]);

  // -----------------------------------------------------------
  // CARREGAR VENDA PENDENTE
  // -----------------------------------------------------------
  useEffect(() => {
    if (!vendaPendenteId || vendaPendenteCarregada) return;
    (async () => {
      try {
        const { data: vp } = await supabase
          .from('vendas_pendentes')
          .select('*')
          .eq('id', vendaPendenteId)
          .single();
        if (!vp) return;

        // Cliente
        s.setNome(vp.cliente_nome || '');
        s.setDocumento(vp.cliente_documento || '');
        if (vp.cliente_telefone) s.setTelefoneCelular(String(vp.cliente_telefone).replace(/^\+\d{1,3}/, ''));
        if (vp.cliente_telefone_fixo) s.setTelefoneFixo(String(vp.cliente_telefone_fixo).replace(/^\+\d{1,3}/, ''));
        s.setEmail(vp.cliente_email || '');
        s.setEndereco(vp.cliente_endereco || '');
        s.setEnderecoComercial(vp.cliente_endereco_comercial || '');
        if (vp.cliente_segmento_id) {
          s.setSegmentoId(vp.cliente_segmento_id);
          const { data: seg } = await supabase
            .from('segmentos')
            .select('nome_pt')
            .eq('id', vp.cliente_segmento_id)
            .maybeSingle();
          if (seg?.nome_pt) s.setSegmentoNome(seg.nome_pt);
        }
        if (vp.cliente_foto_url) s.setFotoCliente(vp.cliente_foto_url);
        s.setObservacoesCliente(vp.cliente_observacoes || '');

        // Empréstimo
        const valorUsar = vp.valor_aprovado != null ? vp.valor_aprovado : vp.valor_principal;
        s.setValorEmprestimo(String(valorUsar).replace(/\.00$/, ''));
        s.setNumeroParcelas(String(vp.numero_parcelas || ''));
        s.setTaxaJuros(String(vp.taxa_juros ?? ''));
        s.setTaxaJurosPersonalizada(true);
        s.setFrequencia(vp.frequencia || 'DIARIO');
        if (vp.data_primeiro_vencimento) s.setDataPrimeiroVencimento(vp.data_primeiro_vencimento);
        if (vp.dia_semana_cobranca != null) s.setDiaSemanaPagamento(String(vp.dia_semana_cobranca));
        if (vp.dia_mes_cobranca != null) s.setDiaMesPagamento(String(vp.dia_mes_cobranca));
        if (vp.dias_mes_cobranca) s.setDiasMesFlexivel(vp.dias_mes_cobranca);
        if (vp.iniciar_proximo_mes != null) s.setIniciarProximoMes(vp.iniciar_proximo_mes);
        s.setObservacoesEmprestimo(vp.observacoes_emprestimo || '');
        if (vp.microseguro_valor) s.setValorMicroseguro(String(vp.microseguro_valor));

        setModalDocVisible(false);
        s.setClienteExpanded(true);
        setVendaPendenteCarregada(true);
      } catch (e) {
        console.error('Erro ao carregar venda pendente:', e);
      }
    })();
  }, [vendaPendenteId, vendaPendenteCarregada]);

  // -----------------------------------------------------------
  // CARREGAR EMPRÉSTIMO ORIGINAL (renegociação)
  // -----------------------------------------------------------
  useEffect(() => {
    const empIdParaCarregar = renegociacao?.emprestimo_id ||
      (tipoEmprestimoDetectado === 'RENOVACAO' && clienteEncontradoId ? '__buscar__' : null);
    if (!empIdParaCarregar) return;

    (async () => {
      try {
        let empId = renegociacao?.emprestimo_id;
        if (!empId && clienteEncontradoId) {
          const { data: emps } = await supabase
            .from('emprestimos')
            .select('id')
            .eq('cliente_id', clienteEncontradoId)
            .in('status', ['ATIVO', 'VENCIDO'])
            .order('created_at', { ascending: false })
            .limit(1);
          empId = emps?.[0]?.id;
        }
        if (!empId) return;

        const { data: emp } = await supabase
          .from('emprestimos')
          .select('valor_saldo, valor_parcela, numero_parcelas, taxa_juros, frequencia_pagamento, dia_semana_cobranca, dia_mes_cobranca, dias_mes_cobranca')
          .eq('id', empId)
          .single();

        if (emp) {
          const saldoStr = (emp.valor_saldo || 0).toFixed(2).replace('.00', '');
          s.setValorEmprestimo(saldoStr);
          s.setNumeroParcelas(String(emp.numero_parcelas || 12));
          if (emp.taxa_juros != null) {
            s.setTaxaJuros(String(emp.taxa_juros));
            s.setTaxaJurosPersonalizada(true);
          }
          if (emp.frequencia_pagamento) {
            s.setFrequencia(emp.frequencia_pagamento);
            if (emp.frequencia_pagamento === 'DIARIO') {
              const d = new Date(); d.setDate(d.getDate() + 1);
              s.setDataPrimeiroVencimento(d.toISOString().split('T')[0]);
            }
          }
          if (emp.dia_semana_cobranca != null) s.setDiaSemanaPagamento(String(emp.dia_semana_cobranca));
          if (emp.dia_mes_cobranca != null) s.setDiaMesPagamento(String(emp.dia_mes_cobranca));
          if (emp.dias_mes_cobranca) s.setDiasMesFlexivel(emp.dias_mes_cobranca);
          console.log('📋 Dados do empréstimo original carregados:', { saldo: emp.valor_saldo, freq: emp.frequencia_pagamento, parcelas: emp.numero_parcelas });
        }
      } catch (e) { console.error('Erro ao carregar empréstimo original:', e); }
    })();
  }, [isRenegociacao, renegociacao?.emprestimo_id, tipoEmprestimoDetectado, clienteEncontradoId]);

  return {
    // Estados
    modalDocVisible, setModalDocVisible,
    docBusca, setDocBusca,
    buscandoDoc,
    clienteEncontradoId, setClienteEncontradoId,
    clienteEncontradoCodigo, setClienteEncontradoCodigo,
    tipoEmprestimoDetectado, setTipoEmprestimoDetectado,
    emprestimOrigemId,

    // Venda pendente
    vendaPendenteId,
    vendaPendenteModo,
    isVendaAprovadaTravada,

    // Actions
    buscarClientePorDocumento,
  };
}
