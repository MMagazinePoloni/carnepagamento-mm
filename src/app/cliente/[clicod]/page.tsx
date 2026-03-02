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

  const initialTab = (searchParams?.get("tab") as 'inicio' | 'suporte' | 'carnes' | 'perfil') || 'inicio'
  const [activeTab, setActiveTab] = useState<'inicio' | 'suporte' | 'carnes' | 'perfil'>(initialTab)
  const [installmentFilter, setInstallmentFilter] = useState<'tudo' | 'aberto' | 'atrasado'>('tudo')
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)
  const [screenMode, setScreenMode] = useState<'none' | 'detail' | 'payment'>('none')
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
                  <div className="action-item">
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

                      // Use a derived "token" or masked Contract ID to maintain privacy
                      const privacyToken = String(c.pvenum).slice(-4).padStart(7, 'A0X');

                      return (
                        <div key={c.pvenum} className="stat-card mb-4 p-0 overflow-hidden shadow-sm">
                          <div
                            className="p-3 d-flex justify-content-between align-items-center cursor-pointer bg-light border-bottom"
                            onClick={() => setExpandedContract(expandedContract === c.pvenum ? null : c.pvenum)}
                          >
                            <div className="d-flex align-items-center gap-3">
                              <div className="bg-white p-2 text-primary shadow-sm" style={{ borderRadius: '12px' }}>
                                <i className="bi bi-file-earmark-text fs-5"></i>
                              </div>
                              <div>
                                <div className="text-muted small fw-bold text-uppercase ls-1" style={{ fontSize: '0.65rem' }}>CONTRATO</div>
                                <div className="fw-bold fs-6 text-dark">#{privacyToken}</div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              {expandedContract !== c.pvenum && (
                                <span className="badge-custom badge-pendente d-none d-sm-inline-block">
                                  {filteredInstallments.length} {filteredInstallments.length === 1 ? 'parcela' : 'parcelas'}
                                </span>
                              )}
                              <i className={`bi bi-chevron-${expandedContract === c.pvenum ? 'up' : 'down'} text-muted`}></i>
                            </div>
                          </div>

                          {expandedContract === c.pvenum && (
                            <div className="p-3 animate__animated animate__fadeIn">
                              <div className="installments-grid-desktop">
                                {filteredInstallments.map((inst) => (
                                  <InstallmentCard
                                    key={inst.id}
                                    installment={inst}
                                    onPay={() => openDetail(inst)}
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
              className={`nav-item border-0 bg-transparent ${activeTab === 'suporte' ? 'active' : ''}`}
              onClick={() => setActiveTab('suporte')}
            >
              <i className={`bi bi-headset nav-icon`}></i>
              <span className="nav-label">Suporte</span>
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

      {screenMode === 'detail' && selectedInstallment && (
        <InstallmentDetailScreen
          installment={selectedInstallment}
          onBack={closeScreens}
          onPay={openPaymentFromDetail}
          onHelp={() => setActiveTab('suporte')}
        />
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

