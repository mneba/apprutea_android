import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { Lang } from '../constants/novaVendaConstants';
import { supabase } from '../services/supabase';

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
  setDiasSemanaPagamento: (v: number[]) => void;
  setDiaMesPagamento: (v: string) => void;
  setDiasMesFlexivel: (v: number[]) => void;
  setIniciarProximoMes: (v: boolean) => void;
  setObservacoesEmprestimo: (v: string) => void;
  setValorMicroseguro: (v: string) => void;
  setClienteExpanded: (v: boolean) => void;
}

interface SolicitacaoRenovacaoParam {
  solic_id: string;
  valor_principal: number;
  numero_parcelas: number;
  taxa_juros: number;
  frequencia: string;
  dia_semana_cobranca?: number | null;
  dias_semana_cobranca?: number[] | null;
  dia_mes_cobranca?: number | null;
  // Termos completos vindos de renovacoes_pendentes — os mesmos que a
  // ClientesScreen já enviava pelo card do cliente.
  dias_mes_cobranca?: number[] | null;
  iniciar_proximo_mes?: boolean | null;
  data_primeiro_vencimento?: string | null;
  observacoes_emprestimo?: string | null;
  microseguro_valor?: number | null;
}

interface UseBuscaDocumentoParams {
  vendedor: any;
  clienteExistente: any;
  renegociacao: any;
  isRenegociacao: boolean;
  vendaPendenteParam: any;
  solicitacaoRenovacaoParam?: SolicitacaoRenovacaoParam | null;
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
  solicitacaoRenovacaoParam,
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
  const [docBusca, setDocBuscaRaw] = useState('');
  // ⭐ Wrapper que sanitiza: apenas a-z, A-Z, 0-9 — máximo 20 caracteres
  const setDocBusca = useCallback((v: string) => {
    setDocBuscaRaw((v || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20));
  }, []);
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [clienteEncontradoId, setClienteEncontradoId] = useState<string | null>(null);
  const [clienteEncontradoCodigo, setClienteEncontradoCodigo] = useState<string | null>(null);
  const [tipoEmprestimoDetectado, setTipoEmprestimoDetectado] = useState<'RENOVACAO' | 'ADICIONAL' | 'NOVO' | null>(null);
  const [emprestimOrigemId, setEmprestimoOrigemId] = useState<string | null>(null);

  // Venda pendente
  const [vendaPendenteIdDetectada, setVendaPendenteIdDetectada] = useState<string | null>(null);
  const [solicitacaoRenovacaoDetectada, setSolicitacaoRenovacaoDetectada] = useState<SolicitacaoRenovacaoParam | null>(
    solicitacaoRenovacaoParam || null
  );
  // TRUE só quando a solicitação encontrada está APROVADA: o admin definiu
  // valor e taxa, e o vendedor não pode alterá-los. No caso PENDENTE +
  // "Alterar" ele precisa editar, por isso não dá para usar
  // `solicitacaoRenovacaoDetectada`, que cobre os dois.
  const [renovacaoAprovadaTravada, setRenovacaoAprovadaTravada] = useState(false);
  const vendaPendenteId = vendaPendenteParam?.id || vendaPendenteIdDetectada || null;
  const vendaPendenteModo = vendaPendenteParam?.modo || (vendaPendenteIdDetectada ? 'aprovada' : null);
  const isVendaAprovadaTravada = vendaPendenteModo === 'aprovada';
  const [vendaPendenteCarregada, setVendaPendenteCarregada] = useState(false);

