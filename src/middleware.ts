import { NextResponse, type NextRequest } from 'next/server';

// Guests (no session cookie) get the server-rendered public landing page at "/";
// signed-in users keep the app shell at "/".
export function middleware(req: NextRequest) {
  if (req.cookies.get('token')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/landing';
  return NextResponse.rewrite(url);
}

export const config = { matcher: '/' };
