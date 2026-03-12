export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">EVA</h1>
          <p className="text-sm text-muted-foreground mt-1">AI Content Engine</p>
        </div>
        {children}
      </div>
    </div>
  )
}
