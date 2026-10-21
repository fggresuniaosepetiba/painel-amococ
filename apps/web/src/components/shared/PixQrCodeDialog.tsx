import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QR_CODE_PIX_PATH } from "@/constants";

interface PixQrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Modal de leitura do QR Code PIX da associação (imagem estática do asset). */
export function PixQrCodeDialog({ open, onOpenChange }: PixQrCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" showClose={false}>
        <DialogHeader className="border-b-0 pr-6 pb-0 text-center">
          <DialogTitle>QR Code PIX</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex items-center justify-center">
          <img
            src={QR_CODE_PIX_PATH}
            alt="QR Code PIX da AMOCOC"
            width={256}
            height={256}
            className="h-64 w-64 rounded-xl border border-slate-200 bg-white object-contain"
          />
        </DialogBody>

        <DialogFooter className="justify-center border-t-0 bg-transparent pt-0 sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
