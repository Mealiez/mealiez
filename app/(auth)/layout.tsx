export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 
                    flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* App name above form */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">
            Mealiez
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Mess management, simplified.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