  // -----------------------------------------------------------
  // BUSCAR CLIENTE POR DOCUMENTO
  // -----------------------------------------------------------
  const buscarClientePorDocumento = async () => {
    // ⭐ Sanitizar: apenas letras e números, máximo 20 caracteres
    const doc = docBusca.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    if (!doc) return;
    setBuscandoDoc(true);
    try {
      const docSemMask = doc;

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

      // ⭐ Busca APENAS exata (sem fallback por substring para evitar falsos positivos)
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome, documento, telefone_celular, endereco, codigo_cliente, status, permite_emprestimo_adicional, permite_renegociacao')
        .or(`documento.eq.${docSemMask},documento.eq.${docBusca}`)
        .limit(1);

      const cli = clientes?.[0];
      if (!cli) {
        s.setDocumento(docBusca);
        setModalDocVisible(false);
        return;
      }

      // ⭐ Cliente suspenso: barra AQUI, no primeiro contato com o cadastro.
      // A fn_renovar_emprestimo também recusa, mas só no "Confirmar venda" —
      // o cobrador já tinha preenchido tudo e, às vezes, combinado com o cliente.
      if (String((cli as any).status || '').toUpperCase() === 'SUSPENSO') {
        setBuscandoDoc(false);
        const titulo = lang === 'es' ? 'Cliente suspendido' : 'Cliente suspenso';
        const msg = lang === 'es'
          ? `${cli.nome} está suspendido. No es posible iniciar renovación ni nuevo préstamo.`
          : `${cli.nome} está suspenso. Não é possível iniciar renovação nem novo empréstimo.`;
        if (Platform.OS === 'web') window.alert(`${titulo}

${msg}`);
        else Alert.alert(titulo, msg, [{ text: 'OK' }]);
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

      // Buscar empréstimo ativo (incluindo rota_id para validar rota)
      const { data: emps } = await supabase
        .from('emprestimos')
        .select('id, status, valor_saldo, rota_id')
        .eq('cliente_id', cli.id)
        .in('status', ['ATIVO', 'VENCIDO'])
        .order('created_at', { ascending: false })
        .limit(1);
      const emp = emps?.[0];

      // ⭐ Se cliente tem empréstimo ativo em OUTRA rota → BLOQUEAR
      if (emp && emp.rota_id && vendedor?.rota_id && emp.rota_id !== vendedor.rota_id) {
        setBuscandoDoc(false);
        const titulo = lang === 'es' ? 'Cliente de otra ruta' : 'Cliente de outra rota';
        const msg = lang === 'es'
          ? `Este cliente tiene un préstamo activo en otra ruta. No es posible registrar venta.`
          : `Este cliente possui empréstimo ativo em outra rota. Não é possível registrar venda.`;
        if (Platform.OS === 'web') window.alert(`${titulo}\n\n${msg}`);
        else Alert.alert(titulo, msg, [{ text: 'OK' }]);
        return;
      }

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
        // ⚠ SEM O DDI. O telefone é gravado como `${ddiCelular}${numero}`,
        // e o seletor de DDI fica no `+55` padrão. Pôr aqui o valor
        // GRAVADO — que já tem o `+55` — fazia a próxima gravação somar
        // outro, e cada venda nova ao mesmo cliente acrescentava mais um:
        // `+55+55+5511578406794`. Eram 301 dos 1.446 celulares em
        // 19/10/2026, e 53 dos 84 clientes da Barcelona.
        //
        // O `+` é repetido de propósito na expressão: ela também limpa o
        // que já está corrompido, em vez de só não piorar.
        //
        // A linha equivalente do fluxo de renovação (mais abaixo, com
        // `vp.cliente_telefone`) sempre fez isso certo — foi dela que saiu
        // o conserto.
        s.setTelefoneCelular(String(cli.telefone_celular || '').replace(/^(\+\d{1,3})+/, ''));
        s.setDocumento(cli.documento || docBusca);
        s.setEndereco(cli.endereco || '');
        setClienteEncontradoId(cli.id);
        setClienteEncontradoCodigo(cli.codigo_cliente || null);
      };

      if (!temEmprestimoAtivo) {
        // ⭐ Verificar se há solicitação RENOVACAO_EXCEDE_ANTERIOR para este cliente
        if (temHistoricoQuitado && vendedor?.rota_id) {
          const { data: solicData } = await supabase
            .from('solicitacoes_autorizacao')
            .select('id, status, valor_solicitado, valor_limite, emprestimo_id, renovacao_pendente_id')
            .eq('cliente_id', cli.id)
            .eq('rota_id', vendedor.rota_id)
            .eq('tipo_solicitacao', 'RENOVACAO_EXCEDE_ANTERIOR')
            .in('status', ['PENDENTE', 'APROVADO'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (solicData) {
            // Termos vêm de `renovacoes_pendentes` — é lá que ficam os valores
            // que o vendedor pediu e, depois, os que o admin aprovou (o web
            // grava as edições via fn_resolver_renovacao_pendente).
            // Antes este trecho copiava parcelas/taxa/frequência do último
            // empréstimo QUITADO e usava `valor_solicitado` como valor: o
            // formulário abria com os termos antigos, não com o que foi
            // autorizado. A tela de Clientes já lia a fonte certa, então os
            // dois caminhos mostravam coisas diferentes.
            let termos: any = null;
            if (solicData.renovacao_pendente_id) {
              const { data: rp } = await supabase.rpc('fn_buscar_detalhes_renovacao_pendente', {
                p_renovacao_pendente_id: solicData.renovacao_pendente_id,
              });
              termos = Array.isArray(rp) ? rp[0] : rp;
            }

            // Sem renovação pendente (solicitações antigas), cai no empréstimo
            // quitado como antes — melhor que abrir o formulário vazio.
            let empQuitado: any = null;
            if (!termos) {
              const { data } = await supabase
                .from('emprestimos')
                .select('numero_parcelas, taxa_juros, frequencia_pagamento, dia_semana_cobranca, dias_semana_cobranca, dia_mes_cobranca')
                .eq('id', solicData.emprestimo_id)
                .single();
              empQuitado = data;
            }

            const solicParam: SolicitacaoRenovacaoParam = {
              solic_id: solicData.id,
              valor_principal: termos?.valor_aprovado ?? termos?.valor_principal ?? solicData.valor_solicitado ?? 0,
              numero_parcelas: termos?.numero_parcelas || empQuitado?.numero_parcelas || 10,
              taxa_juros: termos?.taxa_juros ?? empQuitado?.taxa_juros ?? 20,
              frequencia: termos?.frequencia || empQuitado?.frequencia_pagamento || 'DIARIO',
              dia_semana_cobranca: termos?.dia_semana_cobranca ?? empQuitado?.dia_semana_cobranca ?? null,
              dias_semana_cobranca: termos?.dias_semana_cobranca ?? empQuitado?.dias_semana_cobranca ?? null,
              dia_mes_cobranca: termos?.dia_mes_cobranca ?? empQuitado?.dia_mes_cobranca ?? null,
              dias_mes_cobranca: termos?.dias_mes_cobranca ?? null,
              iniciar_proximo_mes: termos?.iniciar_proximo_mes ?? false,
              data_primeiro_vencimento: termos?.data_primeiro_vencimento ?? null,
              observacoes_emprestimo: termos?.observacoes_emprestimo ?? null,
              microseguro_valor: termos?.microseguro_valor ?? null,
            };

            if (solicData.status === 'APROVADO') {
              // Aprovada — pré-preencher form e travar
              preencherCliente();
              setSolicitacaoRenovacaoDetectada(solicParam);
              setRenovacaoAprovadaTravada(true);
              s.setValorEmprestimo(String(solicParam.valor_principal));
              s.setNumeroParcelas(String(solicParam.numero_parcelas));
              s.setTaxaJuros(String(solicParam.taxa_juros));
              s.setTaxaJurosPersonalizada(true);
              s.setFrequencia(solicParam.frequencia);
              if (solicParam.dias_semana_cobranca && solicParam.dias_semana_cobranca.length > 0) {
                s.setDiasSemanaPagamento([...solicParam.dias_semana_cobranca].sort((a, b) => a - b));
              } else if (solicParam.dia_semana_cobranca != null) {
                s.setDiaSemanaPagamento(String(solicParam.dia_semana_cobranca));
              }
              if (solicParam.dia_mes_cobranca != null) s.setDiaMesPagamento(String(solicParam.dia_mes_cobranca));
              if (solicParam.dias_mes_cobranca) s.setDiasMesFlexivel(solicParam.dias_mes_cobranca);
              if (solicParam.iniciar_proximo_mes != null) s.setIniciarProximoMes(solicParam.iniciar_proximo_mes);
              if (solicParam.data_primeiro_vencimento) s.setDataPrimeiroVencimento(solicParam.data_primeiro_vencimento);
              if (solicParam.observacoes_emprestimo) s.setObservacoesEmprestimo(solicParam.observacoes_emprestimo);
              if (solicParam.microseguro_valor) s.setValorMicroseguro(String(solicParam.microseguro_valor));
              setTipoEmprestimoDetectado('RENOVACAO');
              setModalDocVisible(false);
              const msg = lang === 'es'
                ? `Renovacion aprobada para ${cli.nome}. Los campos estan bloqueados segun lo autorizado.`
                : `Renovacao aprovada para ${cli.nome}. Os campos estao bloqueados conforme autorizado.`;
              if (Platform.OS === 'web') window.alert(msg);
              else Alert.alert(lang === 'es' ? 'Renovacion aprobada' : 'Renovacao aprovada', msg, [{ text: 'OK' }]);
              return;
            }

            // PENDENTE — mostrar opções
            const msgPendente = lang === 'es'
              ? `Solicitud pendiente de renovacion por $ ${solicData.valor_solicitado} (limite: $ ${solicData.valor_limite}) para ${cli.nome}.`
              : `Solicitacao pendente de renovacao por $ ${solicData.valor_solicitado} (limite: $ ${solicData.valor_limite}) para ${cli.nome}.`;

            const handleAlterar = () => {
              preencherCliente();
              setSolicitacaoRenovacaoDetectada(solicParam);
              s.setValorEmprestimo(String(solicParam.valor_principal));
              s.setNumeroParcelas(String(solicParam.numero_parcelas));
              s.setTaxaJuros(String(solicParam.taxa_juros));
              s.setTaxaJurosPersonalizada(true);
              s.setFrequencia(solicParam.frequencia);
              if (solicParam.dias_semana_cobranca && solicParam.dias_semana_cobranca.length > 0) {
                s.setDiasSemanaPagamento([...solicParam.dias_semana_cobranca].sort((a, b) => a - b));
              } else if (solicParam.dia_semana_cobranca != null) {
                s.setDiaSemanaPagamento(String(solicParam.dia_semana_cobranca));
              }
              if (solicParam.dia_mes_cobranca != null) s.setDiaMesPagamento(String(solicParam.dia_mes_cobranca));
              if (solicParam.dias_mes_cobranca) s.setDiasMesFlexivel(solicParam.dias_mes_cobranca);
              if (solicParam.iniciar_proximo_mes != null) s.setIniciarProximoMes(solicParam.iniciar_proximo_mes);
              if (solicParam.data_primeiro_vencimento) s.setDataPrimeiroVencimento(solicParam.data_primeiro_vencimento);
              if (solicParam.observacoes_emprestimo) s.setObservacoesEmprestimo(solicParam.observacoes_emprestimo);
              if (solicParam.microseguro_valor) s.setValorMicroseguro(String(solicParam.microseguro_valor));
              setTipoEmprestimoDetectado('RENOVACAO');
              setModalDocVisible(false);
            };

            const handleCancelar = async () => {
              await supabase
                .from('solicitacoes_autorizacao')
                .update({ status: 'CANCELADO', motivo_resolucao: 'Cancelado pelo vendedor', data_resolucao: new Date().toISOString() })
                .eq('id', solicData.id);
              // Prosseguir como renovação normal sem restrição
              preencherCliente();
              setTipoEmprestimoDetectado('RENOVACAO');
              setModalDocVisible(false);
            };

            if (Platform.OS === 'web') {
              const alterar = window.confirm('OK = Alterar e cancelar solicitacao / Cancelar = ver mais opcoes');
              if (alterar) {
                handleAlterar();
              } else {
                const cancelar = window.confirm(lang === 'es' ? 'Cancelar la solicitud?' : 'Cancelar a solicitacao?');
                if (cancelar) await handleCancelar();
              }
            } else {
              Alert.alert(
                lang === 'es' ? 'Solicitud pendiente' : 'Solicitacao pendente',
                msgPendente,
                [
                  { text: lang === 'es' ? 'Cancelar solicitud' : 'Cancelar solicitacao', style: 'destructive', onPress: handleCancelar },
                  { text: lang === 'es' ? 'Alterar y cancelar' : 'Alterar e cancelar', onPress: handleAlterar },
                  { text: lang === 'es' ? 'Cerrar' : 'Fechar', style: 'cancel' },
                ]
              );
            }
            return;
          }
        }

        // Sem solicitação pendente — fluxo normal
        preencherCliente();
        if (temHistoricoQuitado) {
          setTipoEmprestimoDetectado('RENOVACAO');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Este es un prestamo de renovacion.`
            : `Cliente encontrado: ${cli.nome}. Este e um emprestimo de renovacao.`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert(lang === 'es' ? 'Renovacao' : 'Renovação', msg, [{ text: 'OK' }]);
        } else {
          setTipoEmprestimoDetectado('NOVO');
          setModalDocVisible(false);
          const msg = lang === 'es'
            ? `Cliente encontrado: ${cli.nome}. Complete los datos del prestamo.`
            : `Cliente encontrado: ${cli.nome}. Preencha os dados do emprestimo.`;
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
          .select('id, nome, documento, telefone_celular, endereco, codigo_cliente, status, permite_emprestimo_adicional, permite_renegociacao')
          .eq('id', clienteExistente.id)
          .single();
        if (!cli) return;

        // Mesma trava do caminho por documento: cliente vindo pré-selecionado
        // pelo card também não pode iniciar renovação estando suspenso.
        if (String((cli as any).status || '').toUpperCase() === 'SUSPENSO') {
          const titulo = lang === 'es' ? 'Cliente suspendido' : 'Cliente suspenso';
          const msg = lang === 'es'
            ? `${cli.nome} está suspendido. No es posible iniciar renovación ni nuevo préstamo.`
            : `${cli.nome} está suspenso. Não é possível iniciar renovação nem novo empréstimo.`;
          if (Platform.OS === 'web') { window.alert(`${titulo}

${msg}`); navigation.goBack(); }
          else Alert.alert(titulo, msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
          return;
        }

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
        if (vp.dias_semana_cobranca && vp.dias_semana_cobranca.length > 0) {
          s.setDiasSemanaPagamento([...vp.dias_semana_cobranca].sort((a, b) => a - b));
        } else if (vp.dia_semana_cobranca != null) {
          s.setDiaSemanaPagamento(String(vp.dia_semana_cobranca));
        }
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
  // CARREGAR O EMPRÉSTIMO DE REFERÊNCIA
  // -----------------------------------------------------------
  //
  // Pedido do Julio em 07/10/2026: "na renovação de um cliente seria muito
  // funcional o formulário já abrir preenchido com as informações do último
  // empréstimo — valor, juros, quantidade de parcelas e frequência. Se o
  // último foi de 300 nas mesmas condições, ao clicar em Renovar esses dados
  // já apareceriam como referência, e o cobrador só alteraria o necessário."
  //
  // Isto já existia, e falhava justamente no caso que ele descreve. Duas
  // correções, em 12/10/2026:
  //
  // 1. A BUSCA SÓ OLHAVA EMPRÉSTIMO EM ABERTO. A renovação clássica — cliente
  //    QUITOU e volta para pegar de novo — é detectada por
  //    `temHistoricoQuitado`, e nesse cliente não há nada ATIVO nem VENCIDO.
  //    A consulta voltava vazia e o formulário abria em branco. Agora, não
  //    achando em aberto, procura o último quitado.
  //
  // 2. O VALOR VINHA DO SALDO DEVEDOR, e os dois casos querem números
  //    diferentes:
  //
  //      renegociação  refinancia a dívida — o novo principal É o saldo que
  //                    sobrou, e é isso que o vendedor espera ver;
  //      renovação     é empréstimo novo de tamanho parecido — quem serve de
  //                    referência é o PRINCIPAL do anterior, os 300 do
  //                    exemplo, não os 40 que ainda faltavam.
  //
  //    `emprestimOrigemId` distingue os dois sem adivinhação: ele só é
  //    preenchido nos caminhos que chamam `fn_renegociar_emprestimo`.
  //
  // Ordenado por `created_at` e não por `data_emprestimo`: cerca de 650
  // empréstimos nasceram com data divergente da liquidação (ver CLAUDE.md), e
  // "o último" tem de ser o último de verdade.
  useEffect(() => {
    // ⚠ REFERÊNCIA NÃO PASSA NA FRENTE DE AUTORIZAÇÃO.
    //
    // Havendo solicitação de renovação em mão, os termos que valem são os
    // que o ADMIN liberou — já preenchidos pelo efeito da solicitação ou
    // pelo parâmetro do card. Este efeito rodava junto e os
    // SOBRESCREVIA pelo último empréstimo, porque só olhava
    // `tipoEmprestimoDetectado === 'RENOVACAO'`.
    //
    // E perdia sempre, porque é o último a terminar: a solicitação grava
    // o valor ao fim da própria busca, que é quem acende
    // `tipoEmprestimoDetectado` e `clienteEncontradoId` — as duas
    // dependências daqui. Então a tela mostrava o valor aprovado e, uma
    // fração de segundo depois, ele virava o valor do empréstimo
    // anterior. Com o campo TRAVADO (`renovacaoAprovadaTravada`), o
    // vendedor não tinha como corrigir.
    //
    // O estrago não parava na tela: `fn_renovar_emprestimo` só exige
    // autorização quando `p_valor_principal > valor do anterior`. Com o
    // valor sobrescrito para exatamente o do anterior, a comparação dá
    // falso, a função cria o empréstimo pelo valor VELHO e a aprovação
    // nunca é consumida — fica `APROVADO` para sempre, e o card continua
    // oferecendo.
    //
    // Relatado pelo Mauricio em 26/10/2026. MEDIDO na Paola 2, com o
    // relógio, três casos em cinco dias:
    //
    //   Lucho          26/10 19:22:21 pediu · 19:22:40 aprovado 600,00
    //                        19:23:02 empréstimo de 100,00  (ATIVO)
    //   Marcos Oliveira 26/10 19:09:58 pediu · 19:10:32 aprovado 2.000,00
    //                        19:11:05 empréstimo de 200,00  (anulado)
    //   Juan Carlos     22/10 15:16:28 pediu · 15:16:57 aprovado 1.000,00
    //                        15:17:29 empréstimo de 700,00  (ATIVO)
    //
    // Os três valores criados são, ao centavo, o `valor_principal` do
    // último empréstimo QUITADO de cada cliente — que é exatamente o que
    // a consulta deste efeito busca.
    //
    // A guarda cobre os DOIS caminhos de entrada porque
    // `solicitacaoRenovacaoDetectada` nasce do parâmetro do card e
    // também é gravada pela busca por documento. `renegociacao` segue
    // passando: ali o alvo é explícito e o número certo é o saldo.
    if (solicitacaoRenovacaoDetectada && !renegociacao?.emprestimo_id) return;

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

          // Nada em aberto: é o cliente que quitou e voltou. O último quitado
          // é a referência — sem isto, a renovação mais comum de todas abria
          // com o formulário em branco.
          if (!empId) {
            const { data: quitados } = await supabase
              .from('emprestimos')
              .select('id')
              .eq('cliente_id', clienteEncontradoId)
              .eq('status', 'QUITADO')
              .order('created_at', { ascending: false })
              .limit(1);
            empId = quitados?.[0]?.id;
          }
        }
        if (!empId) return;

        const { data: emp } = await supabase
          .from('emprestimos')
          .select('valor_principal, valor_saldo, valor_parcela, numero_parcelas, taxa_juros, frequencia_pagamento, dia_semana_cobranca, dias_semana_cobranca, dia_mes_cobranca, dias_mes_cobranca')
          .eq('id', empId)
          .single();

        if (emp) {
          // Renegociação parte do saldo; renovação parte do principal. Ver o
          // porquê no comentário do topo deste efeito.
          const ehRenegociacao = !!renegociacao?.emprestimo_id || !!emprestimOrigemId;
          const base = ehRenegociacao
            ? Number(emp.valor_saldo || 0)
            : Number(emp.valor_principal || emp.valor_saldo || 0);

          s.setValorEmprestimo(base.toFixed(2).replace('.00', ''));
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
          if (emp.dias_semana_cobranca && emp.dias_semana_cobranca.length > 0) {
            s.setDiasSemanaPagamento([...emp.dias_semana_cobranca].sort((a, b) => a - b));
          } else if (emp.dia_semana_cobranca != null) {
            s.setDiaSemanaPagamento(String(emp.dia_semana_cobranca));
          }
          if (emp.dia_mes_cobranca != null) s.setDiaMesPagamento(String(emp.dia_mes_cobranca));
          if (emp.dias_mes_cobranca) s.setDiasMesFlexivel(emp.dias_mes_cobranca);
          console.log('📋 Referência carregada:', {
            origem: ehRenegociacao ? 'saldo (renegociação)' : 'principal (renovação)',
            valor: base, freq: emp.frequencia_pagamento, parcelas: emp.numero_parcelas,
          });
        }
      } catch (e) { console.error('Erro ao carregar empréstimo original:', e); }
    })();
  }, [isRenegociacao, renegociacao?.emprestimo_id, tipoEmprestimoDetectado, clienteEncontradoId,
      solicitacaoRenovacaoDetectada]);

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

    // Solicitação de renovação detectada
    solicitacaoRenovacaoDetectada,
    renovacaoAprovadaTravada,

    // Actions
    buscarClientePorDocumento,
  };
}