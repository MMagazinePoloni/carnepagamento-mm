import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { installmentId, amount, customerId: bodyCustomerId, customer } = await req.json()

    if (!installmentId || !amount) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const apiUrl = process.env.ABACATEPAY_API_URL
    const apiKey = process.env.ABACATEPAY_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: "API de pagamento não configurada" },
        { status: 500 }
      )
    }

    const onlyDigits = (s: string | undefined | null) => (s ?? "").toString().replace(/\D/g, "")

    async function apiFetch(path: string, init: RequestInit = {}) {
      const url = `${apiUrl}${path.startsWith("/") ? path : `/${path}`}`
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`
      }

      return fetch(url, {
        ...init,
        headers: { ...headers, ...(init.headers as any) }
      })
    }

    const amountInCents = Math.round(Number(amount) * 100)

    let customerId = bodyCustomerId as string | undefined

    // CNPJ fixo da empresa (somente números) — conforme solicitado
    const COMPANY_CNPJ = "12010833000112"

    // Monta inlineCustomer usando dados recebidos (quando houver),
    // mas força o taxId para o CNPJ da empresa por enquanto.
    const inlineCustomer = {
      name: customer?.name || `Cliente ${installmentId}`,
      email: customer?.email || `cliente+${Date.now()}@example.com`,
      cellphone: onlyDigits(customer?.cellphone) || "11999999999",
      taxId: COMPANY_CNPJ
    }

    // Se foi passado customerId, tenta usar; caso contrário cria cliente
    if (!customerId) {
      try {
        const resCustomer = await apiFetch("/v1/customer/create", {
          method: "POST",
          body: JSON.stringify(inlineCustomer)
        })

        const resText = await resCustomer.text()
        if (resCustomer.ok) {
          try {
            const json = JSON.parse(resText)
            // tenta obter id em diferentes formatos
            customerId = json.data?.id ?? json.id ?? json.data?.customerId ?? json.customerId
          } catch (e) {
            console.warn("Não foi possível parsear resposta de criação de cliente:", e)
          }
        } else {
          console.warn("Falha ao criar cliente (seguiremos com checkout inline):", resText)
        }
      } catch (e) {
        console.warn("Erro na tentativa de criar cliente:", e)
      }
    }

    // Monta payload de cobrança
    const payload: any = {
      frequency: "ONE_TIME",
      methods: ["PIX"],
      products: [
        {
          externalId: installmentId,
          name: `Pagamento Parcela ${installmentId}`,
          quantity: 1,
          price: amountInCents
        }
      ],
      returnUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      completionUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    }

    if (customerId) {
      payload.customerId = customerId
    } else {
      payload.customer = inlineCustomer
    }

    // Tenta criar cobrança
    let res = await apiFetch("/v1/billing/create", {
      method: "POST",
      body: JSON.stringify(payload)
    })

    let text = await res.text()

    // Se falhar por "customer not found" e usamos customerId, tentar com inline customer
    if (!res.ok) {
      const lowered = text.toLowerCase()
      const customerNotFound = lowered.includes("customer not found")
      if (customerNotFound && payload.customerId) {
        delete payload.customerId
        payload.customer = inlineCustomer
        res = await apiFetch("/v1/billing/create", {
          method: "POST",
          body: JSON.stringify(payload)
        })
        text = await res.text()

        if (res.ok) {
          const json = JSON.parse(text)
          return NextResponse.json({
            chargeId: json.id ?? json.data?.id,
            paymentUrl: json.url ?? json.data?.url,
            status: json.status ?? json.data?.status,
            pixCopiaCola: json.pixCopiaCola ?? json.data?.pixCopiaCola ?? null,
            qrText: json.qrText ?? json.data?.qrText ?? null
          })
        }
      }

      console.error("Erro AbacatePay:", text)
      return NextResponse.json(
        { success: false, data: null, error: text || "Falha na cobrança" },
        { status: res.status }
      )
    }

    const json = JSON.parse(text)

    return NextResponse.json({
      chargeId: json.id ?? json.data?.id,
      paymentUrl: json.url ?? json.data?.url,
      status: json.status ?? json.data?.status,
      pixCopiaCola: json.pixCopiaCola ?? json.data?.pixCopiaCola ?? null,
      qrText: json.qrText ?? json.data?.qrText ?? null
    })

  } catch (error) {
    console.error("Erro interno:", error)
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}