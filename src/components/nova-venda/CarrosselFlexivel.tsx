// =====================================================================
// CARROSSEL DO EMPRÉSTIMO FLEXÍVEL
// Arquivo: src/components/nova-venda/CarrosselFlexivel.tsx
// =====================================================================
//
// O flexível era a frequência mais fácil de errar: uma grade de 31 dias solta
// no formulário, um campo de data em outro lugar da tela, e um checkbox
// "iniciar no próximo mês" que ninguém entendia — e que, descobrimos, NUNCA
// foi lido pelo gerador de parcelas.
//
// Aqui é um ACORDEÃO de três tópicos, não uma sequência de telas soltas:
//
//   1. Data da primeira parcela  — a ÂNCORA, escolhida num calendário de mês.
//   2. Dias de pagamento         — os dias que se repetem, numa grade de 31.
//   3. Cálculo das datas         — nota, não etapa: quem calcula é o servidor.
//
// A folha abre com os três abertos em texto: é a explicação. No "Começar", o
// tópico 1 sobe e expande, e os outros descem recolhidos. A explicação não
// desaparece para dar lugar ao formulário — ela VIRA o formulário, e o
// vendedor nunca perde de vista onde está na regra.
//
// Cada escolha vira um BLOCO logo abaixo do tópico que a produziu, na mesma
// linguagem visual nos dois: a primeira parcela e cada dia do mês são o mesmo
// tipo de objeto. O bloco é o retorno de "entendi o que você escolheu" — em
// vez de o vendedor ter de reler a grade para saber o que está marcado.
//
// ALTURA FIXA, DE PROPÓSITO. A folha tem altura calculada uma vez e não se
// move entre os passos: cabeçalho, trilha e rodapé são fixos e só o miolo
// rola. Popup que cresce e encolhe a cada etapa quebra o padrão visual que o
// usuário espera de um processo em etapas, e o botão de avançar sai do lugar
// justo quando a mão já está indo nele.
//
// Nenhuma data é calculada aqui. Domingo, feriado, mês sem o dia 31 — tudo
// isso é regra de negócio e mora no Postgres. O Finalizar chama
// `fn_datas_parcelas`, a mesma função que vai gerar as parcelas na hora de
// salvar: se ela recusar, não confirmamos. Ver
// sql/2026-09-26_datas_parcelas_unificadas.sql.

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import Carregando from '../Carregando';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// O acordeão precisa do movimento: "sobe o 1, descem os outros" só se lê como
// uma coisa se a transição for vista. Curta, para não atrasar a mão.
const ANIM = {
  duration: 180,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
} as const;

type Lang = 'pt-BR' | 'es';

interface Props {
  visible: boolean;
  onClose: () => void;
  lang: Lang;
  /** Quantas parcelas o empréstimo terá — usado na validação do cronograma. */
  numeroParcelas: number;
  /**
   * `data_liquidacao` da liquidação em que a venda está sendo lançada — a data
   * operacional, e a régua de tudo aqui: qual mês o calendário abre e quais
   * dias ficam disponíveis. Ver CLAUDE.md, "A liquidação é a régua do tempo".
   */
  dataOperacional?: string;
  /** Valores atuais do formulário, para reabrir o carrossel já preenchido. */
  dataInicial?: string | null;
  diasIniciais?: number[];
  /** Devolve a âncora (`YYYY-MM-DD`) e os dias marcados. */
  onConfirmar: (data: string, dias: number[]) => void;
}

