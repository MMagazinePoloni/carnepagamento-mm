"use client"

import { useEffect, useMemo, useState } from "react"
import type { Contract, Installment, InstallmentStatus } from "../../../lib/types"
import PaymentModal from "../../../components/PaymentModal"
import InstallmentCard from "../../../components/InstallmentCard"
import { useParams } from "next/navigation"

export default function ContractPage() {
  const params = useParams()
  const token = useMemo(() => (params?.token as string) || "", [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contract, setContract] = useState<Contract | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [paying, setPaying] = useState<{ open: boolean; installment?: Installment }>({
    open: false
  })

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/contracts/${token}`)

        const data = await res.json()

        if (!mounted) return

        if (!res.ok) {
          setError(data.error || "Erro ao carregar contrato.")
          setLoading(false)
          return
        }

        setContract(data.contract)
        setInstallments(data.installments)
        setLoading(false)
      } catch (err: any) {
        if (!mounted) return
        setError("Erro inesperado ao carregar contrato.")
        setLoading(false)
      }
    }

    if (token) load()

    return () => {
      mounted = false
    }
  }, [token])

  const openPayment = (inst: Installment) =>
    setPaying({ open: true, installment: inst })

  const closePayment = () => setPaying({ open: false })

  return (
    <div className="dashboard-container">
      {loading ? (
        <div className="d-flex justify-content-center align-items-center vh-100">
          <div className="spinner-border text-primary-red" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
        </div>
      ) : error ? (
        <div className="d-flex flex-column justify-content-center align-items-center vh-100 text-center p-4">
          <i className="bi bi-exclamation-triangle-fill text-danger fs-1 mb-3"></i>
          <h4 className="fw-bold">Ops! Algo deu errado.</h4>
          <p className="text-muted">{error}</p>
          <button className="btn btn-primary-red mt-3 px-4 rounded-3" onClick={() => window.location.reload()}>Tentar Novamente</button>
        </div>
      ) : contract ? (
        <>
          {/* Header */}
          <div className="header-top">
            <div>
              <div className="welcome-label">Seu Carnê Digital</div>
              <h1 className="welcome-title">Olá, {contract.customer_name ? contract.customer_name.split(' ')[0] : 'Cliente'}!</h1>
            </div>
            <div className="menu-btn shadow-sm">
              <i className="bi bi-shield-check text-success fs-4"></i>
            </div>
          </div>

          {/* Quick Info MM Card */}
          <div className="mm-card-section">
            <div className="mm-card-visual shadow">
              <div className="mm-card-chip"></div>
              <div className="mt-4">
                <div className="mm-card-name">MM MAGAZINE</div>
                <div className="mm-card-holder">{contract.customer_name || 'CLIENTE MM'}</div>
              </div>
              <div className="position-absolute bottom-0 end-0 p-3 opacity-50">
                <i className="bi bi-rss fs-5 rotate-90"></i>
              </div>
            </div>
            <div className="power-box shadow">
              <i className="bi bi-file-text text-primary"></i>
              <span className="power-label">Contrato</span>
              <span className="power-value">#{contract.contract_number}</span>
            </div>
          </div>

          {/* Status Cards */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon bg-light text-primary">
                <i className="bi bi-wallet"></i>
              </div>
              <div className="stat-label">Valor Total</div>
              <div className="stat-value">
                {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contract.total_amount)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon bg-light text-danger">
                <i className="bi bi-calendar-check"></i>
              </div>
              <div className="stat-label">Parcelas</div>
              <div className="stat-value">
                {String(installments.filter(i => i.status === 'pago').length).padStart(2, '0')} / {String(installments.length).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Installments List */}
          <div className="mt-4 mb-5">
            <h5 className="fw-bold mb-3 ls-1 text-uppercase small text-muted">Parcelas do Carnê</h5>
            <div className="installments-grid-desktop">
              {installments.map((inst) => (
                <InstallmentCard
                  key={inst.id}
                  installment={inst}
                  onPay={() => openPayment(inst)}
                />
              ))}
            </div>
          </div>

          {/* Info Alert */}
          <div className="info-alert shadow-sm mb-5">
            <div className="info-icon">
              <i className="bi bi-info-lg"></i>
            </div>
            <div className="info-text">
              Pague em dia para evitar juros e multas e manter seu crédito aprovado.
            </div>
          </div>

          <footer className="text-center py-4">
            <p className="text-muted small mb-0">Loja confiável. Pagamentos 100% seguros.</p>
            <p className="text-muted" style={{ fontSize: '0.6rem' }}>© {new Date().getFullYear()} MM Magazine</p>
          </footer>
        </>
      ) : null}

      {paying.open && paying.installment && (
        <PaymentModal
          installment={paying.installment}
          onClose={closePayment}
          onStatusChange={(newStatus: InstallmentStatus) => {
            setInstallments((prev) =>
              prev.map((i) =>
                i.id === paying.installment!.id
                  ? { ...i, status: newStatus }
                  : i
              )
            )
          }}
        />
      )}
    </div>
  )
}
