# Changelog — Modal QR Code PIX no Dashboard

- Novo componente único e reutilizável `PixQrCodeDialog`
  (`apps/web/src/components/shared/PixQrCodeDialog.tsx`): imagem estática do
  asset `qrcode-pix.png` centralizada (256×256, `rounded-xl` + borda) e botão
  **Fechar** no rodapé.
- Botão **QR Code PIX** (`outline`, ícone `QrCode` à esquerda) no header do
  Dashboard, imediatamente à esquerda de "Novo associado". Sem gate de
  permissão (leitura do QR é livre); "Novo associado" mantém
  `members.create`.
- Caminho do asset centralizado em `QR_CODE_PIX_PATH`
  (`apps/web/src/constants/index.ts`), seguindo o padrão do `LOGO_PATH`.
- Fechamento por botão, `ESC` e overlay (Radix). Nenhum endpoint, permissão
  ou schema alterado.
- Validação: `pnpm --filter @amococ/web typecheck` e
  `pnpm --filter @amococ/web build` limpos; smoke no navegador (login
  `amococ`, aba Dashboard) confirmando ícone/ordem, carregamento da
  imagem e fechamento.
