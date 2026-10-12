// =====================================================================
// O RECIBO DE PAGAMENTO
// Arquivo: src/components/ReciboPagamento.tsx
// =====================================================================
//
// O vendedor registra a parcela, vê o comprovante na tela e, querendo, manda
// pelo WhatsApp — como IMAGEM, que é o que aparece dentro da conversa. PDF o
// WhatsApp entrega como documento anexado, que o cliente precisa abrir.
//
// POR QUE O RECIBO É DESENHADO EM RN E NÃO EM HTML
// O extrato da liquidação usa `expo-print` com HTML e sai em PDF (ver
// LiquidacaoDetalhes.tsx). Aqui o alvo é imagem, e `react-native-view-shot`
// fotografa a mesma view que o vendedor está vendo — o que se confere na tela
// é, byte a byte, o que vai para o cliente. Com HTML haveria dois desenhos
// para manter iguais.
//
// A LOGO É IMAGEM REMOTA, e é o detalhe que estraga este tipo de tela: a
// captura acontece em milissegundos e a imagem leva o tempo da rede do
// vendedor, que é ruim por definição. Capturar antes do `onLoad` produz recibo
// sem logo, em silêncio. Daí `logoPronta`: o botão de compartilhar espera.
//
// O formato imita o cupom de 80mm do extrato — monoespaçado, estreito, valores
// à direita. É o comprovante que o cliente já conhece.

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import {
  buscarConfigRecibo,
  buscarSituacao,
  preencherMarcadores,
  type ConfigRecibo,
  type DadosRecibo,
} from '../services/recibo';
import { mensagemErro } from '../utils/mensagemErro';

type Idioma = 'pt-BR' | 'es';

const textos = {
  'pt-BR': {
    titulo: 'Comprovante',
    compartilhar: 'Compartilhar',
    fechar: 'Fechar',
    preparando: 'Preparando...',
    copiada: 'Mensagem copiada. Cole na conversa junto com a imagem.',
    erro: 'Não foi possível gerar o comprovante.',
    parcela: 'Parcela',
    cliente: 'Cliente',
    data: 'Data',
    cobrador: 'Cobrador',
    dinheiro: 'Dinheiro',
    credito: 'Crédito',
    saldo: 'Saldo',
    proximo: 'Próximo venc.',
  },
  'es': {
    titulo: 'Comprobante',
    compartilhar: 'Compartir',
    fechar: 'Cerrar',
    preparando: 'Preparando...',
    copiada: 'Mensaje copiado. Péguelo en la conversación junto con la imagen.',
    erro: 'No se pudo generar el comprobante.',
    parcela: 'Cuota',
    cliente: 'Cliente',
    data: 'Fecha',
    cobrador: 'Cobrador',
    dinheiro: 'Efectivo',
    credito: 'Crédito',
    saldo: 'Saldo',
    proximo: 'Próx. venc.',
  },
} as const;

const fmt = (v: number) =>
  '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (d: string | null | undefined) => {
  if (!d) return '—';
  const so = d.substring(0, 10);
  if (so.length === 10 && so.includes('-')) {
    const [y, m, dia] = so.split('-');
    return `${dia}/${m}/${y}`;
  }
  return so;
};

export interface DadosPagamentoRecibo {
  clienteNome: string;
  emprestimoId: string;
  numeroParcela: number;
  valorEspecie: number;
  valorCredito: number;
  /** Data da LIQUIDAÇÃO, não do relógio — ver CLAUDE.md. */
  dataOperacional: string;
  vendedorId: string;
  vendedorNome: string;
  empresaId: string | null;
}

interface Props {
  visible: boolean;
  dados: DadosPagamentoRecibo | null;
  idioma: Idioma;
  onClose: () => void;
}

