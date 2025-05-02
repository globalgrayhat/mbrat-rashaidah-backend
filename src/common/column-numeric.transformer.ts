export const ColumnNumericTransformer = {
  to: (v?: number): number | null => v ?? null,
  from: (v?: string): number | null => (v ? parseFloat(v) : null),
};

export const ColumnNumericTransformerWithDefault = (defaultValue: number) => ({
  to: (v?: number): number | null => v ?? defaultValue,
  from: (v?: string): number | null => (v ? parseFloat(v) : defaultValue),
});
