import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as anexosSvc from '../services/anexos';
import { Anexo } from '../services/anexos';
import ConfirmModal from './ConfirmModal';

// ─────────────────────────────────────────────────────────────────────────────
// Lista de anexos (evidências) de um cliente ou de um pagamento.
//
// A descrição é digitada pelo usuário — lista livre, sem tipos fixos. É
// obrigatória: sem ela, três meses depois isso vira uma pilha de fotos sem
// significado. As miniaturas usam URL assinada, que expira; por isso o mapa de
// URLs é remontado a cada carga da lista, não guardado no banco.
// ─────────────────────────────────────────────────────────────────────────────

type Lang = 'pt-BR' | 'es';

const TX = {
  'pt-BR': {
    titulo: 'Documentos e evidências',
    vazio: 'Nenhum anexo enviado',
    vazioDica: 'Comprovante de endereço, documento, foto do local ou do negócio.',
    adicionar: 'Adicionar anexo',
    camera: 'Tirar foto',
    galeria: 'Escolher da galeria',
    cancelar: 'Cancelar',
    descricaoTitulo: 'O que é este anexo?',
    descricaoPlaceholder: 'Ex.: Comprovante de endereço',
    enviar: 'Enviar',
    enviando: 'Enviando…',
    removerTitulo: 'Remover anexo',
    removerMsg: 'Este anexo será apagado definitivamente.',
    remover: 'Remover',
    erro: 'Erro',
    semPermissaoCamera: 'Permissão de câmera negada.',
    semPermissaoGaleria: 'Permissão de galeria negada.',
    porLbl: 'por',
  },
  es: {
    titulo: 'Documentos y evidencias',
    vazio: 'Ningún archivo adjunto',
    vazioDica: 'Comprobante de domicilio, documento, foto del lugar o del negocio.',
    adicionar: 'Agregar adjunto',
    camera: 'Tomar foto',
    galeria: 'Elegir de la galería',
    cancelar: 'Cancelar',
    descricaoTitulo: '¿Qué es este adjunto?',
    descricaoPlaceholder: 'Ej.: Comprobante de domicilio',
    enviar: 'Enviar',
    enviando: 'Enviando…',
    removerTitulo: 'Eliminar adjunto',
    removerMsg: 'Este adjunto será borrado definitivamente.',
    remover: 'Eliminar',
    erro: 'Error',
    semPermissaoCamera: 'Permiso de cámara denegado.',
    semPermissaoGaleria: 'Permiso de galería denegado.',
    porLbl: 'por',
  },
};

interface AnexosListaProps {
  clienteId: string;
  /** Ausente = documentos do cliente. Presente = comprovantes do pagamento. */
  pagamentoId?: string | null;
  lang: Lang;
  enviadoPor?: string | null;
  enviadoPorNome?: string | null;
  /** false esconde os botões de enviar/remover (visualização apenas). */
  podeEditar?: boolean;
}

