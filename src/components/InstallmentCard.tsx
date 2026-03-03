import type { Installment } from "../lib/types"

export default function InstallmentCard({
  installment,
  onClick
}: {
  installment: Installment
  onClick: () => void
}) {
  const isPending = installment.status === "pendente"
  const isLate = installment.status === "atrasado"
  const isPaid = installment.status === "pago"

  const statusLabel = isPending ? "ABERTO" : isLate ? "ATRASADO" : "PAGO"
  const statusClass = isPending ? "badge-aberto" : isLate ? "badge-atrasado" : "badge-pago"
  const totalAmount = installment.amount + (installment.fine_amount || 0)

  const dueFormatted = new Date(installment.due_date).toLocaleDateString("pt-BR", {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const paidDateFormatted = new Date(installment.due_date).toLocaleDateString("pt-BR", {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <div
      className={`custom-installment-card ${isLate ? 'card-atrasado' : ''} ${isPaid ? 'card-pago' : ''}`}
      onClick={onClick}
    >
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <div className="text-muted small fw-bold text-uppercase ls-1" style={{ fontSize: '0.65rem' }}>Parcela</div>
          <div className="fw-bold fs-4 text-dark" style={{ lineHeight: 1.1 }}>
            {String(installment.index).padStart(2, '0')}
            <span className="text-muted fw-normal fs-6"> / {String(installment.count).padStart(2, '0')}</span>
          </div>
        </div>
        <div className="d-flex flex-column align-items-end gap-1">
          <span className={`badge-custom ${statusClass}`}>
            {statusLabel}
          </span>
          {isPaid && (
            <span className="card-paid-date">{paidDateFormatted}</span>
          )}
        </div>
      </div>

      <div className="d-flex align-items-center mb-3 text-muted" style={{ fontSize: '0.75rem' }}>
        {isPaid ? (
          <><i className="bi bi-check-circle-fill me-2 text-success"></i> Pagamento Confirmado</>
        ) : isLate ? (
          <><i className="bi bi-exclamation-triangle-fill me-2" style={{ color: 'var(--primary-red)' }}></i> Vencimento: {dueFormatted}</>
        ) : (
          <><i className="bi bi-calendar3 me-2"></i> Vencimento: {dueFormatted}</>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-end">
        <div className="fw-bold fs-4" style={{ color: isPaid ? '#A0AEC0' : isLate ? 'var(--primary-red)' : '#1A202C' }}>
          {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAmount)}
        </div>
        <div className="card-chevron">
          <i className="bi bi-chevron-right"></i>
        </div>
      </div>
    </div>
  )
}
