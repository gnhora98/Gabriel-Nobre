// Perfis das praias de Salvador e Lauro de Freitas.
// facing: direção (graus) de onde vem a ondulação que entra de frente na praia.
// exposure: fração do swell de mar aberto que chega na bancada (recifes/abrigo reduzem).
// minHeight: altura mínima de swell (m) pra começar a quebrar direito.
// tide: maré preferida ("baixa" | "media" | "cheia" | "qualquer").
export type Beach = {
  id: string;
  name: string;
  city: "Salvador" | "Lauro de Freitas";
  lat: number;
  lon: number;
  facing: number;
  exposure: number;
  minHeight: number;
  tide: "baixa" | "media" | "cheia" | "qualquer";
  bottom: "areia" | "pedra" | "recife" | "misto";
  notes: string;
  cams?: Cam[];
};

// Câmeras ao vivo gratuitas. Os provedores não permitem exibir dentro de outro app,
// então o botão abre a página da câmera no navegador.
export type Cam = { name: string; url: string; provider: string };

export const BEACHES: Beach[] = [
  { id: "farol-barra", name: "Farol da Barra", city: "Salvador", lat: -13.0105, lon: -38.5326, facing: 195, exposure: 0.6, minHeight: 1.2, tide: "media", bottom: "pedra", notes: "Só funciona com swell grande de S/SO; abrigada do leste.",
    cams: [
      { name: "Praia da Barra", url: "https://www.climaaovivo.com.br/ba/salvador/salvador-monte-pascoal-hotel-praia-da-barra", provider: "Clima ao Vivo" },
      { name: "Av. Oceânica / Farol", url: "https://www.climaaovivo.com.br/ba/salvador/salvador-monte-pascoal-hotel-barra", provider: "Clima ao Vivo" },
    ] },
  { id: "rio-vermelho", name: "Rio Vermelho / Paciência", city: "Salvador", lat: -13.0125, lon: -38.4905, facing: 170, exposure: 0.8, minHeight: 0.9, tide: "media", bottom: "pedra", notes: "Fundo de pedra; gosta de swell de S/SSE." },
  { id: "amaralina", name: "Amaralina", city: "Salvador", lat: -13.013, lon: -38.472, facing: 160, exposure: 0.85, minHeight: 0.8, tide: "media", bottom: "recife", notes: "Bancada de recife, melhor na meia-maré." },
  { id: "pituba", name: "Pituba", city: "Salvador", lat: -13.0055, lon: -38.457, facing: 150, exposure: 0.8, minHeight: 0.8, tide: "cheia", bottom: "recife", notes: "Recifes na baixa-mar; melhor com maré mais cheia." },
  { id: "jardim-alah", name: "Jardim de Alah", city: "Salvador", lat: -12.9985, lon: -38.441, facing: 140, exposure: 0.95, minHeight: 0.6, tide: "qualquer", bottom: "areia", notes: "Beach break de areia, pega bem swell de SE." },
  { id: "corsario", name: "Corsário / Boca do Rio", city: "Salvador", lat: -12.9805, lon: -38.425, facing: 135, exposure: 0.95, minHeight: 0.6, tide: "qualquer", bottom: "areia", notes: "Beach break consistente." },
  { id: "placaford", name: "Piatã / Placaford", city: "Salvador", lat: -12.958, lon: -38.388, facing: 130, exposure: 0.9, minHeight: 0.7, tide: "media", bottom: "misto", notes: "Bancadas de areia e pedra." },
  { id: "itapua", name: "Itapuã", city: "Salvador", lat: -12.9545, lon: -38.356, facing: 120, exposure: 0.8, minHeight: 0.8, tide: "cheia", bottom: "recife", notes: "Recifes rasos; cuidado na baixa-mar." },
  { id: "stella-maris", name: "Stella Maris", city: "Salvador", lat: -12.943, lon: -38.329, facing: 115, exposure: 1.0, minHeight: 0.5, tide: "qualquer", bottom: "areia", notes: "Mais exposta de Salvador, pega quase todo swell de E/SE." },
  { id: "flamengo", name: "Flamengo", city: "Salvador", lat: -12.933, lon: -38.314, facing: 110, exposure: 1.0, minHeight: 0.5, tide: "qualquer", bottom: "areia", notes: "Beach break aberto, parecido com Stella." },
  { id: "ipitanga", name: "Ipitanga", city: "Lauro de Freitas", lat: -12.905, lon: -38.3, facing: 110, exposure: 0.95, minHeight: 0.6, tide: "qualquer", bottom: "areia", notes: "Areia, picos variam com as bancadas." },
  { id: "vilas", name: "Vilas do Atlântico", city: "Lauro de Freitas", lat: -12.89, lon: -38.288, facing: 105, exposure: 0.9, minHeight: 0.6, tide: "media", bottom: "misto", notes: "Recifes na beira; melhor na meia-maré." },
  { id: "buraquinho", name: "Buraquinho", city: "Lauro de Freitas", lat: -12.878, lon: -38.282, facing: 105, exposure: 0.95, minHeight: 0.6, tide: "qualquer", bottom: "areia", notes: "Perto da foz do Joanes; bancadas mudam bastante." },
];

// Pontos de grade usados pra baixar os dados de mar (Open-Meteo ~8 km).
// Cada praia usa o ponto offshore mais próximo.
export const MARINE_POINTS = [
  { id: "barra", lat: -13.04, lon: -38.5 },
  { id: "orla", lat: -13.0, lon: -38.4 },
  { id: "norte", lat: -12.93, lon: -38.27 },
];

export function marinePointFor(b: Beach): string {
  if (b.lon < -38.46) return "barra";
  if (b.lon < -38.335) return "orla";
  return "norte";
}

// Pontos de referência para navegação na BTS.
export const NAV_POINT = { lat: -12.98, lon: -38.56 }; // boca da baía / canal de Salvador
export const CITY_POINT = { lat: -12.97, lon: -38.45 };