export default function ReciboPagamento({ visible, dados, idioma, onClose }: Props) {
  const t = textos[idioma] || textos['pt-BR'];

  const cupomRef = useRef<View>(null);
  const [config, setConfig] = useState<ConfigRecibo | null>(null);
  const [situacao, setSituacao] = useState<{ saldo: number; proximo: string | null; total: number } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [logoPronta, setLogoPronta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !dados) return;
    let vivo = true;

    (async () => {
      setCarregando(true);
      setAviso(null);
      try {
        const [cfg, sit] = await Promise.all([
          buscarConfigRecibo(dados.vendedorId, dados.empresaId),
          buscarSituacao(dados.emprestimoId),
        ]);
        if (!vivo) return;
        setConfig(cfg);
        setSituacao({ saldo: sit.saldo, proximo: sit.proximoVencimento, total: sit.totalParcelas });
        // Sem logo configurada não há o que esperar.
        setLogoPronta(!cfg.logoUrl);
      } catch (e) {
        if (vivo) setAviso(mensagemErro(e, t.erro));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => { vivo = false; };
  }, [visible, dados, t.erro]);

  if (!visible || !dados) return null;

  const modelo = config?.modelo;
  const marcadores: DadosRecibo = {
    cliente: dados.clienteNome,
    valor_pago: fmt(dados.valorEspecie + dados.valorCredito),
    parcela: situacao?.total ? `${dados.numeroParcela}/${situacao.total}` : String(dados.numeroParcela),
    saldo: fmt(situacao?.saldo || 0),
    proximo_vencimento: fmtData(situacao?.proximo),
    data: fmtData(dados.dataOperacional),
    empresa: config?.empresaNome || '',
    vendedor: dados.vendedorNome,
  };

  const p = (texto: string) => preencherMarcadores(texto, marcadores);

  const compartilhar = async () => {
    if (!cupomRef.current || compartilhando) return;
    setCompartilhando(true);
    setAviso(null);
    try {
      const uri = await captureRef(cupomRef, { format: 'png', quality: 1 });

      // A legenda vai para a área de transferência, não com a imagem: o
      // compartilhamento do Android manda UM conteúdo, e mandar o texto faria
      // a imagem ficar de fora. Imagem é o recibo; o texto é acompanhamento.
      if (modelo?.mensagem_whatsapp) {
        await Clipboard.setStringAsync(p(modelo.mensagem_whatsapp));
        setAviso(t.copiada);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: t.titulo,
          UTI: 'public.png',
        });
      }
    } catch (e) {
      setAviso(mensagemErro(e, t.erro));
    } finally {
      setCompartilhando(false);
    }
  };

  const pronto = !carregando && !!config && logoPronta;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.folha}>
          <View style={S.header}>
            <Text style={S.tituloTela}>{t.titulo}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={S.fechar}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={S.area}>
            {carregando ? (
              <View style={S.carregando}>
                <ActivityIndicator color="#6366F1" />
                <Text style={S.carregandoTx}>{t.preparando}</Text>
              </View>
            ) : (
              // `collapsable={false}` é obrigatório: sem ele o Android funde
              // esta View na mãe para economizar, e a captura devolve a tela
              // inteira em vez do cupom.
              <View ref={cupomRef} collapsable={false} style={S.cupom}>
                {!!config?.logoUrl && (
                  <Image
                    source={{ uri: config.logoUrl }}
                    style={S.logo}
                    resizeMode="contain"
                    onLoad={() => setLogoPronta(true)}
                    onError={() => setLogoPronta(true)}
                  />
                )}

                {!!modelo?.titulo && <Text style={S.titulo}>{p(modelo.titulo)}</Text>}
                {!!modelo?.cabecalho && <Text style={S.cabecalho}>{p(modelo.cabecalho)}</Text>}

                <View style={S.divisor} />

                <Linha rotulo={t.cliente} valor={marcadores.cliente} />
                <Linha rotulo={t.data} valor={marcadores.data} />
                {modelo?.mostrar_vendedor && <Linha rotulo={t.cobrador} valor={marcadores.vendedor} />}

                <View style={S.divisor} />

                <Linha
                  rotulo={`${t.parcela} ${marcadores.parcela}`}
                  valor={fmt(dados.valorEspecie)}
                />
                {/* Crédito em linha própria: não é dinheiro que entrou agora, e
                    somá-lo ao pago faria o cliente ler que entregou mais do que
                    entregou. Ver `valor_saldo` em CLAUDE.md. */}
                {dados.valorCredito > 0 && (
                  <Linha rotulo={t.credito} valor={fmt(dados.valorCredito)} />
                )}
                {modelo?.mostrar_saldo && (
                  <Linha rotulo={t.saldo} valor={marcadores.saldo} negrito />
                )}
                {modelo?.mostrar_proximo_vencimento && (
                  <Linha rotulo={t.proximo} valor={marcadores.proximo_vencimento} />
                )}

                {!!modelo?.rodape && (
                  <>
                    <View style={S.divisor} />
                    <Text style={S.rodape}>{p(modelo.rodape)}</Text>
                  </>
                )}
              </View>
            )}

            {!!aviso && <Text style={S.aviso}>{aviso}</Text>}
          </ScrollView>

          <View style={S.botoes}>
            <TouchableOpacity style={S.btnFechar} onPress={onClose} disabled={compartilhando}>
              <Text style={S.btnFecharTx}>{t.fechar}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btnEnviar, (!pronto || compartilhando) && S.btnOcupado]}
              onPress={compartilhar}
              disabled={!pronto || compartilhando}
              activeOpacity={0.85}
            >
              {compartilhando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="share-social-outline" size={17} color="#fff" />
              )}
              <Text style={S.btnEnviarTx}>{t.compartilhar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Linha({ rotulo, valor, negrito }: { rotulo: string; valor: string; negrito?: boolean }) {
  return (
    <View style={S.linha}>
      <Text style={[S.linhaTx, negrito && S.forte]}>{rotulo}</Text>
      <Text style={[S.linhaTx, negrito && S.forte]}>{valor}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  folha: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  tituloTela: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  fechar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  area: { paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center' },
  carregando: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  carregandoTx: { fontSize: 13, color: '#6B7280' },

  cupom: { width: 280, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 18, borderWidth: 1, borderColor: '#E5E7EB' },
  logo: { width: 160, height: 48, alignSelf: 'center', marginBottom: 12 },
  titulo: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', textAlign: 'center', color: '#111827', letterSpacing: 1 },
  cabecalho: { fontFamily: 'monospace', fontSize: 11, textAlign: 'center', color: '#374151', marginTop: 2 },
  divisor: { height: 1, backgroundColor: '#D1D5DB', marginVertical: 10 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 3 },
  linhaTx: { fontFamily: 'monospace', fontSize: 11, color: '#1F2937' },
  forte: { fontWeight: '700' },
  rodape: { fontFamily: 'monospace', fontSize: 11, textAlign: 'center', color: '#374151' },

  aviso: { fontSize: 12, color: '#6B7280', marginTop: 12, textAlign: 'center' },

  botoes: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  btnFechar: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnFecharTx: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  btnEnviar: { flex: 2, flexDirection: 'row', gap: 8, backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnOcupado: { opacity: 0.6 },
  btnEnviarTx: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
