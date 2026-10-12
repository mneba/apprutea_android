// =====================================================================
// O MODELO DO RECIBO DE PAGAMENTO
// Arquivo: src/services/recibo.ts
// =====================================================================
//
// O ADMIN configura o modelo pelo web (aba Recibos do vendedor) e ele é
// gravado em `configuracoes_recibos.modelo_recibo`, um `jsonb`.
//
// O CONTRATO NÃO VIVE AQUI. Vive no COMMENT daquela coluna, porque web e app
// são repositórios separados e não compartilham código: é o comentário no
// banco que os mantém de acordo. Marcador novo entra nos três lugares — lá, no
// `ModeloRecibo.tsx` do web e aqui.
//
// LEITURA SOB DEMANDA E GUARDADA. Só acontece quando o vendedor pede o
// primeiro recibo do dia, e o resultado fica em memória: o modelo muda por
// configuração do ADMIN, não durante a cobrança. Isso mantém a "uma onda" do
// carregamento diário intacta — nada disto entra no caminho quente.

import { supabase } from './supabase';

export interface ModeloRecibo {
  titulo: string;
  cabecalho: string;
  rodape: string;
  mensagem_whatsapp: string;
  mostrar_saldo: boolean;
  mostrar_proximo_vencimento: boolean;
  mostrar_vendedor: boolean;
}

export const MODELO_PADRAO: ModeloRecibo = {
  titulo: 'RECIBO DE PAGAMENTO',
  cabecalho: '{empresa}',
  rodape: 'Obrigado pelo pagamento!',
  mensagem_whatsapp: 'Olá {cliente}, segue o comprovante do seu pagamento de {valor_pago} em {data}.',
  mostrar_saldo: true,
  mostrar_proximo_vencimento: true,
  mostrar_vendedor: true,
};

export interface ConfigRecibo {
  modelo: ModeloRecibo;
  logoUrl: string | null;
  empresaNome: string;
}

/**
 * Parte do padrão e sobrescreve o que veio.
 *
 * O `jsonb` pode ser nulo (vendedor sem modelo próprio) ou estar sem uma chave
 * que passou a existir depois de ele ter sido gravado. Sem isto, `undefined`
 * chegaria no desenho como texto vazio e o recibo sairia com um pedaço a menos
 * sem ninguém entender por quê.
 */
export function normalizarModelo(bruto: unknown): ModeloRecibo {
  if (!bruto || typeof bruto !== 'object') return { ...MODELO_PADRAO };
  return { ...MODELO_PADRAO, ...(bruto as Partial<ModeloRecibo>) };
}

export interface DadosRecibo {
  cliente: string;
  valor_pago: string;
  parcela: string;
  saldo: string;
  proximo_vencimento: string;
  data: string;
  empresa: string;
  vendedor: string;
}

/**
 * Troca `{marcador}` pelo valor.
 *
 * Marcador desconhecido fica à vista, igual ao web: apagá-lo esconderia o erro
 * de digitação de quem pode corrigi-lo, e o cliente receberia uma frase com um
 * buraco no meio.
 */
export function preencherMarcadores(texto: string, dados: DadosRecibo): string {
  return (texto || '').replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    const valor = (dados as unknown as Record<string, string>)[chave];
    return valor !== undefined ? valor : inteiro;
  });
}

// A configuração de um vendedor não muda no meio da rota.
let guardado: { vendedorId: string; config: ConfigRecibo } | null = null;

/**
 * Busca o modelo do vendedor, com a empresa como segunda opção.
 *
 * `configuracoes_recibos` aceita linha por vendedor OU por empresa — é assim
 * que o web permite "aplicar a todos os vendedores". A do vendedor ganha.
 */
export async function buscarConfigRecibo(
  vendedorId: string,
  empresaId: string | null,
): Promise<ConfigRecibo> {
  if (guardado?.vendedorId === vendedorId) return guardado.config;

  let modelo = MODELO_PADRAO;
  let logoUrl: string | null = null;
  let empresaNome = '';

  try {
    const { data: doVendedor } = await supabase
      .from('configuracoes_recibos')
      .select('modelo_recibo, logo_url')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    let linha = doVendedor;

    if (!linha && empresaId) {
      const { data: daEmpresa } = await supabase
        .from('configuracoes_recibos')
        .select('modelo_recibo, logo_url')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      linha = daEmpresa;
    }

    if (linha) {
      modelo = normalizarModelo((linha as any).modelo_recibo);
      logoUrl = (linha as any).logo_url || null;
    }

    if (empresaId) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('nome')
        .eq('id', empresaId)
        .maybeSingle();
      empresaNome = (empresa as any)?.nome || '';
    }
  } catch (e) {
    // Recibo é um extra: sem configuração ele sai no modelo padrão, e isso é
    // melhor do que não sair. Nunca derrubar o fluxo do pagamento por causa
    // de uma leitura de aparência.
    console.error('❌ Config do recibo:', e);
  }

  const config: ConfigRecibo = { modelo, logoUrl, empresaNome };
  guardado = { vendedorId, config };
  return config;
}

/** Chamado quando a configuração pode ter mudado (ex.: ao trocar de sessão). */
export function limparConfigRecibo() {
  guardado = null;
}

export interface SituacaoEmprestimo {
  saldo: number;
  proximoVencimento: string | null;
  totalParcelas: number;
}

/**
 * Lê saldo e próximo vencimento DEPOIS do pagamento.
 *
 * Não dá para derivar do que a tela tinha: o saldo que ela guarda é o de antes
 * de gravar, e `fn_registrar_pagamento` pode ter quitado a parcela, consumido
 * crédito ou gerado excedente. Para um comprovante que vai para a mão do
 * cliente, o número tem de vir de onde ele é verdade.
 *
 * `valor_saldo` do empréstimo já vem líquido de crédito (ver CLAUDE.md) — é
 * exatamente o que o cliente ainda deve.
 */
export async function buscarSituacao(emprestimoId: string): Promise<SituacaoEmprestimo> {
  const { data: emp } = await supabase
    .from('emprestimos')
    .select('valor_saldo, numero_parcelas')
    .eq('id', emprestimoId)
    .maybeSingle();

  const { data: proxima } = await supabase
    .from('emprestimo_parcelas')
    .select('data_vencimento')
    .eq('emprestimo_id', emprestimoId)
    .gt('valor_saldo', 0)
    .order('data_vencimento', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    saldo: Number((emp as any)?.valor_saldo || 0),
    totalParcelas: Number((emp as any)?.numero_parcelas || 0),
    proximoVencimento: (proxima as any)?.data_vencimento || null,
  };
}
