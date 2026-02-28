"use client"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabaseClient"
import type { Installment, InstallmentStatus } from "../../../lib/types"
import InstallmentCard from "../../../components/InstallmentCard"
import PaymentModal from "../../../components/PaymentModal"

type ContractWithInstallments = {
  pvenum: number
  total: number
  count: number
  firstDate: string
  installments: Installment[]
}

export default function ClienteContratosPage() {
  const params = useParams()
  const clicod = useMemo(() => Number(params?.clicod as string), [params])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<ContractWithInstallments[]>([])
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [expandedContract, setExpandedContract] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'inicio' | 'extrato' | 'carnes' | 'perfil'>('inicio')
  const [paying, setPaying] = useState<{ open: boolean; installment?: Installment }>({
    open: false
  })

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!clicod || isNaN(clicod)) {
        setError("Cliente inválido")
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)

      // Fetch customer name
      const { data: customerData } = await supabase
        .from("CLIENTE")
        .select("CLINOM")
        .eq("CLICOD", clicod)
        .maybeSingle()
      
      if (mounted && customerData) {
        setCustomerName((customerData as any).CLINOM)
      }

      const { data, error } = await supabase
        .from("NVENDA")
        .select("PVENUM, PVEDAT, NPESEQ, PVETPA, PAGCOD, PAGDES, CLICOD")
        .eq("CLICOD", clicod)
        .order("PVENUM", { ascending: false })
        .order("NPESEQ", { ascending: true })

      if (!mounted) return
      if (error) {
        setError(`Erro ao buscar contratos: ${error.message}`)
        setLoading(false)
        return
      }
      if (!data || data.length === 0) {
        setContracts([])
        setLoading(false)
        return
      }

      function addDays(base: string, days: number) {
        const d = new Date(base)
        d.setDate(d.getDate() + days)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const dd = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${dd}`
      }

      const map = new Map<number, ContractWithInstallments>()
      for (const row of data as any[]) {
        const num = Number(row.PVENUM)
        if (!map.has(num)) {
          map.set(num, {
            pvenum: num,
            total: 0,
            count: 0,
            firstDate: row.PVEDAT,
            installments: []
          })
        }
        
        const item = map.get(num)!
        item.total += Number(row.PVETPA || 0)
        item.count = Math.max(item.count, Number(row.NPESEQ))
        if (new Date(row.PVEDAT) < new Date(item.firstDate)) {
          item.firstDate = row.PVEDAT
        }

        const pago = Number(row.PAGCOD) === 7
        const idx = Number(row.NPESEQ)
        const firstIsBoleto = String(row.PAGDES || "").toUpperCase() === "BOLETO" || Number(row.PAGCOD) === 5
        const due = firstIsBoleto
          ? addDays(item.firstDate, 30 * idx)
          : addDays(item.firstDate, 30 * (idx - 1))

        item.installments.push({
          id: `${row.PVENUM}-${row.NPESEQ}`,
          contract_id: String(row.PVENUM),
          index: idx,
          count: 0, // Will be updated later
          amount: Number(row.PVETPA || 0),
          due_date: due,
          status: pago
            ? "pago"
            : new Date(due).getTime() < Date.now()
            ? "atrasado"
            : "pendente",
          pix_charge_id: null,
          pcrnot: Number(row.PVENUM)
        })
      }

      const result = Array.from(map.values()).map(c => ({
        ...c,
        installments: c.installments.map(i => ({ ...i, count: c.count }))
      })).sort((a, b) => b.pvenum - a.pvenum)

      setContracts(result)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [clicod])

  const openPayment = (inst: Installment) =>
    setPaying({ open: true, installment: inst })

  const closePayment = () => setPaying({ open: false })

  const nextInstallment = useMemo(() => {
    const all = contracts.flatMap(c => c.installments).filter(i => i.status !== "pago")
    return all.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
  }, [contracts])

  const stats = useMemo(() => {
    const all = contracts.flatMap(c => c.installments)
    const paid = all.filter(i => i.status === "pago").length
    const total = all.length
    const totalAmount = all.filter(i => i.status !== "pago").reduce((acc, i) => acc + i.amount, 0)
    return { paid, total, totalAmount }
  }, [contracts])

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
      ) : (
        <>
          {/* Header */}
          <div className="header-top">
            <div>
              <div className="welcome-label">Bem-vindo de volta</div>
              <h1 className="welcome-title">Olá, {customerName ? customerName.split(' ')[0] : 'Cliente'}!</h1>
            </div>
            <button className="menu-btn shadow-sm" onClick={() => setActiveTab('perfil')}>
              <i className="bi bi-list fs-4"></i>
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="animate__animated animate__fadeIn">
            {activeTab === 'inicio' && (
              <>
                {/* Quick Actions */}
                <div className="quick-actions">
                  <div className="action-item cursor-pointer" onClick={() => setActiveTab('carnes')}>
                    <div className="action-icon-box text-danger">
                      <i className="bi bi-qr-code"></i>
                    </div>
                    <div className="action-label">PIX</div>
                  </div>
                  <div className="action-item">
                    <div className="action-icon-box text-primary">
                      <i className="bi bi-upc-scan"></i>
                    </div>
                    <div className="action-label">BOLETO</div>
                  </div>
                  <div className="action-item cursor-pointer" onClick={() => setActiveTab('extrato')}>
                    <div className="action-icon-box text-secondary">
                      <i className="bi bi-clock-history"></i>
                    </div>
                    <div className="action-label">HISTÓRICO</div>
                  </div>
                  <div className="action-item">
                    <div className="action-icon-box text-dark">
                      <i className="bi bi-shop"></i>
                    </div>
                    <div className="action-label">LOJAS</div>
                  </div>
                </div>

                {/* MM Card Section */}
                <div className="mm-card-section">
                  <div className="mm-card-visual shadow">
                    <div className="mm-card-chip"></div>
                    <div className="mt-4">
                      <div className="mm-card-name">MM MAGAZINE</div>
                      <div className="mm-card-holder">{customerName || 'CLIENTE MM'}</div>
                    </div>
                    <div className="position-absolute bottom-0 end-0 p-3 opacity-50">
                      <i className="bi bi-rss fs-5 rotate-90"></i>
                    </div>
                  </div>
                  <div className="power-box shadow">
                    <i className="bi bi-wallet2 text-primary"></i>
                    <span className="power-label">Poder de compra</span>
                    <span className="power-value">R$ 2.500,00</span>
                  </div>
                </div>

                {/* Status Cards */}
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-icon bg-light text-primary">
                      <i className="bi bi-wallet"></i>
                    </div>
                    <div className="stat-label">Saldo Total</div>
                    <div className="stat-value">
                      {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalAmount)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon bg-light text-danger">
                      <i className="bi bi-calendar-check"></i>
                    </div>
                    <div className="stat-label">Parcelas</div>
                    <div className="stat-value">
                      {String(stats.paid).padStart(2, '0')} / {String(stats.total).padStart(2, '0')}
                    </div>
                  </div>
                </div>

                {/* Próximo Vencimento */}
                {nextInstallment && (
                  <div className="main-payment-card">
                    <div className="payment-label">Próximo Vencimento</div>
                    <div className="payment-value">
                      {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nextInstallment.amount)}
                    </div>
                    <div className="payment-date">
                      <i className="bi bi-calendar3 me-2 text-muted"></i>
                      {new Date(nextInstallment.due_date).toLocaleDateString("pt-BR", { day: 'numeric', month: 'short' })}
                    </div>

                    <div className="progress-circle-container">
                      <svg viewBox="0 0 36 36" className="w-100 h-100">
                        <path
                          className="stroke-light"
                          style={{ stroke: '#f3f3f3', strokeWidth: 3, fill: 'none' }}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="stroke-red"
                          style={{ 
                            stroke: 'var(--primary-red)', 
                            strokeWidth: 3, 
                            strokeLinecap: 'round', 
                            fill: 'none',
                            strokeDasharray: `${(stats.paid / (stats.total || 1)) * 100}, 100`
                          }}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <text x="18" y="20.35" className="fw-bold" style={{ fontSize: '8px', textAnchor: 'middle', fill: '#1A1A1A' }}>
                          {Math.round((stats.paid / (stats.total || 1)) * 100)}%
                        </text>
                      </svg>
                    </div>

                    <div className="payment-actions">
                      <button className="btn-pay shadow-sm" onClick={() => openPayment(nextInstallment)}>
                        <i className="bi bi-qr-code"></i>
                        Pagar Agora
                      </button>
                      <button className="btn-view" onClick={() => {
                        setActiveTab('carnes');
                        setExpandedContract(Number(nextInstallment.contract_id));
                      }}>
                        <i className="bi bi-card-list"></i>
                        Ver Carnês
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Alert */}
                <div className="info-alert mt-4 shadow-sm">
                  <div className="info-icon">
                    <i className="bi bi-info-lg"></i>
                  </div>
                  <div className="info-text">
                    Mantenha seus pagamentos em dia e aumente seu score para novos limites.
                  </div>
                </div>
              </>
            )}

            {activeTab === 'extrato' && (
              <div className="p-2">
                <h5 className="fw-bold mb-4 ls-1 text-uppercase small text-muted">Histórico de Atividades</h5>
                <div className="stat-card p-4 text-center">
                  <i className="bi bi-clock-history fs-1 text-muted mb-3 d-block"></i>
                  <p className="text-muted mb-0">Nenhuma atividade recente registrada no momento.</p>
                </div>
              </div>
            )}

            {activeTab === 'carnes' && (
              <div className="p-2">
                <h5 className="fw-bold mb-4 ls-1 text-uppercase small text-muted">Meus Carnês Digitais</h5>
                {contracts.length === 0 ? (
                  <div className="stat-card p-5 text-center shadow-sm">
                    <i className="bi bi-folder-x fs-1 text-muted mb-3 d-block"></i>
                    <p className="text-muted mb-0">Nenhum contrato ativo encontrado no momento.</p>
                  </div>
                ) : (
                  contracts.map((c) => (
                    <div key={c.pvenum} className="stat-card mb-3 p-0 overflow-hidden">
                      <div 
                        className="p-3 d-flex justify-content-between align-items-center cursor-pointer"
                        onClick={() => setExpandedContract(expandedContract === c.pvenum ? null : c.pvenum)}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-light p-2 rounded-3 text-primary">
                            <i className="bi bi-file-text fs-5"></i>
                          </div>
                          <div>
                            <div className="fw-bold">Contrato #{c.pvenum}</div>
                            <div className="text-muted small">Início: {new Date(c.firstDate).toLocaleDateString("pt-BR")}</div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge-custom badge-pendente d-none d-sm-inline-block">
                            {c.count} parcelas
                          </span>
                          <i className={`bi bi-chevron-${expandedContract === c.pvenum ? 'up' : 'down'} text-muted`}></i>
                        </div>
                      </div>
                      
                      {expandedContract === c.pvenum && (
                        <div className="p-3 bg-light border-top animate__animated animate__fadeIn">
                          <div className="installments-grid-desktop">
                            {c.installments.map((inst) => (
                              <InstallmentCard
                                key={inst.id}
                                installment={inst}
                                onPay={() => openPayment(inst)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'perfil' && (
              <div className="p-2">
                <h5 className="fw-bold mb-4 ls-1 text-uppercase small text-muted">Seu Perfil</h5>
                <div className="stat-card p-4">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="bg-primary-red text-white rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 64, height: 64 }}>
                      <i className="bi bi-person fs-2"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-1">{customerName || 'Cliente MM'}</h5>
                      <span className="text-muted small">ID: #{clicod}</span>
                    </div>
                  </div>
                  <div className="list-group list-group-flush">
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-person-gear text-muted"></i>
                        <span>Dados Pessoais</span>
                      </div>
                      <i className="bi bi-chevron-right text-muted small"></i>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-shield-lock text-muted"></i>
                        <span>Segurança</span>
                      </div>
                      <i className="bi bi-chevron-right text-muted small"></i>
                    </div>
                    <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-question-circle text-muted"></i>
                        <span>Ajuda & Suporte</span>
                      </div>
                      <i className="bi bi-chevron-right text-muted small"></i>
                    </div>
                    <button className="list-group-item d-flex justify-content-between align-items-center px-0 py-3 border-0 bg-transparent text-danger w-100">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-box-arrow-right"></i>
                        <span className="fw-bold">Sair da Conta</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Nav */}
          <div className="bottom-nav">
            <button 
              className={`nav-item border-0 bg-transparent ${activeTab === 'inicio' ? 'active' : ''}`}
              onClick={() => setActiveTab('inicio')}
            >
              <i className={`bi bi-house-door${activeTab === 'inicio' ? '-fill' : ''} nav-icon`}></i>
              <span className="nav-label">Início</span>
            </button>
            <button 
              className={`nav-item border-0 bg-transparent ${activeTab === 'extrato' ? 'active' : ''}`}
              onClick={() => setActiveTab('extrato')}
            >
              <i className={`bi bi-file-earmark-text${activeTab === 'extrato' ? '-fill' : ''} nav-icon`}></i>
              <span className="nav-label">Extrato</span>
            </button>
            <button 
              className={`nav-item border-0 bg-transparent ${activeTab === 'carnes' ? 'active' : ''}`}
              onClick={() => setActiveTab('carnes')}
            >
              <i className={`bi bi-collection${activeTab === 'carnes' ? '-fill' : ''} nav-icon`}></i>
              <span className="nav-label">Carnês</span>
            </button>
            <button 
              className={`nav-item border-0 bg-transparent ${activeTab === 'perfil' ? 'active' : ''}`}
              onClick={() => setActiveTab('perfil')}
            >
              <i className={`bi bi-person${activeTab === 'perfil' ? '-fill' : ''} nav-icon`}></i>
              <span className="nav-label">Perfil</span>
            </button>
          </div>
        </>
      )}

      {paying.open && paying.installment && (
        <PaymentModal
          installment={paying.installment}
          onClose={closePayment}
          onStatusChange={(newStatus: InstallmentStatus) => {
            setContracts((prev) =>
              prev.map((c) => ({
                ...c,
                installments: c.installments.map((i) =>
                  i.id === paying.installment!.id
                    ? { ...i, status: newStatus }
                    : i
                )
              }))
            )
          }}
        />
      )}
    </div>
  )
}