const TX = {
  'pt-BR': {
    titulo: 'Empréstimo flexível',
    passo: 'Passo',
    de: 'de',
    t1: 'Data da primeira parcela',
    t1txt: 'Você escolhe a data da primeira parcela. Ela define o mês em que o empréstimo começa.',
    t1ajuda: 'Toque no dia. Os dias apagados não estão disponíveis.',
    t2: 'Dias de pagamento',
    t2txt: 'Depois escolhe os dias do mês em que o cliente vai pagar. Esses dias se repetem todos os meses.',
    t2ajuda: 'Toque nos dias do mês. Cada um vira uma regra que se repete.',
    t3: 'Cálculo das datas',
    t3txt: 'As datas são calculadas pelo servidor, que já ajusta o que cair em domingo ou feriado da rota.',
    primeira: 'Primeira parcela',
    todoDiaPre: 'todo dia ',
    todoDiaPos: '',
    semBloco1: 'Escolha o dia no calendário acima',
    semBloco2: 'Nenhum dia escolhido ainda',
    comecar: 'Começar',
    voltar: 'Voltar',
    proximo: 'Próximo',
    finalizar: 'Finalizar',
    validando: 'Validando…',
    erroValidar: 'Não foi possível validar o cronograma',
    diasSemana: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  },
  'es': {
    titulo: 'Préstamo flexible',
    passo: 'Paso',
    de: 'de',
    t1: 'Fecha de la primera cuota',
    t1txt: 'Usted elige la fecha de la primera cuota. Ella define el mes en que empieza el préstamo.',
    t1ajuda: 'Toque el día. Los días apagados no están disponibles.',
    t2: 'Días de pago',
    t2txt: 'Después elige los días del mes en que el cliente va a pagar. Esos días se repiten todos los meses.',
    t2ajuda: 'Toque los días del mes. Cada uno se vuelve una regla que se repite.',
    t3: 'Cálculo de las fechas',
    t3txt: 'Las fechas las calcula el servidor, que ya ajusta lo que caiga en domingo o feriado de la ruta.',
    primeira: 'Primera cuota',
    todoDiaPre: 'día ',
    todoDiaPos: ' de cada mes',
    semBloco1: 'Elija el día en el calendario de arriba',
    semBloco2: 'Aún no eligió ningún día',
    comecar: 'Empezar',
    voltar: 'Volver',
    proximo: 'Siguiente',
    finalizar: 'Finalizar',
    validando: 'Validando…',
    erroValidar: 'No se pudo validar el cronograma',
    diasSemana: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  },
};

const MESES = {
  'pt-BR': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  'es': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};

/** `YYYY-MM-DD` → partes numéricas, sem passar por Date (evita fuso). */
const partes = (isoStr: string) => {
  const [a, m, d] = isoStr.substring(0, 10).split('-').map(Number);
  return { ano: a, mes: m, dia: d };
};

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

const diasNoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();

/** Dia da semana, sem deslocamento de fuso. 0 = domingo. */
const diaSemana = (ano: number, mes: number, dia: number) =>
  new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();

const fmtBR = (isoStr: string) => {
  const { ano, mes, dia } = partes(isoStr);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
};

const dd = (n: number) => String(n).padStart(2, '0');

/** Meses desde o ano 0, para comparar dois meses com um inteiro. */
const ordinalMes = (ano: number, mes: number) => ano * 12 + (mes - 1);

