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

  const statusLabel = isPending ? "ABERTO" : isLate ? "ATRASADO" : "PAGO"
  const statusClass = isPending ? "badge-aberto" : isLate ? "badge-atrasado" : "badge-pago"
  const totalAmount = installment.amount + (installment.fine_amount || 0)

  return (
    <div className={`custom-installment-card ${isPaid ? 'opacity-75' : ''}`}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="text-muted small fw-bold text-uppercase ls-1" style={{ fontSize: '0.65rem' }}>Parcela</div>
          <div className="fw-bold fs-5 text-dark" style={{ textDecoration: isPaid ? 'line-through' : 'none' }}>
            {String(installment.index).padStart(2, '0')} <span className="text-muted fw-normal">/ {String(installment.count).padStart(2, '0')}</span>
          </div>
        </div>
        <span className={`badge-custom ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="d-flex align-items-center mb-3 text-muted" style={{ fontSize: '0.75rem' }}>
        {isPaid ? (
          <><i className="bi bi-check-circle-fill me-2 text-success"></i> Liquidado</>
        ) : isLate ? (
          <><i className="bi bi-calendar3 me-2"></i> Vencimento: {new Date(installment.due_date).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })}</>
        ) : (
          <><i className="bi bi-clock me-2"></i> Vencimento: {new Date(installment.due_date).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })}</>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-end mt-4">
        <div className="fw-bold fs-4" style={{ color: isPaid ? '#A0AEC0' : isLate ? 'var(--primary-red)' : '#1A202C' }}>
          {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAmount)}
        </div>

        {isLate ? (
          <button className="btn-pay shadow-sm" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={onPay}>
            Pagar Agora <i className="bi bi-arrow-right ms-1"></i>
          </button>
        ) : isPending ? (
          <button className="btn-agendar shadow-sm" onClick={onPay}>
            Agendar
          </button>
        ) : (
          <div className="btn-receipt">
            <i className="bi bi-receipt"></i>
          </div>
        )}
      </div>
    </div>
  )
}


