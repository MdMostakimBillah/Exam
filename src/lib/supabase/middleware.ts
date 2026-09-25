import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const needsRole =
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/student/dashboard') ||
    pathname.startsWith('/student/payments') ||
    pathname.startsWith('/i')

  // H5: knowing "someone is signed in" is not authorization. Every guarded
  // area also checks WHICH role the caller has (RLS is the real boundary;
  // this just stops the obvious "any account can open /super-admin" path).
  let role: string | null = null
  if (user && needsRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    role = profile?.role ? String(profile.role).toLowerCase() : null
  }

  const isStudent = role === 'student'
  const isStaff =
    role === 'institution_admin' || role === 'staff' || role === 'viewer' || role === 'super_admin'

  const redirect = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    return NextResponse.redirect(url)
  }

  // Protect super-admin routes (super_admin only)
  if (pathname.startsWith('/super-admin')) {
    if (!user) return redirect('/login')
    if (role !== 'super_admin') return redirect(isStudent ? '/student/dashboard' : '/i')
  }

  // Protect institution routes (except root /i which handles its own auth)
  if (pathname.match(/^\/i\/[^/]+/)) {
    if (!user) return redirect('/login')
    if (isStudent) return redirect('/student/dashboard')
    if (!isStaff) return redirect('/login')
  }

  // Protect student dashboard and payments routes (students only)
  if (pathname.startsWith('/student/dashboard') || pathname.startsWith('/student/payments')) {
    if (!user) return redirect('/student/login')
    if (!isStudent) return redirect(role === 'super_admin' ? '/super-admin' : '/i')
  }

  // If a signed-in super admin opens /i, send them to their own dashboard.
  if (pathname.startsWith('/i') && role === 'super_admin') {
    return redirect('/super-admin')
  }

  return supabaseResponse
}
