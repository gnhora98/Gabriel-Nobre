# Carta BTS

App pessoal (PWA, funciona offline) para a Baía de Todos os Santos:

- **Navegador**: carta náutica oficial da Marinha (raster CHM), GPS, SOG/COG, trilha (exporta GPX), waypoints com rumo/distância/ETA, modo Lancha/Veleiro (VMG, bordo, laylines) e termômetro de condição de navegação.
- **Surfista**: ranking das praias de Salvador e Lauro de Freitas, termômetro de 5 níveis, janela de 7 dias, maré e clima por praia.
- **Previsão**: tempo, vento, mar e chuva para 7 dias.

## Fontes de dados
| Dado | Fonte |
|---|---|
| Tempo/vento | ECMWF IFS 0,25° via Open-Meteo (atualiza ao abrir o app com internet) |
| Ondas/swell | Open-Meteo Marine |
| Vento medido | METAR do Aeroporto de Salvador (SBSV), via `netlify/functions/metar.mts` |
| Maré prevista | Constantes harmônicas ajustadas com 3 anos do marégrafo EMSAL (IBGE/CHM, UHSLC 708); NR da DHN (Z0 = 133,5 cm). `scripts/tide_fit.py` |
| Maré medida | Marégrafo de Salvador em tempo real (IOC Sea Level Monitoring) |
| Cartas | Cartas raster BSB do CHM, importadas no próprio app |

## Cartas náuticas
Baixe no celular os `.zip` **BSB** das cartas da série 1100 em
https://www.marinha.mil.br/chm/dados-do-segnav/cartas-raster e importe em **Navegador → Cartas**.
Ficam salvas no aparelho (IndexedDB) e funcionam sem internet.

## Desenvolvimento
```
npm install
npm run dev      # desenvolvimento
npm test         # testes (leitor KAP e maré)
npm run build    # gera dist/
```

App de apoio: não substitui cartas oficiais atualizadas nem equipamentos obrigatórios.
