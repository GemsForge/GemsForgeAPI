interface NoticeProps {
  message: string | null;
  kind?: "error" | "success";
}

export function Notice({ message, kind = "error" }: NoticeProps) {
  if (!message) return null;
  return <div className={`notice ${kind}`}>{message}</div>;
}
