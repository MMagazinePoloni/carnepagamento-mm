"use client"
import type { Installment } from "../lib/types"

export default function InstallmentDetailScreen({
    installment,
    onBack,
    onPay,
    onHelp
}: {
    installment: Installment
    onBack: () => void
    onPay: () => void
    onHelp?: () => void
}) {
    const totalAmount = installment.amount + (installment.fine_amount || 0)
    const isLate = installment.status === "atrasado"
    const isPaid = installment.status === "pago"

    const statusLabel = isPaid
        ? "Pago"
        : isLate
            ? "Parcela Atrasada"
            : "Aguardando Pagamento"

    const statusClass = isPaid
        ? "detail-status-paid"
        : isLate
            ? "detail-status-late"
            : "detail-status-pending"

    const dueFormatted = new Date(installment.due_date).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric"
    })

    const contractDisplay = installment.pcrnot
        ? `${String(installment.pcrnot).slice(-3).padStart(3, '0')}.${String(installment.pcrnot).slice(0, 3).padStart(3, '0')}-X`
        : "---"

    const orderNumber = `MM-${String(installment.pcrnot || 0).padStart(8, '9')}`

    const purchaseDateFormatted = installment.pcrnot
        ? new Date(new Date(installment.due_date).getTime() - (installment.index - 1) * 30 * 24 * 60 * 60 * 1000)
            .toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "---"

    return (
        <div className="detail-screen animate__animated animate__fadeIn">
            {/* Header */}
            <div className="detail-header">
                <button className="detail-back-btn" onClick={onBack}>
                    <i className="bi bi-chevron-left"></i>
                </button>
                <h5 className="detail-title">Detalhes da Parcela</h5>
                <button className="detail-help-btn" onClick={onHelp}>
                    <i className="bi bi-question-circle"></i>
                </button>
            </div>

            {/* Value Card */}
            <div className="detail-value-card">
                <div className="detail-value-card-inner">
                    <div className="detail-value-header">
                        <div>
                            <div className="detail-parcela-label">
                                PARCELA {String(installment.index).padStart(2, "0")} DE {String(installment.count).padStart(2, "0")}
                            </div>
                            <div className="detail-parcela-value">
                                {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAmount)}
                            </div>
                            <div className={`detail-status-badge ${statusClass}`}>
                                <i className={`bi ${isPaid ? 'bi-check-circle-fill' : isLate ? 'bi-exclamation-circle-fill' : 'bi-clock-fill'} me-1`}></i>
                                {statusLabel}
                            </div>
                        </div>
                        <div className="detail-value-icon">
                            <i className="bi bi-credit-card-2-front-fill"></i>
                        </div>
                    </div>
                    <div className="detail-due-row">
                        <span className="detail-due-label">Vencimento</span>
                        <span className="detail-due-date">{dueFormatted}</span>
                    </div>
                </div>
            </div>

            {/* Product Section */}
            <div className="detail-product-card">
                <div className="detail-product-row">
                    <div className="detail-product-img">
                        <i className="bi bi-box-seam-fill"></i>
                    </div>
                    <div className="detail-product-info">
                        <div className="detail-product-name">Compra MM Magazine</div>
                        <div className="detail-product-order">Pedido #{orderNumber}</div>
                    </div>
                </div>

                <div className="detail-meta-row">
                    <div className="detail-meta-item">
                        <div className="detail-meta-label">DATA COMPRA</div>
                        <div className="detail-meta-value">{purchaseDateFormatted}</div>
                    </div>
                    <div className="detail-meta-item">
                        <div className="detail-meta-label">CONTRATO</div>
                        <div className="detail-meta-value">{contractDisplay}</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="detail-action-buttons">
                    <button className="detail-action-btn" onClick={onPay}>
                        <i className="bi bi-qr-code-scan"></i>
                        <span>Copiar PIX</span>
                    </button>
                    <button className="detail-action-btn">
                        <i className="bi bi-file-earmark-pdf"></i>
                        <span>Boleto PDF</span>
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="detail-footer">
                <div className="detail-secure-label">
                    <i className="bi bi-shield-check me-1"></i>
                    PAGAMENTO 100% SEGURO
                </div>

                <div className="detail-total-row">
                    <span className="detail-total-label">Total a pagar</span>
                    <span className="detail-total-value">
                        {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAmount)}
                    </span>
                </div>

                {!isPaid && (
                    <button className="detail-pay-btn" onClick={onPay}>
                        <i className="bi bi-qr-code me-2"></i>
                        PAGAR PARCELA
                    </button>
                )}
            </div>
        </div>
    )
}
