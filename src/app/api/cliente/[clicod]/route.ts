import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Installment } from "../../../../lib/types"
import { decodeClientId } from "../../../../lib/obfuscate"

type ContractWithInstallments = {
    pvenum: number
    total: number
    count: number
    firstDate: string
    installments: Installment[]
}

export async function GET(
    _req: Request,
    { params }: { params: { clicod: string } }
) {
    try {
        const rawToken = params.clicod;
        const clicod = Number(decodeClientId(rawToken));

        if (!clicod || isNaN(clicod)) {
            return NextResponse.json({ error: "CLICOD inválido" }, { status: 400 })
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

        if (!url || !key) {
            return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
        }

        const supa = createClient(url, key)

        // Fetch customer name and CPF
        const { data: customerData } = await supa
            .from("CLIENTE")
            .select("CLINOM, CLICGC")
            .eq("CLICOD", clicod)
            .maybeSingle()

        const customerName = customerData ? (customerData as any).CLINOM : null
        const customerCpf = customerData ? (customerData as any).CLICGC : null

        const { data, error } = await supa
            .from("NVENDA")
            .select("PVENUM, PVEDAT, NPESEQ, PVETPA, PAGCOD, PAGDES, CLICOD")
            .eq("CLICOD", clicod) // Use number directly
            .order("PVENUM", { ascending: false })
            .order("NPESEQ", { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ customerName, customerCpf, contracts: [] })
        }

        // Fetch FCRECEBER to determine which installments are paid
        const { data: fbcData } = await supa
            .from("FCRECEBER")
            .select("PCRNOT, FCRPAR, FCRVLP, FCRPGT")
            .eq("CLICOD", clicod)

        // Fetch PAGAMENTOS where status is 'paid' or 'processed'
        const { data: pgtData } = await supa
            .from("PAGAMENTOS")
            .select("PCRNOT, FCRPAR, FCRPGT, STATUS, METHOD")
            .eq("CLICOD", clicod)
            .in("STATUS", ["paid", "processed"])

        // Build a Set of "PCRNOT-FCRPAR" keys where payment is confirmed
        const paidSet = new Set<string>()
        const paymentDateMap = new Map<string, string>()
        const paymentMethodMap = new Map<string, string>()

        if (fbcData) {
            for (const row of fbcData as any[]) {
                // Consider paid if FCRPGT exists
                const payDate = row.FCRPGT;
                if (payDate) {
                    const fbcKey = `${row.PCRNOT}-${row.FCRPAR}`
                    paidSet.add(fbcKey)
                    paymentDateMap.set(fbcKey, payDate)
                }
            }
        }

        if (pgtData) {
            for (const row of pgtData as any[]) {
                const pgtKey = `${row.PCRNOT}-${row.FCRPAR}`
                paidSet.add(pgtKey)
                if (row.FCRPGT) {
                    paymentDateMap.set(pgtKey, row.FCRPGT)
                }
                if (row.METHOD) {
                    paymentMethodMap.set(pgtKey, row.METHOD)
                }
            }
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

            const idx = Number(row.NPESEQ)
            const firstIsBoleto = String(row.PAGDES || "").toUpperCase() === "BOLETO" || Number(row.PAGCOD) === 5
            const due = firstIsBoleto
                ? addDays(item.firstDate, 30 * idx)
                : addDays(item.firstDate, 30 * (idx - 1))

            // Check paid status from FBCRECEBER first, then fallback to NVENDA.PAGCOD
            const fbcKey = `${num}-${idx}`
            const pagoFbc = paidSet.has(fbcKey)
            const pagoNvenda = Number(row.PAGCOD) === 7
            const pago = pagoFbc || pagoNvenda

            // Get payment date from FBCRECEBER
            const fbcPayDate = paymentDateMap.get(fbcKey) || null

            // Determine payment method from PAGDES or PAGAMENTOS
            const pagDes = String(row.PAGDES || "").toUpperCase()
            const pgtMethod = paymentMethodMap.get(fbcKey)
            const paymentMethod = pago ? (pgtMethod || (pagDes === "PIX" ? "PIX" : pagDes === "BOLETO" ? "Boleto" : "PIX")) : null

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
                pcrnot: Number(row.PVENUM),
                clicod: clicod,
                payment_date: fbcPayDate,
                payment_method: paymentMethod
            })
        }

        const contracts = Array.from(map.values()).map(c => ({
            ...c,
            installments: c.installments.map(i => ({ ...i, count: c.count }))
        })).sort((a, b) => b.pvenum - a.pvenum)

        return NextResponse.json({ customerName, customerCpf, contracts })

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
