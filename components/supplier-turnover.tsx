import { formatSupplierTurnover, supplierTurnoverLabel, supplierTurnoverSource } from "@/lib/supplier-turnover";

export function SupplierTurnover({ value }: { value: number | null | undefined }) {
  return <span className="supplier-turnover" title={supplierTurnoverSource}>
    <span className="supplier-turnover-label">{supplierTurnoverLabel}</span>
    <strong className="supplier-turnover-value">{formatSupplierTurnover(value)}</strong>
  </span>;
}
