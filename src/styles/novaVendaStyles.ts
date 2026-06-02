import { Platform, StyleSheet } from 'react-native';

// ============================================================
// ESTILOS - NovaVenda (centralizados)
// Nota: CalendarioSelector tem seus próprios estilos locais.
// ============================================================

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  // Header
  header: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCloseBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },

  // Seções
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
    marginLeft: 4,
  },
  sectionChevron: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sectionBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Cliente read-only
  clienteReadOnlyBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clienteReadOnlyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  clienteReadOnlyLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    width: 70,
    flexShrink: 0,
  },
  clienteReadOnlyValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },

  // Campos
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  fieldLabelError: {
    color: '#EF4444',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
    borderColor: '#D1D5DB',
  },
  hintRenegociacao: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Banner venda aprovada
  bannerAprovada: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  bannerAprovadaTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },
  bannerAprovadaTexto: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
  },
  btnAlterarSolicitado: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  btnAlterarSolicitadoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Row fields (DDI + telefone)
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  ddiSelector: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
  },
  ddiText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  ddiChevron: {
    fontSize: 10,
    color: '#9CA3AF',
  },

  // Select field (Segmento)
  selectField: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectFieldText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  selectFieldPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
    flex: 1,
  },
  selectFieldChevron: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  // Foto
  photoContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  photoPlaceholderIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  photoPlaceholderText: {
    fontSize: 13,
    color: '#6B7280',
  },
  photoPreviewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowColor: 'transparent',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Taxa de juros
  taxaButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taxaButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    minWidth: 56,
    alignItems: 'center',
  },
  taxaButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  taxaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  taxaButtonTextActive: {
    color: '#fff',
  },
  taxaCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
  },
  taxaCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  frequenciaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  radioOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#2563EB',
  },
  radioCircleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  radioLabel: {
    fontSize: 14,
    color: '#374151',
  },
  radioLabelActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  diasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  diaGridItem: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaGridItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  diaGridText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  diaGridTextActive: {
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxCheck: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  calculoBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  calculoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  calculoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calculoLabel: {
    fontSize: 14,
    color: '#374151',
  },
  calculoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  resumoSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    backgroundColor: '#F8FAFF',
  },
  resumoBloco: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
    marginBottom: 10,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  resumoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  resumoLabelSmall: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resumoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  resumoValueSmall: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  resumoTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  resumoTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  resumoTotalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Botão confirmar - estados
  confirmButtonEnabled: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  confirmButtonTextDisabled: {
    color: '#9CA3AF',
  },

  // Modal Resultado
  resultadoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultadoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  resultadoHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  resultadoHeaderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  resultadoHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  resultadoHeaderMsg: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
  },
  resultadoBloco: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
  },
  resultadoBlocoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  resultadoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  resultadoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  resultadoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  parcelaHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  parcelaHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  parcelaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  parcelaText: {
    fontSize: 13,
    color: '#374151',
  },
  resultadoCloseBtn: {
    backgroundColor: '#16A34A',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  resultadoCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Picker modais
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '88%',
    maxHeight: '70%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  pickerCloseText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerSearchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerSearchInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  pickerSearchClear: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerSearchClearText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerItemIndented: {
    paddingLeft: 32,
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#374151',
  },
  pickerItemTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  pickerItemCode: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  pickerGroupHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  pickerGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerLoading: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  pickerLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Modal busca documento
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalCardTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  modalCardDesc: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  modalCardInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1F2937', backgroundColor: '#F9FAFB', marginBottom: 20 },
  modalCardButtons: { flexDirection: 'row', gap: 12 },
  modalCardBtnCancel: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalCardBtnCancelText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  modalCardBtnConfirm: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#3B82F6', alignItems: 'center' },
  modalCardBtnConfirmText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
