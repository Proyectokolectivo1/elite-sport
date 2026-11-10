# Fondo en movimiento: cómo preparar el video

El video **no se reproduce**: su tiempo avanza con el scroll. Al bajar, la persona corre; al subir, retrocede. Para que se sienta fluido en el celular el video debe estar preparado así.

## Reglas
- **Sin audio**, 6 a 10 segundos, 24 fotogramas por segundo.
- **Un fotograma clave por cuadro** (`-g 1`). Es lo más importante: sin eso el navegador salta a trompicones al buscar un instante.
- Cámara fija o con movimiento suave, fondo sencillo y la persona avanzando de forma continua. Mejor que el primer y el último cuadro se parezcan.
- Formato MP4 (H.264). WebM también funciona.
- Peso: computador menos de 12 MB; celular menos de 6 MB. El límite del sitio es 25 MB.

## Comandos (FFmpeg)
Computador, horizontal 1080p:

```bash
ffmpeg -i corredor.mp4 -an -vf "fps=24,scale=-2:1080" -c:v libx264 -preset slow -crf 27 -g 1 -pix_fmt yuv420p -movflags +faststart corredor-pc.mp4
```

Celular, vertical 540 × 960 (recorta el centro del video horizontal):

```bash
ffmpeg -i corredor.mp4 -an -vf "fps=24,crop=ih*9/16:ih,scale=540:960" -c:v libx264 -preset slow -crf 29 -g 1 -pix_fmt yuv420p -movflags +faststart corredor-movil.mp4
```

Imagen de respaldo (primer cuadro):

```bash
ffmpeg -i corredor.mp4 -vf "scale=1280:-2" -frames:v 1 corredor-poster.jpg
```

Si pesa demasiado, sube `-crf` (28, 30) o baja a 720p (`scale=-2:720`).

## Subirlo
Administración → Ajustes → **Fondo en movimiento**: sube el video de computador, el de celular y la imagen de respaldo, activa la casilla y ajusta el velo. Se aplica a la tienda principal y a las secciones de los mayoristas.

## Qué hace el sitio por ti
- En celulares (menos de 768 px) usa el video vertical; si no hay, el horizontal.
- Con "reducir movimiento" activado en el dispositivo, o con ahorro de datos, solo muestra la imagen fija.
- El video se descarga después de pintar la página, para no frenar la carga.
- El velo sobre el video mantiene el texto legible; las barras de marca se vuelven translúcidas.

## Dónde conseguir el video
Usa un video tuyo o con licencia de uso comercial. No se incluye ninguno en el proyecto.
