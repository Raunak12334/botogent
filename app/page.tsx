import Link from "next/link"
import { auth, currentUser } from "@clerk/nextjs/server"
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs"
import {
  ShieldCheck,
  Sparkles,
  Lock,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  User,
  Layers,
  Code2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function Page() {
  const { isAuthenticated, userId } = await auth()
  const user = isAuthenticated ? await currentUser() : null

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <span className="font-heading font-semibold tracking-tight text-base sm:text-lg">
                Botogent
              </span>
              <span className="ml-2 hidden text-xs font-mono text-muted-foreground sm:inline-block">
                Next.js 16 + Clerk
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">
                  Get Started
                </Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="hidden sm:inline-flex gap-1 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Authenticated
                </Badge>
                <UserButton />
              </div>
            </Show>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Show when="signed-in">
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
                Welcome back, {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Explorer"}!
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                You are securely signed in. Your Clerk authentication session is active.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2 border-border/60 shadow-xs">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="size-5 text-primary" />
                    Account Profile
                  </CardTitle>
                  <CardDescription>
                    Information resolved from server-side session and currentUser()
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1">
                      <span className="text-xs text-muted-foreground block font-medium">User ID</span>
                      <code className="text-xs font-mono font-semibold break-all">{userId}</code>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1">
                      <span className="text-xs text-muted-foreground block font-medium">Primary Email</span>
                      <span className="text-xs font-medium truncate block">
                        {user?.primaryEmailAddress?.emailAddress ?? "No email linked"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Auth Architecture</span>
                      <Badge variant="secondary" className="text-xs">Next.js 16 Proxy + Server Components</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Session tokens and user permissions are validated with Clerk&apos;s async <code className="font-mono text-foreground font-semibold">auth()</code> and middleware runner in <code className="font-mono text-foreground font-semibold">proxy.ts</code>.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-xs flex flex-col justify-between">
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="size-5 text-primary" />
                      Quick Controls
                    </CardTitle>
                    <CardDescription>
                      Manage identity and test features
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Dark mode toggle</span>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">d</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Theming</span>
                      <span className="text-xs font-medium text-foreground">@clerk/ui (shadcn)</span>
                    </div>
                  </CardContent>
                </div>
                <div className="p-4 pt-0">
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" render={<Link href="/sign-in" />} className="w-full justify-between">
                      <span>Sign-in Page Route</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" render={<Link href="/sign-up" />} className="w-full justify-between">
                      <span>Sign-up Page Route</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Show>

        <Show when="signed-out">
          <div className="space-y-12 py-4">
            {/* Hero Section */}
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <Badge variant="outline" className="px-3 py-1 text-xs gap-1.5 border-primary/20 bg-primary/5 text-primary">
                <Sparkles className="size-3.5" />
                Authentication Powered by Clerk
              </Badge>
              <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight">
                Secure Authentication for Botogent
              </h1>
              <p className="text-muted-foreground text-sm sm:text-lg leading-relaxed">
                Full-featured authentication setup with Next.js 16 App Router, styled with Base UI &amp; Shadcn components.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <SignInButton mode="modal">
                  <Button size="lg" className="px-6">
                    Sign in to test
                    <ArrowRight className="size-4 ml-1" />
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button variant="outline" size="lg" className="px-6">
                    Create account
                  </Button>
                </SignUpButton>
              </div>
              <p className="text-xs font-mono text-muted-foreground pt-1">
                Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">d</kbd> anywhere to toggle dark mode
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/60 shadow-xs">
                <CardHeader>
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <KeyRound className="size-5" />
                  </div>
                  <CardTitle>Prebuilt Auth Components</CardTitle>
                  <CardDescription>
                    Complete Sign In, Sign Up, and User Profile controls seamlessly embedded in your app.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border/60 shadow-xs">
                <CardHeader>
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Layers className="size-5" />
                  </div>
                  <CardTitle>Shadcn Theming</CardTitle>
                  <CardDescription>
                    Styled using <code className="text-xs font-mono">@clerk/ui</code> with matching design tokens and dark mode support.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border/60 shadow-xs sm:col-span-2 lg:col-span-1">
                <CardHeader>
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Code2 className="size-5" />
                  </div>
                  <CardTitle>Next.js 16 Proxy Architecture</CardTitle>
                  <CardDescription>
                    Configured with Next.js 16 <code className="text-xs font-mono">proxy.ts</code> middleware for fast edge protection and async auth.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </Show>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <div className="container mx-auto px-4">
          Botogent &bull; Next.js 16 &bull; Clerk Auth &bull; Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">d</kbd> for Dark Theme
        </div>
      </footer>
    </div>
  )
}
