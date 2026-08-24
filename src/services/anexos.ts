import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// ANEXOS (evidências) — documentos do cliente e comprovantes de pagamento
//
// Bucket `documentos` é PRIVADO. Nada de `getPublicUrl` aqui: foto de CPF e
// comprovante de endereço em URL pública ficam acessíveis para sempre a quem
// tiver o link. A exibição usa URL assinada de validade curta (`urlAssinada`).
//
// O caminho carrega o cliente_id no 2º segmento porque é isso que a policy do
// storage lê para decidir acesso (fn_pode_acessar_anexo_path). Mudar o formato
// do caminho quebra a permissão, não só a organização das pastas.
//   documentos/clientes/{cliente_id}/{uuid}.jpg
//   documentos/pagamentos/{cliente_id}/{pagamento_id}/{uuid}.jpg
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'documentos';

/** Teto do arquivo ORIGINAL escolhido, antes do redimensionamento. */
export const TAMANHO_MAX_BYTES = 5 * 1024 * 1024;

/** Lado maior da imagem depois do redimensionamento. */
const LADO_MAX_PX = 1600;

/** Validade da URL assinada, em segundos. */
const VALIDADE_URL_SEG = 300;

export interface Anexo {
  id: string;
  cliente_id: string;
  pagamento_id: string | null;
  descricao: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  enviado_por_nome: string | null;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// `crypto.randomUUID` não existe no Hermes. Suficiente para nome de arquivo:
// o caminho já é único por cliente/pagamento e há UNIQUE em storage_path.
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const base64ParaBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/**
 * Redimensiona e recomprime a imagem antes do envio.
 *
 * Foto de celular sai com 3–8 MB; quatro delas por cliente, numa rota de 200,
 * são vários GB de storage e um upload que trava o cobrador em 3G. Aqui a
 * imagem cai para ~250–400 KB sem perder legibilidade de documento.
 *
 * Ponto único de redimensionamento: se um dia a lib mudar, muda só aqui.
 */
export async function prepararImagem(uri: string): Promise<{ base64: string; mime: string }> {
  const r = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: LADO_MAX_PX } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!r.base64) throw new Error('Falha ao processar a imagem.');
  return { base64: r.base64, mime: 'image/jpeg' };
}

// ─── API ────────────────────────────────────────────────────────────────────

/** Documentos do cliente (não inclui comprovantes de pagamento). */
export async function listarDoCliente(clienteId: string): Promise<Anexo[]> {
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('cliente_id', clienteId)
    .is('pagamento_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Anexo[];
}

/** Comprovantes de um pagamento específico. */
export async function listarDoPagamento(pagamentoId: string): Promise<Anexo[]> {
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('pagamento_id', pagamentoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Anexo[];
}

/** URL temporária para exibir o arquivo. Expira em VALIDADE_URL_SEG. */
export async function urlAssinada(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, VALIDADE_URL_SEG);
  if (error) {
    console.error('❌ [anexos] URL assinada:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

interface EnviarParams {
  clienteId: string;
  /** Ausente = documento do cliente. Presente = comprovante daquele pagamento. */
  pagamentoId?: string | null;
  /** URI local vinda do ImagePicker. */
  uri: string;
  /** Tamanho do arquivo original, para barrar antes de processar. */
  tamanhoOriginal?: number | null;
  descricao: string;
  enviadoPor?: string | null;
  enviadoPorNome?: string | null;
}

export async function enviar({
  clienteId,
  pagamentoId = null,
  uri,
  tamanhoOriginal,
  descricao,
  enviadoPor = null,
  enviadoPorNome = null,
}: EnviarParams): Promise<Anexo> {
  const desc = descricao.trim();
  if (!desc) throw new Error('Descreva o que é este anexo.');

  if (tamanhoOriginal && tamanhoOriginal > TAMANHO_MAX_BYTES) {
    throw new Error(
      `Arquivo muito grande (${(tamanhoOriginal / 1024 / 1024).toFixed(1)} MB). Máximo ${TAMANHO_MAX_BYTES / 1024 / 1024} MB.`,
    );
  }

  const { base64, mime } = await prepararImagem(uri);
  const bytes = base64ParaBytes(base64);

  const path = pagamentoId
    ? `pagamentos/${clienteId}/${pagamentoId}/${uuid()}.jpg`
    : `clientes/${clienteId}/${uuid()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (upErr) {
    console.error('❌ [anexos] upload:', upErr);
    throw upErr;
  }

  const { data, error } = await supabase
    .from('anexos')
    .insert({
      cliente_id: clienteId,
      pagamento_id: pagamentoId,
      descricao: desc,
      storage_path: path,
      mime_type: mime,
      tamanho_bytes: bytes.length,
      enviado_por: enviadoPor,
      enviado_por_nome: enviadoPorNome,
    })
    .select()
    .single();

  if (error) {
    // Registro falhou: o arquivo já subiu e ficaria órfão no bucket.
    await supabase.storage.from(BUCKET).remove([path]);
    console.error('❌ [anexos] insert:', error);
    throw error;
  }

  console.log('✅ [anexos] enviado:', path, `${(bytes.length / 1024).toFixed(0)} KB`);
  return data as Anexo;
}

export async function remover(anexo: Anexo): Promise<void> {
  // Registro primeiro: sem ele o arquivo é inalcançável de qualquer forma.
  // Na ordem inversa, uma falha ao apagar a linha deixaria um anexo listado
  // apontando para arquivo inexistente.
  const { error } = await supabase.from('anexos').delete().eq('id', anexo.id);
  if (error) throw error;

  const { error: stErr } = await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
  if (stErr) console.error('⚠️ [anexos] registro removido, arquivo permaneceu:', stErr);
}
