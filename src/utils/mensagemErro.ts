// =====================================================================
// A MENSAGEM QUE O VENDEDOR PODE LER
// =====================================================================
//
// Em 09/10/2026 um vendedor tentou abrir o dia e viu isto na tela:
//
//     Erro catch
//     permission denied for function fn_abrir_liquidacao_diaria
//
// Ele estava na rua, com o celular na mão. Não havia nada ali que ele
// pudesse fazer com aquela informação — e o que de fato tinha acontecido, a
// sessão ter caído, não aparecia em lugar nenhum.
//
// A REGRA: mensagem técnica NUNCA vai para a tela. O que não se conhece vira
// texto genérico; o que se conhece vira instrução.
//
// A EXCEÇÃO, e é importante: as funções de negócio do Postgres levantam
// `RAISE EXCEPTION`, código `P0001`, com texto escrito em português PARA o
// vendedor — "Liquidação já aberta para hoje", "Valor maior que o saldo".
// Essas passam intactas. Trocá-las por "ocorreu um erro" seria piorar: elas
// dizem exatamente o que fazer.
//
// Como distinguir: erro de infraestrutura tem código conhecido (`42501`,
// `23505`, `PGRST###`); regra de negócio vem com `P0001`.
//
// POR QUE O IDIOMA É ESTADO DESTE MÓDULO, e não parâmetro: dos onze arquivos
// que mostram erro, oito não têm `idioma` em escopo — eles usam o `textos`
// local de cada tela. Passar o idioma em todos exigiria atravessar o
// `AuthContext` por oito componentes para um detalhe de formatação. O
// `AuthContext` avisa este módulo quando o idioma muda, como já faz com o
// cliente do Supabase, que também é único.

export type Idioma = 'pt-BR' | 'es';

let idiomaAtual: Idioma = 'pt-BR';

/** Chamado pelo `AuthContext` quando o idioma carrega ou muda. */
export function definirIdiomaDasMensagens(i: Idioma) {
  idiomaAtual = i;
}

const TEXTOS = {
  'pt-BR': {
    sessao: 'Sua sessão expirou. Entre novamente para continuar.',
    rede: 'Sem conexão. Tente de novo em instantes.',
    duplicado: 'Esse registro já existe.',
    referencia: 'Não foi possível concluir: há informação ligada a este registro.',
    obrigatorio: 'Faltou preencher um campo obrigatório.',
    generico: 'Não foi possível concluir. Tente de novo.',
  },
  'es': {
    sessao: 'Su sesión expiró. Ingrese nuevamente para continuar.',
    rede: 'Sin conexión. Intente de nuevo en unos instantes.',
    duplicado: 'Ese registro ya existe.',
    referencia: 'No se pudo completar: hay información ligada a este registro.',
    obrigatorio: 'Falta completar un campo obligatorio.',
    generico: 'No se pudo completar. Intente de nuevo.',
  },
} as const;

interface ErroBruto {
  code?: string;
  message?: string;
  details?: string;
}

/** O erro é falta de permissão — quase sempre a sessão que caiu. */
export function ehErroDeSessao(e: unknown): boolean {
  const err = e as ErroBruto | null;
  if (!err) return false;
  if (err.code === '42501') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('permission denied') || m.includes('jwt') || m.includes('not authenticated');
}

/**
 * O texto que vai para a tela.
 *
 * `padrao` é o que a chamada quer dizer no caso genérico — "Não foi possível
 * iniciar o dia" diz mais que "não foi possível concluir". Sem ele, usa o
 * genérico.
 */
export function mensagemErro(e: unknown, padrao?: string): string {
  const t = TEXTOS[idiomaAtual] ?? TEXTOS['pt-BR'];
  const err = e as ErroBruto | null;

  if (!err) return padrao || t.generico;

  // Regra de negócio escrita para o vendedor: passa como está.
  if (err.code === 'P0001' && err.message) return err.message;

  if (ehErroDeSessao(err)) return t.sessao;

  switch (err.code) {
    // O prazo do cliente HTTP (ver services/supabase.ts). Para o vendedor é
    // a mesma coisa que estar sem sinal.
    case 'TIMEOUT': return t.rede;
    case '23505': return t.duplicado;
    case '23503': return t.referencia;
    case '23502': return t.obrigatorio;
    default: break;
  }

  const m = (err.message ?? '').toLowerCase();
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout')
      || m.includes('abort')) return t.rede;

  // Nada reconhecido. O original fica no console, para quem investiga; a tela
  // recebe o texto que o vendedor consegue usar.
  console.error('[erro não traduzido]', err.code, err.message, err.details);
  return padrao || t.generico;
}
