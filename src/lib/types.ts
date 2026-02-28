export type InstallmentStatus = "pendente" | "pago" | "atrasado"

export interface Contract {
  id: string
  token: string
  customer_name: string
  contract_number: string
  total_amount: number
}

export interface Installment {
  id: string
  contract_id: string
  index: number
  count: number
  amount: number
  due_date: string
  status: InstallmentStatus
  fine_amount?: number
  pix_charge_id?: string | null
  pcrnot?: number
}

export interface PaymentHistory {
  id: string
  installment_id: string
  amount: number
  method: "pix"
  status: "pending" | "paid" | "failed"
  created_at: string
  provider_id?: string
}

export interface TokenMap {
  token: string
  pcrnot: number
}