export default function CarrosselFlexivel({
  visible, onClose, lang, numeroParcelas, dataOperacional,
  dataInicial, diasIniciais, onConfirmar,
}: Props) {
  const t = TX[lang];
  const { vendedor } = useAuth();
  const { height: alturaJanela } = useWindowDimensions();

  // Altura travada. Calculada da janela, com teto para não virar uma folha
  // absurda em tablet. Não muda entre os passos — ver o cabeçalho do arquivo.
  const alturaFolha = Math.min(Math.round(alturaJanela * 0.88), 720);

  // 0 = explicação (os três tópicos abertos em texto); 1 e 2 = as etapas.
  const [passo, setPasso] = useState(0);
  const [hojeRota, setHojeRota] = useState<string | null>(null);
  const [mesVis, setMesVis] = useState<{ ano: number; mes: number } | null>(null);
  const [dataAncora, setDataAncora] = useState<string | null>(null);
  const [dias, setDias] = useState<number[]>([]);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fallback, e só isso. A régua é `dataOperacional` — a liquidação aberta.
  // `fn_data_hoje_rota` entra apenas quando não há dia aberto, que é a regra 2
  // do CLAUDE.md, "A liquidação é a régua do tempo". Usar a RPC como regra era
  // errado: operando 25/08 num dia 27/09, o calendário abria em setembro e
  // bloqueava os dias de agosto que o vendedor precisava.
  //
  // Com liquidação aberta a RPC não é nem chamada — uma ida ao servidor menos.
  useEffect(() => {
    if (!visible || dataOperacional || !vendedor?.rota_id) return;
    // O thenable do Supabase nao tem .catch: o erro se trata dentro do then.
    supabase.rpc('fn_data_hoje_rota', { p_rota_id: vendedor.rota_id }).then(
      ({ data, error }) => setHojeRota(!error && typeof data === 'string' ? data.substring(0, 10) : null),
      () => setHojeRota(null),
    );
  }, [visible, dataOperacional, vendedor?.rota_id]);

  const hoje = dataOperacional ?? hojeRota;

  // Reabrir com o que já estava escolhido: editar não pode custar recomeçar.
  //
  // O ref garante que isto rode UMA vez por abertura. Sem ele, `hoje` chegando
  // do servidor (ou qualquer re-render do pai) jogaria o vendedor de volta à
  // explicação no meio do processo.
  const abertoRef = useRef(false);
  useEffect(() => {
    if (!visible) { abertoRef.current = false; return; }
    if (abertoRef.current) return;
    abertoRef.current = true;
    setPasso(0);
    setErro(null);
    setValidando(false);
    setMesVis(null);
    setDias(diasIniciais && diasIniciais.length ? [...diasIniciais] : []);
    setDataAncora(dataInicial ? dataInicial.substring(0, 10) : null);
  }, [visible, dataInicial, diasIniciais]);

  const irPara = (n: number) => {
    LayoutAnimation.configureNext(ANIM);
    setErro(null);
    setPasso(n);
  };

  // Mês visível no calendário: o escolhido, senão o da âncora que já existe,
  // senão o operacional. Derivado, não sincronizado — nada para dessincronizar.
  const mesAtual = hoje ? partes(hoje) : null;
  const mes = mesVis
    ?? (dataAncora ? { ano: partes(dataAncora).ano, mes: partes(dataAncora).mes } : null)
    ?? (mesAtual ? { ano: mesAtual.ano, mes: mesAtual.mes } : null);

  // A janela de meses continua sendo a mesma de antes: o mês operacional e o
  // seguinte. Mudar isso é regra de negócio, não UI.
  const limiteMin = mesAtual ? ordinalMes(mesAtual.ano, mesAtual.mes) : 0;
  const limiteMax = limiteMin + 1;
  const ordAtual = mes ? ordinalMes(mes.ano, mes.mes) : 0;
  const podeVoltarMes = !!mes && !!mesAtual && ordAtual > limiteMin;
  const podeAvancarMes = !!mes && !!mesAtual && ordAtual < limiteMax;

  const andarMes = (saltos: number) => {
    if (!mes || !mesAtual) return;
    const alvo = ordAtual + saltos;
    if (alvo < limiteMin || alvo > limiteMax) return;
    setMesVis({ ano: Math.floor(alvo / 12), mes: (alvo % 12) + 1 });
  };

  const alternarDia = useCallback((d: number) => {
    LayoutAnimation.configureNext(ANIM);
    setDias(p => (p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort((a, b) => a - b)));
  }, []);

  // Dia que já passou não pode ser âncora. Só restringe o mês operacional.
  const diaBloqueado = (d: number) => {
    if (!mes || !mesAtual) return false;
    if (d > diasNoMes(mes.ano, mes.mes)) return true;
    return mes.ano === mesAtual.ano && mes.mes === mesAtual.mes && d < mesAtual.dia;
  };

  // O Finalizar não fecha antes de o BANCO aceitar. Se eu validasse aqui, a
  // tela aprovaria uma combinação que o salvamento depois recusaria — que é
  // exatamente o tipo de divergência que este projeto já pagou caro.
  const finalizar = async () => {
    if (!dataAncora || !dias.length || !vendedor?.rota_id) return;
    setValidando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc('fn_datas_parcelas', {
        p_rota_id: vendedor.rota_id,
        p_quantidade: numeroParcelas,
        p_data_primeira: dataAncora,
        p_frequencia: 'FLEXIVEL',
        p_dia_especifico: null,
        p_dias_flexivel: dias,
      });
      if (error) throw error;
      if (!Array.isArray(data) || !data.length) throw new Error(t.erroValidar);
      onConfirmar(dataAncora, dias);
      onClose();
    } catch (e: any) {
      console.error('❌ Validação do flexível:', e);
      setErro(e?.message || t.erroValidar);
    } finally {
      setValidando(false);
    }
  };

  const podeAvancar =
    (passo === 0)
    || (passo === 1 && !!dataAncora)
    || (passo === 2 && dias.length > 0 && !validando);

  // ── Calendário de mês, para a âncora ────────────────────────────────────
  const calendarioMes = () => {
    if (!mes) return <Carregando variante="bloco" tamanho="small" />;
    const total = diasNoMes(mes.ano, mes.mes);
    const vazias = diaSemana(mes.ano, mes.mes, 1);
    const celulas: (number | null)[] = [
      ...Array.from({ length: vazias }, () => null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
    const escolhido = dataAncora ? partes(dataAncora) : null;

    return (
      <>
        <View style={S.mesBarra}>
          <TouchableOpacity
            style={[S.mesSeta, !podeVoltarMes && S.mesSetaOff]}
            onPress={() => andarMes(-1)}
            disabled={!podeVoltarMes}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={podeVoltarMes ? '#4338CA' : '#D1D5DB'} />
          </TouchableOpacity>
          <Text style={S.mesNome}>{MESES[lang][mes.mes - 1]} {mes.ano}</Text>
          <TouchableOpacity
            style={[S.mesSeta, !podeAvancarMes && S.mesSetaOff]}
            onPress={() => andarMes(1)}
            disabled={!podeAvancarMes}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={podeAvancarMes ? '#4338CA' : '#D1D5DB'} />
          </TouchableOpacity>
        </View>

        <View style={S.semana}>
          {t.diasSemana.map(d => (
            <Text key={d} style={S.semanaTx}>{d}</Text>
          ))}
        </View>

        <View style={S.calGrade}>
          {celulas.map((d, i) => {
            if (d === null) return <View key={`v${i}`} style={S.calCel} />;
            const off = diaBloqueado(d);
            const on = !!escolhido && escolhido.ano === mes.ano
              && escolhido.mes === mes.mes && escolhido.dia === d;
            return (
              <View key={d} style={S.calCel}>
                <TouchableOpacity
                  style={[S.calDia, on && S.calDiaOn, off && S.calDiaOff]}
                  onPress={() => {
                    LayoutAnimation.configureNext(ANIM);
                    setDataAncora(iso(mes.ano, mes.mes, d));
                  }}
                  disabled={off}
                  activeOpacity={0.6}
                >
                  <Text style={[S.calDiaTx, on && S.calDiaTxOn, off && S.calDiaTxOff]}>{d}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  // ── Grade solta de 31 dias, para os dias que se repetem ─────────────────
  const grade31 = () => (
    <View style={S.grade}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
        const on = dias.includes(d);
        return (
          <TouchableOpacity
            key={d}
            style={[S.dia, on && S.diaOn]}
            onPress={() => alternarDia(d)}
            activeOpacity={0.6}
          >
            <Text style={[S.diaTx, on && S.diaTxOn]}>{d}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const blocoVazio = (texto: string) => (
    <View style={S.vazio}>
      <Ionicons name="ellipse-outline" size={14} color="#9CA3AF" />
      <Text style={S.vazioTx}>{texto}</Text>
    </View>
  );

  // Resumo que o tópico recolhido mostra: o que já foi respondido nele.
  const resumoDe = (n: number) => {
    if (n === 1) return dataAncora ? fmtBR(dataAncora) : null;
    if (n === 2) return dias.length ? dias.map(dd).join(' · ') : null;
    return null;
  };

  // ── Conteúdo de cada tópico expandido ───────────────────────────────────
  const conteudoDoTopico = (n: number) => {
    if (n === 1) {
      return (
        <>
          <Text style={S.ajuda}>{t.t1ajuda}</Text>
          {calendarioMes()}
          {/* O bloco da primeira parcela vive AQUI, logo abaixo do calendário
              que o produziu — e usa o mesmo `S.bloco` dos dias do mês, para
              que os dois se leiam como o mesmo tipo de objeto. */}
          <View style={S.blocos}>
            {dataAncora ? (
              <View style={S.bloco}>
                <View style={S.blocoSelo}>
                  <Ionicons name="flag" size={13} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.blocoRot}>{t.primeira}</Text>
                  <Text style={S.blocoVal}>
                    <Text style={S.blocoForte}>{fmtBR(dataAncora)}</Text>
                    {'  ·  '}
                    {t.diasSemana[diaSemana(
                      partes(dataAncora).ano, partes(dataAncora).mes, partes(dataAncora).dia,
                    )]}
                  </Text>
                </View>
              </View>
            ) : blocoVazio(t.semBloco1)}
          </View>
        </>
      );
    }

    if (n === 2) {
      return (
        <>
          <Text style={S.ajuda}>{t.t2ajuda}</Text>
          {grade31()}
          <View style={S.blocos}>
            {dias.length ? dias.map(d => (
              <View key={d} style={S.bloco}>
                <View style={S.blocoSelo}>
                  <Text style={S.blocoSeloTx}>{d}</Text>
                </View>
                <Text style={[S.blocoVal, { flex: 1 }]}>
                  {t.todoDiaPre}
                  <Text style={S.blocoForte}>{dd(d)}</Text>
                  {t.todoDiaPos}
                </Text>
                <TouchableOpacity onPress={() => alternarDia(d)} hitSlop={8}>
                  <Ionicons name="close-circle" size={19} color="#C7D2FE" />
                </TouchableOpacity>
              </View>
            )) : blocoVazio(t.semBloco2)}
          </View>

          {!!erro && (
            <View style={S.erro}>
              <Ionicons name="alert-circle" size={16} color="#B45309" />
              <Text style={S.erroTx}>{erro}</Text>
            </View>
          )}
        </>
      );
    }

    return null;
  };

  const TOPICOS = [
    { n: 1, titulo: t.t1, texto: t.t1txt },
    { n: 2, titulo: t.t2, texto: t.t2txt },
    // O 3 é nota, não etapa: não expande e não recebe toque. Fica para o
    // vendedor saber que as datas não são invenção da tela.
    { n: 3, titulo: t.t3, texto: t.t3txt },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={[S.folha, { height: alturaFolha }]}>

          <View style={S.header}>
            <View style={{ flex: 1 }}>
              <Text style={S.titulo}>{t.titulo}</Text>
              {passo > 0 && (
                <Text style={S.passoTx}>{t.passo} {passo} {t.de} 2</Text>
              )}
            </View>
            <TouchableOpacity style={S.fechar} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* A trilha ocupa o lugar sempre, mesmo na explicação — se ela
              aparecesse só a partir do passo 1, o miolo pularia. */}
          <View style={S.trilha}>
            {[1, 2].map(n => (
              <View key={n} style={[S.trilhaItem, passo >= n && S.trilhaItemOn]} />
            ))}
          </View>

          <ScrollView style={S.corpo} showsVerticalScrollIndicator={false}>
            {TOPICOS.map(({ n, titulo, texto }) => {
              const nota = n === 3;
              const ativo = passo === n;
              const explicando = passo === 0;
              const resumo = resumoDe(n);
              // Tocar num tópico recolhido volta para ele — é o caminho curto
              // que um acordeão promete. Só para trás, e só o que já está
              // respondido: pular adiante sem a âncora não faz sentido.
              const alcancavel = !nota && !explicando && !ativo
                && (n < passo || !!resumoDe(n - 1));

              return (
                <View key={n} style={[S.topico, ativo && S.topicoAtivo, nota && S.topicoNota]}>
                  <TouchableOpacity
                    style={S.topicoCabeca}
                    onPress={() => alcancavel && irPara(n)}
                    disabled={!alcancavel}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      S.num,
                      ativo && S.numAtivo,
                      nota && S.numNota,
                    ]}>{n}</Text>

                    <View style={{ flex: 1 }}>
                      <Text style={[S.topicoTitulo, ativo && S.topicoTituloAtivo]}>{titulo}</Text>

                      {/* Na explicação todos mostram o texto. Depois, o
                          recolhido mostra a resposta que já tem — o texto sai
                          de cena porque já foi lido. */}
                      {(explicando || nota) && <Text style={S.topicoTexto}>{texto}</Text>}
                      {!explicando && !nota && !ativo && !!resumo && (
                        <Text style={S.topicoResumo}>{resumo}</Text>
                      )}
                    </View>

                    {alcancavel && (
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>

                  {ativo && (
                    <View style={S.topicoCorpo}>{conteudoDoTopico(n)}</View>
                  )}
                </View>
              );
            })}

            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={S.rodape}>
            {passo > 0 && (
              <TouchableOpacity
                style={S.btVoltar}
                onPress={() => irPara(passo - 1)}
                disabled={validando}
              >
                <Text style={S.btVoltarTx}>{t.voltar}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[S.btAvancar, !podeAvancar && S.btOff]}
              onPress={passo === 2 ? finalizar : () => irPara(passo + 1)}
              disabled={!podeAvancar}
              activeOpacity={0.85}
            >
              <Text style={S.btAvancarTx}>
                {validando ? t.validando
                  : passo === 0 ? t.comecar
                  : passo === 1 ? t.proximo
                  : t.finalizar}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  // `height` fixo, não `maxHeight`: a folha não muda de tamanho entre passos.
  folha: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 12,
  },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16 },
  titulo: { fontSize: 17, fontWeight: '800', color: '#111827' },
  passoTx: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  fechar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  trilha: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginTop: 12, height: 3 },
  trilhaItem: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E5E7EB' },
  trilhaItemOn: { backgroundColor: '#4338CA' },

  corpo: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },

  topico: {
    borderRadius: 13, marginBottom: 8,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  topicoAtivo: { borderColor: '#C7D2FE', backgroundColor: '#FCFCFF' },
  topicoNota: { borderColor: 'transparent', backgroundColor: '#FAFAFA' },
  topicoCabeca: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  num: {
    width: 23, height: 23, borderRadius: 12,
    backgroundColor: '#E5E7EB', color: '#6B7280',
    fontSize: 12, fontWeight: '800',
    textAlign: 'center', lineHeight: 23, overflow: 'hidden',
  },
  numAtivo: { backgroundColor: '#4338CA', color: '#fff' },
  numNota: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  topicoTitulo: { fontSize: 14, fontWeight: '700', color: '#374151' },
  topicoTituloAtivo: { color: '#111827', fontSize: 15 },
  topicoTexto: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginTop: 4 },
  topicoResumo: { fontSize: 12, color: '#4338CA', fontWeight: '700', marginTop: 3 },
  topicoCorpo: { paddingHorizontal: 12, paddingBottom: 13 },

  ajuda: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginBottom: 12 },

  mesBarra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  mesSeta: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  mesSetaOff: { backgroundColor: '#FAFAFA' },
  mesNome: {
    fontSize: 15, fontWeight: '700', color: '#111827', textTransform: 'capitalize',
  },

  semana: { flexDirection: 'row', marginBottom: 4 },
  semanaTx: {
    width: '14.28%', textAlign: 'center',
    fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase',
  },
  calGrade: { flexDirection: 'row', flexWrap: 'wrap' },
  calCel: { width: '14.28%', paddingVertical: 2, alignItems: 'center' },
  calDia: {
    width: 36, height: 34, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6',
  },
  calDiaOn: { backgroundColor: '#4338CA' },
  calDiaOff: { backgroundColor: 'transparent' },
  calDiaTx: { fontSize: 13, fontWeight: '600', color: '#374151' },
  calDiaTxOn: { color: '#fff', fontWeight: '800' },
  calDiaTxOff: { color: '#D1D5DB' },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dia: {
    width: 38, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  diaOn: { backgroundColor: '#4338CA' },
  diaTx: { fontSize: 13, fontWeight: '600', color: '#374151' },
  diaTxOn: { color: '#fff', fontWeight: '800' },

  blocos: { marginTop: 14, gap: 8 },
  bloco: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EEF2FF', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 11,
  },
  blocoSelo: {
    width: 26, height: 26, borderRadius: 8, backgroundColor: '#4338CA',
    alignItems: 'center', justifyContent: 'center',
  },
  blocoSeloTx: { fontSize: 12, fontWeight: '800', color: '#fff' },
  blocoRot: { fontSize: 10, fontWeight: '700', color: '#6366F1', textTransform: 'uppercase' },
  blocoVal: { fontSize: 13, color: '#3730A3', fontWeight: '600' },
  blocoForte: { fontWeight: '800' },

  vazio: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 11, paddingVertical: 12, paddingHorizontal: 11,
    borderWidth: 1, borderColor: '#F3F4F6', borderStyle: 'dashed',
  },
  vazioTx: { fontSize: 12, color: '#9CA3AF', flex: 1 },

  erro: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 11,
  },
  erroTx: { fontSize: 12, color: '#92400E', flex: 1 },

  rodape: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12 },
  btVoltar: {
    paddingHorizontal: 20, paddingVertical: 13, borderRadius: 11,
    backgroundColor: '#F3F4F6',
  },
  btVoltarTx: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  btAvancar: {
    flex: 1, paddingVertical: 13, borderRadius: 11,
    backgroundColor: '#4338CA', alignItems: 'center',
  },
  btOff: { backgroundColor: '#C7D2FE' },
  btAvancarTx: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
