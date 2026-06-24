export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      {children}
    </div>
  )
}
