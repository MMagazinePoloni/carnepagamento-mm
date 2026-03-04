"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabaseClient"
import type { Installment, InstallmentStatus } from "../../../lib/types"
import InstallmentCard from "../../../components/InstallmentCard"
import InstallmentDetailScreen from "../../../components/InstallmentDetailScreen"
import PaymentScreen from "../../../components/PaymentScreen"
import { decodeClientId } from "../../../lib/obfuscate"

type ContractWithInstallments = {
  pvenum: number
  total: number
  count: number
  firstDate: string
  installments: Installment[]
}

export default function ClienteContratosPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawToken = params?.clicod as string
  const clicod = useMemo(() => Number(decodeClientId(rawToken)), [rawToken])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<ContractWithInstallments[]>([])
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [expandedContract, setExpandedContract] = useState<number | null>(null)

  const initialTab = (searchParams?.get("tab") as 'inicio' | 'suporte' | 'carnes' | 'perfil' | 'lojas' | 'historico') || 'inicio'
  const [activeTab, setActiveTab] = useState<'inicio' | 'suporte' | 'carnes' | 'perfil' | 'lojas' | 'historico'>(initialTab)
  const [installmentFilter, setInstallmentFilter] = useState<'tudo' | 'aberto' | 'atrasado'>('tudo')
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)
  const [screenMode, setScreenMode] = useState<'none' | 'detail' | 'payment' | 'history_detail'>('none')
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

  // Detect ?payment=success from AbacatePay redirect
  useEffect(() => {
    if (searchParams?.get("payment") === "success") {
      setShowPaymentSuccess(true)
    }
  }, [searchParams])

  const dismissPaymentSuccess = useCallback(() => {
    setShowPaymentSuccess(false)
    // Remove query param from URL without reload
    const url = new URL(window.location.href)
    url.searchParams.delete("payment")
    router.replace(url.pathname + url.search, { scroll: false })
    // Reload data to get updated statuses
    window.location.reload()
  }, [router])

  // Auto-dismiss payment success after 5 seconds
  useEffect(() => {
    if (!showPaymentSuccess) return
    const timer = setTimeout(() => {
      dismissPaymentSuccess()
    }, 5000)
    return () => clearTimeout(timer)
  }, [showPaymentSuccess, dismissPaymentSuccess])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!rawToken || !clicod || isNaN(clicod)) {
        setError("Cliente inválido")
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/cliente/${rawToken}`)
        const json = await res.json()

        if (!mounted) return
        if (!res.ok) {
          setError(json.error || "Erro ao buscar dados do cliente")
          setLoading(false)
          return
        }

        setCustomerName(json.customerName)
        setContracts(json.contracts || [])
      } catch (err: any) {
        if (!mounted) return
        setError(err.message || "Erro de rede")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [clicod])

  const openDetail = (inst: Installment) => {
    setSelectedInstallment(inst)
    setScreenMode('detail')
  }

  const openPaymentFromDetail = () => {
    setScreenMode('payment')
  }

  const closeScreens = () => {
    setScreenMode('none')
    setSelectedInstallment(null)
  }

  const goBackFromPayment = () => {
    setScreenMode('detail')
  }

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
          {/* Desktop Sidebar */}
          <aside className="desktop-sidebar">
            <div className="sidebar-brand">
              <div className="sidebar-logo">
                <span className="sidebar-logo-text">MM</span>
              </div>
              <div className="sidebar-brand-info">
                <div className="sidebar-brand-name">MM Magazine</div>
                <div className="sidebar-brand-subtitle">Área do Cliente</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              {([
                { key: 'inicio' as const, icon: 'house-door', label: 'Início' },
                { key: 'carnes' as const, icon: 'collection', label: 'Carnês' },
                { key: 'historico' as const, icon: 'clock-history', label: 'Histórico' },
                { key: 'lojas' as const, icon: 'shop', label: 'Lojas' },
                { key: 'suporte' as const, icon: 'headset', label: 'Suporte' },
                { key: 'perfil' as const, icon: 'person', label: 'Perfil' },
              ]).map((item) => (
                <button
                  key={item.key}
                  className={`sidebar-nav-item ${activeTab === item.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  <div className="sidebar-nav-indicator"></div>
                  <i className={`bi bi-${item.icon}${activeTab === item.key ? '-fill' : ''} sidebar-nav-icon`}></i>
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="sidebar-footer">
              <div className="sidebar-user">
                <div className="sidebar-user-avatar">
                  <i className="bi bi-person-fill"></i>
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{customerName ? customerName.split(' ')[0] : 'Cliente'}</div>
                  <div className="sidebar-user-role">Cliente MM</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Wrapper */}
          <div className="main-content-area">
            {/* TAB CONTENT */}
            <div className="tab-content-animated" key={activeTab}>
              {activeTab === 'inicio' && (
                <>
                  {/* Header - Only on Home */}
                  <div className="header-top">
                    <div>
                      <div className="welcome-label">Bem-vindo de volta</div>
                      <h1 className="welcome-title">Olá, {customerName ? customerName.split(' ')[0] : 'Cliente'}!</h1>
                    </div>
                    <button className="menu-btn shadow-sm" onClick={() => setActiveTab('perfil')}>
                      <i className="bi bi-list fs-4"></i>
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="quick-actions">
                    <div className="action-item cursor-pointer" onClick={() => setActiveTab('carnes')}>
                      <div className="action-icon-box" style={{ background: '#FFF0F0', color: 'var(--primary-red)' }}>
                        <i className="bi bi-qr-code-scan"></i>
                      </div>
                      <div className="action-label">PIX</div>
                    </div>
                    <div className="action-item">
                      <div className="action-icon-box" style={{ background: '#E6F0FE', color: 'var(--mm-card-blue)' }}>
                        <i className="bi bi-upc-scan"></i>
                      </div>
                      <div className="action-label">BOLETO</div>
                    </div>
                    <div className="action-item cursor-pointer" onClick={() => setActiveTab('suporte')}>
                      <div className="action-icon-box" style={{ background: '#F8F9FA', color: '#6C757D' }}>
                        <i className="bi bi-headset"></i>
                      </div>
                      <div className="action-label">SUPORTE</div>
                    </div>
                    <div className="action-item cursor-pointer" onClick={() => setActiveTab('lojas')}>
                      <div className="action-icon-box" style={{ background: '#F8F9FA', color: '#6C757D' }}>
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
                      <div className="stat-icon" style={{ background: '#E6F0FE', color: 'var(--mm-card-blue)' }}>
                        <i className="bi bi-wallet2"></i>
                      </div>
                      <div className="stat-label">Saldo Total</div>
                      <div className="stat-value">
                        {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalAmount)}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon" style={{ background: '#FFF0F0', color: 'var(--primary-red)' }}>
                        <i className="bi bi-calendar-event"></i>
                      </div>
                      <div className="stat-label">Parcelas</div>
                      <div className="stat-value">
                        {String(stats.paid).padStart(2, '0')} / {String(stats.total).padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  {/* Próximo Vencimento restored as per request */}
                  {nextInstallment && (
                    <div className="main-payment-card mt-2">
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
                        <button className="btn-pay shadow-sm" onClick={() => openDetail(nextInstallment)}>
                          <i className="bi bi-cash-coin"></i>
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
                  <div className="info-alert mt-4 shadow-sm" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                    <div className="info-icon" style={{ background: 'var(--mm-card-blue)' }}>
                      <i className="bi bi-info-lg"></i>
                    </div>
                    <div className="info-text">
                      Mantenha seus pagamentos em dia e aumente seu score para novos limites.
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'suporte' && (
                <div className="p-3 bg-app pb-5">
                  <div className="d-flex align-items-center mb-4">
                    <button className="back-btn shadow-sm" onClick={() => setActiveTab('inicio')}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <h5 className="fw-bold m-0 flex-grow-1 text-center" style={{ marginRight: '40px' }}>Suporte e Ajuda</h5>
                  </div>

                  <div className="mb-4">
                    <h3 className="fw-bold text-dark lh-sm m-0">Como podemos te</h3>
                    <h3 className="fw-bold text-danger lh-sm m-0 mb-2">ajudar hoje?</h3>
                    <p className="text-muted small">Gerencie seus carnês da MM Magazine rapidamente.</p>
                  </div>

                  <div className="suporte-card shadow-sm mb-4 position-relative overflow-hidden bg-white"
                    style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid #f0f0f0' }}>
                    <div className="d-flex align-items-center gap-3 mb-2">
                      <div className="bg-success bg-opacity-10 text-success rounded p-3 d-flex align-items-center justify-content-center"
                        style={{ width: '48px', height: '48px' }}>
                      </div>
                      <div>
                        <h6 className="fw-bold m-0 fs-5 text-dark">WhatsApp</h6>
                      </div>
                    </div>
                    <p className="text-muted small m-0 pe-5">
                      Fale agora com um consultor via contato direto.
                    </p>
                    <div className="position-absolute" style={{ top: '1.5rem', right: '1.5rem' }}>
                      <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-1" style={{ fontSize: '0.6rem', fontWeight: 700 }}>
                        <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.4rem' }}></i> ONLINE AGORA
                      </div>
                    </div>
                    <div className="whatsapp-bg-icon position-absolute opacity-10" style={{ right: '-10px', bottom: '-20px', fontSize: '100px', color: '#25D366' }}>
                      <i className="bi bi-whatsapp"></i>
                    </div>
                  </div>

                  <div className="search-bar position-relative mb-4">
                    <i className="bi bi-search position-absolute text-muted" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)' }}></i>
                    <input type="text" className="form-control bg-white shadow-sm border-0"
                      placeholder="Pesquise por dúvidas, parcelas..."
                      style={{ paddingLeft: '2.5rem', height: '50px', borderRadius: '12px' }} />
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-3 mt-4">
                    <h6 className="fw-bold m-0 text-dark fs-5">Perguntas Frequentes</h6>
                    <span className="text-danger small fw-bold" style={{ fontSize: '0.7rem' }}>VER TUDO</span>
                  </div>

                  <div className="d-flex flex-column gap-2 mb-4">
                    <div className="bg-white rounded-4 px-3 py-3 d-flex align-items-center justify-content-between shadow-sm">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-danger bg-opacity-10 text-danger rounded p-2 d-flex align-items-center justify-content-center">
                          <i className="bi bi-receipt"></i>
                        </div>
                        <span className="fw-bold text-dark fs-6">Como pago meu carnê?</span>
                      </div>
                      <i className="bi bi-chevron-down text-muted"></i>
                    </div>
                    <div className="bg-white rounded-4 px-3 py-3 d-flex align-items-center justify-content-between shadow-sm">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-danger bg-opacity-10 text-danger rounded p-2 d-flex align-items-center justify-content-center">
                          <i className="bi bi-clock"></i>
                        </div>
                        <span className="fw-bold text-dark fs-6">Taxas e juros por atraso</span>
                      </div>
                      <i className="bi bi-chevron-down text-muted"></i>
                    </div>
                    <div className="bg-white rounded-4 px-3 py-3 d-flex align-items-center justify-content-between shadow-sm">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-danger bg-opacity-10 text-danger rounded p-2 d-flex align-items-center justify-content-center">
                          <i className="bi bi-shield-check"></i>
                        </div>
                        <span className="fw-bold text-dark fs-6">Configurações de segurança</span>
                      </div>
                      <i className="bi bi-chevron-down text-muted"></i>
                    </div>
                  </div>

                  <div className="bg-white rounded-4 px-3 py-3 d-flex align-items-center justify-content-between shadow-sm mt-4">
                    <div className="d-flex align-items-center gap-3">
                      <div className="bg-light text-secondary rounded p-2 d-flex align-items-center justify-content-center">
                        <i className="bi bi-shop"></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>ENCONTRAR UMA LOJA FÍSICA</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Localize a MM Magazine mais próxima</div>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted small"></i>
                  </div>
                </div>
              )}

              {activeTab === 'carnes' && (
                <div className="carnes-tab-container pb-5">
                  <div className="carnes-header mt-3">
                    <button className="back-btn shadow-sm" onClick={() => setActiveTab('inicio')}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <h4 className="fw-bold m-0 text-dark">Meus Carnês</h4>
                    <button className="help-btn shadow-sm" onClick={() => setActiveTab('suporte')}>
                      <i className="bi bi-question-circle"></i>
                    </button>
                  </div>

                  <div className="total-restante-card shadow">
                    <div className="total-restante-content">
                      <div className="total-restante-label">TOTAL RESTANTE</div>
                      <div className="total-restante-value">
                        {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalAmount)}
                      </div>
                      {nextInstallment && (
                        <div className="total-restante-next-due">
                          Próximo vencimento: {new Date(nextInstallment.due_date).toLocaleDateString("pt-BR", { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                    <div className="total-restante-bg-shapes">
                      <div className="shape shape-1"></div>
                      <div className="shape shape-2"></div>
                      <div className="shape shape-3"></div>
                    </div>
                  </div>

                  <div className="filter-pills-container scroll-x pb-3 mb-2 mt-4">
                    <button
                      className={`filter-pill ${installmentFilter === 'tudo' ? 'active' : ''}`}
                      onClick={() => setInstallmentFilter('tudo')}
                    >
                      Tudo
                    </button>
                    <button
                      className={`filter-pill ${installmentFilter === 'aberto' ? 'active' : ''}`}
                      onClick={() => setInstallmentFilter('aberto')}
                    >
                      Em Aberto
                    </button>
                    <button
                      className={`filter-pill ${installmentFilter === 'atrasado' ? 'active' : ''}`}
                      onClick={() => setInstallmentFilter('atrasado')}
                    >
                      Atrasados
                    </button>
                  </div>

                  <div className="installments-list">
                    {contracts.length === 0 ? (
                      <div className="stat-card p-5 text-center shadow-sm">
                        <i className="bi bi-folder-x fs-1 text-muted mb-3 d-block"></i>
                        <p className="text-muted mb-0">Nenhum contrato ativo encontrado no momento.</p>
                      </div>
                    ) : (
                      contracts.map((c) => {
                        const filteredInstallments = c.installments
                          .filter(i => {
                            if (installmentFilter === 'tudo') return true;
                            if (installmentFilter === 'aberto') return i.status === 'pendente';
                            if (installmentFilter === 'atrasado') return i.status === 'atrasado';
                            return true;
                          })
                          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

                        if (filteredInstallments.length === 0) return null;

                        const openCount = filteredInstallments.filter(i => i.status !== 'pago').length;
                        const paidCount = filteredInstallments.filter(i => i.status === 'pago').length;
                        const lateCount = filteredInstallments.filter(i => i.status === 'atrasado').length;
                        const totalValue = filteredInstallments.filter(i => i.status !== 'pago').reduce((acc, i) => acc + i.amount, 0);
                        const isExpanded = expandedContract === c.pvenum;

                        return (
                          <div key={c.pvenum} className="contract-card-modern">
                            <div className="contract-card-accent"></div>
                            <div
                              className="contract-card-header"
                              onClick={() => setExpandedContract(isExpanded ? null : c.pvenum)}
                            >
                              <div className="contract-card-top-row">
                                <div className="contract-card-icon-wrapper">
                                  <i className="bi bi-file-earmark-text-fill"></i>
                                </div>
                                <div className="contract-card-info">
                                  <span className="contract-card-label">CONTRATO</span>
                                  <span className="contract-card-number">Nº {c.pvenum}</span>
                                </div>
                                <div className="contract-card-toggle">
                                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                </div>
                              </div>

                              <div className="contract-card-stats-row">
                                <div className="contract-card-stat">
                                  <div className="contract-card-stat-value">
                                    {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}
                                  </div>
                                  <div className="contract-card-stat-label">Saldo restante</div>
                                </div>
                                <div className="contract-card-badges">
                                  {lateCount > 0 && (
                                    <span className="contract-badge contract-badge-late">
                                      <i className="bi bi-exclamation-circle-fill"></i> {lateCount} {lateCount === 1 ? 'atrasada' : 'atrasadas'}
                                    </span>
                                  )}
                                  {openCount > 0 && lateCount === 0 && (
                                    <span className="contract-badge contract-badge-open">
                                      {openCount} {openCount === 1 ? 'pendente' : 'pendentes'}
                                    </span>
                                  )}
                                  {paidCount > 0 && (
                                    <span className="contract-badge contract-badge-paid">
                                      <i className="bi bi-check-circle-fill"></i> {paidCount} {paidCount === 1 ? 'paga' : 'pagas'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="contract-card-progress">
                                <div
                                  className="contract-card-progress-bar"
                                  style={{ width: `${(paidCount / (filteredInstallments.length || 1)) * 100}%` }}
                                ></div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="contract-card-body">
                                <div className="installments-grid-desktop">
                                  {filteredInstallments.map((inst) => (
                                    <InstallmentCard
                                      key={inst.id}
                                      installment={inst}
                                      onClick={() => openDetail(inst)}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })

                    )}
                  </div>
                </div>
              )}

              {activeTab === 'perfil' && (
                <div className="p-3 bg-app pb-5">
                  <div className="d-flex align-items-center mb-4">
                    <button className="back-btn shadow-sm" onClick={() => setActiveTab('inicio')}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <h5 className="fw-bold m-0 flex-grow-1 text-center" style={{ marginRight: '40px' }}>Perfil</h5>
                  </div>

                  <div className="bg-white rounded-4 p-4 shadow-sm text-center mb-4 position-relative overflow-hidden d-flex flex-column align-items-center">
                    <div className="mb-3 d-flex justify-content-center position-relative perfil-avatar-wrapper">
                      <div className="rounded-4 bg-danger text-white d-flex align-items-center justify-content-center shadow"
                        style={{ width: '80px', height: '80px', position: 'relative', zIndex: 2 }}>
                        <i className="bi bi-person-fill fs-1"></i>
                      </div>
                      <div className="position-absolute text-muted opacity-10 fw-bold fst-italic"
                        style={{ fontSize: '120px', top: -40, right: -20, zIndex: 1, letterSpacing: '-5px' }}>
                        M
                      </div>
                    </div>
                    <h4 className="fw-bold text-dark m-0 mb-1">{customerName || 'Cliente MM'}</h4>
                    <p className="text-muted small mb-3">CPF: 000.***.***-00</p>
                    <div className="d-inline-flex bg-danger bg-opacity-10 text-danger rounded-pill px-3 py-1 align-items-center gap-1" style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                      <i className="bi bi-patch-check-fill"></i> CLIENTE OURO
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-muted fw-bold mb-2 ms-1" style={{ fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Preferências</div>
                    <div className="bg-white rounded-4 shadow-sm overflow-hidden">
                      <div className="d-flex align-items-center justify-content-between p-3 border-bottom" onClick={() => setActiveTab('suporte')} style={{ cursor: 'pointer' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-2 d-flex align-items-center justify-content-center">
                            <i className="bi bi-headset fs-5"></i>
                          </div>
                          <span className="fw-bold text-dark">Suporte e Ajuda</span>
                        </div>
                        <i className="bi bi-chevron-right text-muted small"></i>
                      </div>
                      <div className="d-flex align-items-center justify-content-between p-3" style={{ cursor: 'pointer' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-secondary bg-opacity-10 text-secondary rounded-3 p-2 d-flex align-items-center justify-content-center">
                            <i className="bi bi-moon-fill fs-5"></i>
                          </div>
                          <span className="fw-bold text-dark">Tema do Aplicativo</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-muted small fw-600">Sistema</span>
                          <i className="bi bi-chevron-right text-muted small"></i>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-muted fw-bold mb-2 ms-1" style={{ fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Carnês e Documentos</div>
                    <div className="bg-white rounded-4 shadow-sm overflow-hidden p-3 d-flex align-items-center justify-content-between"
                      onClick={() => setActiveTab('carnes')} style={{ cursor: 'pointer' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-3 p-2 d-flex align-items-center justify-content-center"
                          style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                          <i className="bi bi-file-earmark-text-fill fs-5"></i>
                        </div>
                        <span className="fw-bold text-dark">Meus Contratos</span>
                      </div>
                      <i className="bi bi-chevron-right text-muted small"></i>
                    </div>
                  </div>

                  <button className="btn btn-danger w-100 rounded-4 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm mb-4"
                    style={{ background: '#E31A2D' }}>
                    <i className="bi bi-box-arrow-left"></i> Sair da Conta
                  </button>

                  <div className="text-center pb-5 mb-3">
                    <div className="fw-bold text-muted mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}>MM MAGAZINE DIGITAL</div>
                    <div className="text-muted" style={{ fontSize: '0.6rem' }}>Versão 3.4.12 (Build 2024)</div>
                  </div>
                </div>
              )}

              {activeTab === 'lojas' && (
                <div className="lojas-tab-container pb-5">
                  <div className="lojas-header">
                    <button className="back-btn shadow-sm" onClick={() => setActiveTab('inicio')}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <h5 className="fw-bold m-0 flex-grow-1 text-center">Encontrar uma Loja Física</h5>
                    <div style={{ width: '40px' }}></div>
                  </div>

                  {/* Search Bar */}
                  <div className="lojas-search">
                    <i className="bi bi-search lojas-search-icon"></i>
                    <input type="text" className="lojas-search-input" placeholder="Pesquise por cidade ou CEP" />
                    <button className="lojas-search-locate">
                      <i className="bi bi-geo-alt"></i>
                    </button>
                  </div>

                  {/* Map Area */}
                  <div className="lojas-map">
                    <div className="lojas-map-gradient"></div>
                    <div className="lojas-map-grid">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="lojas-map-gridline-h" style={{ top: `${(i + 1) * 5}%` }}></div>
                      ))}
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="lojas-map-gridline-v" style={{ left: `${(i + 1) * 5}%` }}></div>
                      ))}
                    </div>
                    {/* Store Pins */}
                    <div className="lojas-pin" style={{ top: '40%', left: '50%' }}>
                      <div className="lojas-pin-icon">
                        <i className="bi bi-shop-window"></i>
                      </div>
                      <div className="lojas-pin-shadow"></div>
                    </div>
                  </div>

                  {/* Stores List */}
                  <div className="lojas-list-header">
                    <h5 className="fw-bold m-0">Lojas Próximas</h5>
                    <span className="lojas-count-badge">1 LOJA ENCONTRADA</span>
                  </div>

                  <div className="lojas-list">
                    {/* MM Magazine Poloni */}
                    <div className="loja-card">
                      <div className="loja-card-content">
                        <div className="loja-card-header">
                          <div>
                            <h6 className="loja-name">MM - Magazine Poloni</h6>
                            <span className="loja-status-badge loja-status-aberto">
                              <i className="bi bi-circle-fill"></i> ABERTO
                            </span>
                          </div>
                          <div className="loja-icon-box">
                            <i className="bi bi-shop-window"></i>
                          </div>
                        </div>
                        <div className="loja-address">
                          <i className="bi bi-geo-alt-fill"></i>
                          <span>R. Rio Branco, 235, Poloni - SP, 15160-000</span>
                        </div>
                        <div className="loja-distance">
                          <i className="bi bi-arrow-up-right"></i>
                          <span>Sua loja mais próxima</span>
                        </div>
                        <div className="loja-info-row">
                          <div className="loja-info-item">
                            <i className="bi bi-clock"></i>
                            <span>Seg a Sex: 8h - 18h</span>
                          </div>
                          <div className="loja-info-item">
                            <i className="bi bi-telephone"></i>
                            <span>(17) 3000-0000</span>
                          </div>
                        </div>
                        <a
                          href="https://www.google.com/maps/search/?api=1&query=R.+Rio+Branco+235+Poloni+SP+15160-000"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="loja-directions-btn"
                        >
                          <i className="bi bi-map"></i>
                          Como chegar
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'historico' && (
                <div className="historico-tab-container pb-5">
                  <div className="historico-header">
                    <button className="back-btn shadow-sm" onClick={() => setActiveTab('inicio')}>
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <h4 className="fw-bold m-0 text-dark">Histórico de Pagamentos</h4>
                    <div style={{ width: '40px' }}></div>
                  </div>

                  {/* Carné Progress Card */}
                  <div className="historico-progress-card">
                    <div className="historico-progress-inner">
                      <div>
                        <div className="historico-progress-label">PROGRESSO DO CARNÊ</div>
                        <div className="historico-progress-count">
                          <span className="historico-progress-paid">{String(stats.paid).padStart(2, '0')}</span>
                          <span className="historico-progress-separator">/</span>
                          <span className="historico-progress-total">{String(stats.total).padStart(2, '0')}</span>
                        </div>
                        <div className="historico-progress-sublabel">Parcelas pagas</div>
                      </div>
                      <div className="historico-progress-balance">
                        <div className="historico-progress-balance-label">Saldo Restante</div>
                        <div className="historico-progress-balance-value">
                          {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalAmount)}
                        </div>
                      </div>
                    </div>
                    <div className="historico-progress-bar">
                      <div
                        className="historico-progress-bar-fill"
                        style={{ width: `${(stats.paid / (stats.total || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="historico-timeline">
                    {(() => {
                      const paidInstallments = contracts
                        .flatMap(c => c.installments)
                        .filter(i => i.status === 'pago')
                        .sort((a, b) => {
                          const dateA = a.payment_date || a.due_date;
                          const dateB = b.payment_date || b.due_date;
                          return new Date(dateB).getTime() - new Date(dateA).getTime();
                        });

                      if (paidInstallments.length === 0) {
                        return (
                          <div className="historico-empty">
                            <i className="bi bi-clock-history"></i>
                            <p>Nenhum pagamento realizado ainda.</p>
                          </div>
                        );
                      }

                      // Group by month/year using payment_date
                      const grouped = new Map<string, typeof paidInstallments>();
                      const monthLabels: Record<string, string> = {};
                      for (const inst of paidInstallments) {
                        const d = new Date(inst.payment_date || inst.due_date);
                        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
                        monthLabels[key] = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        if (!grouped.has(key)) grouped.set(key, []);
                        grouped.get(key)!.push(inst);
                      }

                      return Array.from(grouped.entries()).map(([key, instList]) => (
                        <div key={key} className="historico-month-group">
                          <div className="historico-month-label">{monthLabels[key]?.toUpperCase()}</div>
                          {instList.map((inst) => {
                            const payDate = inst.payment_date || inst.due_date;
                            const dateFormatted = new Date(payDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                            const method = inst.payment_method || 'PIX';
                            return (
                              <div
                                key={inst.id}
                                className="historico-item"
                                onClick={() => { setSelectedInstallment(inst); setScreenMode('history_detail'); }}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className="historico-item-dot"></div>
                                <div className="historico-item-card">
                                  <div className="historico-item-icon-box">
                                    <i className="bi bi-receipt-cutoff"></i>
                                  </div>
                                  <div className="historico-item-info">
                                    <div className="historico-item-title">Parcela {String(inst.index).padStart(2, '0')}</div>
                                    <div className="historico-item-sub">{dateFormatted} • {method}</div>
                                  </div>
                                  <div className="historico-item-right">
                                    <div className="historico-item-amount">
                                      {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(inst.amount)}
                                    </div>
                                    <div className="historico-item-receipt">
                                      <i className="bi bi-chevron-right"></i>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Nav - Mobile Only */}
          <div className="bottom-nav">
            <button
              className={`nav-item border-0 bg-transparent ${activeTab === 'inicio' ? 'active' : ''}`}
              onClick={() => setActiveTab('inicio')}
            >
              <i className={`bi bi-house-door${activeTab === 'inicio' ? '-fill' : ''} nav-icon`}></i>
              <span className="nav-label">Início</span>
            </button>
            <button
              className={`nav-item border-0 bg-transparent ${activeTab === 'carnes' ? 'active' : ''}`}
              onClick={() => setActiveTab('carnes')}
            >
              <i className={`bi bi-collection${activeTab === 'carnes' ? '-fill' : ''} nav-icon`}></i>
              <span className="nav-label">Carnês</span>
            </button>
            <button
              className={`nav-item border-0 bg-transparent ${activeTab === 'historico' ? 'active' : ''}`}
              onClick={() => setActiveTab('historico')}
            >
              <i className={`bi bi-clock-history nav-icon`}></i>
              <span className="nav-label">Histórico</span>
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

      {screenMode === 'detail' && selectedInstallment && (
        <InstallmentDetailScreen
          installment={selectedInstallment}
          onBack={closeScreens}
          onPay={openPaymentFromDetail}
          onHelp={() => setActiveTab('suporte')}
        />
      )}

      {screenMode === 'history_detail' && selectedInstallment && (
        <div className="hist-detail-screen">
          <div className="hist-detail-header">
            <button className="back-btn shadow-sm" onClick={closeScreens}>
              <i className="bi bi-chevron-left"></i>
            </button>
            <div style={{ width: '40px' }}></div>
          </div>

          <div className="hist-detail-body">
            {/* Green Check */}
            <div className="hist-check-wrapper">
              <div className="hist-check-circle">
                <i className="bi bi-check-lg"></i>
              </div>
            </div>

            <h4 className="hist-title">Pagamento Realizado!</h4>
            <p className="hist-subtitle">Seu carnê está em dia.</p>

            {/* Receipt Card */}
            <div className="hist-receipt-card">
              <div className="hist-receipt-amount-section">
                <div className="hist-receipt-amount-label">VALOR PAGO</div>
                <div className="hist-receipt-amount-value">
                  {Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedInstallment.amount)}
                </div>
              </div>

              <div className="hist-receipt-divider"></div>

              <div className="hist-receipt-row">
                <span className="hist-receipt-row-label">Data do Pagamento</span>
                <span className="hist-receipt-row-value">
                  {selectedInstallment.payment_date
                    ? new Date(selectedInstallment.payment_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
                    : 'N/A'}
                </span>
              </div>

              <div className="hist-receipt-divider"></div>

              <div className="hist-receipt-row">
                <span className="hist-receipt-row-label">Forma de Pagamento</span>
                <span className="hist-receipt-row-value hist-receipt-method">
                  {(selectedInstallment.payment_method || 'PIX') === 'PIX' ? (
                    <><span className="hist-pix-badge">$</span> PIX</>
                  ) : (
                    <><i className="bi bi-upc-scan me-1"></i> {selectedInstallment.payment_method}</>
                  )}
                </span>
              </div>

              <div className="hist-receipt-divider"></div>

              <div className="hist-receipt-row">
                <span className="hist-receipt-row-label">Parcela</span>
                <span className="hist-receipt-row-value">
                  Refere-se à {String(selectedInstallment.index).padStart(2, '0')}ª Parcela
                </span>
              </div>

              <div className="hist-receipt-divider"></div>

              <div className="hist-receipt-id-section">
                <div className="hist-receipt-id-label">ID DA TRANSAÇÃO</div>
                <div className="hist-receipt-id-row">
                  <span className="hist-receipt-id-value">
                    TRX-{selectedInstallment.contract_id}-{String(selectedInstallment.index).padStart(2, '0')}-MM
                  </span>
                  <button
                    className="hist-receipt-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(`TRX-${selectedInstallment.contract_id}-${String(selectedInstallment.index).padStart(2, '0')}-MM`);
                    }}
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <button className="hist-share-btn">
              <i className="bi bi-share me-2"></i>
              Compartilhar Comprovante
            </button>

            <button className="hist-pdf-btn">
              <i className="bi bi-file-earmark-pdf me-2"></i>
              Baixar PDF
            </button>

            <p className="hist-legal-text">
              Este é um documento digital válido como comprovante de pagamento junto à rede de lojas MM.
            </p>
          </div>
        </div>
      )}

      {screenMode === 'payment' && selectedInstallment && (
        <PaymentScreen
          installment={selectedInstallment}
          onBack={goBackFromPayment}
          onStatusChange={(newStatus: InstallmentStatus) => {
            setContracts((prev) =>
              prev.map((c) => ({
                ...c,
                installments: c.installments.map((i) =>
                  i.id === selectedInstallment.id
                    ? { ...i, status: newStatus }
                    : i
                )
              }))
            )
          }}
        />
      )}

      {/* Payment Success Overlay */}
      {showPaymentSuccess && (
        <div className="payment-success-overlay animate__animated animate__fadeIn">
          <div className="payment-success-content animate__animated animate__zoomIn">
            <div className="payment-success-icon-wrapper">
              <div className="payment-success-icon-bg">
                <i className="bi bi-check-lg"></i>
              </div>
              <div className="payment-success-ring"></div>
            </div>
            <h2 className="payment-success-title">Pagamento Confirmado!</h2>
            <p className="payment-success-subtitle">
              Seu pagamento foi processado com sucesso pelo AbacatePay.
            </p>
            <div className="payment-success-details">
              <div className="payment-success-detail-row">
                <i className="bi bi-shield-check"></i>
                <span>Transação segura e verificada</span>
              </div>
              <div className="payment-success-detail-row">
                <i className="bi bi-clock-history"></i>
                <span>Comprovante disponível em instantes</span>
              </div>
            </div>
            <button className="payment-success-btn" onClick={dismissPaymentSuccess}>
              <i className="bi bi-house-door me-2"></i>
              Voltar ao Início
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

