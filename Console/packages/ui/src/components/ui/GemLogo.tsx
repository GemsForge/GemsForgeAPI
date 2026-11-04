import { styled, Text, XStack, YStack } from "tamagui";
import logoSource from "../../assets/brand/gemsforge-primary-logo.png";

const LogoMark = styled(YStack, {
  width: 36,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "$gemControl",
  backgroundColor: "$wireframePanel",
});

export function GemLogo({ compact = false }: { compact?: boolean } = {}) {
  return (
    <XStack alignItems="center" gap="$2" aria-label="GemLife Console" className={compact ? "gem-logo-compact" : undefined}>
      <LogoMark aria-hidden>
        <img src={logoSource} width={32} height={32} alt="GemLife Console logo" style={{ objectFit: "contain" }} />
      </LogoMark>
      {!compact ? <Text color="$wireframeHeading" fontSize="$4" fontWeight="700">GemLife Console</Text> : null}
    </XStack>
  );
}
