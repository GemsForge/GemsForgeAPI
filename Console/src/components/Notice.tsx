import { Paragraph, YStack } from "tamagui";

interface NoticeProps {
  message: string | null;
  kind?: "error" | "success";
}

export function Notice({ message, kind = "error" }: NoticeProps) {
  if (!message) return null;
  return (
    <YStack
      className={`notice ${kind}`}
      marginBottom="$3"
      padding="$3"
      borderRadius="$3"
      backgroundColor={kind === "success" ? "$gemMintDark" : "$gemDanger"}
    >
      <Paragraph color="$gemInk" fontSize="$3">
        {message}
      </Paragraph>
    </YStack>
  );
}