const fmtTamanho = (b?: number | null) =>
  !b ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const fmtQuando = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const loc = lang === 'es' ? 'es' : 'pt-BR';
  return `${d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: '2-digit' })} · ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
};

export default function AnexosLista({
  clienteId,
  pagamentoId = null,
  lang,
  enviadoPor = null,
  enviadoPorNome = null,
  podeEditar = true,
}: AnexosListaProps) {
  const t = TX[lang] || TX['pt-BR'];

  const [itens, setItens] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const [menuVisivel, setMenuVisivel] = useState(false);
  const [uriPendente, setUriPendente] = useState<string | null>(null);
  const [tamanhoPendente, setTamanhoPendente] = useState<number | null>(null);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [visualizando, setVisualizando] = useState<string | null>(null);
  const [aRemover, setARemover] = useState<Anexo | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    setErro(null);
    try {
      const lista = pagamentoId
        ? await anexosSvc.listarDoPagamento(pagamentoId)
        : await anexosSvc.listarDoCliente(clienteId);
      setItens(lista);

      // URLs assinadas em paralelo — expiram, então são sempre refeitas.
      const pares = await Promise.all(
        lista.map(async a => [a.id, await anexosSvc.urlAssinada(a.storage_path)] as const),
      );
      const mapa: Record<string, string> = {};
      for (const [id, url] of pares) if (url) mapa[id] = url;
      setUrls(mapa);
    } catch (e: any) {
      console.error('❌ [AnexosLista] carregar:', e);
      setErro(e?.message || 'Falha ao carregar anexos.');
    } finally {
      setCarregando(false);
    }
  }, [clienteId, pagamentoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const escolher = async (origem: 'camera' | 'galeria') => {
    setMenuVisivel(false);
    try {
      const perm =
        origem === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        setErro(origem === 'camera' ? t.semPermissaoCamera : t.semPermissaoGaleria);
        return;
      }

      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1, // o redimensionamento acontece no serviço
      };
      const r =
        origem === 'camera'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);

      if (r.canceled || !r.assets?.[0]) return;
      setUriPendente(r.assets[0].uri);
      setTamanhoPendente(r.assets[0].fileSize ?? null);
      setDescricao('');
    } catch (e: any) {
      console.error('❌ [AnexosLista] escolher:', e);
      setErro(e?.message || 'Falha ao abrir a imagem.');
    }
  };

  const confirmarEnvio = async () => {
    if (!uriPendente || !descricao.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await anexosSvc.enviar({
        clienteId,
        pagamentoId,
        uri: uriPendente,
        tamanhoOriginal: tamanhoPendente,
        descricao,
        enviadoPor,
        enviadoPorNome,
      });
      setUriPendente(null);
      setTamanhoPendente(null);
      setDescricao('');
      await carregar();
    } catch (e: any) {
      console.error('❌ [AnexosLista] enviar:', e);
      setErro(e?.message || 'Falha ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarRemocao = async () => {
    const alvo = aRemover;
    setARemover(null);
    if (!alvo) return;
    try {
      await anexosSvc.remover(alvo);
      await carregar();
    } catch (e: any) {
      console.error('❌ [AnexosLista] remover:', e);
      setErro(e?.message || 'Falha ao remover.');
    }
  };

  return (
    <View>
      <Text style={S.secTitulo}>{t.titulo}</Text>

      {erro && (
        <View style={S.erroBox}>
          <Ionicons name="alert-circle-outline" size={15} color="#B91C1C" />
          <Text style={S.erroTx}>{erro}</Text>
        </View>
      )}

      {carregando ? (
        <ActivityIndicator color="#3B82F6" style={{ marginVertical: 20 }} />
      ) : itens.length === 0 ? (
        <View style={S.vazio}>
          <Ionicons name="folder-open-outline" size={34} color="#D1D5DB" />
          <Text style={S.vazioTx}>{t.vazio}</Text>
          <Text style={S.vazioDica}>{t.vazioDica}</Text>
        </View>
      ) : (
        itens.map(a => (
          <View key={a.id} style={S.linha}>
            <TouchableOpacity
              onPress={() => urls[a.id] && setVisualizando(urls[a.id])}
              activeOpacity={0.8}
            >
              {urls[a.id] ? (
                <Image source={{ uri: urls[a.id] }} style={S.thumb} />
              ) : (
                <View style={[S.thumb, S.thumbVazia]}>
                  <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>

            <View style={S.linhaInfo}>
              <Text style={S.linhaDesc} numberOfLines={2}>{a.descricao}</Text>
              <Text style={S.linhaMeta} numberOfLines={1}>
                {fmtQuando(a.created_at, lang)}
                {a.tamanho_bytes ? ` · ${fmtTamanho(a.tamanho_bytes)}` : ''}
              </Text>
              {a.enviado_por_nome ? (
                <Text style={S.linhaMeta} numberOfLines={1}>{t.porLbl} {a.enviado_por_nome}</Text>
              ) : null}
            </View>

            {podeEditar && (
              <TouchableOpacity style={S.btnRemover} onPress={() => setARemover(a)}>
                <Ionicons name="trash-outline" size={17} color="#B91C1C" />
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {podeEditar && (
        <TouchableOpacity style={S.btnAdd} onPress={() => setMenuVisivel(true)} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
          <Text style={S.btnAddTx}>{t.adicionar}</Text>
        </TouchableOpacity>
      )}

      {/* Origem da imagem */}
      <Modal visible={menuVisivel} transparent animationType="fade" onRequestClose={() => setMenuVisivel(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <TouchableOpacity style={S.sheetItem} onPress={() => escolher('camera')}>
              <Ionicons name="camera-outline" size={20} color="#1F2937" />
              <Text style={S.sheetItemTx}>{t.camera}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.sheetItem} onPress={() => escolher('galeria')}>
              <Ionicons name="images-outline" size={20} color="#1F2937" />
              <Text style={S.sheetItemTx}>{t.galeria}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.sheetItem, S.sheetCancelar]} onPress={() => setMenuVisivel(false)}>
              <Text style={S.sheetCancelarTx}>{t.cancelar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Descrição + confirmação do envio */}
      <Modal
        visible={!!uriPendente}
        transparent
        animationType="fade"
        onRequestClose={() => !enviando && setUriPendente(null)}
      >
        <View style={S.overlay}>
          <View style={S.box}>
            <Text style={S.boxTitulo}>{t.descricaoTitulo}</Text>
            {uriPendente && <Image source={{ uri: uriPendente }} style={S.previa} />}
            <TextInput
              style={S.input}
              value={descricao}
              onChangeText={setDescricao}
              placeholder={t.descricaoPlaceholder}
              placeholderTextColor="#9CA3AF"
              editable={!enviando}
              autoFocus
            />
            <View style={S.boxBotoes}>
              <TouchableOpacity
                style={[S.btn, S.btnCancelar]}
                onPress={() => setUriPendente(null)}
                disabled={enviando}
              >
                <Text style={S.btnCancelarTx}>{t.cancelar}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.btn, S.btnEnviar, (!descricao.trim() || enviando) && S.btnOff]}
                onPress={confirmarEnvio}
                disabled={!descricao.trim() || enviando}
              >
                <Text style={S.btnEnviarTx}>{enviando ? t.enviando : t.enviar}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Visualização em tela cheia */}
      <Modal visible={!!visualizando} transparent animationType="fade" onRequestClose={() => setVisualizando(null)}>
        <View style={S.visorFundo}>
          <TouchableOpacity style={S.visorFechar} onPress={() => setVisualizando(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={S.visorConteudo}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
          >
            {visualizando && <Image source={{ uri: visualizando }} style={S.visorImg} resizeMode="contain" />}
          </ScrollView>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!aRemover}
        titulo={t.removerTitulo}
        mensagem={`${aRemover?.descricao || ''}\n\n${t.removerMsg}`}
        textoCancelar={t.cancelar}
        textoConfirmar={t.remover}
        corConfirmar="#DC2626"
        onCancelar={() => setARemover(null)}
        onConfirmar={confirmarRemocao}
      />
    </View>
  );
}

const S = StyleSheet.create({
  secTitulo: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
  erroBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10, marginBottom: 10 },
  erroTx: { flex: 1, fontSize: 12, color: '#B91C1C' },
  vazio: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  vazioTx: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  vazioDica: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 20 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#E5E7EB' },
  thumbVazia: { alignItems: 'center', justifyContent: 'center' },
  linhaInfo: { flex: 1 },
  linhaDesc: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  linhaMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  btnRemover: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2' },
  btnAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  btnAddTx: { fontSize: 14, fontWeight: '600', color: '#2563EB' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 340, overflow: 'hidden' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sheetItemTx: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  sheetCancelar: { justifyContent: 'center', borderBottomWidth: 0 },
  sheetCancelarTx: { fontSize: 15, color: '#6B7280', fontWeight: '600' },

  box: { backgroundColor: '#fff', borderRadius: 16, padding: 18, width: '100%', maxWidth: 360 },
  boxTitulo: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  previa: { width: '100%', height: 150, borderRadius: 10, backgroundColor: '#F3F4F6', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937', marginBottom: 16 },
  boxBotoes: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnCancelar: { backgroundColor: '#F3F4F6' },
  btnCancelarTx: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnEnviar: { backgroundColor: '#10B981' },
  btnEnviarTx: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnOff: { backgroundColor: '#D1D5DB' },

  visorFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  visorFechar: { position: 'absolute', top: 40, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  visorConteudo: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  visorImg: { width: '100%', height: '100%', minHeight: 400 },
});
