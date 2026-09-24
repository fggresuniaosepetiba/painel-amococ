import { useRef, useState } from "react";
import { Camera, Trash2, Upload, User } from "lucide-react";
import { imageService } from "@/services/imageService";
import { MAX_PHOTO_SIZE } from "@/constants";
import { useToast } from "@/hooks/ToastProvider";
import { cn } from "@/utils/cn";

interface PhotoUploaderProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function PhotoUploader({
  value,
  onChange,
  disabled,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const validation = imageService.validate(file, MAX_PHOTO_SIZE);
    if (validation) {
      toast.error("Imagem inválida", validation);
      return;
    }
    setLoading(true);
    try {
      const processed = await imageService.resizePhoto(file, 480);
      onChange(processed.dataUrl);
    } catch {
      toast.error("Não foi possível ler a imagem", "Tente outro arquivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-5">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex h-32 w-26 w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition",
          value
            ? "border-brand-300"
            : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40",
          (disabled || loading) && "opacity-60"
        )}
        aria-label="Selecionar foto"
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Pré-visualização da foto"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-ink-950/60 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="h-5 w-5" />
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-slate-400">
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            ) : (
              <>
                <User className="h-7 w-7" />
                <Upload className="h-3.5 w-3.5" />
              </>
            )}
          </span>
        )}
      </button>

      <div className="min-w-0 pt-1">
        <p className="text-[13px] font-medium text-slate-700">Foto do associado</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          PNG, JPG ou JPEG de até 4 MB. A foto é redimensionada
          automaticamente sem distorção.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-ring disabled:opacity-50"
          >
            {value ? "Substituir foto" : "Selecionar foto"}
          </button>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus-ring disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
