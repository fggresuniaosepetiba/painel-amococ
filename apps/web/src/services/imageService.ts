import { ACCEPTED_IMAGE_TYPES } from "@/constants";

/**
 * Serviço de imagens: validação, leitura e otimização local.
 * Uso para fotos de associados e assinatura oficial.
 */
export interface ProcessedImage {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = dataUrl;
  });
}

export const imageService = {
  isAcceptedType(file: File): boolean {
    return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  },

  validate(file: File, maxSizeBytes: number): string | null {
    if (!this.isAcceptedType(file)) {
      return "Formato inválido. Use PNG, JPG ou JPEG.";
    }
    if (file.size > maxSizeBytes) {
      return "Arquivo muito grande. Reduza o tamanho e tente novamente.";
    }
    return null;
  },

  async read(file: File): Promise<string> {
    return readAsDataUrl(file);
  },

  /**
   * Redimensiona preservando proporção (cover/contain) e gera data URL.
   * Usado para fotos de associado (quadrado/retângulo).
   */
  async resizePhoto(file: File, maxSize = 480): Promise<ProcessedImage> {
    const original = await readAsDataUrl(file);
    const img = await loadImage(original);
    const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("IMAGE_CANVAS_FAILED");
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return {
      dataUrl,
      mimeType: "image/jpeg",
      sizeBytes: Math.round((dataUrl.length * 3) / 4),
    };
  },

  /**
   * Processa assinatura preservando transparência quando houver.
   * PNG permanece PNG; JPG permanece JPG.
   */
  async resizeSignature(file: File, maxWidth = 700): Promise<ProcessedImage> {
    const original = await readAsDataUrl(file);
    const img = await loadImage(original);
    const ratio = Math.min(maxWidth / img.width, 1);
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("IMAGE_CANVAS_FAILED");
    // Fundo transparente para preservar eventual transparência do PNG
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const keepPng = file.type === "image/png";
    const dataUrl = canvas.toDataURL(keepPng ? "image/png" : "image/jpeg", 0.92);
    return {
      dataUrl,
      mimeType: keepPng ? "image/png" : "image/jpeg",
      sizeBytes: Math.round((dataUrl.length * 3) / 4),
    };
  },

  /**
   * Recorta as bordas vazias de uma imagem (fundo transparente OU branco),
   * aproximando a tinta até as bordas. É o que faz a assinatura "colar"
   * na linha da carteirinha mesmo quando o arquivo enviado tem muito
   * espaço em branco. Se quase nada for recortado, devolve o original.
   */
  async trimSignature(dataUrl: string): Promise<string> {
    try {
      const img = await loadImage(dataUrl);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (width < 8 || height < 8) return dataUrl;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, width, height);

      // Pixel é "vazio": transparente ou praticamente branco.
      const isBlank = (i: number): boolean => {
        if (data[i + 3] < 24) return true;
        return data[i] >= 246 && data[i + 1] >= 246 && data[i + 2] >= 246;
      };

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          if (!isBlank((row + x) * 4)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return dataUrl; // imagem totalmente vazia

      const margin = 3;
      minX = Math.max(0, minX - margin);
      minY = Math.max(0, minY - margin);
      maxX = Math.min(width - 1, maxX + margin);
      maxY = Math.min(height - 1, maxY + margin);
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      if (cropW * cropH > width * height * 0.95) return dataUrl; // nada a recortar

      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext("2d");
      if (!outCtx) return dataUrl;
      outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      const keepPng = dataUrl.startsWith("data:image/png");
      return out.toDataURL(keepPng ? "image/png" : "image/jpeg", 0.95);
    } catch {
      return dataUrl;
    }
  },

  /**
   * Baixa um data URL de forma confiável convertendo para Blob.
   * (Anchors com data URLs muito grandes podem ser bloqueados.)
   */
  downloadDataUrl(dataUrl: string, fileName: string): Promise<void> {
    const trigger = (href: string, revoke: boolean) => {
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (revoke) {
        window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
      }
    };

    if (dataUrl.startsWith("data:")) {
      return fetch(dataUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          trigger(url, true);
        });
    }
    trigger(dataUrl, false);
    return Promise.resolve();
  },
};
