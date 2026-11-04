// =====================================================================
// FOTO DO CLIENTE -- vai para o Storage, nunca para a coluna
// =====================================================================
//
// ⚠ `clientes.foto_url` é para guardar uma URL. Até 03/11/2026 a tela de
// Nova Venda gravava ali a imagem INTEIRA em base64, e o estrago foi
// medido: 113 dos 121 clientes com foto tinham a imagem na coluna,
// somando 24 MB, com média de 210 kB e um registro de 1.185 kB.
//
// Não aparece como lentidão de banco -- o Postgres só lê uma coluna
// TOASTed, e `pg_stat_statements` dava 18 ms para `fn_buscar_clientes`.
// O custo é transferência, serialização JSON e parse no aparelho:
//
//     Madrid (50 clientes)    5.021 kB de foto contra 11 kB de dado
//     empresa Juan Jose       15 MB por abertura da lista de clientes
//
// Com a URL, cada cliente custa ~100 bytes no payload e a imagem passa a
// ser baixada sob demanda e cacheada pelo sistema.
//
// NOTA: `ClienteDetalhesModal` tem a sua própria cópia deste upload, que
// é a que já rodava em campo (bucket `fotos`, desde 04/06/2026). Não foi
// trocada por esta função para não mexer num caminho testado junto com a
// correção -- mas a regra é esta, e é aqui que a próxima tela deve vir.

import { supabase } from './supabase';

const BUCKET = 'fotos';

/** Nome de arquivo para cliente que AINDA NÃO EXISTE.
 *
 *  Na Nova Venda a foto é tirada antes de o cliente ter id -- a venda só é
 *  criada no Confirmar. Por isso o caminho não pode ser `clientes/<id>`,
 *  como no modal de detalhes, e sai um nome próprio.
 *
 *  Consequência aceita: venda abandonada depois da foto deixa um arquivo
 *  órfão no bucket. São alguns KB, e o contrário -- subir só no Confirmar
 *  -- põe uma espera de rede no meio do fluxo, com o cobrador na porta do
 *  cliente. */
const nomeParaClienteNovo = (ext: 'jpg' | 'png') =>
  `clientes/novo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

/**
 * Sobe a imagem para o bucket e devolve a URL pública.
 *
 * `base64` é o que o `ImagePicker` entrega com `base64: true`, SEM o
 * prefixo `data:`. `uri` serve só para descobrir a extensão.
 *
 * Devolve `null` em qualquer falha -- quem chama decide se avisa ou se
 * segue sem foto. A venda NÃO pode parar por causa de uma foto.
 */
export async function subirFotoCliente(
  base64: string,
  uri: string | undefined,
): Promise<string | null> {
  try {
    // A extensão sai da URI, não de `asset.mimeType`: o mimeType mente. Há
    // 7 registros gravados como `data:image/png;base64,/9j/4AAQ` -- `/9j/`
    // é assinatura de JPEG. Era o mimeType do ImagePicker sendo repassado
    // sem conferência.
    const bruta = (uri?.split('.').pop()?.toLowerCase() || 'jpg').replace(/\?.*/, '');
    const ext: 'jpg' | 'png' = bruta === 'png' ? 'png' : 'jpg';
    const caminho = nomeParaClienteNovo(ext);

    // base64 -> Uint8Array. `Buffer` não existe no React Native e
    // `fetch(dataUrl).blob()` é instável no Android; `atob` é o caminho
    // que já roda em campo pelo modal de detalhes.
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);

    const { error } = await supabase.storage.from(BUCKET).upload(caminho, bytes, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    });
    if (error) {
      console.error('❌ Erro ao subir foto do cliente:', error);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
    console.log('✅ Foto no Storage:', caminho, bytes.length, 'bytes');
    return data.publicUrl;
  } catch (e) {
    console.error('❌ Erro ao subir foto do cliente:', e);
    return null;
  }
}
