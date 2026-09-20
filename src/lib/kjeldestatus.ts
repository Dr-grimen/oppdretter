/** Public payload schema: retrieval time is distinct from observation time. */
export type Kjeldestatus = {
  status: "ok" | "delvis" | "feila";
  henta: string;
  dataTid?: string;
  tal: number;
  melding?: string;
};

export async function valfriKjelde<T>(
  hent: () => Promise<T[]>,
  klokke = () => new Date(),
): Promise<{ data: T[]; status: Kjeldestatus }> {
  try {
    const data = await hent();
    if (!Array.isArray(data)) throw new Error("Kjelda returnerte ikkje ei liste.");
    return { data, status: { status: "ok", henta: klokke().toISOString(), tal: data.length } };
  } catch (e) {
    return {
      data: [],
      status: {
        status: "feila", henta: klokke().toISOString(), tal: 0,
        // No raw responses, URLs, tokens or stack traces in the public dataset.
        melding: "Kjelda kunne ikkje hentast. Manglande data tyder ukjent.",
      },
    };
  }
}
