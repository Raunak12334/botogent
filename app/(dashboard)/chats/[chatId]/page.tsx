type ChatPageProps = {
  params: Promise<{
    chatId: string
  }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params

  return <p className="p-4 text-foreground">{chatId}</p>
}
