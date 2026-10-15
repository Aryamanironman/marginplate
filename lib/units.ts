export class UnitConversionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnitConversionError';
    }
}

export function normalize(
    qty: number,
    fromUnit: string,
    toUnit: string,
    unitMap: { from_unit: string; to_unit: string; factor: number }[]
): number {
    // Normalize unit strings to lower case for comparison
    const from = fromUnit.toLowerCase();
    const to = toUnit.toLowerCase();

    // If same unit, return qty
    if (from === to) {
        return qty;
    }

    // Look for direct conversion in unitMap
    const direct = unitMap.find(
        (m) => m.from_unit.toLowerCase() === from && m.to_unit.toLowerCase() === to
    );
    if (direct) {
        return qty * direct.factor;
    }

    // Look for inverse conversion
    const inverse = unitMap.find(
        (m) => m.from_unit.toLowerCase() === to && m.to_unit.toLowerCase() === from
    );
    if (inverse) {
        return qty / inverse.factor;
    }

    // If not found, try to go through a base unit? We'll assume unitMap is complete for the needed conversions.
    // For simplicity, we'll throw an error.
    throw new UnitConversionError(
        `Cannot convert from ${fromUnit} to ${toUnit}. No conversion found in unitMap.`
    );
}