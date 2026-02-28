export function encodeClientId(clicod: number | string): string {
    const num = Number(clicod);
    if (isNaN(num)) return String(clicod);

    // Obfuscation multiplier to prevent casual URL guessing
    const obfuscatedNum = num * 98765;
    return obfuscatedNum.toString(16); // Hex representation
}

export function decodeClientId(token: string): string {
    // Backward compatibility: If it's a raw number, use it directly
    if (/^\d+$/.test(token)) {
        return token;
    }

    try {
        const parsed = parseInt(token, 16);
        if (!isNaN(parsed) && parsed % 98765 === 0) {
            return String(parsed / 98765);
        }
        return token; // fallback
    } catch (e) {
        return token;
    }
}
