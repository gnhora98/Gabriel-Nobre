# App de viagem de estrada

App Android (celular + Android Auto) para viagens longas de moto/carro: roteiro por dias, postos sugeridos pela autonomia, retomada automática e navegação na multimídia. Briefing completo em `CLAUDE.md`.

## Estrutura

| Pasta | O que tem |
|---|---|
| `core/` | Kotlin puro: modelo da viagem, postos pela autonomia útil, avanço/volta de etapas, chegada por GPS, pôr do sol offline. Testes JUnit. |
| `app/` | App Android: telas do celular (Compose) e do Android Auto (Car App Library, categoria NAVIGATION). |
| `dados/` | `viagem-exemplo.json`, carregado no primeiro uso. |
| `docs/telas/` | Capturas geradas pelos testes (`ScreensTest`). |
| `mockups/` | Rascunho original das telas. |

## Comandos

```
./gradlew :core:test                 # testes do núcleo
./gradlew :app:testDebugUnitTest     # gera as capturas em docs/telas/
./gradlew :app:assembleDebug         # APK em app/build/outputs/apk/debug/
```

Precisa do Android SDK (platform 36) com `sdk.dir` em `local.properties`.

## Instalar (sideload)

1. No celular, ative a depuração USB e instale com a Play Store como instaladora (sem isso o Android Auto pode esconder o app):
   `adb install -r -i com.android.vending app-debug.apk`
2. No Android Auto (celular): Ajustes → toque várias vezes em "Versão" para liberar o modo desenvolvedor → menu ⋮ → Configurações do desenvolvedor → ative **Fontes desconhecidas**.
3. Abra o app no celular uma vez e permita a localização (usada para detectar a chegada em cada etapa).

## Viagem de teste (0.3)

O app abre com a viagem **Teste · Stella Maris** ativa: casa (Rua Ítalo Gaudenzi) → Colégio Marízia Maior → Redemix Supermercado → Paróquia Nossa Senhora de Fátima → casa, 5,3 km pela rota real. A outra viagem (Salvador ⇄ Fortaleza) continua disponível em **Viagens → Usar esta viagem**.

- **Celular:** Viagens → **▶ Navegar no celular**. Usa o GPS; o botão **Simular** anda pela rota (1× ≈ 54 km/h, 5×, 20×).
- **Android Auto:** "▶ Seguir viagem" abre o mesmo mapa na multimídia, com Simular, velocidade, Pular etapa e Etapas.
- **Mapa offline:** `app/src/main/assets/mapa/` traz os tiles vetoriais do OpenStreetMap (OpenMapTiles via OpenFreeMap) de Salvador e Lauro de Freitas (zoom 0–14), fontes e ícones. Rotas e manobras vêm do OSRM e ficam em `dados/rotas/`.

## Estado atual (protótipo 0.1)

Funciona:
- **Celular:**
  - abas Viagens, Roteiro (com edição de paradas e aviso de trecho sem posto), Garagem e Ajustes;
  - idiomas PT/EN/ES;
  - 4 temas, além do automático dia/noite;
  - unidades km ou mi.
- **Android Auto:**
  - boas-vindas com o veículo e "Seguir viagem";
  - lista de etapas;
  - navegação com rota do dia, ícone do veículo e painel de autonomia/próxima etapa/destino com o pôr do sol;
  - "Pular etapa";
  - avanço automático ao chegar (GPS) com aviso por voz;
  - alerta de pôr do sol.
- **Persistência:** tudo fica salvo no aparelho e funciona sem internet.

Ainda não:
- Mapa real offline (MapLibre + tiles OSM). Hoje o fundo é esquemático e a rota liga as paradas em linha reta.
- Roteamento curva a curva (GraphHopper).
- Busca de postos OSM no corredor da rota. Hoje usa os postos cadastrados no roteiro.
- Garagem em 3D (SceneView/glTF). Hoje é uma ilustração com giro simulado.
