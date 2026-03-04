/**
 * Ofuscação genérica de IDs numéricos.
 * Funciona para qualquer ID: cliente, contrato, etc.
 * Algoritmo: ID × 98765 → hexadecimal, com prefixo "x" para
 * evitar ambiguidade quando o hex contém apenas dígitos.
 */

const SALT = 98765;
const PREFIX = "x";

export function encodeId(id: number | string): string {
    const num = Number(id);
    if (isNaN(num)) return String(id);

    const obfuscatedNum = num * SALT;
    return PREFIX + obfuscatedNum.toString(16);
}

export function decodeId(token: string): string {
    // New format: starts with "x" prefix
    if (token.startsWith(PREFIX)) {
        try {
            const hex = token.slice(PREFIX.length);
            const parsed = parseInt(hex, 16);
            if (!isNaN(parsed) && parsed % SALT === 0) {
                return String(parsed / SALT);
            }
        } catch (e) {
            // fall through
        }
    }

    // Legacy format (no prefix): try hex decode
    if (/^[0-9a-fA-F]+$/.test(token) && !/^\d+$/.test(token)) {
        try {
            const parsed = parseInt(token, 16);
            if (!isNaN(parsed) && parsed % SALT === 0) {
                return String(parsed / SALT);
            }
        } catch (e) {
            // fall through
        }
    }

    // Backward compatibility: raw numeric ID
    if (/^\d+$/.test(token)) {
        return token;
    }

    return token;
}

// Aliases para compatibilidade com código existente
export const encodeClientId = encodeId;
export const decodeClientId = decodeId;
