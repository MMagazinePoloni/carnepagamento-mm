import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
  _req: Request,
  { params }: { params: { pvenum: string } }
) {
  try {
    const pvenum = Number(params.pvenum)

    if (!pvenum || isNaN(pvenum)) {
      return NextResponse.json({ error: "PVENUM inválido" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (!url || !key) {
      return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
    }

    const supa = createClient(url, key)

    const { data: venda, error: vendaErr } = await supa
      .from("NVENDA")
      .select("PVENUM, PVEDAT, NPESEQ, PVETPA, PAGCOD, PAGDES, CLICOD")
      .eq("PVENUM", pvenum)
      .order("NPESEQ", { ascending: true })

    if (vendaErr) {
      return NextResponse.json({ error: vendaErr.message }, { status: 500 })
    }

    if (!venda || venda.length === 0) {
      return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 })
    }

    const count = Math.max(...venda.map((r: any) => Number(r.NPESEQ)))
    const total = venda.reduce(
      (sum: number, r: any) => sum + Number(r.PVETPA || 0),
      0
    )

    const first = venda[0]

    const contract = {
      id: String(pvenum),
      token: String(pvenum),
      customer_name: `Cliente #${first.CLICOD}`,
      contract_number: String(pvenum),
      total_amount: total
    }

    function addDays(base: string, days: number) {
      const d = new Date(base)
      d.setDate(d.getDate() + days)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      return `${y}-${m}-${dd}`
    }

    const baseDate = first.PVEDAT
    const firstIsBoleto =
      String(first.PAGDES || "").toUpperCase() === "BOLETO" ||
      Number(first.PAGCOD) === 5
    const firstIsDinheiro =
      String(first.PAGDES || "").toUpperCase() === "DINHEIRO" ||
      Number(first.PAGCOD) === 1

    const installments = venda.map((v: any) => {
      const pago = Number(v.PAGCOD) === 7
      const idx = Number(v.NPESEQ)
      const due = firstIsBoleto
        ? addDays(baseDate, 30 * idx) // 1ª em 30 dias, depois 60, 90...
        : addDays(baseDate, 30 * (idx - 1)) // 1ª no dia (0), depois 30, 60...

      return {
        id: `${v.PVENUM}-${v.NPESEQ}`,
        contract_id: String(v.PVENUM),
        index: idx,
        count,
        amount: Number(v.PVETPA || 0),
        due_date: due,
        status: pago
          ? "pago"
          : new Date(due).getTime() < Date.now()
          ? "atrasado"
          : "pendente",
        pix_charge_id: null,
        pcrnot: Number(v.PVENUM)
      }
    })

    return NextResponse.json({ contract, installments })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
