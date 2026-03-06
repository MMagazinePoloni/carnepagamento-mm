/**
 * Ofuscação genérica de IDs numéricos.
 * Funciona para qualquer ID: cliente, contrato, etc.
 * Algoritmo: ID × 98765 → hexadecimal, com prefixo "x" para
 * evitar ambiguidade quando o hex contém apenas dígitos.
 */

const SALT = 98765; // Salt fixo para não quebrar links existentes
const PREFIX = "x";

/**
 * Ofuscação de IDs numéricos para URLs públicas.
 * Isso não é criptografia real, mas evita que usuários adivinhem IDs de outros clientes.
 */
export function encodeId(id: number | string): string {
    const num = Number(id);
    if (isNaN(num)) return String(id);

    // Multiplicamos por um salt fixo e transformamos em hexadecimal
    const obfuscatedNum = num * SALT;
    return PREFIX + obfuscatedNum.toString(16);
}

export function decodeId(token: string): string {
    if (!token) return "";

    // Novo formato: começa com o prefixo "x"
    if (token.startsWith(PREFIX)) {
        try {
            const hex = token.slice(PREFIX.length);
            const parsed = parseInt(hex, 16);
            if (!isNaN(parsed) && parsed % SALT === 0) {
                return String(parsed / SALT);
            }
        } catch (e) {
            // falha no decode
        }
    }

    // Formato legado (sem prefixo): tenta decode hex se for hexadecimal
    if (/^[0-9a-fA-F]+$/.test(token) && !/^\d+$/.test(token)) {
        try {
            const parsed = parseInt(token, 16);
            if (!isNaN(parsed) && parsed % SALT === 0) {
                return String(parsed / SALT);
            }
        } catch (e) {
            // falha no decode
        }
    }

    // IMPORTANTE: Removemos a aceitação de IDs numéricos puros para maior segurança
    // Se o token for apenas números, não decodificamos (a menos que seja explicitamente necessário)
    
    return ""; // Retorna vazio se não for um token válido
}

// Aliases para compatibilidade com código existente
export const encodeClientId = encodeId;
export const decodeClientId = decodeId;
