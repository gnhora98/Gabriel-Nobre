# App de viagem de estrada (moto/carro) — briefing para o Claude Code

> Projeto do Gabriel (Salvador/BA). Fase atual: **validar layouts, funcionalidades e visualizações. NÃO começar o desenvolvimento do app ainda** sem o Gabriel pedir.
> Sempre que for gerar telas, gráficos ou visuais: **mostrar uma imagem ilustrativa antes** e esperar validação (evita retrabalho e gasto de tokens).
> Respostas objetivas, em português. Entender o contexto completo antes de começar.

## 1. A ideia

App de navegação focado em **viagens longas de estrada entre cidades** (foco inicial: moto), que roda no **Android Auto**. O diferencial é planejar a viagem inteira com paradas estratégicas, já levando em conta a **autonomia do veículo**, e no dia a dia só abrir e **dar play**.

## 2. Requisitos levantados

### Planejamento da viagem
- Montar o roteiro completo dentro do app: dias, etapas, paradas, hotéis, paradas livres.
- Informar a **autonomia do veículo** (ex.: 200 km) e a **margem de segurança** (ex.: 30%).
- **Postos de combustível já cadastrados no caminho** e sugeridos automaticamente como paradas com base na autonomia e na margem.
- Adicionar outros endereços: hotéis, restaurantes, pontos de interesse, paradas no meio do caminho.
- **Avançar, voltar e editar** etapas.

### Uso na estrada
- Ao conectar no Android Auto: tela de carregamento com a **imagem do veículo selecionado** e um botão **"▶ Seguir viagem"**.
- O app **guarda o último ponto/etapa** e retoma automaticamente no dia seguinte.
- Durante a navegação, o ícone no mapa é o **veículo escolhido** (moto/carro).
- Avança sozinho de etapa ao chegar ("chegamos em X").
- **Funcionar 100% offline**: mapas, rota, postos e roteiro baixados nas pastas do app. Ao voltar a internet, segue normal.

### Garagem (veículos)
- Visualização **3D com rotação 360°**.
- Alternar entre motos e até ~5 carros (o Gabriel citou Toyota Yaris e Ford Fiesta).
- Trocar a cor do veículo.
- O veículo escolhido aparece na tela de carregamento e no mapa.

### Configurações
- Idiomas: **português, inglês, espanhol**.
- Temas: **escuro, claro e personalizados**.
- Configuração no app do celular e, no que for permitido, na própria multimídia.

### Plataforma
- Protótipo **somente Android**, distribuído como **APK** (sideload). iOS/CarPlay fica para depois.

## 3. Viabilidade técnica (já pesquisada)

- **Android Auto (Car App Library):** apps da categoria `androidx.car.app.category.NAVIGATION` podem desenhar o próprio mapa na Surface (`NavigationTemplate` + permissão `ACCESS_SURFACE`). Isso viabiliza o ícone do veículo no mapa, o painel de autonomia etc.
- **Limite do Android Auto:** fora do mapa, a tela do carro só aceita templates do Google (listas, botões, cartões). Não aceita digitação com o veículo em movimento. Por isso:
  - Garagem 3D, edição de roteiro e ajustes completos ficam no **celular**.
  - No carro ficam a tela de boas-vindas/continuar, a navegação e ajustes simples (tema, pular etapa).
- **Sideload no Android Auto:** ativar o modo desenvolvedor do Android Auto e ligar "Fontes desconhecidas". Atenção: só isso pode não bastar para apps da Car App Library. Instalar via ADB marcando a Play Store como instaladora:
  `adb install -r -i com.android.vending app.apk`
- **Offline:** o Google Maps SDK não permite mapa/rota offline para terceiros. Stack sugerida:
  - Mapa: **MapLibre** + tiles vetoriais offline (MBTiles/PMTiles) de **OpenStreetMap**.
  - Rota no aparelho: **GraphHopper** (ou Valhalla).
  - Postos: OSM `amenity=fuel` extraídos para o corredor da rota e salvos localmente.
  - Voz: TTS do Android (offline).
  - Estado da viagem: banco local (Room).
- **3D da garagem:** glTF + SceneView/Filament no celular. Modelos de carros reais precisam de licença: preferir modelos genéricos (hatch, sedã, SUV, moto custom, trail) ou licenciados.

## 4. Telas já rascunhadas (ver `mockups/app-viagem-telas.png`)

**Android Auto**
1. **Ao conectar:** foto do veículo, "Bom dia, Gabriel", cartão "Continuar viagem · Dia 4 de 8 · Fortaleza → Pipa", botões "▶ Seguir viagem" e "Etapas".
2. **Navegação:** mapa com ícone do veículo e rota, cartão de manobra, painel lateral com:
   - Autonomia restante (barra) e próximo posto
   - Próxima etapa (n/total)
   - Destino do dia + horário do pôr do sol

   Chips: km restantes, indicador Offline e "Pular etapa".

**Celular** (abas: Viagens · Roteiro · Garagem · Ajustes)

3. **Garagem:** visualizador 3D (arrastar para girar), modelos, cores, autonomia, margem de segurança, consumo médio.
4. **Roteiro:** linha do tempo por dia com postos sugeridos (laranja), paradas do usuário (azul), pernoite (roxo); botões Voltar / Editar / Avançar; status do download offline.
5. **Ajustes:** idioma PT/EN/ES, temas (Escuro, Claro, Deserto, Litoral), voz, aviso de pôr do sol, evitar terra, tema automático dia/noite, unidades.

O Gabriel **aprovou o rumo** dessas telas.

## 5. Sugestões extras (não aprovadas ainda)

- **Já nas telas:**
  - Aviso de pôr do sol
  - Pular etapa
  - Margem de segurança configurável
  - Temas temáticos
- **A decidir:**
  - Importar viagem de planilha/GPX/KML
  - Compartilhar localização ao vivo
  - Previsão de chuva no trajeto (cache offline)
  - Diário de custos (combustível/hotel)

## 6. Pendências com o Gabriel

1. Veículos: modelos **genéricos** ou insistir em modelos reais (Yaris, Fiesta)?
2. Quais sugestões da seção 5 entram no protótipo?
3. Próximo passo combinado: levar as telas finais e o **fluxo completo** para um design (layout + navegação entre telas), **ainda sem código**.

## 7. Dados de teste

`dados/viagem-exemplo.json` traz a viagem real que planejamos (Salvador ⇄ Fortaleza de moto, dez/2026, Royal Enfield Meteor 650, autonomia de 200 km): dias, horários, distâncias, postos com coordenadas e hotéis. Serve de caso de teste para o roteiro, a sugestão de postos e a retomada da viagem.

## 8. Arquivos

- `CLAUDE.md`: este briefing.
- `mockups/app-viagem-telas.png`: rascunho das 5 telas.
- `mockups/app-viagem-telas.html`: fonte editável do rascunho.
- `dados/viagem-exemplo.json`: viagem de teste.
