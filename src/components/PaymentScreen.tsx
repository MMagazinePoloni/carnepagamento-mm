"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import QRCode from "react-qr-code"
import type { Installment, InstallmentStatus } from "../lib/types"
import { supabase } from "../lib/supabaseClient"

type PaymentTab = "pix" | "boleto"

export default function PaymentScreen({
    installment,
    onBack,
    onStatusChange
}: {
    installment: Installment
    onBack: () => void
    onStatusChange: (newStatus: InstallmentStatus) => void
}) {
    const [activeTab, setActiveTab] = useState<PaymentTab>("pix")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [brCode, setBrCode] = useState<string>("")
    const [chargeId, setChargeId] = useState<string>("")
    const [copied, setCopied] = useState(false)
    const [paid, setPaid] = useState(false)
    const [simulating, setSimulating] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const createdRef = useRef(false) // Guard against duplicate createCharge

    const totalAmount = installment.amount + (installment.fine_amount || 0)

    const body = useMemo(() => ({
        installmentId: installment.id,
        amount: totalAmount
    }), [installment.id, totalAmount])

    const dueFormatted = new Date(installment.due_date).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric"
    })

    useEffect(() => {
        // Prevent duplicate charge creation (React StrictMode calls useEffect twice)
        if (createdRef.current) return
        createdRef.current = true

        async function createCharge() {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch("/api/abacatepay/create-charge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                })
                if (!res.ok) {
                    let msg = "Falha ao criar cobrança Pix."
                    try {
                        const j = await res.json()
                        const details = j?.error
                        if (details) msg += ` ${String(details).slice(0, 300)}`
                    } catch { }
                    setError(msg)
                    setLoading(false)
                    return
                }
                const data = await res.json()

                if (!data.brCode) {
                    setError("QR Code PIX não retornado pela API.")
                    setLoading(false)
                    return
                }

                const newChargeId = data.chargeId || ""
                console.log("Charge criado:", newChargeId)
                setBrCode(data.brCode)
                setChargeId(newChargeId)

                // Save payment record in Supabase
                const { error: insertErr } = await supabase.from("payments").insert({
                    installment_id: installment.id,
                    amount: totalAmount,
                    method: "pix",
                    status: "pending",
                    provider_id: newChargeId || null
                })
                if (insertErr) console.error("Erro ao inserir payment:", insertErr)
                else console.log("Payment inserido com provider_id:", newChargeId)

                if (installment.pcrnot) {
                    await supabase
                        .from("NVENDA")
                        .update({ ENVIADO: true, PAGDES: "PIX" })
                        .eq("PVENUM", installment.pcrnot)
                        .eq("NPESEQ", installment.index)
                }

                setLoading(false)
                // Start polling for payment status
                startPolling(newChargeId)
            } catch (err: any) {
                setError(`Erro de rede: ${err.message || "tente novamente"}`)
                setLoading(false)
            }
        }
        createCharge()
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [body])

    async function markAsPaid(pixId: string) {
        console.log("markAsPaid chamado com provider_id:", pixId)

        try {
            const res = await fetch("/api/abacatepay/mark-paid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chargeId: pixId,
                    pvenum: installment.pcrnot || null,
                    npeseq: installment.index || null
                })
            })
            const data = await res.json()
            if (!res.ok) {
                console.error("Erro mark-paid:", data.error)
            } else {
                console.log("mark-paid sucesso:", data)
            }
        } catch (err) {
            console.error("Erro ao chamar mark-paid:", err)
        }

        setPaid(true)
        onStatusChange("pago")
    }

    async function checkPaymentStatus(pixId: string): Promise<boolean> {
        try {
            const res = await fetch(`/api/abacatepay/check-status?id=${encodeURIComponent(pixId)}`)
            if (!res.ok) {
                console.warn("check-status HTTP", res.status)
                return false
            }
            const data = await res.json()
            if (data.status === "PAID") {
                return true
            }
        } catch (err) {
            console.warn("check-status error:", err)
        }
        return false
    }

    function startPolling(pixId: string) {
        if (!pixId) return
        timerRef.current = setInterval(async () => {
            const isPaid = await checkPaymentStatus(pixId)
            if (isPaid) {
                if (timerRef.current) clearInterval(timerRef.current)
                await markAsPaid(pixId)
            }
        }, 10000) // 10 seconds to avoid 503 overload
    }

    async function handleSimulate() {
        if (!chargeId || simulating) return
        setSimulating(true)
        try {
            const res = await fetch("/api/abacatepay/simulate-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chargeId })
            })
            if (!res.ok) {
                console.error("Falha ao simular:", await res.text())
                setSimulating(false)
                return
            }

            // Simulate succeeded → payment is done in dev mode
            // Mark as paid directly (no need to check-status, avoids 503)
            if (timerRef.current) clearInterval(timerRef.current)
            await markAsPaid(chargeId)
        } catch (err) {
            console.error("Erro ao simular:", err)
        } finally {
            setSimulating(false)
        }
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(brCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 3000)
        } catch {
            const ta = document.createElement("textarea")
            ta.value = brCode
            document.body.appendChild(ta)
            ta.select()
            document.execCommand("copy")
            document.body.removeChild(ta)
            setCopied(true)
            setTimeout(() => setCopied(false), 3000)
        }
    }

    return (
        <div className="payment-screen animate__animated animate__fadeIn">
            {/* Header */}
            <div className="payment-screen-header">
                <button className="detail-back-btn" onClick={onBack}>
                    <i className="bi bi-chevron-left"></i>
                </button>
                <h5 className="detail-title">Pagamento</h5>
                <div style={{ width: 40 }}></div>
            </div>

            {/* Installment Summary Card */}
            <div className="payment-summary-card">
                <div className="payment-summary-inner">
                    <div>
                        <div className="payment-summary-label">
                            PARCELA {String(installment.index).padStart(2, "0")}/{String(installment.count).padStart(2, "0")}
                        </div>
                        <div className="payment-summary-value">
                            <span className="payment-summary-currency">R$</span>
                            {" "}
                            {Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(totalAmount)}
                        </div>
                        <div className="payment-summary-due">
                            <i className="bi bi-calendar3 me-1"></i>
                            Vencimento: {dueFormatted}
                        </div>
                    </div>
                    <div className="payment-summary-icon">
                        <i className="bi bi-receipt-cutoff"></i>
                    </div>
                </div>
            </div>

            {/* Method Tabs */}
            <div className="payment-method-tabs">
                <button
                    className={`payment-tab ${activeTab === "pix" ? "active" : ""}`}
                    onClick={() => setActiveTab("pix")}
                >
                    <i className="bi bi-qr-code-scan me-2"></i>
                    PIX
                </button>
                <button
                    className={`payment-tab ${activeTab === "boleto" ? "active" : ""}`}
                    onClick={() => setActiveTab("boleto")}
                >
                    <i className="bi bi-upc-scan me-2"></i>
                    Boleto
                </button>
            </div>

            {/* Tab Content */}
            <div className="payment-tab-content">
                {activeTab === "pix" && (
                    <div className="animate__animated animate__fadeIn">
                        {paid ? (
                            <div className="payment-success-box">
                                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "3rem" }}></i>
                                <h5 className="fw-bold mt-3 text-success">Pagamento Confirmado!</h5>
                                <p className="text-muted small">Seu pagamento foi processado com sucesso.</p>
                            </div>
                        ) : loading ? (
                            <div className="payment-loading-box">
                                <div className="spinner-border text-danger" role="status">
                                    <span className="visually-hidden">Gerando...</span>
                                </div>
                                <p className="text-muted small mt-3">Gerando QR Code PIX...</p>
                            </div>
                        ) : error ? (
                            <div className="payment-error-box">
                                <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: "2rem" }}></i>
                                <p className="text-muted small mt-2">{error}</p>
                            </div>
                        ) : (
                            <>
                                <p className="payment-instruction-text">
                                    Escaneie o QR Code ou copie a chave PIX abaixo para pagar instantaneamente.
                                </p>

                                {/* QR Code */}
                                <div className="payment-qr-container">
                                    <div className="payment-qr-badge">PIX</div>
                                    <div className="payment-qr-box">
                                        <QRCode value={brCode || " "} size={180} />
                                    </div>
                                    <div className="payment-qr-watermark">PIX • AbacatePay</div>
                                </div>

                                {/* Copy Code */}
                                <div className="payment-copy-section">
                                    <div className="payment-copy-label">PIX COPIA E COLA</div>
                                    <div className="payment-copy-field">
                                        <span className="payment-copy-text">{brCode.slice(0, 32)}...</span>
                                        <button className="payment-copy-icon" onClick={handleCopy}>
                                            <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
                                        </button>
                                    </div>
                                </div>

                                <button className="payment-copy-btn" onClick={handleCopy}>
                                    <i className={`bi ${copied ? 'bi-check-circle-fill' : 'bi-clipboard-check'} me-2`}></i>
                                    {copied ? "Código Copiado!" : "Copiar Código PIX"}
                                </button>

                                {/* Polling indicator */}
                                <div className="text-center mt-2">
                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                        <div className="spinner-grow spinner-grow-sm text-success" role="status">
                                            <span className="visually-hidden">Aguardando...</span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600 }}>
                                            Aguardando confirmação do pagamento...
                                        </span>
                                    </div>
                                </div>

                                {/* Dev Mode: Simulate Payment */}
                                {chargeId && (
                                    <button
                                        className="payment-simulate-btn"
                                        onClick={handleSimulate}
                                        disabled={simulating}
                                    >
                                        <i className={`bi ${simulating ? 'bi-hourglass-split' : 'bi-lightning-charge-fill'} me-2`}></i>
                                        {simulating ? 'Simulando...' : 'Simular Pagamento (DEV)'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === "boleto" && (
                    <div className="payment-boleto-placeholder animate__animated animate__fadeIn">
                        <i className="bi bi-upc-scan" style={{ fontSize: "3rem", color: "#CBD5E0" }}></i>
                        <h6 className="fw-bold mt-3 text-dark">Boleto Bancário</h6>
                        <p className="text-muted small">Funcionalidade em breve. Use PIX para pagamento instantâneo.</p>
                    </div>
                )}
            </div>

            {/* Secure Footer */}
            <div className="payment-secure-footer">
                <i className="bi bi-shield-lock-fill me-1 text-success"></i>
                TRANSAÇÃO SEGURA CRIPTOGRAFADA POR MM PAY
            </div>
        </div>
    )
}
