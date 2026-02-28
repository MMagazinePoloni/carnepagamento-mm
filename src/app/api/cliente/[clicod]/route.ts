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

        // Fetch customer name
        const { data: customerData } = await supa
            .from("CLIENTE")
            .select("CLINOM")
            .eq("CLICOD", clicod)
            .maybeSingle()

        const customerName = customerData ? (customerData as any).CLINOM : null

        const { data, error } = await supa
            .from("NVENDA")
            .select("PVENUM, PVEDAT, NPESEQ, PVETPA, PAGCOD, PAGDES, CLICOD")
            .eq("CLICOD", String(clicod))
            .order("PVENUM", { ascending: false })
            .order("NPESEQ", { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ customerName, contracts: [] })
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

        const contracts = Array.from(map.values()).map(c => ({
            ...c,
            installments: c.installments.map(i => ({ ...i, count: c.count }))
        })).sort((a, b) => b.pvenum - a.pvenum)

        return NextResponse.json({ customerName, contracts })

    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
