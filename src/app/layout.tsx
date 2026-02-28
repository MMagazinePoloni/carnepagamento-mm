import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import "animate.css/animate.min.css"
import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portal de Parcelas",
  description: "Consulte e pague seu carnê de forma simples e segura"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app">
          {children}
        </div>
      </body>
    </html>
  )
}
