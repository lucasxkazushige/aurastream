# AuraStream 4K - Aplicativo Android & Android TV

Aplicativo nativo configurado para **Smart TVs Android**, **Google TV**, **Fire TV Stick**, **TV Boxes** (Xiaomi Mi Box, Mecool, TX9, etc.) e celulares Android.

## Métodos para Usar na sua Smart TV ou TV Box:

### Método 1: Usando o Addon do Stremio (Mais rápido e compatível com 100% das TVs)
1. Instale o **Stremio** na sua TV pela Google Play Store ou Amazon AppStore.
2. No menu Addons, adicione a URL do seu servidor:
   ```
   http://151.247.210.55:7700/stremio/manifest.json
   ```
3. Pronto! Seus filmes aparecerão em 4K nativo direto no Stremio.

### Método 2: Nova Video Player ou VLC (Reprodução Direta de Altíssima Fidelidade)
1. Na sua TV Android / Firestick, instale o **Nova Video Player** ou **VLC** (gratuitos na Play Store).
2. No navegador da TV ou no celular, acesse `http://151.247.210.55:7700`.
3. Ao clicar no filme, selecione o botão **"App / TV (4K)"** e toque em **"Nova Player / TV Box"**.
4. O reprodutor da TV abrirá automaticamente em tela cheia tocando em 4K nativo com áudio DTS/Atmos!

### Método 3: Compilar o APK Nativo
Este diretório está configurado com `AndroidManifest.xml` pronto para Android TV (Leanback Launcher).
Para compilar o APK via Capacitor ou Android Studio:
```bash
npx cap add android
npx cap sync android
cd android && ./gradlew assembleRelease
```
