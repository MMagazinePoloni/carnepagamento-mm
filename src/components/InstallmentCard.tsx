import type { Installment } from "../lib/types"

function statusLabel(status: Installment["status"]) {
  if (status === "pendente") return "Pendente"
  if (status === "pago") return "Pago"
  return "Atrasado"
}

export default function InstallmentCard({
  installment,
  onPay
}: {
  installment: Installment
  onPay: () => void
}) {
  const isPending = installment.status === "pendente"
  const isLate = installment.status === "atrasado"
  const isPaid = installment.status === "pago"

  return (
    <div className="custom-installment-card">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="fw-bold text-dark">Parcela {installment.index}/{installment.count}</div>
          <div className="text-muted small">
            Vence em {new Date(installment.due_date).toLocaleDateString("pt-BR")}
          </div>
        </div>
        <span className={`badge-custom badge-${installment.status}`}>
          {statusLabel(installment.status)}
        </span>
      </div>
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <span className="text-muted small fw-bold text-uppercase ls-1">Valor</span>
        <span className="fw-bold fs-5" style={{ color: 'var(--mm-card-blue)' }}>
          {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(installment.amount + (installment.fine_amount || 0))}
        </span>
      </div>

      <div>
        {isPending || isLate ? (
          <button className="btn-pay w-100 shadow-sm" onClick={onPay}>
            <i className="bi bi-qr-code me-2"></i>
            Pagar com Pix
          </button>
        ) : isPaid ? (
          <div className="text-success text-center fw-bold py-2 bg-light rounded-3 border border-success border-opacity-25">
            <i className="bi bi-check-circle-fill me-2"></i>
            PARCELA PAGA
          </div>
        ) : null}
      </div>
    </div>
  )
}


